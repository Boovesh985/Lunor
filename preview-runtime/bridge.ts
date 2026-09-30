import type { PreviewToHost } from '../shared/previewProtocol.ts';

type Message = PreviewToHost extends infer M ? (M extends { source: string } ? Omit<M, 'source'> : never) : never;

/** Send a message to the Studio. The iframe has an opaque origin, so '*' is required. */
export function post(message: Message): void {
  try {
    window.parent.postMessage({ source: 'lunor-preview', ...message }, '*');
  } catch {
    /* host gone — ignore */
  }
}

/**
 * Warnings react-native-web prints for props that are perfectly valid in a
 * native React Native app. Showing them would teach learners the wrong thing.
 */
const WEB_ONLY_NOISE = [
  /useNativeDriver/,
  /is deprecated\. (Please use|Use) /,
  /style props are deprecated/,
  /BackHandler is not supported on web/,
  /LayoutAnimation/,
];

function formatArg(value: unknown, depth = 0): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (typeof value !== 'object' || value === null) return String(value);
  if (depth > 2) return Array.isArray(value) ? '[…]' : '{…}';
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(
      value,
      (_key, v: unknown) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]';
          seen.add(v);
          if ('$$typeof' in v) return '[React element]';
        }
        if (typeof v === 'function') return `[Function ${(v as { name?: string }).name || 'anonymous'}]`;
        return v;
      },
      2,
    );
  } catch {
    return String(value);
  }
}

/** console.* with printf-style substitutions, like React's own warnings use. */
export function formatConsole(args: unknown[]): string {
  if (typeof args[0] === 'string' && /%[sdifoOc]/.test(args[0])) {
    let index = 1;
    const head = (args[0] as string).replace(/%([sdifoOc])/g, (_m, kind: string) => {
      if (kind === 'c') {
        index++;
        return '';
      }
      return index < args.length ? formatArg(args[index++]) : `%${kind}`;
    });
    args = [head, ...args.slice(index)];
  }
  const text = args.map((a) => formatArg(a)).join(' ');
  return text.length > 4000 ? `${text.slice(0, 4000)}…` : text;
}

export function installConsoleBridge(): void {
  const levels = ['log', 'info', 'warn', 'error'] as const;
  for (const level of levels) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      const message = formatConsole(args);
      if ((level === 'warn' || level === 'error') && WEB_ONLY_NOISE.some((re) => re.test(message))) return;
      post({ type: 'console', level, message });
    };
  }
}
