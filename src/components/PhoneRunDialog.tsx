import { FileDown, RotateCw, Smartphone, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadBlob, exportExpoZip, SNACK_ORIGIN, snackData, snackEmbedUrl } from '../lib/exporters';
import type { Project } from '../lib/projects';
import { useUI } from '../lib/uiState';
import { uid } from '../lib/utils';
import { award } from '../lib/xp';
import { useStudio } from '../store/studio';
import { Button, Dialog, Spinner } from './ui';

type Phase = 'loading' | 'ready' | 'timeout';

const STEPS = [
  {
    title: 'Install Expo Go',
    body: (
      <>
        Free on the{' '}
        <a className="text-brand-2 hover:underline" href="https://apps.apple.com/app/expo-go/id982107779" target="_blank" rel="noreferrer">
          App Store
        </a>{' '}
        and{' '}
        <a className="text-brand-2 hover:underline" href="https://play.google.com/store/apps/details?id=host.exp.exponent" target="_blank" rel="noreferrer">
          Google Play
        </a>
        .
      </>
    ),
  },
  { title: 'Scan the QR code', body: <>Keep <b className="text-soft">My Device</b> selected in the Snack panel and scan it with your camera (iOS) or Expo Go (Android).</> },
  { title: 'Play with it', body: <>Your app now runs natively. Edits you make in Snack hot-reload on the phone.</> },
];

/**
 * "Run on your phone": embeds an Expo Snack session and hands it the project
 * over postMessage (see snackEmbedUrl). The phone connects to that session
 * through Expo Go, so the generated app runs as real native UI.
 */
export function PhoneRunDialog() {
  const open = useUI((s) => s.phoneOpen);
  const setOpen = useUI((s) => s.setPhoneOpen);
  const project = useStudio((s) => s.project);
  return (
    <Dialog
      open={open && !!project?.buildComplete}
      onOpenChange={setOpen}
      title="Run it on your phone"
      description="Expo Snack bundles your code and Expo Go runs it as a real native app."
      className="max-w-5xl"
    >
      {project && <SnackSession project={project} />}
    </Dialog>
  );
}

function SnackSession({ project }: { project: Project }) {
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');
  const [exporting, setExporting] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  // One Snack session per attempt, holding the code as it was when opened.
  const iframeId = useMemo(() => uid(), [attempt]);
  const snapshot = useRef(project);

  useEffect(() => {
    setPhase('loading');
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current;
      if (event.origin !== SNACK_ORIGIN || !frame || event.source !== frame.contentWindow) return;
      const [name, data] = Array.isArray(event.data) ? event.data : [];
      if (name !== 'expoFrameLoaded' || data?.iframeId !== iframeId) return;
      frame.contentWindow?.postMessage(['expoDataEvent', snackData(snapshot.current, iframeId)], SNACK_ORIGIN);
      setPhase('ready');
      award(`snack:${snapshot.current.id}`, 15, 'Sent to Expo Snack');
    };
    window.addEventListener('message', onMessage);
    const timer = window.setTimeout(() => setPhase((p) => (p === 'loading' ? 'timeout' : p)), 25_000);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
    };
  }, [iframeId]);

  const download = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await exportExpoZip(project);
      downloadBlob(blob, filename);
      award(`export:${project.id}`, 25, 'Project exported');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="grid gap-5 md:grid-cols-[230px_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <ol className="space-y-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-[11px] font-bold text-white">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="rounded-xl border border-line bg-bg/60 p-3 text-xs leading-relaxed text-muted">
          Your project’s code is sent to <b className="text-soft">snack.expo.dev</b> to bundle it. Nothing is saved to an Expo account unless you choose to.
        </div>
        <div className="mt-auto space-y-2">
          <p className="text-xs text-subtle">Prefer your own machine?</p>
          <Button variant="outline" size="sm" className="w-full" onClick={download} loading={exporting}>
            {!exporting && <FileDown className="size-3.5" />} Download Expo project
          </Button>
        </div>
      </div>

      <div className="relative h-[min(620px,64dvh)] min-h-[380px] overflow-hidden rounded-xl border border-line bg-[#141414]">
        <iframe
          key={iframeId}
          ref={frameRef}
          src={snackEmbedUrl(snapshot.current, iframeId)}
          title="Expo Snack"
          className="size-full"
          allow="clipboard-write"
        />
        {phase !== 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#141414] p-6 text-center">
            {phase === 'loading' ? (
              <>
                <Spinner className="size-6" />
                <p className="text-sm text-muted">Starting an Expo Snack session…</p>
              </>
            ) : (
              <>
                <div className="flex size-11 items-center justify-center rounded-2xl border border-line bg-elevated text-brand-2">
                  <WifiOff className="size-5" />
                </div>
                <p className="font-display font-semibold">Expo Snack didn’t respond</p>
                <p className="max-w-sm text-sm text-muted">It may be blocked by your network or a browser extension. Try again, or download the project and run it with <code className="font-mono text-soft">npx expo start</code>.</p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setAttempt((a) => a + 1)}>
                    <RotateCw className="size-3.5" /> Try again
                  </Button>
                  <Button variant="primary" size="sm" onClick={download} loading={exporting}>
                    {!exporting && <Smartphone className="size-3.5" />} Download instead
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
