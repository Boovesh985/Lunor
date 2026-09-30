import { ArrowRight, Ban, Check, Clock, HelpCircle, Layers, RefreshCcw, Smartphone, Sparkles, Target, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Understanding } from '../../shared/schemas.ts';
import { InlineMarkdown } from '../components/Markdown';
import { StageError } from '../components/StageError';
import { StageHeader } from '../components/StageHeader';
import { ThinkingPanel } from '../components/ThinkingPanel';
import { Badge, Button, Card, Skeleton } from '../components/ui';
import type { DeepPartial } from '../lib/types';
import { cn } from '../lib/utils';
import { useStudio } from '../store/studio';

type U = DeepPartial<Understanding>;

const PRIORITY = {
  must: { label: 'Must have', hint: 'The MVP', tone: 'brand' as const },
  should: { label: 'Should have', hint: 'Important', tone: 'info' as const },
  could: { label: 'Could have', hint: 'Nice to have', tone: 'neutral' as const },
};

function Block({ icon, title, children, className }: { icon: ReactNode; title: string; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('animate-fade-up p-5', className)}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
        <span className="text-brand-2">{icon}</span>
        {title}
      </h3>
      {children}
    </Card>
  );
}

function Identity({ u }: { u: U }) {
  const level = u.complexity?.level;
  return (
    <Card className="relative animate-fade-up overflow-hidden p-6">
      <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-brand/15 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-5">
        <span className="flex size-16 items-center justify-center rounded-2xl border border-line bg-elevated text-4xl">{u.emoji ?? '✨'}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold tracking-tight">{u.appName ?? '…'}</h2>
            {u.category && <Badge>{u.category}</Badge>}
          </div>
          {u.tagline && <p className="mt-1 text-soft"><InlineMarkdown>{u.tagline}</InlineMarkdown></p>}
        </div>
        {level && (
          <div className="flex gap-2">
            <Badge tone={level === 'beginner' ? 'ok' : level === 'intermediate' ? 'info' : 'violet'} className="capitalize">
              {level} build
            </Badge>
            {u.complexity?.estimatedHours ? (
              <Badge>
                <Clock className="size-3" /> ~{u.complexity.estimatedHours}h by hand
              </Badge>
            ) : null}
          </div>
        )}
      </div>
      {u.summary && <p className="relative mt-5 text-[15px] leading-relaxed text-soft"><InlineMarkdown>{u.summary ?? ''}</InlineMarkdown></p>}
      {u.complexity?.reasoning && <p className="relative mt-3 text-sm text-muted"><InlineMarkdown>{u.complexity.reasoning ?? ''}</InlineMarkdown></p>}
    </Card>
  );
}

