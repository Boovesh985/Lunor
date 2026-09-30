/**
 * Zod schemas for every AI stage. They are the single source of truth for:
 *  - the JSON Schema we hand Claude as a structured-output format (server)
 *  - request validation (server)
 *  - TypeScript types and runtime validation of AI + sample data (client, tests)
 *
 * Every field is required on purpose: strict structured outputs work best with
 * fully-required objects, and the UI never has to guess what "missing" means.
 * Enum-like strings are also re-validated leniently on the client because the
 * schema transform turns some constraints into descriptions.
 */
import { z } from 'zod';
import { LEVELS, type Level } from './levels.js';

export { LEVELS, type Level };
export const LevelSchema = z.enum(LEVELS);

export const STAGES = ['understand', 'plan', 'build', 'explain', 'learn'] as const;
export type StageId = (typeof STAGES)[number];

/* ───────────────────────────── ① Understand ───────────────────────────── */

export const UnderstandingSchema = z.object({
  appName: z.string().describe('Short, memorable product name (1-2 words), e.g. "SplitMate"'),
  tagline: z.string().describe('One-line value proposition, at most ~70 characters'),
  emoji: z.string().describe('Exactly one emoji that represents the app'),
  category: z.string().describe('App store category, e.g. Productivity, Finance, Education, Health & Fitness, Social, Lifestyle'),
  summary: z.string().describe('2-3 sentences restating the idea in your own words, showing you understood the real need behind it'),
  problem: z.string().describe('The core problem, who has it and why current workarounds fall short (2-3 sentences)'),
  targetUsers: z
    .array(
      z.object({
        persona: z.string().describe('Short persona label, e.g. "Hostel student on a budget"'),
        description: z.string().describe('One sentence about their situation'),
        needs: z.array(z.string()).describe('2-3 concrete needs'),
      }),
    )
    .describe('1-3 personas'),
  features: z
    .array(
      z.object({
        id: z.string().describe('kebab-case id, unique'),
        name: z.string().describe('2-4 words'),
        description: z.string().describe('What the user can do, one sentence'),
        priority: z.enum(['must', 'should', 'could']).describe('MoSCoW priority'),
      }),
    )
    .describe('5-9 features prioritised with MoSCoW; the "must" set is the MVP'),
  outOfScope: z.array(z.string()).describe('2-4 things intentionally NOT built in v1'),
  assumptions: z.array(z.string()).describe('2-4 assumptions you made to fill gaps in the idea'),
  scopeNote: z
    .string()
    .describe('How the idea was scoped into a prototype that runs fully on-device (e.g. local storage and sample data instead of a backend). Empty string if nothing was cut.'),
  clarifyingQuestions: z
    .array(
      z.object({
        id: z.string().describe('kebab-case id'),
        question: z.string(),
        why: z.string().describe('Why the answer changes the design, one sentence'),
        options: z.array(z.string()).describe('2-4 short answer options'),
        defaultIndex: z.number().int().describe('0-based index of the option you recommend'),
      }),
    )
    .describe('2-4 high-impact product or UX decisions the student should make'),
  complexity: z.object({
    level: LevelSchema,
    reasoning: z.string().describe('One or two sentences'),
    estimatedHours: z.number().describe('Rough hours for a student to build the MVP by hand'),
  }),
  platform: z.object({
    recommendation: z.string().describe('Always "React Native + Expo"'),
    reasoning: z.string().describe('Why it suits THIS idea (2 sentences)'),
    alternatives: z
      .array(z.object({ name: z.string(), tradeoff: z.string().describe('One honest sentence') }))
      .describe('2-3 alternatives such as Flutter, native Kotlin/Swift or a PWA'),
  }),
  learningOpportunities: z.array(z.string()).describe('3-5 skills the student will practise by building this'),
});
export type Understanding = z.infer<typeof UnderstandingSchema>;

/* ─────────────────────────────── ② Plan ──────────────────────────────── */

export const FILE_KINDS = ['entry', 'screen', 'component', 'hook', 'context', 'util', 'data', 'theme', 'navigation'] as const;
export const SCREEN_KINDS = ['tab', 'stack', 'modal'] as const;

