/**
 * Opt-in end-to-end check against the real AI provider configured in
 * .env.local (Claude if ANTHROPIC_API_KEY is set, otherwise Gemini):
 *
 *   npm run test:live
 *
 * Runs a fresh idea through all five stages via the real HTTP handler,
 * validates every output against its schema, compiles the generated app and
 * checks that the walkthrough's line references resolve. Uses real quota, so
 * it is skipped in the normal test run. Outputs are written to a temp folder.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CONCEPTS_BY_ID } from '../../shared/concepts.ts';
import { resolveRange } from '../../shared/codeRefs.ts';
import { parseFileBlocks } from '../../shared/fileProtocol.ts';
import { findMissingImports } from '../../shared/runtimeContract.ts';
import { ExplanationSchema, LearnSchema, PlanSchema, UnderstandingSchema } from '../../shared/schemas.ts';
import { createStageHandler } from '../../server/handler.ts';
import type { StageDefinition } from '../../server/stages.ts';
import { buildStage, explainStage, learnStage, planStage, understandStage } from '../../server/stages.ts';
import { compileProject } from '../../src/preview/compiler.ts';

const IDEA =
  process.env.LUNOR_LIVE_IDEA ??
  'A study-group finder for my college: students post which subject they are revising, when and where, and others can join the session.';
const LEVEL = 'beginner' as const;

interface StageRun {
  model: string;
  text: string;
  thinking: string;
  stopReason: string | null;
  usage?: { input: number; output: number };
  seconds: number;
}

async function run<T>(stage: StageDefinition<T>, body: T): Promise<StageRun> {
  const started = Date.now();
  const response = await createStageHandler(stage).fetch(
    new Request(`http://localhost/api/${stage.name}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }),
  );
  expect(response.status, await response.clone().text().catch(() => '')).toBe(200);
  const result: StageRun = { model: '', text: '', thinking: '', stopReason: null, seconds: 0 };
  for (const line of (await response.text()).split('\n').filter(Boolean)) {
    const event = JSON.parse(line);
    if (event.type === 'meta') result.model = event.model;
    if (event.type === 'text') result.text += event.text;
    if (event.type === 'thinking') result.thinking += event.text;
    if (event.type === 'error') throw new Error(`${stage.name}: ${event.code} — ${event.message}`);
    if (event.type === 'done') {
      result.stopReason = event.stopReason;
      result.usage = event.usage;
    }
  }
  result.seconds = Math.round((Date.now() - started) / 100) / 10;
  return result;
}

describe.skipIf(!process.env.LUNOR_LIVE)('live pipeline', () => {
  const out = join(tmpdir(), `lunor-live-${Date.now()}`);

  beforeAll(() => {
    const env = loadEnv('development', process.cwd(), '');
    for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_FALLBACK_MODELS']) vi.stubEnv(key, env[key]);
    vi.stubEnv('LUNOR_MOCK_AI', '');
    mkdirSync(join(out, 'app'), { recursive: true });
  });

  it('takes a new idea through all five stages', { timeout: 20 * 60_000 }, async () => {
    const report: string[] = [];
    const note = (stage: string, r: StageRun, extra = '') =>
      report.push(`${stage.padEnd(10)} ${r.model} · ${r.seconds}s · ${r.usage?.input ?? '?'} in / ${r.usage?.output ?? '?'} out · reasoning ${r.thinking.length} chars ${extra}`);

    const u = await run(understandStage, { idea: IDEA, level: LEVEL });
    const understanding = UnderstandingSchema.parse(JSON.parse(u.text));
    note('understand', u, `· "${understanding.appName}", ${understanding.features.length} features`);

    const p = await run(planStage, { idea: IDEA, level: LEVEL, understanding, answers: [], excludedFeatures: [] });
    const plan = PlanSchema.parse(JSON.parse(p.text));
    note('plan', p, `· ${plan.screens.length} screens, ${plan.files.length} files`);

    // Build, continuing like the Studio does when files are missing (up to 2 more attempts).
    let files: Record<string, string> = {};
    for (let attempt = 0; attempt < 3; attempt++) {
      const missing = [...new Set([...findMissingImports(files), ...plan.files.map((f) => f.path).filter((path) => !(path in files))])];
      if (attempt > 0 && missing.length === 0 && 'App.js' in files) break;
      const b = await run(buildStage, {
        idea: IDEA,
        level: LEVEL,
        understanding,
        plan,
        ...(attempt > 0 ? { existingFiles: files, missing } : {}),
      });
      for (const file of parseFileBlocks(b.text).files) if (file.complete) files[file.path] = file.content;
      note(attempt ? `build +${attempt}` : 'build', b, `· stop ${b.stopReason}, ${Object.keys(files).length} files`);
    }
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(out, 'app', path, '..'), { recursive: true });
      writeFileSync(join(out, 'app', path), content);
    }
    const compiled = compileProject(files);
    report.push(`compile    ${compiled.problems.length} problems ${compiled.problems.map((x) => `${x.file}:${x.line ?? ''} ${x.message}`).join(' | ')}`);
    expect(files['App.js']).toBeDefined();
    expect(findMissingImports(files)).toEqual([]);
    expect(compiled.problems).toEqual([]);

    const e = await run(explainStage, { level: LEVEL, appName: understanding.appName, planSummary: plan.summary, files });
    const explanation = ExplanationSchema.parse(JSON.parse(e.text));
    const refs = [...explanation.dataFlow.steps, ...explanation.files.flatMap((f) => f.sections.map((s) => ({ ...s, file: f.path })))];
    const exact = refs.filter((r) => files[r.file]?.split('\n')[r.startLine - 1]?.trim() === r.anchor.trim()).length;
    const anchored = refs.filter((r) => files[r.file] && resolveRange(files[r.file], r).anchored).length;
    note('explain', e, `· ${explanation.files.length}/${Object.keys(files).length} files, anchors exact ${exact}/${refs.length}, resolved ${anchored}/${refs.length}`);

    const l = await run(learnStage, { level: LEVEL, appName: understanding.appName, planSummary: plan.summary, files });
    const learn = LearnSchema.parse(JSON.parse(l.text));
    const unknown = [...learn.concepts.map((c) => c.conceptId), ...learn.nextSteps.map((n) => n.conceptId)].filter((id) => !CONCEPTS_BY_ID[id]);
    note('learn', l, `· ${learn.concepts.length} concepts, ${learn.quiz.length} quiz, unknown concept ids: ${unknown.join(', ') || 'none'}`);

    writeFileSync(join(out, 'understanding.json'), JSON.stringify(understanding, null, 2));
    writeFileSync(join(out, 'plan.json'), JSON.stringify(plan, null, 2));
    writeFileSync(join(out, 'explanation.json'), JSON.stringify(explanation, null, 2));
    writeFileSync(join(out, 'learn.json'), JSON.stringify(learn, null, 2));
    writeFileSync(join(out, 'thinking.json'), JSON.stringify({ understand: u.thinking, plan: p.thinking, explain: e.thinking, learn: l.thinking }, null, 2));
    console.log(`\n${report.join('\n')}\noutput: ${out}\n`);

    expect(anchored / refs.length).toBeGreaterThan(0.8);
  });
});
