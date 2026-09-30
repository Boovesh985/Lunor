/**
 * Client for the NDJSON streaming endpoints in /api. Every AI stage — and
 * the sample replays used by demos — produce the same callbacks, so the
 * Studio has a single code path for "live" and "instant demo" projects.
 */
import type { StreamEvent } from '../../shared/schemas.ts';
import { useSettings } from './settings';

export class AIError extends Error {
  constructor(
    readonly code: string,
    message: string,
    /** Output received before the failure (lets a build resume). */
    readonly partialText = '',
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export interface StreamHandlers {
  onMeta?(meta: { model: string; mock: boolean }): void;
  onThinking?(delta: string, all: string): void;
  onText?(delta: string, all: string): void;
}

export interface StreamResult {
  text: string;
  thinking: string;
  stopReason: string | null;
  model: string;
  /** True when the stream ended without a `done` event (e.g. a timeout). */
  interrupted: boolean;
}

export type AIEndpoint = 'understand' | 'plan' | 'build' | 'explain' | 'learn' | 'chat';

export async function streamAI(endpoint: AIEndpoint, body: unknown, handlers: StreamHandlers, signal?: AbortSignal): Promise<StreamResult> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const userKey = useSettings.getState().userApiKey.trim();
  if (userKey) headers['x-user-anthropic-key'] = userKey;

  let response: Response;
  try {
    response = await fetch(`/api/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body), signal });
  } catch {
    if (signal?.aborted) throw new AIError('aborted', 'Cancelled.');
    throw new AIError('network', 'Could not reach the Lunor server. Check your connection and try again.');
  }

  if (!response.ok || !response.body) {
    let code = `http_${response.status}`;
    let message = `The server responded with ${response.status}.`;
    try {
      const data = (await response.json()) as { error?: { code?: string; message?: string } };
      code = data.error?.code ?? code;
      message = data.error?.message ?? message;
    } catch {
      /* not JSON */
    }
    throw new AIError(code, message);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let text = '';
  let thinking = '';
  let model = '';
  let stopReason: string | null = null;
  let finished = false;

  const handle = (event: StreamEvent) => {
    switch (event.type) {
      case 'meta':
        model = event.model;
        handlers.onMeta?.(event);
        break;
      case 'thinking':
        thinking += event.text;
        handlers.onThinking?.(event.text, thinking);
        break;
      case 'text':
        text += event.text;
        handlers.onText?.(event.text, text);
        break;
      case 'restart':
        // Everything shown so far is derived from the accumulated text, so
        // clearing it resets partial JSON, streamed files and reasoning alike.
        text = '';
        thinking = '';
        model = event.model;
        handlers.onText?.('', '');
        handlers.onThinking?.('', '');
        handlers.onMeta?.({ model: event.model, mock: false });
        break;
      case 'done':
        stopReason = event.stopReason;
        finished = true;
        break;
      case 'error':
        throw new AIError(event.code, event.message, text);
    }
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let event: StreamEvent;
        try {
          event = JSON.parse(line) as StreamEvent;
        } catch {
          continue;
        }
        handle(event);
      }
    }
  } catch (error) {
    if (error instanceof AIError) throw error;
    if (signal?.aborted) throw new AIError('aborted', 'Cancelled.');
    return { text, thinking, stopReason: null, model, interrupted: true };
  }
  return { text, thinking, stopReason, model, interrupted: !finished };
}

export function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof AIError) return { code: error.code, message: error.message };
  if (error instanceof Error) return { code: 'unknown', message: error.message };
  return { code: 'unknown', message: 'Something went wrong.' };
}
