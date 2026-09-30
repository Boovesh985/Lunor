import { ArrowRight, BookOpen, Check, GitBranch, Layers3, ListTree, MessageSquareCode, RefreshCcw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getConcept } from '../../shared/concepts.ts';
import { resolveRange } from '../../shared/codeRefs.ts';
import type { Explanation } from '../../shared/schemas.ts';
import { CodeView } from '../components/CodeView';
import { fileIcon } from '../components/FileTree';
import { InlineMarkdown, Markdown } from '../components/Markdown';
import { StageError } from '../components/StageError';
import { StageHeader } from '../components/StageHeader';
import { ThinkingPanel } from '../components/ThinkingPanel';
import { Badge, Button, Card, Skeleton } from '../components/ui';
import { hashFiles } from '../lib/projects';
import type { DeepPartial } from '../lib/types';
import { useElementWidth } from '../lib/useElementWidth';
import { cn, fileName } from '../lib/utils';
import { useStudio } from '../store/studio';

type E = DeepPartial<Explanation>;
type View = { kind: 'overview' } | { kind: 'flow' } | { kind: 'file'; path: string };

function ConceptTag({ id }: { id?: string }) {
  if (!id) return null;
  const concept = getConcept(id);
  return (
    <a
      href={concept?.docsUrl}
      target="_blank"
      rel="noreferrer"
      className="rounded-md border border-line bg-panel px-1.5 py-0.5 text-[11px] text-soft hover:border-brand/40 hover:text-fg"
      title={concept ? `${concept.summary} (Lunor level ${concept.lunorLevel})` : id}
    >
      {concept?.name ?? id}
    </a>
  );
}

