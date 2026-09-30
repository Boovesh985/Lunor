/**
 * Google Gemini as a fallback provider, used when a deployment has no
 * Anthropic key but has GEMINI_API_KEY (Gemini's API has a free tier).
 *
 * Stages are written once, in Claude's message shape (server/stages.ts). This
 * adapter maps that call onto `models.generateContentStream` and yields the
 * same provider-neutral StreamEvents, so the client can't tell the difference:
 * - system prompt → `systemInstruction`
 * - effort → `thinkingConfig.thinkingLevel`, with thought summaries streamed
 *   as `thinking` events
 * - JSON stages → `responseJsonSchema`, generated from the same Zod schema
 *
 * Free-tier models are sometimes overloaded (503) or out of quota (429). The
 * free quota is small and counted per model (e.g. 20 requests a day), so a
 * failed request is retried once and then fails over to the next model in the
 * chain. If the failure happens mid-answer, a `restart` event tells the client
 * to discard the partial output first.
 */
import { ApiError, FinishReason, GoogleGenAI, ThinkingLevel, type Content, type GenerateContentConfig } from '@google/genai';
import { z } from 'zod';
import type { StreamEvent } from '../shared/schemas.ts';
import type { Effort } from './claude.ts';
import type { StageCall } from './stages.ts';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
/**
 * Other free-tier Flash models to try, in order, when the preferred one can't
 * serve a request. Each has its own daily quota, so a longer chain means more
 * free requests per day. All of them accept the same Gemini 3 config
 * (thinkingLevel, responseJsonSchema).
 */
export const DEFAULT_GEMINI_FALLBACKS = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview'];

/** Gemini 3.x Flash models cap a response at 65,536 tokens (thinking included). */
const MAX_OUTPUT_TOKENS = 65_536;

export function resolveGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

/** Fallback models from GEMINI_FALLBACK_MODELS (comma-separated; empty disables failover). */
export function geminiFallbackModels(env: Record<string, string | undefined> = process.env): string[] {
  const configured = env.GEMINI_FALLBACK_MODELS;
  if (configured === undefined) return DEFAULT_GEMINI_FALLBACKS;
  return configured
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
}

const THINKING_LEVELS: Record<Effort, ThinkingLevel> = {
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

const schemaCache = new WeakMap<z.ZodType, Record<string, unknown>>();

/**
 * JSON Schema for `responseJsonSchema`. Zod's own conversion keeps enums and
 * numeric bounds, which Gemini supports; only the `$schema` marker is dropped.
 */
export function geminiJsonSchema(schema: z.ZodType): Record<string, unknown> {
  let json = schemaCache.get(schema);
  if (!json) {
    const { $schema: _dialect, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
    json = rest;
    schemaCache.set(schema, json);
  }
  return json;
}

/**
 * Claude-shaped messages → Gemini contents. Consecutive turns with the same
 * role (e.g. two questions in a row after a failed reply) are merged, so the
 * conversation always alternates between user and model.
 */
export function toGeminiContents(messages: StageCall['messages']): Content[] {
  const contents: Content[] = [];
  for (const message of messages) {
    const role = message.role === 'assistant' ? 'model' : 'user';
    const parts =
      typeof message.content === 'string'
        ? [{ text: message.content }]
        : message.content.flatMap((block) => (block.type === 'text' ? [{ text: block.text }] : []));
    if (parts.length === 0) continue;
    const previous = contents.at(-1);
    if (previous?.role === role) previous.parts!.push(...parts);
    else contents.push({ role, parts });
  }
  return contents;
}

export function toGeminiConfig(call: StageCall, signal?: AbortSignal): GenerateContentConfig {
  return {
    systemInstruction: call.system,
    maxOutputTokens: Math.min(call.maxTokens, MAX_OUTPUT_TOKENS),
    thinkingConfig: { includeThoughts: true, thinkingLevel: THINKING_LEVELS[call.effort] },
    ...(call.outputSchema ? { responseMimeType: 'application/json', responseJsonSchema: geminiJsonSchema(call.outputSchema) } : {}),
    ...(signal ? { abortSignal: signal } : {}),
  };
}

const BLOCKED = new Set<string>([
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
  FinishReason.RECITATION,
]);

const declined = (): Extract<StreamEvent, { type: 'error' }> => ({
  type: 'error',
  code: 'refusal',
  message: 'Gemini declined this request. Try rephrasing your idea — Lunor App Studio is for building everyday apps.',
});

export interface GeminiRequest extends StageCall {
  apiKey: string;
  /** Preferred model; `fallbackModels` are tried after it. */
  model: string;
  fallbackModels?: string[];
  signal?: AbortSignal;
  /**
   * Stall watchdog: how long to wait for the first chunk and between chunks,
   * and the total time after which no further model is tried.
   */
  timeouts?: { firstChunkMs: number; idleMs: number; budgetMs?: number };
}

/**
 * Busy free-tier servers occasionally accept a request and then go silent.
 * Thought summaries stream while the model thinks, so a long silence means a
 * stalled connection: abort it and try the next model — unless the request
 * has used most of the 300 s function limit, in which case it reports the
 * failure instead of starting an answer it can't finish.
 */
const DEFAULT_TIMEOUTS = { firstChunkMs: 75_000, idleMs: 60_000, budgetMs: 280_000 };

type GeminiClient = Pick<GoogleGenAI, 'models'>;

/** Overloaded, out of quota, or not available to this key: worth trying another model. */
const FAIL_OVER = new Set([404, 429, 500, 503, 504]);

/**
 * Busy free-tier models sometimes accept a request and then cut the stream
 * off with an error payload; the SDK reports that as an incomplete segment.
 */
const CUT_OFF = /Incomplete JSON segment|high demand|UNAVAILABLE/i;

function canFailOver(error: unknown): boolean {
  if (error instanceof ApiError) return FAIL_OVER.has(error.status);
  return error instanceof Error && CUT_OFF.test(error.message);
}

export async function* streamGemini(req: GeminiRequest, client?: GeminiClient): AsyncGenerator<StreamEvent> {
  const ai =
    client ??
    new GoogleGenAI({
      apiKey: req.apiKey,
      // One quick retry on the same model for transient server errors.
      httpOptions: { retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 3, httpStatusCodes: [500, 503, 504] } },
    });
  const models = [...new Set([req.model, ...(req.fallbackModels ?? geminiFallbackModels())])];

  const timeouts = req.timeouts ?? DEFAULT_TIMEOUTS;
  const started = Date.now();
  // Another model only makes sense if it still has time to start answering.
  const timeLeftForAnother = () => timeouts.budgetMs === undefined || Date.now() - started < timeouts.budgetMs - timeouts.firstChunkMs;

  for (const [index, model] of models.entries()) {
    let streamed = false;
    // Per-attempt abort: the caller's cancel, or our stall watchdog.
    const attempt = new AbortController();
    const cancel = () => attempt.abort();
    req.signal?.addEventListener('abort', cancel, { once: true });
    let stalled = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const arm = (ms: number) => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        stalled = true;
        attempt.abort();
      }, ms);
    };

    try {
      // Tell the client which model is actually answering.
      if (index > 0) yield { type: 'meta', model, mock: false };
      arm(timeouts.firstChunkMs);
      const stream = await ai.models.generateContentStream({
        model,
        contents: toGeminiContents(req.messages),
        config: toGeminiConfig(req, attempt.signal),
      });

      let finish: string | undefined;
      let input = 0;
      let output = 0;
      for await (const chunk of stream) {
        arm(timeouts.idleMs);
        if (chunk.promptFeedback?.blockReason) {
          yield declined();
          return;
        }
        const candidate = chunk.candidates?.[0];
        for (const part of candidate?.content?.parts ?? []) {
          if (!part.text) continue;
          streamed = true;
          yield part.thought ? { type: 'thinking', text: part.text } : { type: 'text', text: part.text };
        }
        finish = candidate?.finishReason ?? finish;
        if (chunk.usageMetadata) {
          input = chunk.usageMetadata.promptTokenCount ?? input;
          output = (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0);
        }
      }

      if (finish && BLOCKED.has(finish)) {
        yield declined();
        return;
      }
      yield { type: 'done', stopReason: finish === FinishReason.MAX_TOKENS ? 'max_tokens' : 'end_turn', usage: { input, output } };
      return;
    } catch (error) {
      const next = models[index + 1];
      if (next && !req.signal?.aborted && (stalled || canFailOver(error)) && timeLeftForAnother()) {
        // The client discards whatever this model already streamed.
        if (streamed) yield { type: 'restart', model: next, reason: `${model} stopped mid-answer; continuing on ${next}.` };
        continue;
      }
      yield stalled && !req.signal?.aborted ? stalledError() : toGeminiErrorEvent(error, req.signal);
      return;
    } finally {
      clearTimeout(watchdog);
      req.signal?.removeEventListener('abort', cancel);
    }
  }
}

