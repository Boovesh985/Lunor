/** Project model + persistence in localStorage (no account needed). */
import type { ChatIntent, Explanation, LearnContent, Level, Plan, StageId, Understanding } from '../../shared/schemas.ts';
import { getSample } from '../samples';
import { safeStorage, uid } from './utils';

export interface FileChange {
  path: string;
  /** null = the file was created by this change */
  before: string | null;
  /** null = the file was deleted by this change */
  after: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** For assistant messages: prose, with file blocks replaced by [[file:path]] markers. */
  content: string;
  intent?: ChatIntent;
  status?: 'streaming' | 'done' | 'error';
  error?: string;
  changes?: FileChange[];
  reverted?: boolean;
  /** Files being written while the reply streams. */
  pending?: { path: string; complete: boolean }[];
  createdAt: number;
}

export interface Progress {
  viewedFiles: string[];
  conceptsDone: string[];
  quiz: Record<string, number>;
  challengesDone: string[];
  hintsShown: Record<string, number>;
}

export interface Project {
  id: string;
  createdAt: number;
  updatedAt: number;
  idea: string;
  level: Level;
  source: 'live' | 'sample';
  sampleId?: string;
  understanding?: Understanding;
  /** Clarifying-question id → chosen option index. */
  decisions: Record<string, number>;
  excludedFeatures: string[];
  plan?: Plan;
  files: Record<string, string>;
  /** Files exactly as the build produced them (for reviews and resets). */
  generatedFiles?: Record<string, string>;
  buildComplete: boolean;
  explanation?: Explanation;
  learn?: LearnContent;
  /** Hash of `files` when the walkthrough / learning path were generated. */
  explainedHash?: string;
  learnHash?: string;
  chat: ChatMessage[];
  /** The AI's summarized reasoning per stage. */
  thinking: Partial<Record<StageId, string>>;
  models: Partial<Record<StageId | 'chat', string>>;
  progress: Progress;
}

export interface ProjectSummary {
  id: string;
  name: string;
  emoji: string;
  idea: string;
  level: Level;
  source: Project['source'];
  stage: StageId;
  updatedAt: number;
}

const INDEX_KEY = 'lunor:projects';
const projectKey = (id: string) => `lunor:project:${id}`;
const MAX_PROJECTS = 24;

export function emptyProgress(): Progress {
  return { viewedFiles: [], conceptsDone: [], quiz: {}, challengesDone: [], hintsShown: {} };
}

export function furthestStage(project: Project): StageId {
  if (project.buildComplete && project.learn) return 'learn';
  if (project.buildComplete && project.explanation) return 'explain';
  if (project.buildComplete || Object.keys(project.files).length) return 'build';
  if (project.plan) return 'plan';
  return 'understand';
}

export function summarize(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.understanding?.appName ?? 'New app',
    emoji: project.understanding?.emoji ?? '📱',
    idea: project.idea,
    level: project.level,
    source: project.source,
    stage: furthestStage(project),
    updatedAt: project.updatedAt,
  };
}

export function listProjects(): ProjectSummary[] {
  return safeStorage.get<ProjectSummary[]>(INDEX_KEY, []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProject(id: string): Project | null {
  const project = safeStorage.get<Project | null>(projectKey(id), null);
  if (!project) return null;
  // Forward-compatible defaults for projects saved by older versions.
  return {
    ...project,
    decisions: project.decisions ?? {},
    excludedFeatures: project.excludedFeatures ?? [],
    files: project.files ?? {},
    chat: (project.chat ?? []).map((m) => (m.status === 'streaming' ? { ...m, status: 'error', error: 'Interrupted' } : m)),
    thinking: project.thinking ?? {},
    models: project.models ?? {},
    progress: { ...emptyProgress(), ...project.progress },
  };
}

export function saveProject(project: Project): void {
  const index = listProjects().filter((p) => p.id !== project.id);
  index.unshift(summarize(project));
  while (!safeStorage.set(projectKey(project.id), project) && index.length > 1) {
    // Storage full: drop the oldest project and try again.
    const oldest = index.pop()!;
    safeStorage.remove(projectKey(oldest.id));
  }
  for (const stale of index.slice(MAX_PROJECTS)) safeStorage.remove(projectKey(stale.id));
  safeStorage.set(INDEX_KEY, index.slice(0, MAX_PROJECTS));
}

export function deleteProject(id: string): void {
  safeStorage.remove(projectKey(id));
  safeStorage.remove(`lunor:appdata:${id}`);
  safeStorage.set(INDEX_KEY, listProjects().filter((p) => p.id !== id));
}

/** Cheap content hash to detect code changes after a walkthrough was generated. */
export function hashFiles(files: Record<string, string>): string {
  let hash = 5381;
  for (const [path, code] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const text = path + '\0' + code;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/** A fresh, empty project; stages fill it in as the pipeline runs. */
function newProject(fields: Pick<Project, 'idea' | 'level' | 'source'> & Partial<Project>): Project {
  const now = Date.now();
  return {
    id: uid('p'),
    createdAt: now,
    updatedAt: now,
    decisions: {},
    excludedFeatures: [],
    files: {},
    buildComplete: false,
    chat: [],
    thinking: {},
    models: {},
    progress: emptyProgress(),
    ...fields,
  };
}

export function createLiveProject(idea: string, level: Level): string {
  const project = newProject({ idea: idea.trim(), level, source: 'live' });
  saveProject(project);
  return project.id;
}

export function createSampleProject(sampleId: string): string | null {
  const sample = getSample(sampleId);
  if (!sample) return null;
  const project = newProject({ idea: sample.idea, level: sample.level, source: 'sample', sampleId });
  saveProject(project);
  return project.id;
}
