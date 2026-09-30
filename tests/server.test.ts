import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseFileBlocks } from '../shared/fileProtocol.ts';
import { UnderstandingSchema } from '../shared/schemas.ts';
import { createStageHandler } from '../server/handler.ts';
import { clientIp, resetRateLimits, takeRateLimit } from '../server/rateLimit.ts';
import { buildStage, chatStage, explainStage, planStage, understandStage } from '../server/stages.ts';
import { readNdjson, readSampleApp, readSampleDoc } from './helpers.ts';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/test', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });

describe('rate limiting', () => {
  beforeEach(() => resetRateLimits());

  it('spends a per-key budget and reports when it resets', () => {
    vi.stubEnv('LUNOR_RATE_LIMIT', '5');
    const now = 1_000_000;
    expect(takeRateLimit('a', 3, now).ok).toBe(true);
    expect(takeRateLimit('a', 2, now).ok).toBe(true);
    const blocked = takeRateLimit('a', 1, now + 60_000);
    expect(blocked).toEqual({ ok: false, retryAfter: 14 * 60 });
    expect(takeRateLimit('b', 1, now).ok).toBe(true);
    expect(takeRateLimit('a', 1, now + 15 * 60_000).ok).toBe(true);
    vi.unstubAllEnvs();
  });

  it('reads the client IP from proxy headers', () => {
    expect(clientIp(new Request('http://x', { headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } }))).toBe('203.0.113.7');
    expect(clientIp(new Request('http://x', { headers: { 'x-real-ip': '198.51.100.2' } }))).toBe('198.51.100.2');
    expect(clientIp(new Request('http://x'))).toBe('local');
  });
});

describe('stage handler', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('rejects other methods, bad JSON and invalid bodies before calling the model', async () => {
    const handler = createStageHandler(understandStage);
    expect((await handler.fetch(new Request('http://localhost/api/understand'))).status).toBe(405);

    const badJson = await handler.fetch(post('{nope'));
    expect(badJson.status).toBe(400);

    const invalid = await handler.fetch(post({ idea: 'hi', level: 'expert' }));
    expect(invalid.status).toBe(400);
    const { error } = await invalid.json();
    expect(error.code).toBe('invalid_request');
    expect(error.message).toMatch(/idea/);
    expect(error.message).toMatch(/level/);
  });

  it('explains how to get a key when none is configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('LUNOR_MOCK_AI', '');
    const response = await createStageHandler(understandStage).fetch(post({ idea: 'A habit tracker for students', level: 'beginner' }));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('no_api_key');
  });

  it('streams a schema-valid NDJSON response in mock mode', async () => {
    vi.stubEnv('LUNOR_MOCK_AI', '1');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const response = await createStageHandler(understandStage).fetch(
      post({ idea: 'Split hostel expenses between roommates', level: 'intermediate' }),
    );
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    const events = await readNdjson(response);
    expect(events[0]).toMatchObject({ type: 'meta', mock: true });
    expect(events.some((e) => e.type === 'thinking')).toBe(true);
    expect(events.at(-1)).toMatchObject({ type: 'done', stopReason: 'end_turn' });
    const text = events.filter((e) => e.type === 'text').map((e) => e.text).join('');
    const understanding = UnderstandingSchema.parse(JSON.parse(text));
    expect(understanding.appName).toBe('SplitMate');
  });

  it('resumes an interrupted build by streaming only the missing files', async () => {
    vi.stubEnv('LUNOR_MOCK_AI', '1');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const app = readSampleApp('habit-hero');
    const existing = Object.fromEntries(Object.entries(app).filter(([path]) => path !== 'App.js').slice(0, 4));
    const response = await createStageHandler(buildStage).fetch(
      post({ idea: 'A habit tracker with streaks', level: 'beginner', understanding: {}, plan: {}, existingFiles: existing }),
    );
    const text = (await readNdjson(response)).filter((e) => e.type === 'text').map((e) => e.text).join('');
    const written = parseFileBlocks(text).files.map((f) => f.path);
    // App.js imports everything else, so it is always written last.
    expect(written.at(-1)).toBe('App.js');
    expect(written.sort()).toEqual(Object.keys(app).filter((p) => !(p in existing)).sort());
  });
});

describe('stage definitions', () => {
  it('JSON stages carry a structured-output schema; build and chat stream free text', () => {
    const understanding = readSampleDoc('habit-hero', 'understanding');
    const plan = readSampleDoc('habit-hero', 'plan');
    const files = readSampleApp('habit-hero');

    const u = understandStage.build({ idea: 'A habit tracker for students', level: 'beginner' });
    expect(u.format?.type).toBe('json_schema');
    expect(JSON.stringify(u.format?.schema)).toContain('clarifyingQuestions');

    const p = planStage.build({ idea: 'A habit tracker for students', level: 'beginner', understanding, answers: [], excludedFeatures: ['reminders'] });
    expect(p.format?.type).toBe('json_schema');
    expect(JSON.stringify(p.messages)).toContain('do not plan them');

    const b = buildStage.build({ idea: 'A habit tracker for students', level: 'beginner', understanding, plan, existingFiles: { 'App.js': files['App.js']! }, missing: ['src/theme.js'] });
    expect(b.format).toBeUndefined();
    expect(JSON.stringify(b.messages)).toContain('Write ONLY the remaining files, in plan order: src/theme.js');

    const e = explainStage.build({ level: 'beginner', appName: 'HabitHero', planSummary: plan.summary, files });
    // Code is sent with line numbers so the model can cite exact lines.
    expect(JSON.stringify(e.messages)).toContain(' 1| import { useState }');

    const c = chatStage.build({ level: 'beginner', appName: 'HabitHero', planSummary: plan.summary, files, intent: 'ask', messages: [{ role: 'assistant', content: 'Hi!' }, { role: 'user', content: 'What is state?' }], context: { file: 'App.js' } });
    expect(c.messages[0]!.role).toBe('user');
    expect(JSON.stringify(c.messages)).toContain('The student is looking at App.js.');
  });
});
