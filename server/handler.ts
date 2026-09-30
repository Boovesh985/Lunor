/**
 * Turns a stage definition into a Vercel Function (Web standard `fetch`).
 * Validates input, picks the provider and key (see providers.ts), applies
 * rate limits, and streams the model's output as NDJSON:
 *
 *   {"type":"meta","model":"claude-opus-5-5","mock":false}
 *   {"type":"thinking","text":"…"}        ← summarized reasoning, live
 *   {"type":"text","text":"…"}            ← JSON or <file> blocks
 *   {"type":"done","stopReason":"end_turn","usage":{…}}
 */
import { z } from 'zod';
import type { StreamEvent } from '../shared/schemas.ts';
import { streamClaude, toErrorEvent } from './claude.ts';
import { streamGemini } from './gemini.ts';
import { mockStream } from './mock.ts';
import { chooseProvider, modelFor } from './providers.ts';
import { clientIp, takeRateLimit } from './rateLimit.ts';
import type { StageDefinition } from './stages.ts';

const MAX_BODY_BYTES = 900_000;
export const USER_KEY_HEADER = 'x-user-anthropic-key';

export function jsonError(status: number, code: string, message: string, headers: Record<string, string> = {}): Response {
  return Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

export function ndjsonResponse(events: AsyncIterable<StreamEvent>, meta: StreamEvent): Response {
  const encoder = new TextEncoder();
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      let lastWrite = Date.now();
      const write = (event: StreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          lastWrite = Date.now();
        } catch {
          open = false; // client went away
        }
      };
      write(meta);
      // Keep intermediaries from treating a long think as an idle connection.
      heartbeat = setInterval(() => {
        if (Date.now() - lastWrite > 10_000) write({ type: 'ping' });
      }, 5_000);
      try {
        for await (const event of events) {
          write(event);
          if (!open) break;
        }
      } catch (error) {
        write(toErrorEvent(error));
      } finally {
        clearInterval(heartbeat);
        if (open) controller.close();
      }
    },
    cancel() {
      clearInterval(heartbeat);
    },
  });

  return new Response(body, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}

export function createStageHandler<T>(stage: StageDefinition<T>) {
  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method !== 'POST') return jsonError(405, 'method_not_allowed', 'Use POST.');

      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) return jsonError(413, 'too_large', 'This project is too large to send in one request.');

      let body: T;
      try {
        body = stage.schema.parse(JSON.parse(raw));
      } catch (error) {
        const message = error instanceof z.ZodError ? z.prettifyError(error) : 'The request body must be valid JSON.';
        return jsonError(400, 'invalid_request', message);
      }

      const userKey = request.headers.get(USER_KEY_HEADER)?.trim() ?? '';
      const choice = chooseProvider(userKey);

      if (!choice) {
        return jsonError(
          503,
          'no_api_key',
          'Live AI is not configured on this deployment. Add your own Anthropic API key in Settings, or open one of the instant demos.',
        );
      }

      if (choice.serverKey) {
        const limit = takeRateLimit(clientIp(request), stage.cost);
        if (!limit.ok) {
          return jsonError(
            429,
            'rate_limited',
            `You've reached this demo's AI limit. Try again in ${Math.ceil(limit.retryAfter / 60)} min, or add your own API key in Settings.`,
            { 'retry-after': String(limit.retryAfter) },
          );
        }
      }

      const model = modelFor(choice.provider);
      let events: AsyncIterable<StreamEvent>;
      if (choice.provider === 'mock') {
        events = mockStream(stage.name, body, request.signal);
      } else {
        const call = { ...stage.build(body), apiKey: choice.apiKey, model, signal: request.signal };
        events = choice.provider === 'gemini' ? streamGemini(call) : streamClaude(call);
      }

      return ndjsonResponse(events, { type: 'meta', model, mock: choice.provider === 'mock' });
    },
  };
}
