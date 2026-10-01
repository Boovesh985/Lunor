import confetti from 'canvas-confetti';
import {
  AlertOctagon,
  BookOpen,
  Check,
  Circle,
  Copy,
  Eraser,
  FileWarning,
  Hammer,
  ListChecks,
  MessageSquareCode,
  RotateCcw,
  RotateCw,
  Smartphone,
  Sparkles,
  SquareTerminal,
  Wand2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PreviewErrorInfo } from '../../shared/previewProtocol.ts';
import { CodeView } from '../components/CodeView';
import { FileTree, type FileMark } from '../components/FileTree';
import { StageError } from '../components/StageError';
import { ThinkingPanel } from '../components/ThinkingPanel';
import { Badge, Button, ProgressBar, Spinner } from '../components/ui';
import { useLiveAI } from '../lib/settings';
import { useUI } from '../lib/uiState';
import { useElementWidth } from '../lib/useElementWidth';
import { cn, countLines } from '../lib/utils';
import type { CompileProblem } from '../preview/compiler';
import { clearAppData, PreviewFrame, type PreviewEvent, type PreviewStatus } from '../preview/PreviewFrame';
import type { DevicePlatform } from '../preview/PhoneFrame';
import { useStudio } from '../store/studio';

interface LogLine {
  id: number;
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
}
let logId = 0;

function describeError(error: PreviewErrorInfo): string {
  return `${error.message}${error.file ? `\n    at ${error.file}${error.line ? `:${error.line}` : ''}` : ''}`;
}

