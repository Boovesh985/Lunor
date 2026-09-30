import { ApiError, ThinkingLevel, type GoogleGenAI } from '@google/genai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../api/config.ts';
import { geminiFallbackModels, geminiJsonSchema, streamGemini, toGeminiConfig, toGeminiContents, toGeminiErrorEvent } from '../server/gemini.ts';
import { chooseProvider, modelFor } from '../server/providers.ts';
import { buildStage, chatStage, planStage, understandStage } from '../server/stages.ts';
import { UnderstandingSchema, type StreamEvent } from '../shared/schemas.ts';
import { readSampleApp, readSampleDoc } from './helpers.ts';

describe('provider selection', () => {
  it('prefers a visitor key, then mock mode, then Claude, then Gemini', () => {
    const both = { ANTHROPIC_API_KEY: 'sk-server', GEMINI_API_KEY: 'g-server' };
    expect(chooseProvider('sk-user', { ...both, LUNOR_MOCK_AI: '1' })).toEqual({ provider: 'anthropic', apiKey: 'sk-user', serverKey: false });
    expect(chooseProvider('', { ...both, LUNOR_MOCK_AI: '1' })?.provider).toBe('mock');
    expect(chooseProvider('', both)).toEqual({ provider: 'anthropic', apiKey: 'sk-server', serverKey: true });
    expect(chooseProvider('', { GEMINI_API_KEY: ' g-server ' })).toEqual({ provider: 'gemini', apiKey: 'g-server', serverKey: true });
    expect(chooseProvider('', { ANTHROPIC_API_KEY: '  ', GEMINI_API_KEY: '' })).toBeNull();
  });

  it('reports the active provider and model without exposing keys', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('LUNOR_MOCK_AI', '');
    vi.stubEnv('GEMINI_API_KEY', 'g-secret');
    vi.stubEnv('GEMINI_MODEL', '');
    const body = await config.fetch().json();
    expect(body).toMatchObject({ aiAvailable: true, mock: false, provider: 'gemini', model: 'gemini-3.8-flash', userKeyModel: 'claude-opus-5-5' });
    expect(JSON.stringify(body)).not.toContain('g-secret');
    expect(modelFor('anthropic')).toBe('claude-opus-5-5');
  });

  afterEach(() => vi.unstubAllEnvs());
});

describe('Gemini request mapping', () => {
  const understanding = readSampleDoc('habit-hero', 'understanding');
  const plan = readSampleDoc('habit-hero', 'plan');

  it('maps roles and flattens text blocks (cache hints are Claude-only)', () => {
    const contents = toGeminiContents([
      { role: 'user', content: [{ type: 'text', text: 'project', cache_control: { type: 'ephemeral' } }, { type: 'text', text: 'question' }] },
      { role: 'assistant', content: 'answer' },
      { role: 'user', content: 'follow-up' },
    ]);
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'project' }, { text: 'question' }] },
      { role: 'model', parts: [{ text: 'answer' }] },
      { role: 'user', parts: [{ text: 'follow-up' }] },
    ]);
  });

  it('merges back-to-back turns with the same role so the roles alternate', () => {
    // e.g. a question whose reply failed (and was dropped), followed by a retry.
    const contents = toGeminiContents([
      { role: 'user', content: 'first try' },
      { role: 'user', content: 'second try' },
      { role: 'assistant', content: 'answer' },
    ]);
    expect(contents).toEqual([
      { role: 'user', parts: [{ text: 'first try' }, { text: 'second try' }] },
      { role: 'model', parts: [{ text: 'answer' }] },
    ]);
  });

  it('JSON stages request schema-constrained JSON with thought summaries', () => {
    const call = understandStage.build({ idea: 'A habit tracker for students', level: 'beginner' });
    const gemini = toGeminiConfig(call);
    expect(gemini.systemInstruction).toBe(call.system);
    expect(gemini.responseMimeType).toBe('application/json');
    expect(gemini.thinkingConfig).toEqual({ includeThoughts: true, thinkingLevel: ThinkingLevel.LOW });
    expect(gemini.maxOutputTokens).toBe(call.maxTokens);

    const schema = gemini.responseJsonSchema as { $schema?: string; properties: Record<string, any> };
    expect(schema.$schema).toBeUndefined();
    expect(schema.properties.appName.type).toBe('string');
    // Enums survive (Gemini supports them), so priorities stay must/should/could.
    expect(schema.properties.features.items.properties.priority.enum).toEqual(['must', 'should', 'could']);

    const planConfig = toGeminiConfig(planStage.build({ idea: 'A habit tracker for students', level: 'beginner', understanding, answers: [], excludedFeatures: [] }));
    expect(planConfig.thinkingConfig?.thinkingLevel).toBe(ThinkingLevel.MEDIUM);
  });

  it('streams free text for build and chat, capped at the model output limit', () => {
    const build = toGeminiConfig({ ...buildStage.build({ idea: 'A habit tracker for students', level: 'beginner', understanding, plan }), maxTokens: 200_000 });
    expect(build.responseMimeType).toBeUndefined();
    expect(build.responseJsonSchema).toBeUndefined();
    expect(build.maxOutputTokens).toBe(65_536);

    const chat = chatStage.build({
      level: 'beginner',
      appName: 'HabitHero',
      planSummary: plan.summary,
      files: readSampleApp('habit-hero'),
      intent: 'ask',
      messages: [{ role: 'user', content: 'What is state?' }],
    });
    expect(toGeminiContents(chat.messages)[0]!.parts!.map((p) => p.text).join('')).toContain('What is state?');
  });

  it('converts each schema once', () => {
    expect(geminiJsonSchema(UnderstandingSchema)).toBe(geminiJsonSchema(UnderstandingSchema));
  });
});

