import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PreviewErrorInfo, PreviewRunPayload, PreviewToHost } from '../../shared/previewProtocol.ts';
import { safeStorage } from '../lib/utils';
import type { CompileProblem } from './compiler';
import { PhoneFrame, type DevicePlatform } from './PhoneFrame';

export type PreviewStatus = 'idle' | 'compiling' | 'booting' | 'running' | 'crashed' | 'compile-error';

export type PreviewEvent =
  | { type: 'status'; status: PreviewStatus }
  | { type: 'problems'; problems: CompileProblem[] }
  | { type: 'error'; error: PreviewErrorInfo }
  | { type: 'console'; level: 'log' | 'info' | 'warn' | 'error'; message: string };

const appDataKey = (projectId: string) => `lunor:appdata:${projectId}`;

/**
 * The runtime is inlined into the iframe's srcdoc rather than loaded by URL:
 * a sandboxed frame without allow-same-origin has an opaque origin, and
 * inlining avoids any cross-origin fetch for the document or the script.
 */
let runtimeSource: Promise<string> | null = null;
function loadRuntime(): Promise<string> {
  runtimeSource ??= fetch('/preview/runtime.js')
    .then((r) => {
      if (!r.ok) throw new Error(`Preview runtime missing (${r.status}). Run "npm run build:runtime".`);
      return r.text();
    })
    .then((code) => code.replace(/<\/script/gi, '<\\/script'))
    .catch((error) => {
      runtimeSource = null;
      throw error;
    });
  return runtimeSource;
}

function buildSrcDoc(runtime: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>html,body{height:100%;margin:0;background:#fff;overflow:hidden}body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased}#root{display:flex;height:100%;flex-direction:column}*{-webkit-tap-highlight-color:transparent}::-webkit-scrollbar{width:0;height:0}</style>
</head><body><div id="root"></div><script>${runtime}</script></body></html>`;
}

export function clearAppData(projectId: string) {
  safeStorage.remove(appDataKey(projectId));
}

function applyStorageOp(projectId: string, data: Extract<PreviewToHost, { type: 'storage' }>) {
  const key = appDataKey(projectId);
  const store = safeStorage.get<Record<string, string>>(key, {});
  if (data.op === 'clear') {
    safeStorage.set(key, {});
    return;
  }
  if (!data.key) return;
  if (data.op === 'set') store[data.key] = data.value ?? '';
  else delete store[data.key];
  safeStorage.set(key, store);
}

interface PreviewFrameProps {
  projectId: string;
  files: Record<string, string>;
  platform: DevicePlatform;
  /** Increment to force a fresh boot (e.g. "Reload app"). */
  reloadToken?: number;
  /** While true (e.g. during code generation) nothing is compiled or run. */
  paused?: boolean;
  onEvent?: (event: PreviewEvent) => void;
  overlay?: ReactNode;
  /** Dev-only test hook: lets automated tests reach into the frame. Never used by the Studio. */
  unsafeSameOriginForTests?: boolean;
}

/**
 * Compiles the project, boots a fresh sandboxed iframe for every run (clean
 * globals, timers and module cache) and relays renders, errors, console
 * output and AsyncStorage writes.
 */
export function PreviewFrame({ projectId, files, platform, reloadToken = 0, paused = false, onEvent, overlay, unsafeSameOriginForTests }: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const pendingRun = useRef<PreviewRunPayload | null>(null);
  const runCounter = useRef(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const [frame, setFrame] = useState<{ key: number; srcDoc: string } | null>(null);
  const [tint, setTint] = useState<{ top?: string; bottom?: string }>({});
  const [barStyle, setBarStyle] = useState<'light' | 'dark' | 'auto'>('auto');

  useEffect(() => {
    if (paused || Object.keys(files).length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const emit = (event: PreviewEvent) => onEventRef.current?.(event);
      emit({ type: 'status', status: 'compiling' });
      let runtime: string;
      let compileProject: typeof import('./compiler').compileProject;
      try {
        [runtime, { compileProject }] = await Promise.all([loadRuntime(), import('./compiler')]);
      } catch (error) {
        emit({ type: 'error', error: { message: (error as Error).message, fatal: true, kind: 'module' } });
        emit({ type: 'status', status: 'crashed' });
        return;
      }
      if (cancelled) return;
      const result = compileProject(files);
      emit({ type: 'problems', problems: result.problems });
      if (!result.entry || result.problems.some((p) => p.severity === 'error')) {
        emit({ type: 'status', status: 'compile-error' });
        return;
      }
      const runId = ++runCounter.current;
      pendingRun.current = {
        runId,
        modules: result.modules,
        entry: result.entry,
        storage: safeStorage.get(appDataKey(projectId), {}),
        platform,
      };
      setBarStyle('auto');
      setFrame({ key: runId, srcDoc: buildSrcDoc(runtime) });
      emit({ type: 'status', status: 'booting' });
    }, 380);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [files, platform, reloadToken, paused, projectId]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow) return;
      const data = event.data as PreviewToHost;
      if (!data || data.source !== 'lunor-preview') return;
      const emit = (e: PreviewEvent) => onEventRef.current?.(e);
      switch (data.type) {
        case 'ready':
          if (pendingRun.current) frame.contentWindow?.postMessage({ source: 'lunor-host', type: 'run', payload: pendingRun.current }, '*');
          break;
        case 'rendered':
          if (data.runId === runCounter.current) emit({ type: 'status', status: 'running' });
          break;
        case 'error':
          if (data.runId !== runCounter.current) break;
          emit({ type: 'error', error: data.error });
          if (data.error.fatal) emit({ type: 'status', status: 'crashed' });
          break;
        case 'console':
          emit({ type: 'console', level: data.level, message: data.message });
          break;
        case 'storage':
          applyStorageOp(projectId, data);
          break;
        case 'statusbar':
          setBarStyle(data.style);
          if (data.background) setTint((t) => ({ ...t, top: data.background }));
          break;
        case 'tint':
          setTint({ top: data.top, bottom: data.bottom });
          break;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [projectId]);

  return (
    <PhoneFrame platform={platform} statusStyle={barStyle} topColor={tint.top} bottomColor={tint.bottom} overlay={overlay}>
      {frame && (
        <iframe
          key={frame.key}
          ref={iframeRef}
          srcDoc={frame.srcDoc}
          title="Live app preview"
          sandbox={`allow-scripts allow-popups allow-forms${import.meta.env.DEV && unsafeSameOriginForTests ? ' allow-same-origin' : ''}`}
          className="absolute inset-0 h-full w-full border-0 bg-white"
        />
      )}
    </PhoneFrame>
  );
}
