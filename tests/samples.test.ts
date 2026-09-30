/**
 * The bundled samples power the instant demos and mock mode, so they must be
 * exactly what the live pipeline would accept: schema-valid, internally
 * consistent, and with every line reference pointing at the right code.
 */
import { describe, expect, it } from 'vitest';
import { CONCEPTS_BY_ID } from '../shared/concepts.ts';
import { findImports, findMissingImports, isAllowedModule, packageName } from '../shared/runtimeContract.ts';
import { ExplanationSchema, LearnSchema, PlanSchema, UnderstandingSchema } from '../shared/schemas.ts';
import { compileProject } from '../src/preview/compiler.ts';
import { readSampleApp, readSampleDoc, sampleIds } from './helpers.ts';

interface Ref {
  file: string;
  startLine: number;
  endLine: number;
  anchor: string;
}

describe.each(sampleIds())('sample "%s"', (id) => {
  const meta = readSampleDoc(id, 'meta');
  const understanding = UnderstandingSchema.parse(readSampleDoc(id, 'understanding'));
  const plan = PlanSchema.parse(readSampleDoc(id, 'plan'));
  const explanation = ExplanationSchema.parse(readSampleDoc(id, 'explanation'));
  const learn = LearnSchema.parse(readSampleDoc(id, 'learn'));
  const files = readSampleApp(id);
  const paths = Object.keys(files).sort();

  it('has consistent metadata and understanding', () => {
    expect(meta.id).toBe(id);
    expect(understanding.complexity.level).toBe(meta.level);
    expect(new Set(understanding.features.map((f) => f.id)).size).toBe(understanding.features.length);
    for (const q of understanding.clarifyingQuestions) expect(q.defaultIndex).toBeLessThan(q.options.length);
  });

  it('plans exactly the files that exist, each built in exactly one step', () => {
    expect(plan.files.map((f) => f.path).sort()).toEqual(paths);
    const stepFiles = plan.buildSteps.flatMap((s) => s.files);
    expect(stepFiles.sort()).toEqual(paths);
    const screenIds = new Set(plan.screens.map((s) => s.id));
    for (const screen of plan.screens) for (const link of screen.navigatesTo) expect(screenIds).toContain(link.screenId);
  });

  it('only uses the runtime contract and compiles cleanly', () => {
    for (const code of Object.values(files)) {
      for (const spec of findImports(code)) {
        if (!spec.startsWith('.')) expect(isAllowedModule(packageName(spec)), spec).toBe(true);
      }
    }
    expect(findMissingImports(files)).toEqual([]);
    const result = compileProject(files);
    expect(result.problems).toEqual([]);
    expect(result.entry).toBe('App.js');
  });

  it('references only concepts from the Lunor taxonomy', () => {
    const ids = [
      ...plan.buildSteps.flatMap((s) => s.concepts),
      ...explanation.files.flatMap((f) => f.sections.flatMap((s) => s.concepts)),
      ...learn.concepts.map((c) => c.conceptId),
      ...learn.quiz.map((q) => q.conceptId),
      ...learn.challenges.flatMap((c) => c.conceptIds),
      ...learn.nextSteps.map((n) => n.conceptId),
    ];
    expect(ids.filter((c) => !CONCEPTS_BY_ID[c])).toEqual([]);
    const taught = new Set(learn.concepts.map((c) => c.conceptId));
    expect(learn.nextSteps.filter((n) => taught.has(n.conceptId))).toEqual([]);
  });

  it('walks through every file, and every line reference lands on its anchor', () => {
    expect(explanation.files.map((f) => f.path).sort()).toEqual(paths);
    const refs: Ref[] = [
      ...explanation.dataFlow.steps,
      ...explanation.files.flatMap((f) => f.sections.map((s) => ({ ...s, file: f.path }))),
      ...learn.concepts.flatMap((c) => c.codeRefs),
      ...learn.quiz.map((q) => q.codeRef),
    ];
    const broken = refs.filter((ref) => {
      const lines = files[ref.file]?.split('\n');
      return !lines || lines[ref.startLine - 1]?.trim() !== ref.anchor || ref.endLine < ref.startLine || ref.endLine > lines.length;
    });
    expect(broken.map((r) => `${r.file}:${r.startLine} ${r.anchor}`)).toEqual([]);
  });

  it('has a well-formed quiz and challenge ladder', () => {
    for (const q of learn.quiz) {
      expect(q.options).toHaveLength(4);
      expect(q.answerIndex).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex).toBeLessThan(4);
    }
    expect(learn.challenges.map((c) => c.difficulty)).toEqual(['easy', 'medium', 'hard']);
  });

  it('ships reasoning for every stage and canned mentor answers', () => {
    const thinking = readSampleDoc<Record<string, string>>(id, 'thinking');
    for (const stage of ['understand', 'plan', 'build', 'explain', 'learn']) expect(thinking[stage]?.length).toBeGreaterThan(100);
    const mentor = readSampleDoc<{ question: string; answer: string }[]>(id, 'mentor');
    expect(mentor.length).toBeGreaterThanOrEqual(2);
  });
});
