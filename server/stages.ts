/**
 * One definition per pipeline stage: how to validate the request and how to
 * turn it into a model call (prompt, output schema, effort, token budget).
 * The call is written in Claude's message shape; server/gemini.ts adapts it.
 */
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { BetaJSONOutputFormat, BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { z } from 'zod';
import { toFileBlocks, withLineNumbers } from '../shared/fileProtocol.js';
import {
  BuildRequestSchema,
  ChatRequestSchema,
  ExplainRequestSchema,
  ExplanationSchema,
  LearnRequestSchema,
  LearnSchema,
  PlanRequestSchema,
  PlanSchema,
  UnderstandRequestSchema,
  UnderstandingSchema,
  type BuildRequest,
  type ChatRequest,
  type ExplainRequest,
  type LearnRequest,
  type PlanRequest,
  type UnderstandRequest,
} from '../shared/schemas.js';
import type { Effort } from './claude.js';
import { BUILD_SYSTEM, CHAT_SYSTEM, EXPLAIN_SYSTEM, LEARN_SYSTEM, PLAN_SYSTEM, UNDERSTAND_SYSTEM, levelLine } from './prompts.js';

export type StageName = 'understand' | 'plan' | 'build' | 'explain' | 'learn' | 'chat';

export interface StageCall {
  system: string;
  messages: BetaMessageParam[];
  maxTokens: number;
  effort: Effort;
  /** Structured-output format for Claude (JSON stages only). */
  format?: BetaJSONOutputFormat;
  /** The same output schema as Zod, for providers that need their own JSON Schema flavour. */
  outputSchema?: z.ZodType;
}

export interface StageDefinition<T> {
  name: StageName;
  schema: z.ZodType<T>;
  /** Weight against the per-IP rate limit. */
  cost: number;
  build(body: T): StageCall;
}

/** Converted once at startup: identical schemas keep the compiled grammar cached. */
function jsonFormat(schema: z.ZodType): BetaJSONOutputFormat {
  return { type: 'json_schema', schema: betaZodOutputFormat(schema).schema };
}
const FORMATS = {
  understanding: jsonFormat(UnderstandingSchema),
  plan: jsonFormat(PlanSchema),
  explanation: jsonFormat(ExplanationSchema),
  learn: jsonFormat(LearnSchema),
};

const EFFORTS = new Set<Effort>(['low', 'medium', 'high']);
function effort(stage: StageName, fallback: Effort): Effort {
  const value = process.env[`LUNOR_EFFORT_${stage.toUpperCase()}`]?.trim().toLowerCase();
  return value && EFFORTS.has(value as Effort) ? (value as Effort) : fallback;
}

const numberedFiles = (files: Record<string, string>) =>
  Object.entries(files)
    .map(([path, code]) => `<file path="${path}">\n${withLineNumbers(code)}\n</file>`)
    .join('\n\n');

const user = (text: string): BetaMessageParam[] => [{ role: 'user', content: text }];

export const understandStage: StageDefinition<UnderstandRequest> = {
  name: 'understand',
  schema: UnderstandRequestSchema,
  cost: 1,
  build: (body) => ({
    system: UNDERSTAND_SYSTEM,
    messages: user(`${levelLine(body.level)}\n\nThe student's app idea:\n"""\n${body.idea}\n"""`),
    maxTokens: 12_000,
    effort: effort('understand', 'low'),
    format: FORMATS.understanding,
    outputSchema: UnderstandingSchema,
  }),
};

export const planStage: StageDefinition<PlanRequest> = {
  name: 'plan',
  schema: PlanRequestSchema,
  cost: 1,
  build: (body) => {
    const decisions = body.answers.length
      ? `The student's decisions:\n${body.answers.map((a) => `- ${a.question} → ${a.answer}`).join('\n')}`
      : 'The student accepted all of your recommended defaults.';
    const removed = body.excludedFeatures.length
      ? `Features the student removed from the MVP (do not plan them): ${body.excludedFeatures.join('; ')}`
      : '';
    return {
      system: PLAN_SYSTEM,
      messages: user(
        [
          levelLine(body.level),
          `Original idea:\n"""\n${body.idea}\n"""`,
          `Approved understanding (JSON):\n${JSON.stringify(body.understanding)}`,
          decisions,
          removed,
        ]
          .filter(Boolean)
          .join('\n\n'),
      ),
      maxTokens: 20_000,
      effort: effort('plan', 'medium'),
      format: FORMATS.plan,
      outputSchema: PlanSchema,
    };
  },
};

export const buildStage: StageDefinition<BuildRequest> = {
  name: 'build',
  schema: BuildRequestSchema,
  cost: 3,
  build: (body) => {
    const existing = body.existingFiles ?? {};
    const planned = ((body.plan as { files?: { path?: string }[] }).files ?? []).map((f) => f.path).filter(Boolean) as string[];
    const remaining = body.missing?.length ? body.missing : planned.filter((path) => !(path in existing));
    const parts = [
      levelLine(body.level),
      `App idea:\n"""\n${body.idea}\n"""`,
      `Understanding (JSON):\n${JSON.stringify(body.understanding)}`,
      `Technical plan to implement (JSON):\n${JSON.stringify(body.plan)}`,
    ];
    if (Object.keys(existing).length > 0) {
      parts.push(
        `The previous generation was interrupted. These files are already complete — do not rewrite them, and keep your imports consistent with their exports:\n\n${toFileBlocks(existing)}`,
        `Write ONLY the remaining files, in plan order: ${remaining.length ? remaining.join(', ') : 'any file App.js still needs'}.`,
      );
    } else {
      parts.push('Write every file in the plan now.');
    }
    return {
      system: BUILD_SYSTEM,
      messages: user(parts.join('\n\n')),
      maxTokens: 64_000,
      effort: effort('build', 'low'),
    };
  },
};

const codeStageMessage = (body: ExplainRequest | LearnRequest) =>
  user([levelLine(body.level), `App: ${body.appName}`, `Architecture summary: ${body.planSummary}`, numberedFiles(body.files)].join('\n\n'));

export const explainStage: StageDefinition<ExplainRequest> = {
  name: 'explain',
  schema: ExplainRequestSchema,
  cost: 1,
  build: (body) => ({
    system: EXPLAIN_SYSTEM,
    messages: codeStageMessage(body),
    maxTokens: 32_000,
    effort: effort('explain', 'low'),
    format: FORMATS.explanation,
    outputSchema: ExplanationSchema,
  }),
};

export const learnStage: StageDefinition<LearnRequest> = {
  name: 'learn',
  schema: LearnRequestSchema,
  cost: 1,
  build: (body) => ({
    system: LEARN_SYSTEM,
    messages: codeStageMessage(body),
    maxTokens: 24_000,
    effort: effort('learn', 'low'),
    format: FORMATS.learn,
    outputSchema: LearnSchema,
  }),
};

function withContext(text: string, body: ChatRequest): string {
  const notes: string[] = [];
  const ctx = body.context;
  if (ctx?.file) notes.push(`The student is looking at ${ctx.file}.`);
  if (ctx?.selection) notes.push(`Code they selected:\n\`\`\`js\n${ctx.selection}\n\`\`\``);
  if (ctx?.error) notes.push(`Current preview error:\n${ctx.error}`);
  return notes.length ? `${text}\n\n---\nContext:\n${notes.join('\n\n')}` : text;
}

export const chatStage: StageDefinition<ChatRequest> = {
  name: 'chat',
  schema: ChatRequestSchema,
  cost: 1,
  build: (body) => {
    // The conversation must start with a user turn.
    const history = body.messages.slice(body.messages.findIndex((m) => m.role === 'user'));
    const original =
      body.intent === 'review' && body.context?.originalFiles
        ? `\n\nOriginal generated files (before the student's own changes):\n${toFileBlocks(body.context.originalFiles)}`
        : '';
    const project = `${levelLine(body.level)}\nApp: ${body.appName}\nArchitecture summary: ${body.planSummary}\n\nCurrent project files:\n${numberedFiles(body.files)}${original}`;

    const messages: BetaMessageParam[] = history.map((message, i) => {
      const text = i === history.length - 1 ? withContext(message.content, body) : message.content;
      if (i === 0) {
        return {
          role: 'user',
          // The project block is cached so follow-up questions on the same code are cheap.
          content: [
            { type: 'text', text: project, cache_control: { type: 'ephemeral' } },
            { type: 'text', text },
          ],
        };
      }
      return { role: message.role, content: text };
    });

    return {
      system: CHAT_SYSTEM,
      messages,
      maxTokens: 32_000,
      effort: body.intent === 'ask' ? effort('chat', 'low') : effort('chat', 'medium'),
    };
  },
};