export const PlanSchema = z.object({
  summary: z.string().describe('2-3 sentence overview of the architecture'),
  techStack: z
    .array(
      z.object({
        name: z.string(),
        category: z.string().describe('One of: Framework, Language, UI, State, Storage, Navigation, Icons, Tooling'),
        reason: z.string().describe('Why it was chosen for this app, one sentence'),
      }),
    )
    .describe('4-7 items'),
  screens: z
    .array(
      z.object({
        id: z.string().describe('camelCase id, e.g. "home"'),
        name: z.string().describe('Human name, e.g. "Home"'),
        purpose: z.string().describe('One sentence'),
        kind: z.enum(SCREEN_KINDS).describe('tab = in the bottom tab bar, stack = pushed on top, modal = presented over the current screen'),
        components: z.array(z.string()).describe('3-6 key UI elements on this screen'),
        navigatesTo: z
          .array(z.object({ screenId: z.string(), trigger: z.string().describe('User action, e.g. "Tap + button"') }))
          .describe('Outgoing navigation from this screen'),
      }),
    )
    .describe('3-6 screens'),
  navigation: z.object({
    pattern: z.string().describe('e.g. "Bottom tabs + modal"'),
    description: z.string().describe('How navigation is implemented with React state (1-2 sentences)'),
  }),
  dataModel: z
    .array(
      z.object({
        entity: z.string().describe('PascalCase entity name'),
        description: z.string(),
        fields: z.array(z.object({ name: z.string(), type: z.string(), description: z.string() })),
        relations: z.array(z.string()).describe('e.g. "Expense.paidBy → Member.id"; empty if none'),
      }),
    )
    .describe('1-4 entities'),
  stateManagement: z.object({ approach: z.string(), description: z.string() }),
  persistence: z.object({ approach: z.string(), description: z.string() }),
  architecture: z
    .array(z.object({ layer: z.string(), description: z.string(), files: z.array(z.string()) }))
    .describe('3-5 layers from the UI down to data'),
  files: z
    .array(
      z.object({
        path: z.string().describe('Relative path, e.g. "src/screens/HomeScreen.js"'),
        purpose: z.string().describe('One sentence'),
        kind: z.enum(FILE_KINDS),
      }),
    )
    .describe('6-12 JavaScript files; must include "App.js" at the root'),
  buildSteps: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().describe('3-6 words'),
        description: z.string().describe('What gets built and why, 1-2 sentences'),
        files: z.array(z.string()).describe('Paths from `files` created in this step'),
        concepts: z.array(z.string()).describe('2-4 concept ids from the taxonomy'),
      }),
    )
    .describe('4-6 ordered steps; together they cover every file exactly once'),
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })).describe('2-4 technical or product risks'),
  futureIdeas: z.array(z.string()).describe('3-4 things to add after the MVP (backend, auth, notifications, ...)'),
});
export type Plan = z.infer<typeof PlanSchema>;

/* ────────────────────────────── ④ Explain ─────────────────────────────── */

const LineRange = {
  startLine: z.number().int().describe('1-based first line'),
  endLine: z.number().int().describe('1-based last line (inclusive)'),
  anchor: z.string().describe('The exact text of startLine, trimmed, copied verbatim from the code'),
};

export const CodeSectionSchema = z.object({
  title: z.string().describe('3-7 words'),
  ...LineRange,
  explanation: z.string().describe('Markdown. Explain what it does AND why, adapted to the learner level'),
  concepts: z.array(z.string()).describe('1-3 concept ids from the taxonomy'),
});
export type CodeSection = z.infer<typeof CodeSectionSchema>;