describe('Gemini errors', () => {
  const error = (status: number, message: string) => new ApiError({ status, message });

  it('maps API errors to the same codes the Claude path uses', () => {
    expect(toGeminiErrorEvent(error(429, 'Resource exhausted')).code).toBe('rate_limit');
    expect(toGeminiErrorEvent(error(400, 'API key not valid. Please pass a valid API key.')).code).toBe('auth');
    expect(toGeminiErrorEvent(error(403, 'Permission denied')).code).toBe('auth');
    expect(toGeminiErrorEvent(error(404, 'models/x is not found')).code).toBe('not_found');
    expect(toGeminiErrorEvent(error(400, 'Invalid JSON schema')).code).toBe('bad_request');
    expect(toGeminiErrorEvent(error(503, 'The model is overloaded')).code).toBe('overloaded');
  });

  it('says whether the free quota ran out for the minute or for the day', () => {
    const perDay = toGeminiErrorEvent(error(429, '{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier","quotaValue":"20"}'));
    const perMinute = toGeminiErrorEvent(error(429, '{"quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}'));
    expect(perDay).toMatchObject({ code: 'rate_limit', message: expect.stringContaining('resets daily') });
    expect(perMinute).toMatchObject({ code: 'rate_limit', message: expect.stringContaining('Wait a minute') });
  });

  it('recognises cancellation and network failures', () => {
    const controller = new AbortController();
    controller.abort();
    expect(toGeminiErrorEvent(new Error('aborted'), controller.signal).code).toBe('aborted');
    expect(toGeminiErrorEvent(new TypeError('fetch failed')).code).toBe('network');
  });
});

