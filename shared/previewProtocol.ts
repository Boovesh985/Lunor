/** postMessage protocol between the Studio (host) and the sandboxed preview iframe. */

export interface PreviewRunPayload {
  runId: number;
  /** path → CommonJS code produced by the host compiler. */
  modules: Record<string, string>;
  entry: string;
  /** AsyncStorage snapshot for this project, so data survives reloads. */
  storage: Record<string, string>;
  platform: 'ios' | 'android';
}

export type HostToPreview = { source: 'lunor-host'; type: 'run'; payload: PreviewRunPayload };

export interface PreviewErrorInfo {
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  column?: number;
  /** Fatal errors replace the app with the error screen; others are logged. */
  fatal: boolean;
  kind: 'module' | 'render' | 'runtime' | 'promise';
}

export type PreviewToHost =
  | { source: 'lunor-preview'; type: 'ready' }
  | { source: 'lunor-preview'; type: 'rendered'; runId: number }
  | { source: 'lunor-preview'; type: 'error'; runId: number; error: PreviewErrorInfo }
  | { source: 'lunor-preview'; type: 'console'; level: 'log' | 'info' | 'warn' | 'error'; message: string }
  | { source: 'lunor-preview'; type: 'storage'; op: 'set' | 'remove' | 'clear'; key?: string; value?: string }
  | { source: 'lunor-preview'; type: 'statusbar'; style: 'light' | 'dark' | 'auto'; background?: string }
  /** Colours at the very top / bottom of the app, so the device chrome can blend in. */
  | { source: 'lunor-preview'; type: 'tint'; top?: string; bottom?: string };

/** Pull "file:line:col" for the first frame that belongs to user code. */
export function locateInStack(stack: string | undefined): { file: string; line: number; column: number } | null {
  if (!stack) return null;
  const match = /lunor-app:\/\/\/([^:)\s]+):(\d+):(\d+)/.exec(stack);
  if (!match) return null;
  return { file: match[1]!, line: Number(match[2]), column: Number(match[3]) };
}
