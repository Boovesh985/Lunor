import { AlertTriangle, ArrowLeft, ArrowRight, Boxes, Compass, Database, FolderTree, Hammer, Lightbulb, Map, RefreshCcw, Route, Save, Workflow } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { getConcept } from '../../shared/concepts.ts';
import type { Plan } from '../../shared/schemas.ts';
import { fileIcon } from '../components/FileTree';
import { InlineMarkdown } from '../components/Markdown';
import { MermaidDiagram } from '../components/Mermaid';
import { StageError } from '../components/StageError';
import { StageHeader } from '../components/StageHeader';
import { ThinkingPanel } from '../components/ThinkingPanel';
import { Badge, Button, Card, Skeleton } from '../components/ui';
import { dataModelDiagram, screenFlowDiagram } from '../lib/diagram';
import type { DeepPartial } from '../lib/types';
import { useStudio } from '../store/studio';

type P = DeepPartial<Plan>;

function Section({ id, icon, title, subtitle, children }: { id: string; icon: ReactNode; title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="animate-fade-up scroll-mt-6">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
        <span className="text-brand-2">{icon}</span>
        {title}
      </h2>
      {subtitle && <p className="mb-4 text-sm text-muted">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

const KIND_TONE = { tab: 'brand', stack: 'neutral', modal: 'warn' } as const;

function ConceptChip({ id }: { id?: string }) {
  if (!id) return null;
  const concept = getConcept(id);
  return (
    <span
      className="rounded-md border border-line bg-panel px-1.5 py-0.5 text-[11px] text-soft"
      title={concept ? `Lunor App Dev level ${concept.lunorLevel}` : undefined}
    >
      {concept?.name ?? id}
      {concept && <span className="ml-1 text-subtle">L{concept.lunorLevel}</span>}
    </span>
  );
}

export function PlanStage() {
  const project = useStudio((s) => s.project)!;
  const status = useStudio((s) => s.status.plan);
  const buildStatus = useStudio((s) => s.status.build);
  const partial = useStudio((s) => s.partial.plan) as P | undefined;
  const thinking = useStudio((s) => s.liveThinking.plan);
  const error = useStudio((s) => s.errors.plan);
  const { runPlan, runBuild, setStage } = useStudio.getState();

  const running = status === 'running';
  const plan: P | undefined = running ? partial : project.plan;
  const flow = useMemo(() => (!running && plan ? screenFlowDiagram(plan) : null), [running, plan]);
  const model = useMemo(() => (!running && plan ? dataModelDiagram(plan) : null), [running, plan]);
  const hasCode = Object.keys(project.files).length > 0;

  const startBuild = () => {
    if (hasCode && !confirm('Rebuilding replaces the current code (and any edits). Continue?')) return;
    void runBuild();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <StageHeader
          stage="plan"
          subtitle="The architecture a senior engineer would sketch before writing code."
          actions={
            !running &&
            project.plan && (
              <>
                {project.source === 'live' && (
                  <Button variant="ghost" size="sm" onClick={() => (!hasCode || confirm('Re-planning replaces the current code. Continue?')) && void runPlan()}>
                    <RefreshCcw className="size-3.5" /> Re-plan
                  </Button>
                )}
                {project.buildComplete ? (
                  <Button variant="primary" size="sm" onClick={() => setStage('build')}>
                    Open the app <ArrowRight className="size-3.5" />
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" onClick={startBuild} loading={buildStatus === 'running'}>
                    <Hammer className="size-3.5" /> Build my app
                  </Button>
                )}
              </>
            )
          }
        />

        <div className="space-y-5">
          <ThinkingPanel
            active={running}
            text={running ? thinking : project.thinking.plan}
            label="Lunor AI is designing the architecture"
            placeholder="Working out the screens, data and files…"
          />
          {error && <StageError error={error} onRetry={() => void runPlan()} />}
        </div>

        {!plan && !running && !error && (
          <Card className="mt-6 flex flex-col items-center gap-4 border-brand/30 bg-gradient-to-b from-brand/[0.08] to-transparent p-8 text-center">
            <Compass className="size-6 text-brand-2" />
            <div>
              <h3 className="font-display text-lg font-semibold">No plan yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted">
                Lunor AI turns the features you kept and the decisions you made into screens, a data model and a file-by-file build roadmap.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => setStage('understand')}>
                <ArrowLeft className="size-4" /> Review my choices
              </Button>
              <Button variant="primary" onClick={() => void runPlan()} disabled={!project.understanding}>
                Generate the plan <ArrowRight className="size-4" />
              </Button>
            </div>
          </Card>
        )}

        {!plan?.summary && running && (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-28 rounded-card" />
            ))}
          </div>
        )}

        {plan?.summary && (
          <div className="mt-8 space-y-12">
            <Section id="overview" icon={<Map className="size-5" />} title="Architecture overview">
              <p className="mb-5 max-w-3xl text-[15px] leading-relaxed text-soft"><InlineMarkdown>{plan.summary ?? ''}</InlineMarkdown></p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(plan.techStack ?? []).filter((t) => t?.name).map((tech) => (
                  <Card key={tech.name} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{tech.name}</span>
                      <Badge>{tech.category}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted"><InlineMarkdown>{tech.reason ?? ''}</InlineMarkdown></p>
                  </Card>
                ))}
              </div>
            </Section>

            {(plan.screens?.length ?? 0) > 0 && (
              <Section id="screens" icon={<Route className="size-5" />} title="Screens & navigation" subtitle={plan.navigation?.description ? <InlineMarkdown>{plan.navigation.description}</InlineMarkdown> : undefined}>
                {flow && (
                  <Card className="mb-4 p-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-muted">
                      <span><InlineMarkdown>{plan.navigation?.pattern ?? ''}</InlineMarkdown></span>
                      <span className="flex gap-3">
                        <span className="flex items-center gap-1"><span className="size-2 rounded-sm border border-brand" /> tab</span>
                        <span className="flex items-center gap-1"><span className="size-2 rounded-full border border-dashed border-brand-2" /> modal</span>
                      </span>
                    </div>
                    <MermaidDiagram code={flow} />
                  </Card>
                )}
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {plan.screens!.filter((s) => s?.name).map((screen) => (
                    <Card key={screen.id ?? screen.name} className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{screen.name}</span>
                        {screen.kind && <Badge tone={KIND_TONE[screen.kind] ?? 'neutral'}>{screen.kind}</Badge>}
                      </div>
                      <p className="mt-1.5 text-sm text-muted"><InlineMarkdown>{screen.purpose ?? ''}</InlineMarkdown></p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {(screen.components ?? []).map((c, i) => (
                          <span key={i} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[11px] text-soft">
                            {c}
                          </span>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </Section>
            )}

            {(plan.dataModel?.length ?? 0) > 0 && (
              <Section id="data" icon={<Database className="size-5" />} title="Data model" subtitle="The shape of the data every screen reads and writes.">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                  {model && (
                    <Card className="flex items-center p-4">
                      <MermaidDiagram code={model} className="w-full" />
                    </Card>
                  )}
                  <div className="space-y-3">
                    {plan.dataModel!.filter((e) => e?.entity).map((entity) => (
                      <Card key={entity.entity} className="overflow-hidden">
                        <div className="border-b border-line px-4 py-3">
                          <span className="font-mono text-sm font-semibold text-[#7ee787]">{entity.entity}</span>
                          <p className="text-xs text-muted"><InlineMarkdown>{entity.description ?? ''}</InlineMarkdown></p>
                        </div>
                        <table className="w-full text-left text-[13px]">
                          <tbody>
                            {(entity.fields ?? []).map((field, i) => (
                              <tr key={i} className="border-b border-line/60 last:border-0">
                                <td className="px-4 py-2 font-mono text-[12px] text-fg">{field?.name}</td>
                                <td className="px-2 py-2 font-mono text-[11px] text-[#79c0ff]">{field?.type}</td>
                                <td className="px-4 py-2 text-muted"><InlineMarkdown>{field?.description ?? ''}</InlineMarkdown></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </Card>
                    ))}
                  </div>
                </div>
              </Section>
            )}

            {(plan.architecture?.length ?? 0) > 0 && (
              <Section id="layers" icon={<Boxes className="size-5" />} title="Layers" subtitle="Each layer only talks to the one below it — that's what keeps the code easy to change.">
                <div className="space-y-2">
                  {plan.architecture!.map((layer, i) => (
                    <div key={i} className="flex flex-col gap-3 rounded-card border border-line bg-card p-4 md:flex-row md:items-center">
                      <div className="flex items-center gap-3 md:w-64">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-white/[0.06] font-mono text-xs text-muted">{i + 1}</span>
                        <div>
                          <div className="font-medium">{layer?.layer}</div>
                          <div className="text-xs text-muted"><InlineMarkdown>{layer?.description ?? ''}</InlineMarkdown></div>
                        </div>
                      </div>
                      <div className="flex flex-1 flex-wrap gap-1.5">
                        {(layer?.files ?? []).map((f) => (
                          <span key={f} className="flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1 font-mono text-[11px] text-soft">
                            {fileIcon(f ?? '')}
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {plan.stateManagement?.approach && (
                    <Card className="p-4">
                      <div className="flex items-center gap-2 text-sm font-medium"><Workflow className="size-4 text-brand-2" /> State: <InlineMarkdown>{plan.stateManagement.approach}</InlineMarkdown></div>
                      <p className="mt-1.5 text-sm text-muted"><InlineMarkdown>{plan.stateManagement.description ?? ''}</InlineMarkdown></p>
                    </Card>
                  )}
                  {plan.persistence?.approach && (
                    <Card className="p-4">
                      <div className="flex items-center gap-2 text-sm font-medium"><Save className="size-4 text-brand-2" /> Storage: <InlineMarkdown>{plan.persistence.approach}</InlineMarkdown></div>
                      <p className="mt-1.5 text-sm text-muted"><InlineMarkdown>{plan.persistence.description ?? ''}</InlineMarkdown></p>
                    </Card>
                  )}
                </div>
              </Section>
            )}

            {(plan.buildSteps?.length ?? 0) > 0 && (
              <Section id="roadmap" icon={<FolderTree className="size-5" />} title="Build roadmap" subtitle="The order the code is written in — the same order you'd build it by hand.">
                <ol className="relative space-y-3 border-l border-line pl-6">
                  {plan.buildSteps!.map((step, i) => (
                    <li key={step?.id ?? i} className="relative">
                      <span className="absolute -left-[37px] flex size-6 items-center justify-center rounded-full border border-line bg-card font-mono text-[11px] text-brand-2">
                        {i + 1}
                      </span>
                      <Card className="p-4">
                        <div className="font-medium">{step?.title}</div>
                        <p className="mt-1 text-sm text-muted"><InlineMarkdown>{step?.description ?? ''}</InlineMarkdown></p>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {(step?.files ?? []).map((f) => (
                            <span key={f} className="flex items-center gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-soft">
                              {fileIcon(f ?? '')}
                              {f?.split('/').pop()}
                            </span>
                          ))}
                          <span className="mx-1 h-3 w-px bg-line" />
                          {(step?.concepts ?? []).map((c) => (
                            <ConceptChip key={c} id={c} />
                          ))}
                        </div>
                      </Card>
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            {((plan.risks?.length ?? 0) > 0 || (plan.futureIdeas?.length ?? 0) > 0) && (
              <div className="grid gap-5 md:grid-cols-2">
                {(plan.risks?.length ?? 0) > 0 && (
                  <Section id="risks" icon={<AlertTriangle className="size-5" />} title="Risks we designed for">
                    <div className="space-y-2">
                      {plan.risks!.map((r, i) => (
                        <Card key={i} className="p-3.5 text-sm">
                          <div className="text-soft"><InlineMarkdown>{r?.risk ?? ''}</InlineMarkdown></div>
                          <div className="mt-1 text-muted">→ <InlineMarkdown>{r?.mitigation ?? ''}</InlineMarkdown></div>
                        </Card>
                      ))}
                    </div>
                  </Section>
                )}
                {(plan.futureIdeas?.length ?? 0) > 0 && (
                  <Section id="future" icon={<Lightbulb className="size-5" />} title="After the MVP">
                    <ul className="space-y-2">
                      {plan.futureIdeas!.map((idea, i) => (
                        <li key={i} className="rounded-card border border-dashed border-line p-3.5 text-sm text-muted">
                          <InlineMarkdown>{idea ?? ''}</InlineMarkdown>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}
              </div>
            )}

            {!running && !project.buildComplete && (
              <Card className="flex flex-col items-center gap-4 border-brand/30 bg-gradient-to-b from-brand/[0.08] to-transparent p-8 text-center">
                <Hammer className="size-6 text-brand-2" />
                <div>
                  <h3 className="font-display text-lg font-semibold">Plan approved? Let's build it.</h3>
                  <p className="mt-1 text-sm text-muted">Lunor AI writes {plan.files?.length ?? 'every'} files step by step — you'll watch the app come alive on the phone preview.</p>
                </div>
                <Button variant="primary" size="lg" onClick={startBuild} loading={buildStatus === 'running'}>
                  Build my app <ArrowRight className="size-4" />
                </Button>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
