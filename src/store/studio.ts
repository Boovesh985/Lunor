/**
 * The Studio store orchestrates the pipeline:
 *
 *   Understand ──▶ Plan ──▶ Build ──▶ Explain
 *                                 └─▶ Learn        (+ Mentor chat at any time)
 *
 * Each stage streams from /api/<stage> (or replays a bundled sample through
 * identical callbacks), renders partial results while streaming, validates
 * the final output with the shared Zod schemas, and persists the project.
 */
import { create } from 'zustand';
import type { ZodType } from 'zod';
import { parseFileBlocks } from '../../shared/fileProtocol.ts';
import { findMissingImports } from '../../shared/runtimeContract.ts';
import {
  ExplanationSchema,
  LearnSchema,
  PlanSchema,
  UnderstandingSchema,
  type ChatIntent,
  type StageId,
} from '../../shared/schemas.ts';
import { AIError, describeError, streamAI, type AIEndpoint, type StreamHandlers, type StreamResult } from '../lib/ai';
import { parsePartial, throttle } from '../lib/partial';
import {
  furthestStage,
  hashFiles,
  loadProject,
  saveProject,
  type ChatMessage,
  type FileChange,
  type Project,
} from '../lib/projects';
import { replayStage, replayText } from '../lib/replay';
import { isLiveAIAvailable } from '../lib/settings';
import { uid } from '../lib/utils';
import { award } from '../lib/xp';
import { loadSampleDoc, type MentorQA } from '../samples';

export type RunStatus = 'idle' | 'running' | 'done' | 'error';
export interface StageError {
  code: string;
  message: string;
  /** A build that failed part-way can continue from the files already written. */
  resumable?: boolean;
}
export interface CodeFocus {
  file: string;
  start?: number;
  end?: number;
  nonce: number;
}
export interface ChatContext {
  file?: string;
  selection?: string;
  error?: string;
}

type JsonStage = 'understand' | 'plan' | 'explain' | 'learn';

interface StudioState {
  project: Project | null;
  stage: StageId;
  status: Record<StageId, RunStatus>;
  errors: Partial<Record<StageId, StageError>>;
  partial: Partial<Record<JsonStage, unknown>>;
  liveThinking: Partial<Record<StageId, string>>;
  build: { activeFile: string | null; streaming: string; attempt: number };
  chatBusy: boolean;
  mentorOpen: boolean;
  focus: CodeFocus | null;
  celebrate: number;

  open(id: string): boolean;
  close(): void;
  setStage(stage: StageId): void;
  setMentorOpen(open: boolean): void;
  focusCode(file: string, start?: number, end?: number, stage?: StageId): void;

  runUnderstand(): Promise<void>;
  setDecision(questionId: string, option: number): void;
  toggleFeature(featureId: string): void;
  runPlan(): Promise<void>;
  runBuild(options?: { resume?: boolean }): Promise<void>;
  runExplain(): Promise<void>;
  runLearn(): Promise<void>;
  cancel(stage: StageId | 'chat'): void;

  updateFile(path: string, content: string): void;
  resetFile(path: string): void;

  sendMessage(text: string, intent?: ChatIntent, context?: ChatContext): Promise<void>;
  revertChanges(messageId: string): void;
  clearChat(): void;

  markFileViewed(path: string): void;
  toggleConcept(conceptId: string): void;
  answerQuiz(questionId: string, option: number, correct: boolean): void;
  revealHint(challengeId: string): void;
  completeChallenge(challengeId: string, xp: number): void;
}

const IDLE: Record<StageId, RunStatus> = { understand: 'idle', plan: 'idle', build: 'idle', explain: 'idle', learn: 'idle' };

const controllers = new Map<string, AbortController>();
function startController(key: string): AbortController {
  controllers.get(key)?.abort();
  const controller = new AbortController();
  controllers.set(key, controller);
  return controller;
}
function finishController(key: string, controller: AbortController) {
  if (controllers.get(key) === controller) controllers.delete(key);
}
function abortAll() {
  controllers.forEach((c) => c.abort());
  controllers.clear();
}
/** Redoing a stage invalidates everything after it, so stop that work first. */
function abortStages(...keys: StageId[]) {
  for (const key of keys) controllers.get(key)?.abort();
}
/** False once a newer run of the same stage has taken over (or the run was cleaned up). */
const isLatest = (key: string, controller: AbortController) => controllers.get(key) === controller;