function FileWalkthrough({ path, data, split }: { path: string; data: E; split: boolean }) {
  const project = useStudio((s) => s.project)!;
  const focus = useStudio((s) => s.focus);
  const { sendMessage, markFileViewed } = useStudio.getState();
  const code = project.files[path] ?? '';
  const entry = (data.files ?? []).find((f) => f?.path === path);
  const sections = useMemo(
    () => (entry?.sections ?? []).filter((s) => s?.title).map((s) => ({ ...s, range: resolveRange(code, { startLine: s.startLine ?? 1, endLine: s.endLine ?? s.startLine ?? 1, anchor: s.anchor }) })),
    [entry, code],
  );
  const [active, setActive] = useState(0);
  const [reveal, setReveal] = useState<{ start: number; end: number; nonce: number } | null>(null);

  useEffect(() => {
    markFileViewed(path);
    setActive(0);
  }, [path]);

  useEffect(() => {
    if (!focus || focus.file !== path || !focus.start) return;
    const index = sections.findIndex((s) => focus.start! >= s.range.start && focus.start! <= s.range.end);
    if (index >= 0) setActive(index);
    setReveal({ start: focus.start, end: focus.end ?? focus.start, nonce: focus.nonce });
  }, [focus?.nonce, path]);

  const select = (index: number) => {
    setActive(index);
    const range = sections[index]?.range;
    if (range) setReveal({ start: range.start, end: range.end, nonce: Date.now() });
  };

  if (!(path in project.files)) return <p className="p-6 text-sm text-muted">This file no longer exists in the project.</p>;

  return (
    <div className={cn('grid h-full min-h-0', split ? 'grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]' : 'grid-rows-[45%_55%]')}>
      <div className={cn('min-h-0', split ? 'border-r border-line' : 'border-b border-line')}>
        <CodeView
          value={code}
          readOnly
          sections={sections.map((s) => [s.range.start, s.range.end] as [number, number])}
          active={sections[active] ? [sections[active].range.start, sections[active].range.end] : null}
          reveal={reveal}
        />
      </div>
      <div className="min-h-0 overflow-y-auto p-5">
        <div className="flex items-center gap-2">
          {fileIcon(path)}
          <h2 className="font-mono text-sm font-semibold">{path}</h2>
          {entry?.role && <Badge>{entry.role}</Badge>}
        </div>
        {entry?.summary ? <p className="mt-2 text-sm leading-relaxed text-soft"><InlineMarkdown>{entry.summary ?? ''}</InlineMarkdown></p> : <Skeleton className="mt-3 h-10 w-full" />}
        <ol className="mt-5 space-y-2.5">
          {sections.map((section, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => select(i)}
                className={cn(
                  'w-full rounded-card border p-4 text-left transition-colors',
                  active === i ? 'border-brand/40 bg-brand/[0.06]' : 'border-line bg-card hover:border-line-strong',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-fg">
                    <span className="mr-2 font-mono text-xs text-brand-2">{String(i + 1).padStart(2, '0')}</span>
                    {section.title}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-subtle">
                    L{section.range.start}
                    {section.range.end !== section.range.start ? `–${section.range.end}` : ''}
                  </span>
                </div>
                {active === i && section.explanation && (
                  <div className="mt-2.5">
                    <Markdown>{section.explanation}</Markdown>
                    {(section.concepts?.length ?? 0) > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {section.concepts!.map((c) => (
                          <ConceptTag key={c} id={c} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ol>
        {sections.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="mt-5"
            onClick={() => void sendMessage(`I'm reading ${path}. What's the most important thing to understand about it, and what would you improve?`, 'ask', { file: path })}
          >
            <MessageSquareCode className="size-3.5" /> Ask the mentor about this file
          </Button>
        )}
      </div>
    </div>
  );
}

function Overview({ data, onOpen }: { data: E; onOpen(view: View): void }) {
  const project = useStudio((s) => s.project)!;
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-8 px-5 py-6 lg:px-8">
        <StageHeader stage="explain" subtitle="Read your app like a senior engineer would explain it to you." />
        <ThinkingPanel active={false} text={project.thinking.explain} />
        {data.overview ? (
          <Card className="p-6">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
              <Sparkles className="size-4 text-brand-2" /> How {project.understanding?.appName ?? 'the app'} works
            </h2>
            <Markdown>{data.overview}</Markdown>
          </Card>
        ) : (
          <Skeleton className="h-40 rounded-card" />
        )}

        {(data.architecture?.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
              <Layers3 className="size-4 text-brand-2" /> Architecture
            </h2>
            <div className="space-y-2">
              {data.architecture!.map((layer, i) => (
                <Card key={i} className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="md:w-56">
                      <div className="font-medium">{layer?.layer}</div>
                      <div className="text-xs text-muted"><InlineMarkdown>{layer?.description ?? ''}</InlineMarkdown></div>
                    </div>
                    <div className="flex flex-1 flex-wrap gap-1.5">
                      {(layer?.files ?? []).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => f && onOpen({ kind: 'file', path: f })}
                          className="flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1 font-mono text-[11px] text-soft hover:border-brand/40 hover:text-fg"
                        >
                          {fileIcon(f ?? '')}
                          {fileName(f ?? '')}
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {data.dataFlow?.scenario && (
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-2">Trace a real interaction</div>
              <div className="mt-1 font-display text-lg font-semibold"><InlineMarkdown>{data.dataFlow.scenario}</InlineMarkdown></div>
              <p className="text-sm text-muted">Follow the code path step by step, across {new Set((data.dataFlow.steps ?? []).map((s) => s?.file)).size} files.</p>
            </div>
            <Button variant="primary" onClick={() => onOpen({ kind: 'flow' })}>
              Follow the data <ArrowRight className="size-4" />
            </Button>
          </Card>
        )}

        {(data.glossary?.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
              <BookOpen className="size-4 text-brand-2" /> Glossary
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.glossary!.map((g, i) => (
                <div key={i} className="rounded-card border border-line bg-card p-3.5">
                  <div className="text-sm font-medium text-fg"><InlineMarkdown>{g?.term ?? ''}</InlineMarkdown></div>
                  <div className="mt-0.5 text-sm text-muted"><InlineMarkdown>{g?.definition ?? ''}</InlineMarkdown></div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function DataFlow({ data, split }: { data: E; split: boolean }) {
  const project = useStudio((s) => s.project)!;
  const steps = (data.dataFlow?.steps ?? []).filter((s) => s?.file);
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const code = step?.file ? (project.files[step.file] ?? '') : '';
  const range = step ? resolveRange(code, { startLine: step.startLine ?? 1, endLine: step.endLine ?? step.startLine ?? 1, anchor: step.anchor }) : null;
  const [nonce, setNonce] = useState(0);
  useEffect(() => setNonce(Date.now()), [index]);

  return (
    <div className={cn('grid h-full min-h-0', split ? 'grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]' : 'grid-rows-[50%_50%]')}>
      <div className={cn('min-h-0 overflow-y-auto p-5', split ? 'border-r border-line' : 'border-b border-line')}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-2">Data flow</div>
        <h2 className="mt-1 font-display text-lg font-semibold"><InlineMarkdown>{data.dataFlow?.scenario ?? ''}</InlineMarkdown></h2>
        <ol className="relative mt-5 space-y-2 border-l border-line pl-5">
          {steps.map((s, i) => (
            <li key={i} className="relative">
              <span className={cn('absolute -left-[27px] top-3 size-3 rounded-full border-2', i === index ? 'border-brand-2 bg-brand-2' : i < index ? 'border-brand-2 bg-bg' : 'border-line-strong bg-bg')} />
              <button
                type="button"
                onClick={() => setIndex(i)}
                className={cn('w-full rounded-card border p-3.5 text-left transition-colors', i === index ? 'border-brand/40 bg-brand/[0.06]' : 'border-transparent hover:bg-white/[0.03]')}
              >
                <div className="text-sm font-medium">{s.title}</div>
                <div className="mt-0.5 font-mono text-[11px] text-subtle">{s.file}</div>
                {i === index && s.description && <Markdown className="mt-2 text-sm">{s.description}</Markdown>}
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
            Previous
          </Button>
          <Button variant="primary" size="sm" disabled={index >= steps.length - 1} onClick={() => setIndex((i) => i + 1)}>
            Next step <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-4 font-mono text-xs text-soft">
          {step?.file && fileIcon(step.file)}
          {step?.file}
          {range && <span className="text-subtle">· lines {range.start}–{range.end}</span>}
        </div>
        <div className="min-h-0 flex-1">
          <CodeView value={code} readOnly active={range ? [range.start, range.end] : null} reveal={range ? { start: range.start, end: range.end, nonce } : null} />
        </div>
      </div>
    </div>
  );
}

export default function ExplainStage() {
  const project = useStudio((s) => s.project)!;
  const status = useStudio((s) => s.status.explain);
  const partial = useStudio((s) => s.partial.explain) as E | undefined;
  const thinking = useStudio((s) => s.liveThinking.explain);
  const error = useStudio((s) => s.errors.explain);
  const focus = useStudio((s) => s.focus);
  const { runExplain } = useStudio.getState();
  const [view, setView] = useState<View>({ kind: 'overview' });
  const [containerRef, width] = useElementWidth();
  const wide = width >= 900;
  const split = (wide ? width - 250 : width) >= 700;

  const running = status === 'running';
  const data: E | undefined = running ? partial : project.explanation;
  const stale = !running && !!project.explanation && project.explainedHash !== hashFiles(project.files);
  const files = useMemo(() => {
    const ordered = (data?.files ?? []).map((f) => f?.path).filter((p): p is string => !!p && p in project.files);
    return [...ordered, ...Object.keys(project.files).filter((p) => !ordered.includes(p))];
  }, [data, project.files]);

  useEffect(() => {
    if (focus?.file && focus.file in project.files) setView({ kind: 'file', path: focus.file });
  }, [focus?.nonce]);

  if (!data) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-4xl px-5 py-6">
          <StageHeader stage="explain" subtitle="Read your app like a senior engineer would explain it to you." />
          <div className="space-y-4">
            <ThinkingPanel active={running} text={thinking} label="Lunor AI is reading your code" placeholder="Reading every file and tracing how data moves between them…" />
            {error ? <StageError error={error} onRetry={() => void runExplain()} /> : <Skeleton className="h-48 rounded-card" />}
          </div>
        </div>
      </div>
    );
  }

  const nav = (
    <aside className={cn('min-h-0 overflow-y-auto bg-panel p-3', wide ? 'border-r border-line' : 'border-b border-line')}>
      {stale && (
        <div className="mb-3 rounded-lg border border-warn/30 bg-warn/[0.08] p-3 text-xs text-soft">
          Your code changed since this walkthrough was written.
          <button type="button" className="mt-2 flex items-center gap-1 font-medium text-[#fcc56b] hover:underline" onClick={() => void runExplain()}>
            <RefreshCcw className="size-3" /> Refresh walkthrough
          </button>
        </div>
      )}
      {running && <div className="mb-3 rounded-lg bg-brand/[0.08] p-2.5 text-xs text-soft">Writing the walkthrough…</div>}
      {error && <StageError error={error} onRetry={() => void runExplain()} />}
      <div className={cn('flex gap-1', wide ? 'flex-col' : 'scrollbar-none overflow-x-auto')}>
        {(
          [
            [{ kind: 'overview' }, 'Overview', <ListTree key="o" className="size-3.5" />],
            [{ kind: 'flow' }, 'Data flow', <GitBranch key="f" className="size-3.5" />],
          ] as const
        ).map(([v, label, icon]) => (
          <button
            key={label}
            type="button"
            onClick={() => setView(v)}
            className={cn('flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px]', view.kind === v.kind ? 'bg-brand/10 text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-soft')}
          >
            {icon}
            {label}
          </button>
        ))}
        {wide && <div className="mb-1 mt-4 px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">Files</div>}
        {files.map((path) => {
          const entry = data.files?.find((f) => f?.path === path);
          const viewed = project.progress.viewedFiles.includes(path);
          const current = view.kind === 'file' && view.path === path;
          return (
            <button
              key={path}
              type="button"
              onClick={() => setView({ kind: 'file', path })}
              className={cn('flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left', current ? 'bg-brand/10 text-fg' : 'text-soft hover:bg-white/[0.04]')}
            >
              {fileIcon(path)}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[12px]">{fileName(path)}</span>
                {wide && entry?.role && <span className="block truncate text-[11px] text-subtle">{entry.role}</span>}
              </span>
              {viewed && <Check className="size-3.5 shrink-0 text-ok" />}
            </button>
          );
        })}
      </div>
      {wide && (
        <p className="mt-4 px-2.5 text-[11px] text-subtle">
          {project.progress.viewedFiles.filter((p) => p in project.files).length}/{files.length} files explored · +5 XP each
        </p>
      )}
    </aside>
  );

  return (
    <div ref={containerRef} className={cn('grid h-full min-h-0', wide ? 'grid-cols-[250px_minmax(0,1fr)]' : 'grid-rows-[auto_minmax(0,1fr)]')}>
      {nav}
      <div className="min-h-0">
        {view.kind === 'overview' && <Overview data={data} onOpen={setView} />}
        {view.kind === 'flow' && <DataFlow data={data} split={split} />}
        {view.kind === 'file' && <FileWalkthrough path={view.path} data={data} split={split} />}
      </div>
    </div>
  );
}