const stalledError = (): Extract<StreamEvent, { type: 'error' }> => ({
  type: 'error',
  code: 'overloaded',
  message: "Gemini's free tier stopped responding. Please try again in a minute.",
});

/** Map Gemini API errors to messages a student can act on (same codes as the Claude path). */
export function toGeminiErrorEvent(error: unknown, signal?: AbortSignal): Extract<StreamEvent, { type: 'error' }> {
  if (signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
    return { type: 'error', code: 'aborted', message: 'Request cancelled.' };
  }
  if (error instanceof ApiError) {
    const invalidKey = /api key/i.test(error.message);
    if (error.status === 401 || error.status === 403 || invalidKey) {
      return { type: 'error', code: 'auth', message: 'The Gemini API key was rejected. Check GEMINI_API_KEY on the server.' };
    }
    if (error.status === 404) {
      return { type: 'error', code: 'not_found', message: `Model not found. Check GEMINI_MODEL (currently "${resolveGeminiModel()}").` };
    }
    if (error.status === 429) {
      // Free-tier quotas are per minute and per day; the error names the one that ran out.
      const daily = /PerDay/i.test(error.message);
      return {
        type: 'error',
        code: 'rate_limit',
        message: daily
          ? "Today's free Gemini quota for this demo is used up (it resets daily). Open an instant demo, or add your own Anthropic API key in Settings to keep building."
          : "Gemini's free tier is rate-limiting this demo right now. Wait a minute and try again, or add your own Anthropic API key in Settings.",
      };
    }
    if (error.status === 400) {
      return { type: 'error', code: 'bad_request', message: error.message || 'The request was rejected by the Gemini API.' };
    }
    if (error.status >= 500) {
      return { type: 'error', code: 'overloaded', message: 'Gemini is temporarily overloaded. Please retry in a moment.' };
    }
    return { type: 'error', code: 'api', message: error.message };
  }
  if (error instanceof Error && CUT_OFF.test(error.message)) {
    return { type: 'error', code: 'overloaded', message: "Gemini's free tier is busy and stopped mid-answer. Please try again in a minute." };
  }
  if (error instanceof TypeError) {
    return { type: 'error', code: 'network', message: 'Could not reach the Gemini API. Check the server network connection.' };
  }
  return { type: 'error', code: 'unknown', message: error instanceof Error ? error.message : 'Unexpected error while talking to Gemini.' };
}