function statusFor(project: Project): { status: Record<StageId, RunStatus>; errors: Partial<Record<StageId, StageError>> } {
  const status: Record<StageId, RunStatus> = {
    understand: project.understanding ? 'done' : 'idle',
    plan: project.plan ? 'done' : 'idle',
    build: project.buildComplete ? 'done' : 'idle',
    explain: project.explanation ? 'done' : 'idle',
    learn: project.learn ? 'done' : 'idle',
  };
  const errors: Partial<Record<StageId, StageError>> = {};
  if (!project.buildComplete && Object.keys(project.files).length > 0) {
    status.build = 'error';
    errors.build = { code: 'interrupted', message: 'The last build was interrupted before it finished.', resumable: true };
  }
  return { status, errors };
}

/** Files still needed after a (possibly interrupted) build. */
function missingAfterBuild(files: Record<string, string>, plannedPaths: string[]): string[] {
  const missing = new Set(findMissingImports(files));
  for (const path of plannedPaths) if (!(path in files)) missing.add(path);
  if (!('App.js' in files)) missing.add('App.js');
  return [...missing];
}

function completeFiles(text: string): Record<string, string> {
  return Object.fromEntries(
    parseFileBlocks(text)
      .files.filter((f) => f.complete)
      .map((f) => [f.path, f.content]),
  );
}

async function cannedAnswer(project: Project, question: string): Promise<string> {
  const note =
    '\n\n---\n_Live AI isn\'t connected on this deployment, so the mentor can only answer the suggested demo questions. Add your Anthropic API key in **Settings** to ask anything and let the mentor edit your code._';
  if (project.source === 'sample' && project.sampleId) {
    const qa = (await loadSampleDoc<MentorQA[]>(project.sampleId, 'mentor')) ?? [];
    const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{3,}/g) ?? []);
    const asked = words(question);
    let best: MentorQA | undefined;
    let bestScore = 0;
    for (const item of qa) {
      const score = [...words(item.question)].filter((w) => asked.has(w)).length;
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }
    if (best && bestScore >= 2) return best.answer;
    return `I can answer these demo questions right away:\n\n${qa.map((q) => `- ${q.question}`).join('\n')}${note}`;
  }
  return `I'd love to help with that!${note}`;
}

