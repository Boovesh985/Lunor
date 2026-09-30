import { ArrowLeft, Bot, Download, FileDown, Settings, Smartphone } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { MentorPanel } from '../components/MentorPanel';
import { PhoneRunDialog } from '../components/PhoneRunDialog';
import { Logo } from '../components/Logo';
import { StageStepper } from '../components/StageStepper';
import { XPPill } from '../components/XP';
import { Badge, Button, EmptyHint, Spinner } from '../components/ui';
import { downloadBlob, exportExpoZip } from '../lib/exporters';
import { navigate } from '../lib/router';
import { useUI } from '../lib/uiState';
import { cn } from '../lib/utils';
import { award } from '../lib/xp';
import { useStudio } from '../store/studio';
import { UnderstandStage } from '../stages/UnderstandStage';
import { PlanStage } from '../stages/PlanStage';

const BuildStage = lazy(() => import('../stages/BuildStage'));
const ExplainStage = lazy(() => import('../stages/ExplainStage'));
const LearnStage = lazy(() => import('../stages/LearnStage'));

function ExportMenu() {
  const project = useStudio((s) => s.project);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!project?.buildComplete) return null;

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Download className="size-3.5" /> <span className="hidden md:inline">Export</span>
      </Button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-line bg-card p-1.5 shadow-2xl">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { blob, filename } = await exportExpoZip(project);
                downloadBlob(blob, filename);
                award(`export:${project.id}`, 25, 'Project exported');
              } finally {
                setBusy(false);
                setOpen(false);
              }
            }}
            className="flex w-full items-start gap-3 rounded-lg p-2.5 text-left hover:bg-white/[0.04]"
          >
            {busy ? <Spinner className="mt-0.5" /> : <FileDown className="mt-0.5 size-4 text-brand-2" />}
            <span>
              <span className="block text-sm font-medium">Download Expo project</span>
              <span className="block text-xs text-muted">.zip with README + your learning notes</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              useUI.getState().openPhone();
            }}
            className="flex w-full items-start gap-3 rounded-lg p-2.5 text-left hover:bg-white/[0.04]"
          >
            <Smartphone className="mt-0.5 size-4 text-brand-2" />
            <span>
              <span className="block text-sm font-medium">Run on your phone</span>
              <span className="block text-xs text-muted">Via Expo Snack — scan the QR code with Expo Go</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function StudioHeader() {
  const project = useStudio((s) => s.project)!;
  const stage = useStudio((s) => s.stage);
  const status = useStudio((s) => s.status);
  const setStage = useStudio((s) => s.setStage);
  const mentorOpen = useStudio((s) => s.mentorOpen);
  const setMentorOpen = useStudio((s) => s.setMentorOpen);
  const chatBusy = useStudio((s) => s.chatBusy);
  const openSettings = useUI((s) => s.openSettings);
  const name = project.understanding?.appName;

  return (
    <header className="z-30 shrink-0 border-b border-line bg-bg/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
        <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 rounded-lg pr-1 text-muted hover:text-fg" aria-label="Back to home">
          <ArrowLeft className="size-4 lg:hidden" />
          <span className="hidden lg:block">
            <Logo compact />
          </span>
        </button>
        <span className="hidden h-6 w-px bg-line lg:block" />
        <div className="flex min-w-0 shrink items-center gap-2">
          <span className="text-lg">{project.understanding?.emoji ?? '✨'}</span>
          <span className="max-w-[160px] truncate font-display text-sm font-semibold">{name ?? 'New app'}</span>
          {project.source === 'sample' && <Badge tone="info">Demo</Badge>}
        </div>
        <div className="mx-auto hidden md:block">
          <StageStepper project={project} current={stage} status={status} onSelect={setStage} />
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <div className="hidden xl:block">
            <XPPill />
          </div>
          <ExportMenu />
          <Button
            variant={mentorOpen ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setMentorOpen(!mentorOpen)}
            className={cn(mentorOpen && 'border-brand/40')}
            disabled={!project.buildComplete && project.chat.length === 0}
            title={project.buildComplete ? 'Ask the AI mentor' : 'The mentor unlocks once your app is built'}
          >
            {chatBusy ? <Spinner /> : <Bot className="size-3.5" />} <span className="hidden md:inline">AI Mentor</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={openSettings} aria-label="Settings">
            <Settings className="size-4" />
          </Button>
        </div>
      </div>
      <div className="border-t border-line px-3 py-1.5 md:hidden">
        <StageStepper project={project} current={stage} status={status} onSelect={setStage} />
      </div>
    </header>
  );
}

export function Studio({ projectId }: { projectId: string }) {
  const open = useStudio((s) => s.open);
  const close = useStudio((s) => s.close);
  const project = useStudio((s) => s.project);
  const stage = useStudio((s) => s.stage);
  const status = useStudio((s) => s.status);
  const mentorOpen = useStudio((s) => s.mentorOpen);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setMissing(!open(projectId));
    return () => {
      close();
      // The phone dialog belongs to this project; don't reopen it on the next one.
      useUI.getState().setPhoneOpen(false);
    };
  }, [projectId, open, close]);

  // Keep the pipeline moving: analyse new ideas, and generate the walkthrough
  // and learning path for built apps that don't have them yet.
  const loaded = project?.id === projectId;
  useEffect(() => {
    if (!loaded || !project) return;
    const state = useStudio.getState();
    if (!project.understanding && status.understand === 'idle') void state.runUnderstand();
    if (project.buildComplete && !project.explanation && status.explain === 'idle') void state.runExplain();
    if (project.buildComplete && !project.learn && status.learn === 'idle') void state.runLearn();
  }, [loaded, project?.understanding, project?.buildComplete, project?.explanation, project?.learn, status.understand, status.explain, status.learn]);

  useEffect(() => {
    const name = project?.understanding?.appName;
    document.title = name ? `${name} · Lunor App Studio` : 'Lunor App Studio';
  }, [project?.understanding?.appName]);

  if (missing) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <EmptyHint icon={<Bot className="size-5" />} title="Project not found" action={<Button variant="primary" onClick={() => navigate('/')}>Start a new app</Button>}>
          This project isn’t saved in this browser. Projects live in local storage, so they don’t move between devices.
        </EmptyHint>
      </div>
    );
  }
  if (!loaded || !project) return <div className="flex h-dvh items-center justify-center"><Spinner className="size-6" /></div>;

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <StudioHeader />
      <div className="flex min-h-0 flex-1">
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <Suspense fallback={<div className="flex h-full items-center justify-center"><Spinner className="size-6" /></div>}>
            {stage === 'understand' && <UnderstandStage />}
            {stage === 'plan' && <PlanStage />}
            {stage === 'build' && <BuildStage />}
            {stage === 'explain' && <ExplainStage />}
            {stage === 'learn' && <LearnStage />}
          </Suspense>
        </main>
        {mentorOpen && <MentorPanel />}
      </div>
      <PhoneRunDialog />
    </div>
  );
}
