import { Check, CheckCircle2, ChevronRight, Code2, ExternalLink, Flag, GraduationCap, Lightbulb, ListChecks, MessageSquareCode, RefreshCcw, Swords, Target, Trophy, Wand2, XCircle } from 'lucide-react';
import { useMemo } from 'react';
import { getConcept, levelsForConcepts, LUNOR_ROADMAP, LUNOR_TRACK_URL } from '../../shared/concepts.ts';
import { resolveRange, sliceLines } from '../../shared/codeRefs.ts';
import type { CodeRef, LearnContent } from '../../shared/schemas.ts';
import { InlineMarkdown, Markdown } from '../components/Markdown';
import { StageError } from '../components/StageError';
import { StageHeader } from '../components/StageHeader';
import { ThinkingPanel } from '../components/ThinkingPanel';
import { Badge, Button, Card, ProgressBar, Skeleton } from '../components/ui';
import { highlightJs } from '../lib/highlight';
import { hashFiles } from '../lib/projects';
import { useLiveAI } from '../lib/settings';
import type { DeepPartial } from '../lib/types';
import { cn } from '../lib/utils';
import { useStudio } from '../store/studio';

type L = DeepPartial<LearnContent>;

const CHALLENGE_XP = { easy: 30, medium: 50, hard: 80 } as const;
const DIFFICULTY_TONE = { easy: 'ok', medium: 'warn', hard: 'brand' } as const;
const TIERS = ['Beginner', 'Easy', 'Intermediate', 'Advanced', 'Expert'] as const;

