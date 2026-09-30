/**
 * Claude access for every pipeline stage, via the official Anthropic SDK.
 *
 * - Model: claude-opus-5-5 by default (override with ANTHROPIC_MODEL).
 * - Thinking is adaptive (always on for this model); we request *summarized*
 *   thinking so the UI can show learners how the AI reasons, live.
 * - `effort` is the latency/cost dial, tuned per stage.
 * - Structured stages pass a JSON-schema output format (from our Zod schemas).
 * - Safety-classifier refusals fall back server-side (`fallbacks: 'default'`).
 *
 * The generator yields a tiny, provider-neutral event stream that the HTTP
 * layer serialises as NDJSON.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { BetaJSONOutputFormat, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { StreamEvent } from '../shared/schemas.js';

export const DEFAULT_MODEL = 'claude-opus-5-5';

export type Effort = 'low' | 'medium' | 'high';

export interface ClaudeRequest {
  apiKey: string;
  model: string;
  system: string;
  messages: BetaMessageParam[];
  maxTokens: number;
  effort: Effort;
  format?: BetaJSONOutputFormat;
  signal?: AbortSignal;
}

export function resolveModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export async function* streamClaude(req: ClaudeRequest): AsyncGenerator<StreamEvent> {
  const client = new Anthropic({ apiKey: req.apiKey, maxRetries: 2, timeout: 295_000 });

  try {
    const stream = client.beta.messages.stream(
      {
        model: req.model,
        max_tokens: req.maxTokens,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive', display: 'summarized' },
        output_config: { effort: req.effort, ...(req.format ? { format: req.format } : {}) },
        // The system prompt is identical for every user of a stage, so cache it.
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        messages: req.messages,
      },
      { signal: req.signal },
    );

    for await (const event of stream) {
      if (event.type !== 'content_block_delta') continue;
      if (event.delta.type === 'thinking_delta' && event.delta.thinking) {
        yield { type: 'thinking', text: event.delta.thinking };
      } else if (event.delta.type === 'text_delta' && event.delta.text) {
        yield { type: 'text', text: event.delta.text };
      }
    }

    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') {
      yield {
        type: 'error',
        code: 'refusal',
        message: 'Claude declined this request. Try rephrasing your idea — Lunor App Studio is for building everyday apps.',
      };
      return;
    }
    yield {
      type: 'done',
      stopReason: message.stop_reason,
      usage: { input: message.usage.input_tokens, output: message.usage.output_tokens },
    };
  } catch (error) {
    yield toErrorEvent(error);
  }
}

/** Map SDK errors (most specific first) to messages a student can act on. */
export function toErrorEvent(error: unknown): Extract<StreamEvent, { type: 'error' }> {
  if (error instanceof Anthropic.APIUserAbortError) {
    return { type: 'error', code: 'aborted', message: 'Request cancelled.' };
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return { type: 'error', code: 'auth', message: 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY on the server, or the key in Settings.' };
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return { type: 'error', code: 'permission', message: 'This API key does not have access to the requested model.' };
  }
  if (error instanceof Anthropic.NotFoundError) {
    return { type: 'error', code: 'not_found', message: `Model not found. Check ANTHROPIC_MODEL (currently "${resolveModel()}").` };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { type: 'error', code: 'rate_limit', message: 'Claude is rate-limiting this key right now. Wait a minute and try again.' };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { type: 'error', code: 'bad_request', message: error.message || 'The request was rejected by the API.' };
  }
  if (error instanceof Anthropic.InternalServerError) {
    return { type: 'error', code: error.status === 529 ? 'overloaded' : 'server', message: 'Claude is temporarily overloaded. Please retry in a moment.' };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { type: 'error', code: 'network', message: 'Could not reach the Anthropic API. Check the server network connection.' };
  }
  if (error instanceof Anthropic.APIError) {
    return { type: 'error', code: 'api', message: error.message };
  }
  return { type: 'error', code: 'unknown', message: error instanceof Error ? error.message : 'Unexpected error while talking to Claude.' };
}