function Features({ u, excluded, onToggle, interactive }: { u: U; excluded: string[]; onToggle(id: string): void; interactive: boolean }) {
  const features = (u.features ?? []).filter((f) => f?.name);
  if (!features.length) return null;
  return (
    <Block icon={<Layers className="size-4" />} title="Features, prioritised (MoSCoW)">
      <p className="-mt-1 mb-4 text-xs text-muted">Untick anything you want to leave out of the first version — the plan will respect it.</p>
      <div className="grid gap-3 md:grid-cols-3">
        {(['must', 'should', 'could'] as const).map((priority) => {
          const items = features.filter((f) => f.priority === priority);
          return (
            <div key={priority} className="rounded-xl border border-line bg-panel p-3">
              <div className="mb-2.5 flex items-center justify-between">
                <Badge tone={PRIORITY[priority].tone}>{PRIORITY[priority].label}</Badge>
                <span className="text-[11px] text-subtle">{PRIORITY[priority].hint}</span>
              </div>
              <div className="space-y-2">
                {items.map((feature) => {
                  const off = excluded.includes(feature.id ?? '');
                  return (
                    <button
                      key={feature.id ?? feature.name}
                      type="button"
                      disabled={!interactive}
                      onClick={() => feature.id && onToggle(feature.id)}
                      className={cn(
                        'flex w-full items-start gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors',
                        interactive && 'hover:border-line hover:bg-white/[0.02]',
                        off && 'opacity-45',
                      )}
                    >
                      <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border', off ? 'border-line-strong' : 'border-brand-2 bg-brand-2/90')}>
                        {!off && <Check className="size-3 text-white" />}
                      </span>
                      <span>
                        <span className={cn('block text-sm font-medium', off && 'line-through')}>{feature.name}</span>
                        <span className="block text-xs leading-relaxed text-muted"><InlineMarkdown links={false}>{feature.description ?? ''}</InlineMarkdown></span>
                      </span>
                    </button>
                  );
                })}
                {items.length === 0 && <p className="px-2 text-xs text-subtle">—</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Block>
  );
}

function Questions({ u, decisions, onChoose, interactive }: { u: U; decisions: Record<string, number>; onChoose(id: string, i: number): void; interactive: boolean }) {
  const questions = (u.clarifyingQuestions ?? []).filter((q) => q?.question);
  if (!questions.length) return null;
  return (
    <Card className="animate-fade-up p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <HelpCircle className="size-4 text-brand-2" /> Decisions for you
      </h3>
      <p className="mb-4 mt-1 text-xs text-muted">Real product choices. We picked a recommendation — change any you disagree with.</p>
      <div className="space-y-5">
        {questions.map((q) => {
          const chosen = decisions[q.id ?? ''] ?? q.defaultIndex ?? 0;
          return (
            <div key={q.id ?? q.question}>
              <p className="text-sm font-medium text-fg">{q.question}</p>
              {q.why && <p className="mt-0.5 text-xs text-muted"><InlineMarkdown>{q.why ?? ''}</InlineMarkdown></p>}
              <div className="mt-2 flex flex-col gap-1.5">
                {(q.options ?? []).map((option, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={!interactive}
                    onClick={() => q.id && onChoose(q.id, i)}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      chosen === i ? 'border-brand/50 bg-brand/10 text-fg' : 'border-line text-soft hover:border-line-strong',
                    )}
                  >
                    <InlineMarkdown links={false}>{option ?? ''}</InlineMarkdown>
                    {i === q.defaultIndex && <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-brand-2">Recommended</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Platform({ u }: { u: U }) {
  if (!u.platform?.recommendation) return null;
  return (
    <Card className="animate-fade-up p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Smartphone className="size-4 text-brand-2" /> Why {u.platform.recommendation}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-soft"><InlineMarkdown>{u.platform.reasoning ?? ''}</InlineMarkdown></p>
      <div className="mt-3 space-y-2">
        {(u.platform.alternatives ?? []).map((alt) => (
          <div key={alt?.name} className="rounded-lg bg-white/[0.03] p-2.5 text-xs">
            <span className="font-medium text-soft">{alt?.name}: </span>
            <span className="text-muted"><InlineMarkdown>{alt?.tradeoff ?? ''}</InlineMarkdown></span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        <Skeleton className="h-36 rounded-card" />
        <Skeleton className="h-36 rounded-card" />
      </div>
    </div>
  );
}

export function UnderstandStage() {
  const project = useStudio((s) => s.project)!;
  const status = useStudio((s) => s.status.understand);
  const planStatus = useStudio((s) => s.status.plan);
  const partial = useStudio((s) => s.partial.understand) as U | undefined;
  const thinking = useStudio((s) => s.liveThinking.understand);
  const error = useStudio((s) => s.errors.understand);
  const { runUnderstand, runPlan, setDecision, toggleFeature, setStage } = useStudio.getState();

  const running = status === 'running';
  const u: U | undefined = running ? partial : project.understanding;
  const done = !running && !!project.understanding;
  const inScope = (u?.features ?? []).filter((f) => f?.id && !project.excludedFeatures.includes(f.id)).length;

  const regenerate = () => {
    if (project.plan && !confirm('Re-analysing resets the plan and the code built from it. Continue?')) return;
    void runUnderstand();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <StageHeader
          stage="understand"
          subtitle="Before any code: what problem are we solving, for whom, and what's in version 1?"
          actions={
            done &&
            project.source === 'live' && (
              <Button variant="ghost" size="sm" onClick={regenerate}>
                <RefreshCcw className="size-3.5" /> Re-analyse
              </Button>
            )
          }
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Your idea</span>
                <Badge className="capitalize">{project.level} level</Badge>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-fg">“{project.idea}”</p>
            </Card>

            <ThinkingPanel active={running} text={running ? thinking : project.thinking.understand} placeholder="Reading your idea…" />
            {error && <StageError error={error} onRetry={() => void runUnderstand()} />}

            {u?.appName ? (
              <>
                <Identity u={u} />
                <div className="grid gap-5 md:grid-cols-2">
                  {u.problem && (
                    <Block icon={<Target className="size-4" />} title="The problem">
                      <p className="text-sm leading-relaxed text-soft"><InlineMarkdown>{u.problem ?? ''}</InlineMarkdown></p>
                    </Block>
                  )}
                  {(u.targetUsers?.length ?? 0) > 0 && (
                    <Block icon={<Users className="size-4" />} title="Who it's for">
                      <div className="space-y-3">
                        {u.targetUsers!.map((user, i) => (
                          <div key={i}>
                            <p className="text-sm font-medium text-fg">{user?.persona}</p>
                            <p className="text-xs text-muted"><InlineMarkdown>{user?.description ?? ''}</InlineMarkdown></p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {(user?.needs ?? []).map((need, j) => (
                                <span key={j} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-soft">
                                  {need}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Block>
                  )}
                </div>
                <Features u={u} excluded={project.excludedFeatures} onToggle={toggleFeature} interactive={done} />
                {u.scopeNote ? (
                  <div className="animate-fade-up rounded-card border border-info/25 bg-info/[0.06] p-4 text-sm text-soft">
                    <span className="font-medium text-[#93c5fd]">How we scoped it: </span>
                    <InlineMarkdown>{u.scopeNote}</InlineMarkdown>
                  </div>
                ) : null}
                <div className="grid gap-5 md:grid-cols-2">
                  {(u.assumptions?.length ?? 0) > 0 && (
                    <Block icon={<Sparkles className="size-4" />} title="Assumptions we made">
                      <ul className="space-y-1.5 text-sm text-soft">
                        {u.assumptions!.map((a, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-subtle">•</span>
                            <InlineMarkdown>{a ?? ''}</InlineMarkdown>
                          </li>
                        ))}
                      </ul>
                    </Block>
                  )}
                  {(u.outOfScope?.length ?? 0) > 0 && (
                    <Block icon={<Ban className="size-4" />} title="Not in version 1">
                      <ul className="space-y-1.5 text-sm text-soft">
                        {u.outOfScope!.map((a, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-subtle">–</span>
                            <InlineMarkdown>{a ?? ''}</InlineMarkdown>
                          </li>
                        ))}
                      </ul>
                    </Block>
                  )}
                </div>
              </>
            ) : running ? (
              <LoadingSkeleton />
            ) : null}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            {u && <Questions u={u} decisions={project.decisions} onChoose={setDecision} interactive={done} />}
            {u && <Platform u={u} />}
            {(u?.learningOpportunities?.length ?? 0) > 0 && (
              <Card className="animate-fade-up p-5">
                <h3 className="text-sm font-semibold">What you'll learn building it</h3>
                <ul className="mt-3 space-y-2">
                  {u!.learningOpportunities!.map((item, i) => (
                    <li key={i} className="flex gap-2 text-sm text-soft">
                      <Check className="mt-0.5 size-4 shrink-0 text-ok" />
                      <InlineMarkdown>{item ?? ''}</InlineMarkdown>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {done && (
              <Card className="border-brand/30 bg-gradient-to-b from-brand/[0.08] to-transparent p-5">
                <h3 className="font-display font-semibold">Ready to design it?</h3>
                <p className="mt-1 text-sm text-muted">
                  {inScope} features in scope · {Object.keys(project.decisions).length} decisions made. Next, Lunor AI plans the screens, data and files.
                </p>
                {project.source === 'sample' && (
                  <p className="mt-2 text-xs text-subtle">Instant demo: its plan is pre-generated, so these choices won't change it. Start your own idea to see them shape the plan.</p>
                )}
                {project.plan ? (
                  <div className="mt-4 flex flex-col gap-2">
                    <Button variant="primary" onClick={() => setStage('plan')}>
                      View the plan <ArrowRight className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => confirm('Re-planning replaces the current plan and code. Continue?') && void runPlan()}
                    >
                      Re-plan with these choices
                    </Button>
                  </div>
                ) : (
                  <Button variant="primary" className="mt-4 w-full" onClick={() => void runPlan()} loading={planStatus === 'running'}>
                    Generate the plan <ArrowRight className="size-4" />
                  </Button>
                )}
              </Card>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
