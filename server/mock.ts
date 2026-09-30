/**
 * Mock mode (LUNOR_MOCK_AI=1): replays the bundled sample projects through
 * the real HTTP + NDJSON streaming path, so the full live pipeline can be
 * developed and tested without an API key. Never used when a key is present
 * in the request, and off unless explicitly enabled.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { toFileBlocks } from '../shared/fileProtocol.js';
import type { StreamEvent } from '../shared/schemas.js';
import type { StageName } from './stages.js';

export function isMockMode(): boolean {
  return process.env.LUNOR_MOCK_AI === '1';
}

const SAMPLES_DIR = resolve(process.cwd(), 'samples');

interface MockBody {
  idea?: string;
  appName?: string;
  intent?: string;
  files?: Record<string, string>;
  existingFiles?: Record<string, string>;
  messages?: { role: string; content: string }[];
}

function pickSample(body: MockBody): string {
  const text = `${body.idea ?? ''} ${body.appName ?? ''}`;
  return /split|expense|bill|roommate|money|owe|hostel|rent/i.test(text) ? 'split-mate' : 'habit-hero';
}

async function readJson<T>(sample: string, name: string): Promise<T> {
  return JSON.parse(await readFile(join(SAMPLES_DIR, sample, name), 'utf8')) as T;
}

async function readAppFiles(sample: string): Promise<Record<string, string>> {
  const root = join(SAMPLES_DIR, sample, 'app');
  const files: Record<string, string> = {};
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else files[relative(root, full).replace(/\\/g, '/')] = await readFile(full, 'utf8');
    }
  }
  await walk(root);
  return files;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolveSleep, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'));
    const timer = setTimeout(resolveSleep, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    }, { once: true });
  });
}

async function* chunked(type: 'text' | 'thinking', text: string, size: number, delay: number, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  for (let i = 0; i < text.length; i += size) {
    await sleep(delay, signal);
    yield { type, text: text.slice(i, i + size) };
  }
}

/** Order files like the plan's build steps (App.js last), as the real model does. */
async function orderByPlan(sample: string, files: Record<string, string>): Promise<Record<string, string>> {
  const plan = await readJson<{ buildSteps?: { files: string[] }[] }>(sample, 'plan.json').catch(() => ({ buildSteps: [] }));
  const order = (plan.buildSteps ?? []).flatMap((step) => step.files);
  const rank = (path: string) => (path === 'App.js' ? 1e6 : order.includes(path) ? order.indexOf(path) : 1e5);
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => rank(a) - rank(b)));
}

function mockChat(body: MockBody): string {
  const files = body.files ?? {};
  const question = body.messages?.at(-1)?.content ?? '';
  if (body.intent === 'edit' || body.intent === 'fix') {
    const themePath = Object.keys(files).find((p) => p.endsWith('theme.js'));
    if (!themePath) return 'In mock mode I can only demo edits on projects with a src/theme.js file.';
    const updated = files[themePath]!.replace(/primary:\s*'#[0-9A-Fa-f]{6}'/, "primary: '#0EA5A4'");
    return `Mock mode demo edit: I'll switch the primary colour in the design tokens. Because every screen reads \`colors.primary\` from \`${themePath}\`, one change restyles the whole app — that's the payoff of design tokens.

<file path="${themePath}">
${updated}
</file>

**What changed**
- \`colors.primary\` is now teal (\`#0EA5A4\`).

Try it: look at the preview — buttons, progress and the active tab all changed together.`;
  }
  if (body.intent === 'review') {
    return `**Mock review.** Nice work! Your change keeps state immutable and reuses the theme tokens.\n\n- ✅ Works on first launch\n- ⚠️ Consider validating empty input before saving\n\n_Connect a real API key for a genuine review of your code._`;
  }
  return `Great question! _(This is a mock-mode answer — add an Anthropic API key for real mentoring.)_

You asked: "${question.slice(0, 160)}"

In this app, state lives in a custom hook and every screen receives it through props. When you tap a card, the hook creates a **new** array with the updated item (\`setState(current => current.map(...))\`), React re-renders, and a \`useEffect\` saves the new list to **AsyncStorage** so it survives a restart.

**Try it:** open \`src/theme.js\` and change \`colors.primary\` — the preview updates instantly.`;
}

export async function* mockStream(stage: StageName, rawBody: unknown, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  const body = rawBody as MockBody;
  const sample = pickSample(body);
  try {
    const thinking = await readJson<Record<string, string>>(sample, 'thinking.json').catch(() => ({}) as Record<string, string>);
    const stageThinking = thinking[stage];
    if (stageThinking) yield* chunked('thinking', stageThinking, 36, 22, signal);

    let output = '';
    if (stage === 'understand') output = JSON.stringify(await readJson(sample, 'understanding.json'));
    else if (stage === 'plan') output = JSON.stringify(await readJson(sample, 'plan.json'));
    else if (stage === 'explain') output = JSON.stringify(await readJson(sample, 'explanation.json'));
    else if (stage === 'learn') output = JSON.stringify(await readJson(sample, 'learn.json'));
    else if (stage === 'chat') output = mockChat(body);
    else {
      const all = await orderByPlan(sample, await readAppFiles(sample));
      const existing = body.existingFiles ?? {};
      output = toFileBlocks(Object.fromEntries(Object.entries(all).filter(([path]) => !(path in existing))));
    }

    yield* chunked('text', output, stage === 'build' ? 110 : 30, stage === 'build' ? 12 : 10, signal);
    yield { type: 'done', stopReason: 'end_turn', usage: { input: 0, output: 0 } };
  } catch (error) {
    if (signal?.aborted) {
      yield { type: 'error', code: 'aborted', message: 'Request cancelled.' };
      return;
    }
    yield { type: 'error', code: 'mock', message: `Mock mode could not load sample data: ${(error as Error).message}` };
  }
}