describe('Gemini failover', () => {
  const call = understandStage.build({ idea: 'A habit tracker for students', level: 'beginner' });
  type Behaviour = 'ok' | 'overloaded' | 'quota' | 'bad-request' | 'midstream' | 'cut-off' | 'blocked' | 'silent' | 'goes-quiet';
  const chunk = (parts: { text: string; thought?: boolean }[], finishReason?: string) => ({
    candidates: [{ content: { parts }, finishReason }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 3 },
  });

  function fakeClient(behaviour: Record<string, Behaviour>) {
    const calls: string[] = [];
    const client = {
      models: {
        async generateContentStream({ model, config }: { model: string; config: { abortSignal?: AbortSignal } }) {
          calls.push(model);
          const mode = behaviour[model];
          // A stalled connection: nothing arrives until the request is aborted.
          const hang = () =>
            new Promise<never>((_, reject) =>
              config.abortSignal?.addEventListener('abort', () => reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }))),
            );
          if (mode === 'silent') await hang();
          if (mode === 'overloaded') throw new ApiError({ status: 503, message: 'This model is currently experiencing high demand.' });
          if (mode === 'quota') throw new ApiError({ status: 429, message: 'Resource has been exhausted.' });
          if (mode === 'bad-request') throw new ApiError({ status: 400, message: 'Invalid JSON schema.' });
          return (async function* () {
            yield chunk([{ text: 'Planning the screens…', thought: true }]);
            if (mode === 'goes-quiet') await hang();
            if (mode === 'midstream') throw new ApiError({ status: 503, message: 'This model is currently experiencing high demand.' });
            // What the SDK throws when a busy model appends an error payload to a 200 stream.
            if (mode === 'cut-off') throw new Error('Incomplete JSON segment at the end');
            yield chunk([{ text: '{"ok":true}' }], mode === 'blocked' ? 'SAFETY' : 'STOP');
          })();
        },
      },
    } as unknown as GoogleGenAI;
    return { client, calls };
  }

  const collect = async (events: AsyncGenerator<StreamEvent>) => {
    const out: StreamEvent[] = [];
    for await (const event of events) out.push(event);
    return out;
  };
  const request = (model: string, fallbackModels: string[]) => ({ ...call, apiKey: 'test', model, fallbackModels, timeouts: { firstChunkMs: 40, idleMs: 40 } });

  it('fails over when the preferred model is overloaded or out of quota', async () => {
    const { client, calls } = fakeClient({ a: 'overloaded', b: 'quota', c: 'ok' });
    const events = await collect(streamGemini(request('a', ['b', 'c']), client));
    expect(calls).toEqual(['a', 'b', 'c']);
    // The client is told which model finally answered.
    expect(events.filter((e) => e.type === 'meta').map((e) => (e as { model: string }).model)).toEqual(['b', 'c']);
    expect(events.filter((e) => e.type === 'thinking')).toHaveLength(1);
    expect(events.filter((e) => e.type === 'text').map((e) => (e as { text: string }).text).join('')).toBe('{"ok":true}');
    expect(events.at(-1)).toEqual({ type: 'done', stopReason: 'end_turn', usage: { input: 10, output: 8 } });
  });

  it('never fails over on a bad request', async () => {
    const bad = fakeClient({ a: 'bad-request', b: 'ok' });
    expect((await collect(streamGemini(request('a', ['b']), bad.client))).at(-1)).toMatchObject({ type: 'error', code: 'bad_request' });
    expect(bad.calls).toEqual(['a']);
  });

  it('restarts on the next model when the answer is cut off mid-stream', async () => {
    for (const mode of ['midstream', 'cut-off'] as const) {
      const { client, calls } = fakeClient({ a: mode, b: 'ok' });
      const events = await collect(streamGemini(request('a', ['b']), client));
      expect(calls).toEqual(['a', 'b']);
      const restart = events.findIndex((e) => e.type === 'restart');
      expect(events[restart]).toMatchObject({ type: 'restart', model: 'b' });
      // Output before the restart is discarded by the client; the answer after it is complete.
      expect(events.slice(restart).filter((e) => e.type === 'text').map((e) => (e as { text: string }).text).join('')).toBe('{"ok":true}');
      expect(events.at(-1)).toMatchObject({ type: 'done' });
    }
  });

  it('explains a cut-off answer when no model is left', async () => {
    const { client } = fakeClient({ a: 'cut-off' });
    expect((await collect(streamGemini(request('a', []), client))).at(-1)).toMatchObject({ type: 'error', code: 'overloaded' });
  });

  it('reports the last error when every model fails, and safety blocks as a refusal', async () => {
    const allBusy = fakeClient({ a: 'quota', b: 'quota' });
    expect((await collect(streamGemini(request('a', ['b']), allBusy.client))).at(-1)).toMatchObject({ type: 'error', code: 'rate_limit' });

    const blocked = fakeClient({ a: 'blocked' });
    expect((await collect(streamGemini(request('a', []), blocked.client))).at(-1)).toMatchObject({ type: 'error', code: 'refusal' });
  });

  it('abandons a stalled connection and moves on to the next model', async () => {
    const silent = fakeClient({ a: 'silent', b: 'ok' });
    const events = await collect(streamGemini(request('a', ['b']), silent.client));
    expect(silent.calls).toEqual(['a', 'b']);
    expect(events.at(-1)).toMatchObject({ type: 'done' });

    const quiet = fakeClient({ a: 'goes-quiet', b: 'ok' });
    const restarted = await collect(streamGemini(request('a', ['b']), quiet.client));
    expect(restarted.some((e) => e.type === 'restart')).toBe(true);
    expect(restarted.at(-1)).toMatchObject({ type: 'done' });

    const allSilent = fakeClient({ a: 'silent' });
    expect((await collect(streamGemini(request('a', []), allSilent.client))).at(-1)).toMatchObject({ type: 'error', code: 'overloaded' });
  });

  it('stops failing over when the time budget is nearly spent', async () => {
    // After a 40 ms stall only 20 ms of a 60 ms budget remain — less than a model needs to start.
    const silent = fakeClient({ a: 'silent', b: 'ok' });
    const events = await collect(streamGemini({ ...request('a', ['b']), timeouts: { firstChunkMs: 40, idleMs: 40, budgetMs: 60 } }, silent.client));
    expect(silent.calls).toEqual(['a']);
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'overloaded' });
  });

  it('stops quietly when the visitor cancels', async () => {
    const controller = new AbortController();
    const silent = fakeClient({ a: 'silent', b: 'ok' });
    setTimeout(() => controller.abort(), 10);
    const events = await collect(streamGemini({ ...request('a', ['b']), signal: controller.signal }, silent.client));
    expect(silent.calls).toEqual(['a']);
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'aborted' });
  });

  it('reads fallback models from GEMINI_FALLBACK_MODELS', () => {
    expect(geminiFallbackModels({})).toEqual(['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview']);
    expect(geminiFallbackModels({ GEMINI_FALLBACK_MODELS: ' x , y,' })).toEqual(['x', 'y']);
    expect(geminiFallbackModels({ GEMINI_FALLBACK_MODELS: '' })).toEqual([]);
  });
});