export const useStudio = create<StudioState>()((set, get) => {
  const patch = (changes: Partial<Project> | ((p: Project) => Partial<Project>)) =>
    set((s) => (s.project ? { project: { ...s.project, ...(typeof changes === 'function' ? changes(s.project) : changes), updatedAt: Date.now() } } : {}));

  const isCurrent = (projectId: string) => get().project?.id === projectId;

  function runSource(stage: StageId, endpoint: AIEndpoint, body: unknown, handlers: StreamHandlers, signal: AbortSignal, existingFiles?: Record<string, string>): Promise<StreamResult> {
    const project = get().project!;
    if (project.source === 'sample' && project.sampleId) return replayStage(project.sampleId, stage, handlers, signal, { existingFiles });
    return streamAI(endpoint, body, handlers, signal);
  }

  async function runJson<T>(stage: JsonStage, body: unknown, schema: ZodType<T>, apply: (data: T) => Partial<Project>): Promise<boolean> {
    const project = get().project;
    if (!project) return false;
    const projectId = project.id;
    const controller = startController(stage);
    set((s) => ({
      status: { ...s.status, [stage]: 'running' },
      errors: { ...s.errors, [stage]: undefined },
      partial: { ...s.partial, [stage]: undefined },
      liveThinking: { ...s.liveThinking, [stage]: '' },
    }));
    const pushPartial = throttle((all: string) => {
      if (isCurrent(projectId)) set((s) => ({ partial: { ...s.partial, [stage]: parsePartial(all) } }));
    }, 90);
    const pushThinking = throttle((all: string) => {
      if (isCurrent(projectId)) set((s) => ({ liveThinking: { ...s.liveThinking, [stage]: all } }));
    }, 90);

    try {
      const result = await runSource(stage, stage, body, {
        onText: (_d, all) => pushPartial(all),
        onThinking: (_d, all) => pushThinking(all),
        onMeta: (meta) => isCurrent(projectId) && patch((p) => ({ models: { ...p.models, [stage]: meta.model } })),
      }, controller.signal);
      pushPartial.flush();
      pushThinking.flush();
      if (!isCurrent(projectId) || !isLatest(stage, controller)) return false;
      if (result.interrupted) throw new AIError('interrupted', 'The connection dropped before the AI finished. Please try again.');
      if (result.stopReason === 'max_tokens') throw new AIError('max_tokens', 'The answer was too long and got cut off. Please try again.');

      let raw: unknown;
      try {
        raw = JSON.parse(result.text);
      } catch {
        throw new AIError('bad_output', "The AI's answer couldn't be read. Please try again.");
      }
      const parsed = schema.safeParse(raw);
      if (!parsed.success) console.warn(`[${stage}] output did not fully match the schema`, parsed.error.issues.slice(0, 5));
      const data = (parsed.success ? parsed.data : raw) as T;

      patch((p) => ({ ...apply(data), thinking: { ...p.thinking, [stage]: result.thinking } }));
      set((s) => ({ status: { ...s.status, [stage]: 'done' }, partial: { ...s.partial, [stage]: undefined } }));
      return true;
    } catch (error) {
      pushPartial.cancel();
      pushThinking.cancel();
      if (!isCurrent(projectId) || !isLatest(stage, controller)) return false;
      const info = describeError(error);
      if (info.code === 'aborted') {
        const hasData = { understand: 'understanding', plan: 'plan', explain: 'explanation', learn: 'learn' }[stage] as keyof Project;
        set((s) => ({ status: { ...s.status, [stage]: get().project?.[hasData] ? 'done' : 'idle' }, partial: { ...s.partial, [stage]: undefined } }));
      } else {
        set((s) => ({ status: { ...s.status, [stage]: 'error' }, errors: { ...s.errors, [stage]: info } }));
      }
      return false;
    } finally {
      finishController(stage, controller);
    }
  }

  function applyChanges(changes: FileChange[]) {
    patch((p) => {
      const files = { ...p.files };
      for (const change of changes) {
        if (change.after === null) delete files[change.path];
        else files[change.path] = change.after;
      }
      return { files };
    });
  }

  return {
    project: null,
    stage: 'understand',
    status: { ...IDLE },
    errors: {},
    partial: {},
    liveThinking: {},
    build: { activeFile: null, streaming: '', attempt: 0 },
    chatBusy: false,
    mentorOpen: false,
    focus: null,
    celebrate: 0,

    open(id) {
      const project = loadProject(id);
      if (!project) return false;
      abortAll();
      set({
        project,
        stage: furthestStage(project),
        ...statusFor(project),
        partial: {},
        liveThinking: {},
        build: { activeFile: null, streaming: '', attempt: 0 },
        chatBusy: false,
        focus: null,
      });
      return true;
    },

    close() {
      abortAll();
      const { project } = get();
      // Saved right here, so a pending debounced save would only repeat it later.
      clearTimeout(saveTimer);
      if (project) saveProject(project);
      set({ project: null, status: { ...IDLE }, errors: {}, partial: {}, liveThinking: {}, chatBusy: false, mentorOpen: false, focus: null });
    },

    setStage: (stage) => set({ stage }),
    setMentorOpen: (mentorOpen) => set({ mentorOpen }),
    focusCode: (file, start, end, stage) => set((s) => ({ focus: { file, start, end, nonce: Date.now() }, stage: stage ?? s.stage })),

    async runUnderstand() {
      const project = get().project;
      if (!project) return;
      abortStages('plan', 'build', 'explain', 'learn');
      set({ stage: 'understand' });
      const ok = await runJson('understand', { idea: project.idea, level: project.level }, UnderstandingSchema, (understanding) => ({
        understanding,
        decisions: Object.fromEntries(
          (understanding.clarifyingQuestions ?? []).map((q) => [q.id, Math.min(Math.max(0, q.defaultIndex ?? 0), Math.max(0, (q.options?.length ?? 1) - 1))]),
        ),
        excludedFeatures: [],
        plan: undefined,
        files: {},
        generatedFiles: undefined,
        buildComplete: false,
        explanation: undefined,
        learn: undefined,
      }));
      if (ok) {
        set((s) => ({ status: { ...s.status, plan: 'idle', build: 'idle', explain: 'idle', learn: 'idle' } }));
        award(`understand:${project.id}`, 20, 'Idea understood');
      }
    },

    setDecision: (questionId, option) => patch((p) => ({ decisions: { ...p.decisions, [questionId]: option } })),

    toggleFeature: (featureId) =>
      patch((p) => ({
        excludedFeatures: p.excludedFeatures.includes(featureId) ? p.excludedFeatures.filter((f) => f !== featureId) : [...p.excludedFeatures, featureId],
      })),

    async runPlan() {
      const project = get().project;
      const understanding = project?.understanding;
      if (!project || !understanding) return;
      abortStages('build', 'explain', 'learn');
      set({ stage: 'plan' });
      const answers = (understanding.clarifyingQuestions ?? []).map((q) => ({
        question: q.question,
        answer: q.options?.[project.decisions[q.id] ?? q.defaultIndex] ?? q.options?.[0] ?? '',
      }));
      const excludedFeatures = (understanding.features ?? []).filter((f) => project.excludedFeatures.includes(f.id)).map((f) => f.name);
      const ok = await runJson('plan', { idea: project.idea, level: project.level, understanding, answers, excludedFeatures }, PlanSchema, (plan) => ({
        plan,
        files: {},
        generatedFiles: undefined,
        buildComplete: false,
        explanation: undefined,
        learn: undefined,
      }));
      if (ok) {
        set((s) => ({ status: { ...s.status, build: 'idle', explain: 'idle', learn: 'idle' }, errors: { ...s.errors, build: undefined } }));
        award(`plan:${project.id}`, 30, 'Architecture planned');
      }
    },

    async runBuild({ resume = false } = {}) {
      const project = get().project;
      if (!project?.plan || !project.understanding) return;
      const projectId = project.id;
      const plannedPaths = (project.plan.files ?? []).map((f) => f.path);
      const controller = startController('build');
      const attempt = resume ? get().build.attempt + 1 : 1;
      const existing = resume ? { ...project.files } : {};
      const missing = resume ? missingAfterBuild(existing, plannedPaths) : undefined;

      if (!resume) {
        abortStages('explain', 'learn');
        patch({ files: {}, generatedFiles: undefined, buildComplete: false, explanation: undefined, learn: undefined, explainedHash: undefined, learnHash: undefined });
      }
      set((s) => ({
        stage: 'build',
        status: { ...s.status, build: 'running', explain: 'idle', learn: 'idle' },
        errors: { ...s.errors, build: undefined, explain: undefined, learn: undefined },
        build: { activeFile: null, streaming: '', attempt },
        liveThinking: { ...s.liveThinking, build: resume ? s.liveThinking.build : '' },
      }));

      let files: Record<string, string> = { ...existing };
      const onText = throttle((all: string) => {
        if (!isCurrent(projectId)) return;
        const parsed = parseFileBlocks(all);
        const streaming = parsed.files.find((f) => !f.complete);
        files = { ...existing, ...Object.fromEntries(parsed.files.filter((f) => f.complete).map((f) => [f.path, f.content])) };
        patch({ files });
        set({ build: { activeFile: streaming?.path ?? parsed.files.at(-1)?.path ?? null, streaming: streaming?.content ?? '', attempt } });
      }, 80);
      const pushThinking = throttle((all: string) => {
        if (isCurrent(projectId)) set((s) => ({ liveThinking: { ...s.liveThinking, build: all } }));
      }, 90);

      try {
        const body = {
          idea: project.idea,
          level: project.level,
          understanding: project.understanding,
          plan: project.plan,
          ...(resume ? { existingFiles: existing, missing } : {}),
        };
        const result = await runSource('build', 'build', body, {
          onText: (_d, all) => onText(all),
          onThinking: (_d, all) => pushThinking(all),
          onMeta: (meta) => isCurrent(projectId) && patch((p) => ({ models: { ...p.models, build: meta.model } })),
        }, controller.signal, existing);
        onText.flush();
        pushThinking.flush();
        if (!isCurrent(projectId) || !isLatest('build', controller)) return;

        files = { ...existing, ...completeFiles(result.text) };
        const stillMissing = missingAfterBuild(files, plannedPaths);
        const dangling = findMissingImports(files);
        const incomplete = dangling.length > 0 || !('App.js' in files) || ((result.interrupted || result.stopReason === 'max_tokens') && stillMissing.length > 0);
        if (incomplete && attempt < 3 && Object.keys(files).length > 0) {
          patch({ files });
          finishController('build', controller);
          return get().runBuild({ resume: true });
        }
        if (!('App.js' in files)) throw new AIError('incomplete', 'The build finished without writing App.js. Please rebuild.');

        patch((p) => ({ files, generatedFiles: files, buildComplete: true, thinking: { ...p.thinking, build: result.thinking } }));
        set((s) => ({ status: { ...s.status, build: 'done' }, build: { activeFile: null, streaming: '', attempt }, celebrate: Date.now() }));
        award(`build:${projectId}`, 50, 'App built');
        void get().runExplain();
        void get().runLearn();
      } catch (error) {
        onText.cancel();
        pushThinking.cancel();
        if (!isCurrent(projectId) || !isLatest('build', controller)) return;
        const info = describeError(error);
        if (error instanceof AIError && error.partialText) files = { ...existing, ...completeFiles(error.partialText) };
        patch({ files });
        const resumable = Object.keys(files).length > 0;
        if (info.code === 'aborted') {
          set((s) => ({
            status: { ...s.status, build: resumable ? 'error' : 'idle' },
            errors: { ...s.errors, build: resumable ? { code: 'aborted', message: 'Build stopped.', resumable } : undefined },
            build: { activeFile: null, streaming: '', attempt },
          }));
        } else {
          set((s) => ({ status: { ...s.status, build: 'error' }, errors: { ...s.errors, build: { ...info, resumable } }, build: { activeFile: null, streaming: '', attempt } }));
        }
      } finally {
        finishController('build', controller);
      }
    },

    async runExplain() {
      const project = get().project;
      if (!project?.buildComplete) return;
      const files = project.files;
      await runJson(
        'explain',
        { level: project.level, appName: project.understanding?.appName ?? 'App', planSummary: project.plan?.summary ?? '', files },
        ExplanationSchema,
        (explanation) => ({ explanation, explainedHash: hashFiles(files) }),
      );
    },

    async runLearn() {
      const project = get().project;
      if (!project?.buildComplete) return;
      const files = project.files;
      await runJson(
        'learn',
        { level: project.level, appName: project.understanding?.appName ?? 'App', planSummary: project.plan?.summary ?? '', files },
        LearnSchema,
        (learn) => ({ learn, learnHash: hashFiles(files) }),
      );
    },

    cancel(stage) {
      controllers.get(stage)?.abort();
    },

    updateFile: (path, content) => patch((p) => ({ files: { ...p.files, [path]: content } })),

    resetFile(path) {
      const original = get().project?.generatedFiles?.[path];
      if (original !== undefined) patch((p) => ({ files: { ...p.files, [path]: original } }));
    },

    async sendMessage(text, intent = 'ask', context) {
      const project = get().project;
      if (!project || get().chatBusy || !text.trim()) return;
      const projectId = project.id;
      const userMessage: ChatMessage = { id: uid('m'), role: 'user', content: text.trim(), intent, createdAt: Date.now() };
      const reply: ChatMessage = { id: uid('m'), role: 'assistant', content: '', intent, status: 'streaming', createdAt: Date.now() };
      patch((p) => ({ chat: [...p.chat, userMessage, reply] }));
      set({ chatBusy: true, mentorOpen: true });

      const controller = startController('chat');
      const update = (changes: Partial<ChatMessage>) =>
        isCurrent(projectId) && patch((p) => ({ chat: p.chat.map((m) => (m.id === reply.id ? { ...m, ...changes } : m)) }));
      const onText = throttle((all: string) => {
        const parsed = parseFileBlocks(all);
        update({ content: parsed.prose, pending: parsed.files.map((f) => ({ path: f.path, complete: f.complete })) });
      }, 60);

      try {
        let result: StreamResult;
        if (!isLiveAIAvailable()) {
          result = await replayText(await cannedAnswer(project, text), { onText: (_d, all) => onText(all) }, controller.signal);
        } else {
          const history = [...project.chat, userMessage]
            .filter((m) => m.status !== 'error' && m.content.trim())
            .slice(-12)
            .map((m) => ({ role: m.role, content: m.content }));
          const body = {
            level: project.level,
            appName: project.understanding?.appName ?? 'App',
            planSummary: project.plan?.summary ?? project.understanding?.summary ?? '',
            files: project.files,
            intent,
            messages: history,
            context: { ...context, originalFiles: intent === 'review' ? project.generatedFiles : undefined },
          };
          result = await streamAI('chat', body, {
            onText: (_d, all) => onText(all),
            onMeta: (meta) => isCurrent(projectId) && patch((p) => ({ models: { ...p.models, chat: meta.model } })),
          }, controller.signal);
        }
        onText.flush();
        if (!isCurrent(projectId)) return;

        const parsed = parseFileBlocks(result.text);
        const current = get().project!.files;
        const changes: FileChange[] = [];
        for (const file of parsed.files) {
          if (file.complete && current[file.path] !== file.content) changes.push({ path: file.path, before: current[file.path] ?? null, after: file.content });
        }
        for (const path of parsed.deletes) if (path in current) changes.push({ path, before: current[path]!, after: null });
        if (changes.length) {
          applyChanges(changes);
          award('first-ai-edit', 15, 'First AI-assisted change');
        }
        update({
          content: parsed.prose || (changes.length ? 'Done — the changes are below and already running in the preview.' : ''),
          status: 'done',
          changes: changes.length ? changes : undefined,
          pending: undefined,
        });
      } catch (error) {
        onText.cancel();
        const info = describeError(error);
        update({ status: 'error', error: info.code === 'aborted' ? 'Stopped.' : info.message, pending: undefined });
      } finally {
        if (isCurrent(projectId)) set({ chatBusy: false });
        finishController('chat', controller);
      }
    },

    revertChanges(messageId) {
      const message = get().project?.chat.find((m) => m.id === messageId);
      if (!message?.changes || message.reverted) return;
      patch((p) => {
        const files = { ...p.files };
        for (const change of [...message.changes!].reverse()) {
          if (change.before === null) delete files[change.path];
          else files[change.path] = change.before;
        }
        return { files, chat: p.chat.map((m) => (m.id === messageId ? { ...m, reverted: true } : m)) };
      });
    },

    clearChat: () => patch({ chat: [] }),

    markFileViewed(path) {
      const project = get().project;
      if (!project || project.progress.viewedFiles.includes(path)) return;
      patch((p) => ({ progress: { ...p.progress, viewedFiles: [...p.progress.viewedFiles, path] } }));
      award(`view:${project.id}:${path}`, 5, 'Explored a file');
    },

    toggleConcept(conceptId) {
      const project = get().project;
      if (!project) return;
      const done = project.progress.conceptsDone.includes(conceptId);
      patch((p) => ({
        progress: {
          ...p.progress,
          conceptsDone: done ? p.progress.conceptsDone.filter((c) => c !== conceptId) : [...p.progress.conceptsDone, conceptId],
        },
      }));
      if (!done) award(`concept:${project.id}:${conceptId}`, 10, 'Concept mastered');
    },

    answerQuiz(questionId, option, correct) {
      const project = get().project;
      if (!project || questionId in project.progress.quiz) return;
      patch((p) => ({ progress: { ...p.progress, quiz: { ...p.progress.quiz, [questionId]: option } } }));
      if (correct) award(`quiz:${project.id}:${questionId}`, 20, 'Correct answer');
    },

    revealHint: (challengeId) =>
      patch((p) => ({ progress: { ...p.progress, hintsShown: { ...p.progress.hintsShown, [challengeId]: (p.progress.hintsShown[challengeId] ?? 0) + 1 } } })),

    completeChallenge(challengeId, xp) {
      const project = get().project;
      if (!project || project.progress.challengesDone.includes(challengeId)) return;
      patch((p) => ({ progress: { ...p.progress, challengesDone: [...p.progress.challengesDone, challengeId] } }));
      award(`challenge:${project.id}:${challengeId}`, xp, 'Challenge complete');
    },
  };
});

/* ───────────────────────── persistence ───────────────────────── */

let saveTimer: ReturnType<typeof setTimeout> | undefined;
useStudio.subscribe((state, previous) => {
  if (!state.project || state.project === previous.project) return;
  const project = state.project;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveProject(project), 400);
});
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const project = useStudio.getState().project;
    if (project) saveProject(project);
  });
}
