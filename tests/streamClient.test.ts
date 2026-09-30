import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamAI } from '../src/lib/ai.ts';
import type { StreamEvent } from '../shared/schemas.ts';

const respond = (events: StreamEvent[]) =>
  vi.fn(async () => new Response(events.map((e) => JSON.stringify(e)).join('\n') + '\n', { headers: { 'content-type': 'application/x-ndjson' } }));

describe('streamAI', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accumulates text and thinking, and reports the model', async () => {
    vi.stubGlobal('fetch', respond([
      { type: 'meta', model: 'claude-opus-5-5', mock: false },
      { type: 'thinking', text: 'Reading the idea. ' },
      { type: 'text', text: '{"a":' },
      { type: 'text', text: '1}' },
      { type: 'done', stopReason: 'end_turn' },
    ]));
    const result = await streamAI('understand', {}, {});
    expect(result).toMatchObject({ text: '{"a":1}', thinking: 'Reading the idea. ', model: 'claude-opus-5-5', stopReason: 'end_turn', interrupted: false });
  });

  it('clears partial output when the server restarts on another model', async () => {
    vi.stubGlobal('fetch', respond([
      { type: 'meta', model: 'gemini-3.8-flash', mock: false },
      { type: 'thinking', text: 'first try' },
      { type: 'text', text: '{"broken":' },
      { type: 'restart', model: 'gemini-3.7-flash', reason: 'busy' },
      { type: 'text', text: '{"ok":true}' },
      { type: 'done', stopReason: 'end_turn' },
    ]));
    const seen: string[] = [];
    const models: string[] = [];
    const result = await streamAI('understand', {}, { onText: (_d, all) => seen.push(all), onMeta: (m) => models.push(m.model) });
    expect(result.text).toBe('{"ok":true}');
    expect(result.thinking).toBe('');
    expect(result.model).toBe('gemini-3.7-flash');
    // The UI is told to clear what it showed before the restart.
    expect(seen).toEqual(['{"broken":', '', '{"ok":true}']);
    expect(models).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash']);
  });

  it('turns an error event into an AIError with the partial text', async () => {
    vi.stubGlobal('fetch', respond([
      { type: 'text', text: 'partial' },
      { type: 'error', code: 'overloaded', message: 'busy' },
    ]));
    await expect(streamAI('build', {}, {})).rejects.toMatchObject({ code: 'overloaded', message: 'busy', partialText: 'partial' });
  });
});