function BuildSteps() {
  const project = useStudio((s) => s.project)!;
  const running = useStudio((s) => s.status.build === 'running');
  const active = useStudio((s) => s.build.activeFile);
  const steps = project.plan?.buildSteps ?? [];
  if (!steps.length) return null;
  return (
    <div className="border-b border-line p-3">
      <div className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        <ListChecks className="size-3.5" /> Build steps
      </div>
      <ol className="space-y-1">
        {steps.map((step, i) => {
          const files = step.files ?? [];
          const done = files.length > 0 && files.every((f) => f in project.files);
          const current = running && !!active && files.includes(active);
          return (
            <li key={step.id ?? i} className={cn('flex items-start gap-2 rounded-md px-1.5 py-1 text-[12.5px]', current && 'bg-brand/[0.08]')}>
              <span className="mt-0.5">
                {done ? (
                  <Check className="size-3.5 text-ok" />
                ) : current ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <Circle className="size-3.5 text-subtle" />
                )}
              </span>
              <span className={cn(done || current ? 'text-soft' : 'text-muted')}>{step.title}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PreviewOverlay({
  running,
  status,
  problems,
  runtimeError,
  onFix,
  onReveal,
  canFix,
}: {
  running: boolean;
  status: PreviewStatus;
  problems: CompileProblem[];
  runtimeError: PreviewErrorInfo | null;
  onFix(): void;
  onReveal(file: string, line?: number): void;
  canFix: boolean;
}) {
  const project = useStudio((s) => s.project)!;
  const build = useStudio((s) => s.build);
  if (running) {
    const planned = project.plan?.files?.length || 1;
    const written = Object.keys(project.files).length;
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0f0f0f] p-8 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 animate-ping rounded-3xl bg-brand/20" />
          <span className="relative flex size-16 items-center justify-center rounded-3xl bg-gradient-brand text-3xl">
            {project.understanding?.emoji ?? '📱'}
          </span>
        </div>
        <p className="font-display text-lg font-semibold text-white">Building {project.understanding?.appName ?? 'your app'}</p>
        <p className="mt-1 max-w-[240px] truncate font-mono text-xs text-[#9e9e9e]">{build.activeFile ? `Writing ${build.activeFile}` : 'Planning the first file…'}</p>
        <ProgressBar value={written / planned} className="mt-6 w-48" />
        <p className="mt-2 text-xs text-[#6b6b6b]">
          {written} of {planned} files{build.attempt > 1 ? ` · resuming (attempt ${build.attempt})` : ''}
        </p>
      </div>
    );
  }
  if (!project.buildComplete) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#0f0f0f] p-8 text-center">
        <Hammer className="size-7 text-[#6b6b6b]" />
        <p className="mt-4 font-display font-semibold text-white">Build not finished</p>
        <p className="mt-1 max-w-[220px] text-xs text-[#9e9e9e]">
          {Object.keys(project.files).length} of {project.plan?.files?.length ?? '?'} files are written. Resume the build to run your app.
        </p>
      </div>
    );
  }
  const errors = problems.filter((p) => p.severity === 'error');
  if (status === 'compile-error' || runtimeError) {
    return (
      <div className="flex h-full flex-col bg-[#140909]/[0.97] p-5 text-left">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#ff8a80]">
          <AlertOctagon className="size-4" /> {runtimeError ? 'App crashed' : "Can't compile"}
        </div>
        <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
          {runtimeError ? (
            <button type="button" onClick={() => runtimeError.file && onReveal(runtimeError.file, runtimeError.line)} className="block w-full text-left">
              <p className="text-[15px] leading-snug text-white">{runtimeError.message}</p>
              {runtimeError.file && (
                <p className="mt-2 font-mono text-xs text-[#ffb199] underline-offset-2 hover:underline">
                  {runtimeError.file}
                  {runtimeError.line ? `:${runtimeError.line}` : ''}
                </p>
              )}
            </button>
          ) : (
            errors.map((p, i) => (
              <button key={i} type="button" onClick={() => onReveal(p.file, p.line)} className="block w-full rounded-lg bg-white/[0.04] p-2.5 text-left hover:bg-white/[0.07]">
                <p className="font-mono text-xs text-[#ffb199]">
                  {p.file}
                  {p.line ? `:${p.line}` : ''}
                </p>
                <p className="mt-1 text-sm text-white">{p.message}</p>
              </button>
            ))
          )}
        </div>
        <div className="mt-4 space-y-2">
          {canFix ? (
            <Button variant="primary" className="w-full" onClick={onFix}>
              <Wand2 className="size-4" /> Fix with AI
            </Button>
          ) : (
            <p className="text-xs text-[#9e9e9e]">Add an API key in Settings to let the AI mentor fix this for you.</p>
          )}
          <p className="text-center text-[11px] text-[#6b6b6b]">The mentor explains the root cause, then patches the code.</p>
        </div>
      </div>
    );
  }
  if (status === 'compiling' || status === 'booting') {
    return (
      <div className="pointer-events-none flex h-full items-end justify-center pb-6">
        <span className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur">
          <Spinner className="size-3 text-white" /> {status === 'compiling' ? 'Compiling…' : 'Starting app…'}
        </span>
      </div>
    );
  }
  return null;
}

export default function BuildStage() {
  const project = useStudio((s) => s.project)!;
  const status = useStudio((s) => s.status.build);
  const build = useStudio((s) => s.build);
  const error = useStudio((s) => s.errors.build);
  const thinking = useStudio((s) => s.liveThinking.build);
  const celebrate = useStudio((s) => s.celebrate);
  const focus = useStudio((s) => s.focus);
  const chatBusy = useStudio((s) => s.chatBusy);
  const { runBuild, updateFile, resetFile, sendMessage, focusCode, setStage } = useStudio.getState();
  const live = useLiveAI();
  const [containerRef, width] = useElementWidth();
  const layout = width >= 1060 ? 'three' : width >= 700 ? 'two' : 'tabs';

  const running = status === 'running';
  const files = project.files;
  const plannedPaths = useMemo(() => (project.plan?.files ?? []).map((f) => f.path), [project.plan]);
  const writtenPaths = Object.keys(files);
  const treePaths = useMemo(() => {
    const set = new Set([...writtenPaths, ...(running ? plannedPaths : [])]);
    if (running && build.activeFile) set.add(build.activeFile);
    return [...set];
  }, [writtenPaths.join('|'), running, plannedPaths, build.activeFile]);

  const [selected, setSelected] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [reveal, setReveal] = useState<{ start: number; end: number; nonce: number } | null>(null);
  const [selection, setSelection] = useState<{ text: string; from: number; to: number } | null>(null);
  const [platform, setPlatform] = useState<DevicePlatform>('ios');
  const [reloadToken, setReloadToken] = useState(0);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
  const [problems, setProblems] = useState<CompileProblem[]>([]);
  const [runtimeError, setRuntimeError] = useState<PreviewErrorInfo | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [panel, setPanel] = useState<'log' | 'console' | 'problems' | null>('log');
  const [mobileTab, setMobileTab] = useState<'files' | 'code' | 'preview'>('preview');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (running) setFollow(true);
  }, [running]);

  const fallbackFile = writtenPaths.includes('App.js') ? 'App.js' : writtenPaths[0] ?? null;
  const activePath = running && follow && build.activeFile ? build.activeFile : selected && (selected in files || selected === build.activeFile) ? selected : fallbackFile;
  const isStreamingFile = running && activePath === build.activeFile && !(activePath! in files);
  const code = isStreamingFile ? build.streaming : activePath ? (files[activePath] ?? '') : '';

  const marks = useMemo(() => {
    const result: Record<string, FileMark | undefined> = {};
    for (const path of treePaths) {
      if (running && path === build.activeFile && !(path in files)) result[path] = 'streaming';
      else if (!(path in files)) result[path] = 'pending';
      else if (project.generatedFiles && project.generatedFiles[path] === undefined) result[path] = 'new';
      else if (project.generatedFiles && project.generatedFiles[path] !== files[path]) result[path] = 'modified';
    }
    return result;
  }, [treePaths, files, project.generatedFiles, running, build.activeFile]);

  const onPreviewEvent = useCallback((event: PreviewEvent) => {
    switch (event.type) {
      case 'status':
        setPreviewStatus(event.status);
        if (event.status === 'compiling') setRuntimeError(null);
        if (event.status === 'booting') setLogs([]);
        break;
      case 'problems':
        setProblems(event.problems);
        break;
      case 'error':
        if (event.error.fatal) setRuntimeError(event.error);
        setLogs((l) => [...l.slice(-199), { id: logId++, level: 'error', message: describeError(event.error) }]);
        break;
      case 'console':
        setLogs((l) => [...l.slice(-199), { id: logId++, level: event.level, message: event.message }]);
        break;
    }
  }, []);

  useEffect(() => {
    if (!celebrate || Date.now() - celebrate > 4000) return;
    void confetti({ particleCount: 140, spread: 75, startVelocity: 38, origin: { x: 0.72, y: 0.55 }, colors: ['#ED2C2C', '#F65F31', '#ffffff', '#fcc56b'] });
    setMobileTab('preview');
  }, [celebrate]);

  useEffect(() => {
    if (!focus || !(focus.file in files)) return;
    setSelected(focus.file);
    setFollow(false);
    setMobileTab('code');
    if (focus.start) setReveal({ start: focus.start, end: focus.end ?? focus.start, nonce: focus.nonce });
  }, [focus?.nonce]);

  const revealIn = (file: string, line?: number) => focusCode(file, line, line);

  const fix = () => {
    const errors = problems.filter((p) => p.severity === 'error');
    const text = runtimeError
      ? `My app crashed in the preview:\n${runtimeError.message}${runtimeError.file ? ` (at ${runtimeError.file}${runtimeError.line ? `:${runtimeError.line}` : ''})` : ''}\nPlease find the root cause, explain it briefly, and fix it.`
      : `The preview can't compile my app:\n${errors.map((p) => `- ${p.file}${p.line ? `:${p.line}` : ''}: ${p.message}`).join('\n')}\nPlease fix it.`;
    const detail = runtimeError ? `${runtimeError.message}\n${(runtimeError.stack ?? '').slice(0, 1500)}` : errors.map((p) => `${p.file}:${p.line ?? '?'} ${p.message}`).join('\n');
    void sendMessage(text, 'fix', { error: detail, file: runtimeError?.file ?? errors[0]?.file });
  };

  if (!running && writtenPaths.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-20 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-brand glow-brand">
            <Hammer className="size-6 text-white" />
          </span>
          <h1 className="mt-6 font-display text-2xl font-semibold">Ready to build {project.understanding?.appName ?? 'your app'}</h1>
          <p className="mt-2 text-muted">
            Lunor AI will write {plannedPaths.length || 'each'} files following the plan, and the app will start running on the phone as soon as it's done.
          </p>
          {error && (
            <div className="mt-6 w-full text-left">
              <StageError error={error} onRetry={() => void runBuild()} onResume={() => void runBuild({ resume: true })} />
            </div>
          )}
          {!error && (
            <Button variant="primary" size="lg" className="mt-8" onClick={() => void runBuild()} disabled={!project.plan}>
              <Hammer className="size-4" /> Build my app
            </Button>
          )}
        </div>
      </div>
    );
  }

  const consoleCount = logs.length;
  const errorCount = problems.filter((p) => p.severity === 'error').length;
  const totalLines = countLines(files);

  const filesPane = (
    <aside className="flex min-h-0 flex-col border-r border-line bg-panel">
      <BuildSteps />
      <div className="flex items-center justify-between px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        <span>Files</span>
        <span className="font-mono normal-case tracking-normal text-subtle">{writtenPaths.length} · {totalLines} lines</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <FileTree
          paths={treePaths}
          active={activePath}
          marks={marks}
          onSelect={(path) => {
            setSelected(path);
            setFollow(path === build.activeFile);
            setMobileTab('code');
          }}
        />
      </div>
    </aside>
  );

  const filePicker = layout !== 'three' && (
    <div className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-panel px-2 py-1.5">
      {treePaths.map((path) => (
        <button
          key={path}
          type="button"
          onClick={() => {
            setSelected(path);
            setFollow(path === build.activeFile);
          }}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11.5px]',
            path === activePath ? 'bg-brand/10 text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-soft',
            marks[path] === 'pending' && 'opacity-40',
          )}
        >
          {path.split('/').pop()}
          {marks[path] === 'modified' && <span className="size-1.5 rounded-full bg-warn" />}
          {marks[path] === 'streaming' && <span className="size-1.5 animate-pulse rounded-full bg-brand-2" />}
        </button>
      ))}
    </div>
  );

  const codePane = (
    <section className="flex min-h-0 min-w-0 flex-col">
      {filePicker}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="min-w-0 truncate font-mono text-[12.5px] text-soft">{activePath ?? '—'}</span>
        {isStreamingFile && (
          <Badge tone="brand">
            <span className="size-1.5 animate-pulse rounded-full bg-brand-2" /> writing
          </Badge>
        )}
        {activePath && marks[activePath] === 'modified' && <Badge tone="warn">edited</Badge>}
        {running && !follow && (
          <button type="button" onClick={() => setFollow(true)} className="text-xs text-brand-2 hover:underline">
            Follow live
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {!running && activePath && marks[activePath] === 'modified' && (
            <Button variant="ghost" size="sm" onClick={() => resetFile(activePath)} title="Restore the generated version">
              <RotateCcw className="size-3.5" /> Reset
            </Button>
          )}
          {project.buildComplete && activePath && (
            <Button variant="ghost" size="sm" onClick={() => focusCode(activePath, undefined, undefined, 'explain')}>
              <BookOpen className="size-3.5" /> <span className="hidden xl:inline">Explain file</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Copy file"
            onClick={() => {
              void navigator.clipboard?.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <CodeView
          value={code}
          readOnly={running}
          onChange={(value) => activePath && !running && updateFile(activePath, value)}
          followTail={isStreamingFile}
          reveal={reveal}
          onSelection={setSelection}
        />
        {selection && !running && project.buildComplete && selection.text.trim().length > 8 && (
          <div className="absolute bottom-3 right-3 z-10 flex gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={chatBusy}
              onClick={() =>
                void sendMessage(`Explain lines ${selection.from}–${selection.to} of ${activePath} to me.`, 'ask', { file: activePath ?? undefined, selection: selection.text.slice(0, 6000) })
              }
            >
              <Sparkles className="size-3.5" /> Explain selection
            </Button>
          </div>
        )}
        {!running && project.buildComplete && !selection && (
          <div className="pointer-events-none absolute bottom-3 right-4 hidden text-[11px] text-subtle lg:block">Edit the code — the preview reloads live · select code to ask about it</div>
        )}
      </div>
      <div className={cn('shrink-0 border-t border-line bg-panel', panel ? 'h-44' : 'h-9')}>
        <div className="flex h-9 items-center gap-1 px-2">
          {(
            [
              ['log', 'Build log', <ListChecks key="i" className="size-3.5" />, 0],
              ['console', 'Console', <SquareTerminal key="i" className="size-3.5" />, consoleCount],
              ['problems', 'Problems', <FileWarning key="i" className="size-3.5" />, errorCount],
            ] as const
          ).map(([id, label, icon, count]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPanel(panel === id ? null : id)}
              className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 text-xs', panel === id ? 'bg-white/[0.06] text-fg' : 'text-muted hover:text-soft')}
            >
              {icon}
              {label}
              {count > 0 && <span className={cn('rounded-full px-1.5 text-[10px]', id === 'problems' ? 'bg-brand/20 text-[#ff8a80]' : 'bg-white/10')}>{count}</span>}
            </button>
          ))}
          {panel === 'console' && logs.length > 0 && (
            <button type="button" onClick={() => setLogs([])} className="ml-auto text-[11px] text-subtle hover:text-fg">
              Clear
            </button>
          )}
          {panel && (
            <button type="button" onClick={() => setPanel(null)} className={cn('rounded p-1 text-subtle hover:text-fg', panel !== 'console' || !logs.length ? 'ml-auto' : '')} aria-label="Close panel">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        {panel && (
          <div className="h-[calc(100%-36px)] overflow-y-auto px-3 pb-2 font-mono text-[11.5px] leading-relaxed">
            {panel === 'log' && (
              <div className="space-y-0.5">
                {(project.plan?.files ?? []).filter((f) => f.path in files).map((f) => (
                  <div key={f.path} className="flex gap-2 text-muted">
                    <span className="text-ok">✓</span> {f.path} <span className="text-subtle">· {files[f.path]!.split('\n').length} lines</span>
                  </div>
                ))}
                {writtenPaths.filter((p) => !plannedPaths.includes(p)).map((p) => (
                  <div key={p} className="flex gap-2 text-muted">
                    <span className="text-ok">✓</span> {p} <span className="text-subtle">· extra file</span>
                  </div>
                ))}
                {running && (
                  <div className="flex gap-2 text-soft">
                    <span className="animate-pulse text-brand-2">✎</span> {build.activeFile ? `writing ${build.activeFile}…` : 'thinking about the first file…'}
                  </div>
                )}
                {project.buildComplete && !running && (
                  <div className="mt-1 text-ok">
                    ✓ Build complete — {writtenPaths.length} files, {totalLines} lines. {project.models.build ? `Model: ${project.models.build}.` : ''}
                  </div>
                )}
              </div>
            )}
            {panel === 'console' &&
              (logs.length === 0 ? (
                <p className="text-subtle">console.log output from your app appears here.</p>
              ) : (
                logs.map((line) => (
                  <div key={line.id} className={cn('whitespace-pre-wrap border-b border-line/40 py-0.5', line.level === 'error' ? 'text-[#ff8a80]' : line.level === 'warn' ? 'text-[#fcc56b]' : 'text-soft')}>
                    {line.message}
                  </div>
                ))
              ))}
            {panel === 'problems' &&
              (problems.length === 0 ? (
                <p className="text-subtle">No problems detected.</p>
              ) : (
                problems.map((p, i) => (
                  <button key={i} type="button" onClick={() => revealIn(p.file, p.line)} className="block w-full py-0.5 text-left text-[#ff8a80] hover:underline">
                    {p.file}
                    {p.line ? `:${p.line}` : ''} — {p.message}
                  </button>
                ))
              ))}
          </div>
        )}
      </div>
    </section>
  );

  const previewPane = (
    <aside className="flex min-h-0 flex-col border-l border-line bg-[radial-gradient(ellipse_at_top,#1a0f0e_0%,#0a0a0a_60%)]">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
        <div className="flex rounded-lg border border-line bg-bg p-0.5">
          {(['ios', 'android'] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={platform === p}
              onClick={() => setPlatform(p)}
              className={cn('rounded-md px-2.5 py-1 text-xs', platform === p ? 'bg-elevated text-fg' : 'text-muted hover:text-soft')}
            >
              {p === 'ios' ? 'iOS' : 'Android'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Reload app" title="Reload app" onClick={() => setReloadToken((t) => t + 1)} disabled={running}>
            <RotateCw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reset app data"
            title="Reset app data (clears AsyncStorage)"
            disabled={running}
            onClick={() => {
              clearAppData(project.id);
              setReloadToken((t) => t + 1);
            }}
          >
            <Eraser className="size-3.5" />
          </Button>
          {project.buildComplete && (
            <button type="button" onClick={() => useUI.getState().openPhone()} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-muted hover:bg-white/5 hover:text-fg" title="Run on your phone with Expo Go">
              <Smartphone className="size-3.5" /> <span className="hidden 2xl:inline">On my phone</span>
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 p-4">
        <PreviewFrame
          projectId={project.id}
          files={files}
          platform={platform}
          reloadToken={reloadToken}
          paused={running || !project.buildComplete}
          onEvent={onPreviewEvent}
          overlay={
            <PreviewOverlay
              running={running}
              status={previewStatus}
              problems={problems}
              runtimeError={runtimeError}
              onFix={fix}
              onReveal={revealIn}
              canFix={live.live && !chatBusy}
            />
          }
        />
      </div>
      {project.buildComplete && !running && (
        <div className="shrink-0 border-t border-line p-3">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setStage('explain')}>
              <BookOpen className="size-3.5" /> Understand the code
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => useStudio.getState().setMentorOpen(true)}>
              <MessageSquareCode className="size-3.5" /> Improve with AI
            </Button>
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <div ref={containerRef} className="flex h-full flex-col">
      {(running || error) && (
        <div className="shrink-0 space-y-3 border-b border-line bg-panel/60 p-3">
          {running && (
            <ThinkingPanel active={!build.activeFile} text={thinking} label="Lunor AI is planning the code" placeholder="Deciding how to structure the code before writing the first file…" />
          )}
          {running && (
            <div className="flex items-center gap-3 px-1 text-sm">
              <Spinner />
              <span className="min-w-0 truncate text-soft">
                {build.activeFile ? (
                  <>
                    Writing <span className="font-mono text-fg">{build.activeFile}</span>
                  </>
                ) : (
                  'Starting the build…'
                )}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted">{writtenPaths.length}/{plannedPaths.length || '?'} files</span>
                <Button variant="ghost" size="sm" onClick={() => useStudio.getState().cancel('build')}>
                  Stop
                </Button>
              </span>
            </div>
          )}
          {error && !running && <StageError error={error} onRetry={() => void runBuild()} onResume={() => void runBuild({ resume: true })} />}
        </div>
      )}

      {layout === 'three' ? (
        <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_minmax(360px,0.8fr)] 2xl:grid-cols-[240px_minmax(0,1fr)_minmax(400px,0.75fr)]">
          {filesPane}
          {codePane}
          {previewPane}
        </div>
      ) : layout === 'two' ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
          {codePane}
          {previewPane}
        </div>
      ) : (
        <>
          <div className="flex shrink-0 gap-1 border-b border-line p-1.5">
            {(['files', 'code', 'preview'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMobileTab(tab)}
                className={cn('flex-1 rounded-lg py-1.5 text-xs font-medium capitalize', mobileTab === tab ? 'bg-elevated text-fg' : 'text-muted')}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {mobileTab === 'files' && filesPane}
            {mobileTab === 'code' && codePane}
            {/* The preview stays mounted on mobile so the app keeps its state between tabs. */}
            <div className={cn('min-h-0 flex-1 flex-col', mobileTab === 'preview' ? 'flex' : 'hidden')}>{previewPane}</div>
          </div>
        </>
      )}
    </div>
  );
}