function RoadmapMap({ covered, next }: { covered: number[]; next: number[] }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {TIERS.map((tier) => (
          <div key={tier} className="min-w-0">
            <div className="mb-1.5 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle" title={tier}>{tier}</div>
            <div className="grid grid-cols-3 gap-1">
              {LUNOR_ROADMAP.filter((l) => l.tier === tier).map((level) => {
                const isCovered = covered.includes(level.level);
                const isNext = next.includes(level.level);
                return (
                  <div
                    key={level.level}
                    title={`Level ${level.level} — ${level.title}${level.milestone ? ` · ${level.milestone}` : ''}${isCovered ? ' · covered by this app' : isNext ? ' · suggested next' : ''}`}
                    className={cn(
                      'relative flex aspect-square items-center justify-center rounded-md font-mono text-[10px] transition-colors',
                      isCovered ? 'bg-gradient-brand font-semibold text-white shadow-[0_0_14px_rgba(237,44,44,0.35)]' : isNext ? 'border border-dashed border-brand-2/70 text-brand-2' : 'bg-white/[0.05] text-subtle',
                    )}
                  >
                    {level.level}
                    {level.milestone && <Flag className="absolute -right-0.5 -top-0.5 size-2.5 text-[#fcc56b]" />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-gradient-brand" /> Covered by your app</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-dashed border-brand-2" /> Suggested next</span>
        <span className="flex items-center gap-1.5"><Flag className="size-3 text-[#fcc56b]" /> Milestone project</span>
      </div>
    </div>
  );
}

function CodeSnippet({ codeRef, files }: { codeRef?: DeepPartial<CodeRef>; files: Record<string, string> }) {
  if (!codeRef?.file || !(codeRef.file in files)) return null;
  const content = files[codeRef.file]!;
  const range = resolveRange(content, { startLine: codeRef.startLine ?? 1, endLine: codeRef.endLine ?? codeRef.startLine ?? 1, anchor: codeRef.anchor });
  const end = Math.min(range.end, range.start + 14);
  const snippet = sliceLines(content, range.start, end);
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-[#0b0b0b]">
      <div className="border-b border-line px-3 py-1.5 font-mono text-[11px] text-subtle">
        {codeRef.file} · lines {range.start}–{end}
      </div>
      <pre className="scrollbar-none overflow-x-auto px-3 py-2 font-mono text-[12px] leading-relaxed">
        {snippet.split('\n').map((line, i) => (
          <div key={i} className="flex">
            <span className="mr-3 w-6 shrink-0 select-none text-right text-[#454545]">{range.start + i}</span>
            <span>{highlightJs(line)}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

function Concepts({ data }: { data: L }) {
  const project = useStudio((s) => s.project)!;
  const { toggleConcept, focusCode } = useStudio.getState();
  const concepts = (data.concepts ?? []).filter((c) => c?.conceptId);
  if (!concepts.length) return null;
  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
        <Lightbulb className="size-5 text-brand-2" /> Concepts in your code
      </h2>
      <p className="mb-4 text-sm text-muted">Each one is explained with your own code. Mark it understood when it clicks (+10 XP).</p>
      <div className="grid gap-4 md:grid-cols-2">
        {concepts.map((item) => {
          const concept = getConcept(item.conceptId!);
          const done = project.progress.conceptsDone.includes(item.conceptId!);
          const level = concept ? LUNOR_ROADMAP[concept.lunorLevel - 1] : undefined;
          return (
            <Card key={item.conceptId} className={cn('flex flex-col p-5', done && 'border-ok/30')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-fg">{concept?.name ?? item.conceptId}</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {concept && <Badge>{concept.category}</Badge>}
                    {level && <Badge tone="brand">Lunor L{level.level} · {level.title}</Badge>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleConcept(item.conceptId!)}
                  className={cn('flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors', done ? 'border-ok bg-ok/15 text-ok' : 'border-line text-subtle hover:border-ok/50 hover:text-ok')}
                  aria-label={done ? 'Mark as not understood' : 'Mark as understood'}
                  title={done ? 'Understood' : 'Mark as understood'}
                >
                  <Check className="size-4" />
                </button>
              </div>
              {item.explanation && <Markdown className="mt-3 text-sm">{item.explanation}</Markdown>}
              {item.whyItMatters && <p className="mt-2 text-xs text-muted"><span className="font-medium text-soft">Why it matters: </span><InlineMarkdown>{item.whyItMatters}</InlineMarkdown></p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(item.codeRefs ?? []).filter((r) => r?.file && r.file in project.files).map((ref, i) => {
                  const range = resolveRange(project.files[ref.file!], { startLine: ref.startLine ?? 1, endLine: ref.endLine ?? ref.startLine ?? 1, anchor: ref.anchor });
                  return (
                    <button
                      key={i}
                      type="button"
                      title={ref.note}
                      onClick={() => focusCode(ref.file!, range.start, range.end, 'explain')}
                      className="flex items-center gap-1 rounded-md border border-line bg-panel px-2 py-1 font-mono text-[11px] text-soft hover:border-brand/40 hover:text-fg"
                    >
                      <Code2 className="size-3 text-brand-2" /> {ref.file!.split('/').pop()}:{range.start}
                    </button>
                  );
                })}
              </div>
              {item.practiceTip && (
                <div className="mt-3 rounded-lg bg-white/[0.03] p-3 text-xs leading-relaxed text-soft">
                  <span className="font-semibold text-brand-2">Try it: </span>
                  <InlineMarkdown>{item.practiceTip}</InlineMarkdown>
                </div>
              )}
              {concept && (
                <a href={concept.docsUrl} target="_blank" rel="noreferrer" className="mt-auto flex items-center gap-1 pt-3 text-xs text-muted hover:text-fg">
                  Official docs <ExternalLink className="size-3" />
                </a>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function Quiz({ data }: { data: L }) {
  const project = useStudio((s) => s.project)!;
  const { answerQuiz } = useStudio.getState();
  const questions = (data.quiz ?? []).filter((q) => q?.id && q.question && (q.options?.length ?? 0) >= 2);
  if (!questions.length) return null;
  const answers = project.progress.quiz;
  const answered = questions.filter((q) => q.id! in answers);
  const correct = answered.filter((q) => answers[q.id!] === q.answerIndex).length;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Target className="size-5 text-brand-2" /> Quiz: your own code
          </h2>
          <p className="mt-1 text-sm text-muted">Every question is about the app you just built. +20 XP per correct answer — first try only.</p>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-bold tabular-nums">
            {correct}<span className="text-muted">/{questions.length}</span>
          </div>
          <div className="text-xs text-muted">{answered.length < questions.length ? `${questions.length - answered.length} left` : correct === questions.length ? 'Perfect score! 🎉' : 'Quiz complete'}</div>
        </div>
      </div>
      <div className="space-y-4">
        {questions.map((q, qi) => {
          const chosen = answers[q.id!];
          const isAnswered = chosen !== undefined;
          return (
            <Card key={q.id} className="p-5">
              <p className="font-medium text-fg">
                <span className="mr-2 font-mono text-sm text-brand-2">Q{qi + 1}</span>
                <InlineMarkdown>{q.question ?? ''}</InlineMarkdown>
              </p>
              <div className="mt-3">
                <CodeSnippet codeRef={q.codeRef} files={project.files} />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {q.options!.map((option, i) => {
                  const isCorrect = i === q.answerIndex;
                  const isChosen = i === chosen;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={isAnswered}
                      onClick={() => answerQuiz(q.id!, i, isCorrect)}
                      className={cn(
                        'flex items-start gap-2.5 rounded-lg border p-3 text-left text-sm transition-colors',
                        !isAnswered && 'border-line hover:border-brand/40 hover:bg-white/[0.02]',
                        isAnswered && isCorrect && 'border-ok/50 bg-ok/10 text-fg',
                        isAnswered && isChosen && !isCorrect && 'border-brand/50 bg-brand/10',
                        isAnswered && !isCorrect && !isChosen && 'border-line opacity-50',
                      )}
                    >
                      <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-line font-mono text-[10px] text-muted">
                        {isAnswered && isCorrect ? <CheckCircle2 className="size-4 text-ok" /> : isAnswered && isChosen ? <XCircle className="size-4 text-[#ff8a80]" /> : String.fromCharCode(65 + i)}
                      </span>
                      <InlineMarkdown className="text-soft" links={false}>{option}</InlineMarkdown>
                    </button>
                  );
                })}
              </div>
              {isAnswered && q.explanation && (
                <div className={cn('mt-4 rounded-lg p-3.5', chosen === q.answerIndex ? 'bg-ok/[0.07]' : 'bg-brand/[0.07]')}>
                  <Markdown className="text-sm">{`**${chosen === q.answerIndex ? 'Correct!' : 'Not quite.'}** ${q.explanation}`}</Markdown>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function Challenges({ data }: { data: L }) {
  const project = useStudio((s) => s.project)!;
  const chatBusy = useStudio((s) => s.chatBusy);
  const live = useLiveAI();
  const { revealHint, completeChallenge, sendMessage, setStage } = useStudio.getState();
  const challenges = (data.challenges ?? []).filter((c) => c?.id && c.title);
  if (!challenges.length) return null;
  const edited = !!project.generatedFiles && hashFiles(project.files) !== hashFiles(project.generatedFiles);
  const needsKey = live.live ? undefined : 'Add an API key in Settings to use the AI mentor';

  return (
    <section>
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
        <Swords className="size-5 text-brand-2" /> Challenges: extend your app
      </h2>
      <p className="mb-4 text-sm text-muted">Build it yourself in the editor, then ask the mentor to review your attempt. Stuck? Reveal a hint, or let the AI show you how.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        {challenges.map((c) => {
          const difficulty = (c.difficulty ?? 'easy') as keyof typeof CHALLENGE_XP;
          const xp = CHALLENGE_XP[difficulty] ?? 30;
          const hintsShown = project.progress.hintsShown[c.id!] ?? 0;
          const hints = c.hints ?? [];
          const done = project.progress.challengesDone.includes(c.id!);
          const brief = `"${c.title}": ${c.description}\nAcceptance criteria:\n${(c.acceptanceCriteria ?? []).map((a) => `- ${a}`).join('\n')}`;
          return (
            <Card key={c.id} className={cn('flex flex-col p-5', done && 'border-ok/40')}>
              <div className="flex items-center justify-between">
                <Badge tone={DIFFICULTY_TONE[difficulty] ?? 'neutral'} className="capitalize">{difficulty}</Badge>
                <span className="flex items-center gap-1 text-xs font-semibold text-[#fcc56b]">
                  <Trophy className="size-3.5" /> {xp} XP
                </span>
              </div>
              <h3 className="mt-3 font-display text-base font-semibold">{c.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-soft"><InlineMarkdown>{c.description ?? ''}</InlineMarkdown></p>
              {(c.acceptanceCriteria?.length ?? 0) > 0 && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">
                    <ListChecks className="size-3" /> Done when
                  </div>
                  <ul className="space-y-1">
                    {c.acceptanceCriteria!.map((a, i) => (
                      <li key={i} className="flex gap-1.5 text-xs text-muted">
                        <ChevronRight className="mt-0.5 size-3 shrink-0" />
                        <InlineMarkdown>{a}</InlineMarkdown>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {hintsShown > 0 && (
                <div className="mt-3 space-y-1.5">
                  {hints.slice(0, hintsShown).map((h, i) => (
                    <p key={i} className="rounded-lg bg-white/[0.03] p-2.5 text-xs text-soft">
                      <span className="font-semibold text-brand-2">Hint {i + 1}: </span>
                      <InlineMarkdown>{h}</InlineMarkdown>
                    </p>
                  ))}
                </div>
              )}
              <div className="mt-auto space-y-2 pt-4">
                {hintsShown < hints.length && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => revealHint(c.id!)}>
                    <Lightbulb className="size-3.5" /> Reveal hint {hintsShown + 1} of {hints.length}
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStage('build')}>
                    <Code2 className="size-3.5" /> Open editor
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!live.live || chatBusy || !edited}
                    title={needsKey ?? (!edited ? 'Edit the code first, then ask for a review' : undefined)}
                    onClick={() => void sendMessage(`Please review my attempt at the challenge ${brief}\nTell me what works, what's missing and any bugs.`, 'review')}
                  >
                    <MessageSquareCode className="size-3.5" /> Review me
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!live.live || chatBusy}
                    title={needsKey}
                    onClick={() => void sendMessage(`Implement this challenge in my app and teach me how you did it: ${brief}`, 'edit')}
                  >
                    <Wand2 className="size-3.5" /> Show me how
                  </Button>
                  <Button variant={done ? 'secondary' : 'primary'} size="sm" disabled={done} onClick={() => completeChallenge(c.id!, xp)}>
                    {done ? <><Check className="size-3.5" /> Done</> : 'Mark done'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export default function LearnStage() {
  const project = useStudio((s) => s.project)!;
  const status = useStudio((s) => s.status.learn);
  const partial = useStudio((s) => s.partial.learn) as L | undefined;
  const thinking = useStudio((s) => s.liveThinking.learn);
  const error = useStudio((s) => s.errors.learn);
  const { runLearn } = useStudio.getState();

  const running = status === 'running';
  const data: L | undefined = running ? partial : project.learn;
  const conceptIds = useMemo(() => (data?.concepts ?? []).map((c) => c?.conceptId).filter((c): c is string => !!c), [data]);
  const covered = useMemo(() => levelsForConcepts(conceptIds), [conceptIds]);
  const next = useMemo(() => levelsForConcepts((data?.nextSteps ?? []).map((n) => n?.conceptId).filter((c): c is string => !!c)).filter((l) => !covered.includes(l)), [data, covered]);
  // The code changed since this path was written (quiz snippets and tips may point at old code).
  const stale = !running && !!project.learn && !!project.learnHash && project.learnHash !== hashFiles(project.files);

  const quizTotal = data?.quiz?.length ?? 0;
  const quizCorrect = (data?.quiz ?? []).filter((q) => q?.id && project.progress.quiz[q.id] === q.answerIndex).length;
  const conceptsDone = conceptIds.filter((c) => project.progress.conceptsDone.includes(c)).length;
  const challengesDone = (data?.challenges ?? []).filter((c) => c?.id && project.progress.challengesDone.includes(c.id)).length;
  const mastery = (conceptsDone + quizCorrect + challengesDone * 2) / Math.max(1, conceptIds.length + quizTotal + (data?.challenges?.length ?? 0) * 2);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-6 sm:px-6 lg:py-8">
        <div>
          <StageHeader
            stage="learn"
            subtitle="Turn what you built into skills you keep."
            actions={
              stale && (
                <Button variant="ghost" size="sm" onClick={() => void runLearn()}>
                  <RefreshCcw className="size-3.5" /> Refresh for my edits
                </Button>
              )
            }
          />
          <div className="space-y-4">
            <ThinkingPanel
              active={running}
              text={running ? thinking : project.thinking.learn}
              label="Lunor AI is designing your learning path"
              placeholder="Matching your code to concepts on Lunor's roadmap…"
            />
            {error && <StageError error={error} onRetry={() => void runLearn()} />}
          </div>
        </div>

        {!data?.headline && running && <Skeleton className="h-56 rounded-card" />}

        {data?.headline && (
          <Card className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand/15 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <div>
                <GraduationCap className="size-6 text-brand-2" />
                <p className="mt-3 font-display text-xl font-semibold leading-snug"><InlineMarkdown>{data.headline}</InlineMarkdown></p>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    ['Concepts', `${conceptsDone}/${conceptIds.length}`],
                    ['Quiz', `${quizCorrect}/${quizTotal}`],
                    ['Challenges', `${challengesDone}/${data.challenges?.length ?? 0}`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-line bg-panel p-3">
                      <div className="font-display text-lg font-bold tabular-nums">{value}</div>
                      <div className="text-[11px] text-muted">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-muted">
                    <span>Mastery of this app</span>
                    <span>{Math.round(mastery * 100)}%</span>
                  </div>
                  <ProgressBar value={mastery} />
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Your place on Lunor's App Development track</div>
                    <div className="text-xs text-muted">
                      This app covers {covered.length} of 30 levels
                    </div>
                  </div>
                  <a href={LUNOR_TRACK_URL} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-xs text-brand-2 hover:underline">
                    Open track <ExternalLink className="size-3" />
                  </a>
                </div>
                <RoadmapMap covered={covered} next={next} />
              </div>
            </div>
          </Card>
        )}

        {data && <Concepts data={data} />}
        {data && !running && <Quiz data={data} />}
        {data && !running && <Challenges data={data} />}

        {!running && (data?.nextSteps?.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <Flag className="size-5 text-brand-2" /> What to learn next
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data!.nextSteps!.map((step, i) => {
                const concept = getConcept(step?.conceptId ?? '');
                const level = concept ? LUNOR_ROADMAP[concept.lunorLevel - 1] : undefined;
                return (
                  <a key={i} href={concept?.docsUrl ?? LUNOR_TRACK_URL} target="_blank" rel="noreferrer" className="group rounded-card border border-dashed border-line bg-card p-4 transition-colors hover:border-brand/40">
                    {level && <div className="text-[11px] font-semibold text-brand-2">Level {level.level} · {level.title}</div>}
                    <div className="mt-1 font-medium">{concept?.name ?? step?.conceptId}</div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted"><InlineMarkdown links={false}>{step?.reason ?? ''}</InlineMarkdown></p>
                    <span className="mt-2 flex items-center gap-1 text-xs text-muted group-hover:text-fg">
                      Start learning <ExternalLink className="size-3" />
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