export const ExplanationSchema = z.object({
  overview: z.string().describe('Markdown. How the app works end to end, 1-2 short paragraphs'),
  architecture: z
    .array(z.object({ layer: z.string(), description: z.string(), files: z.array(z.string()) }))
    .describe('3-5 layers, UI first'),
  dataFlow: z.object({
    scenario: z.string().describe('One key user action, e.g. "Adding a new expense"'),
    steps: z
      .array(
        z.object({
          title: z.string(),
          description: z.string().describe('What happens at this step, one or two sentences'),
          file: z.string(),
          ...LineRange,
        }),
      )
      .describe('4-7 steps across files, in execution order'),
  }),
  files: z
    .array(
      z.object({
        path: z.string(),
        role: z.string().describe('Short phrase, e.g. "Screen", "Custom hook", "Design tokens"'),
        summary: z.string().describe('What this file is responsible for, 1-2 sentences'),
        sections: z.array(CodeSectionSchema).describe('2-5 sections covering the most important code, in file order'),
      }),
    )
    .describe('One entry per project file'),
  glossary: z.array(z.object({ term: z.string(), definition: z.string() })).describe('5-10 terms a learner meets in this code'),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

/* ─────────────────────────────── ⑤ Learn ─────────────────────────────── */

export const CodeRefSchema = z.object({
  file: z.string(),
  ...LineRange,
  note: z.string().describe('What to notice here, one sentence'),
});
export type CodeRef = z.infer<typeof CodeRefSchema>;

export const LearnSchema = z.object({
  headline: z.string().describe('Motivating one-liner about what building this app teaches'),
  concepts: z
    .array(
      z.object({
        conceptId: z.string().describe('Id from the taxonomy'),
        explanation: z.string().describe('Personalised explanation grounded in THIS code, adapted to the level (2-4 sentences)'),
        whyItMatters: z.string().describe('One sentence on real-world relevance'),
        codeRefs: z.array(CodeRefSchema).describe('1-3 places in the code that demonstrate the concept'),
        practiceTip: z.string().describe('A tiny change to try in the editor to see the concept in action'),
      }),
    )
    .describe('6-10 concepts, ordered from foundational to advanced'),
  quiz: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        codeRef: CodeRefSchema.describe('The code the question is about'),
        options: z.array(z.string()).describe('Exactly 4 options'),
        answerIndex: z.number().int().describe('0-based index of the correct option'),
        explanation: z.string().describe('Why the answer is right and the others are not'),
        conceptId: z.string(),
      }),
    )
    .describe('5 questions grounded in this code'),
  challenges: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        difficulty: z.enum(['easy', 'medium', 'hard']),
        description: z.string().describe('What to add or change in this app'),
        hints: z.array(z.string()).describe('2-3 progressive hints'),
        conceptIds: z.array(z.string()),
        acceptanceCriteria: z.array(z.string()).describe('2-3 checks that define done'),
      }),
    )
    .describe('3 challenges: one easy, one medium, one hard'),
  nextSteps: z
    .array(z.object({ conceptId: z.string(), reason: z.string() }))
    .describe('3-4 concept ids from the taxonomy that this app does NOT cover, to learn next'),
});
export type LearnContent = z.infer<typeof LearnSchema>;

/* ───────────────────────────── Requests ─────────────────────────────── */

export const FilesSchema = z.record(z.string().max(200), z.string().max(60_000));
export type ProjectFiles = z.infer<typeof FilesSchema>;

const Idea = z.string().trim().min(8, 'Describe your idea in a sentence or two').max(1500);
const LooseObject = z.record(z.string(), z.unknown());

export const UnderstandRequestSchema = z.object({ idea: Idea, level: LevelSchema });

export const PlanRequestSchema = z.object({
  idea: Idea,
  level: LevelSchema,
  understanding: LooseObject,
  answers: z.array(z.object({ question: z.string().max(400), answer: z.string().max(400) })).max(8),
  excludedFeatures: z.array(z.string().max(120)).max(20),
});

export const BuildRequestSchema = z.object({
  idea: Idea,
  level: LevelSchema,
  understanding: LooseObject,
  plan: LooseObject,
  /** Continuation: files already generated by an interrupted build. */
  existingFiles: FilesSchema.optional(),
  /** Continuation: paths still needed (unwritten plan files + unresolved imports). */
  missing: z.array(z.string().max(200)).max(40).optional(),
});

export const ExplainRequestSchema = z.object({
  level: LevelSchema,
  appName: z.string().max(80),
  planSummary: z.string().max(4000),
  files: FilesSchema,
});

export const LearnRequestSchema = ExplainRequestSchema;

export const CHAT_INTENTS = ['ask', 'edit', 'fix', 'review'] as const;
export type ChatIntent = (typeof CHAT_INTENTS)[number];

export const ChatRequestSchema = z.object({
  level: LevelSchema,
  appName: z.string().max(80),
  planSummary: z.string().max(4000),
  files: FilesSchema,
  intent: z.enum(CHAT_INTENTS),
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(40_000) }))
    .min(1)
    .max(24),
  /** Optional focus: an open file, a selection or a runtime error. */
  context: z
    .object({
      file: z.string().max(200).optional(),
      selection: z.string().max(8000).optional(),
      error: z.string().max(4000).optional(),
      originalFiles: FilesSchema.optional(),
    })
    .optional(),
});

export type UnderstandRequest = z.infer<typeof UnderstandRequestSchema>;
export type PlanRequest = z.infer<typeof PlanRequestSchema>;
export type BuildRequest = z.infer<typeof BuildRequestSchema>;
export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;
export type LearnRequest = z.infer<typeof LearnRequestSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

/* ─────────────────────────── Stream protocol ─────────────────────────── */

/** One line of the NDJSON stream every AI endpoint returns. */
export type StreamEvent =
  | { type: 'meta'; model: string; mock: boolean }
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string }
  /** The provider switched model mid-answer: discard the partial output and keep reading. */
  | { type: 'restart'; model: string; reason: string }
  | { type: 'ping' }
  | { type: 'done'; stopReason: string | null; usage?: { input: number; output: number } }
  | { type: 'error'; code: string; message: string };
