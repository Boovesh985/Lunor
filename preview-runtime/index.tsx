/**
 * Lunor preview runtime — runs AI-generated React Native code in the browser.
 *
 * Loaded by /preview/index.html inside a sandboxed iframe (opaque origin, no
 * access to the Studio's storage or cookies). The Studio posts compiled
 * modules; we evaluate them with a small CommonJS loader, alias react-native
 * to react-native-web plus device-like shims, and report renders, errors,
 * console output and AsyncStorage writes back to the host.
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as JSXRuntime from 'react/jsx-runtime';
import * as RNW from 'react-native-web';
import { locateInStack, type HostToPreview, type PreviewErrorInfo, type PreviewRunPayload } from '../shared/previewProtocol.ts';
import { installConsoleBridge, post } from './bridge.ts';
import { createModuleSystem, esModule, PreviewModuleError } from './moduleSystem.ts';
import { createAsyncStorage } from './shims/asyncStorage.ts';
import { ExpoStatusBar, LinearGradient, createNativeStatusBar, hapticsModule, safeAreaModule } from './shims/expo.tsx';
import { ActionSheetIOS, Alert, OverlayHost, ToastAndroid, setOverlayPlatform } from './shims/overlay.tsx';
import { loadFamily, vectorIconModules } from './shims/vectorIcons.tsx';

let runId = 0;
let started = false;

function toErrorInfo(error: unknown, kind: PreviewErrorInfo['kind'], fatal: boolean): PreviewErrorInfo {
  const err = error instanceof Error ? error : new Error(String(error));
  const where = locateInStack(err.stack);
  return {
    message: err.message || String(error),
    stack: err.stack,
    file: where?.file ?? (err instanceof PreviewModuleError ? err.file : undefined),
    line: where?.line,
    column: where?.column,
    fatal,
    kind,
  };
}

function report(error: unknown, kind: PreviewErrorInfo['kind'], fatal: boolean) {
  post({ type: 'error', runId, error: toErrorInfo(error, kind, fatal) });
}

function createBuiltins(payload: PreviewRunPayload): Record<string, unknown> {
  const platform = payload.platform;
  setOverlayPlatform(platform);
  const Platform = {
    ...RNW.Platform,
    OS: platform,
    Version: platform === 'ios' ? '18.0' : 35,
    isPad: false,
    isTV: false,
    constants: { reactNativeVersion: { major: 0, minor: 86, patch: 3 } },
    select: <T,>(spec: Record<string, T>): T | undefined =>
      platform in spec ? spec[platform] : 'native' in spec ? spec.native : spec.default,
  };
  const noopLogBox = { ignoreLogs: () => undefined, ignoreAllLogs: () => undefined, install: () => undefined, uninstall: () => undefined };
  const BackHandler = { addEventListener: () => ({ remove: () => undefined }), removeEventListener: () => undefined, exitApp: () => undefined };

  const reactNative = esModule({
    ...RNW,
    Alert,
    ActionSheetIOS,
    ToastAndroid,
    Platform,
    StatusBar: createNativeStatusBar(),
    LogBox: noopLogBox,
    BackHandler,
  });

  return {
    react: esModule(React, (React as { default?: unknown }).default ?? React),
    'react/jsx-runtime': esModule(JSXRuntime),
    'react/jsx-dev-runtime': esModule({ ...JSXRuntime, jsxDEV: JSXRuntime.jsx }),
    'react-dom': esModule(ReactDOM),
    'react-native': reactNative,
    'react-native-web': reactNative,
    '@react-native-async-storage/async-storage': createAsyncStorage(payload.storage),
    'expo-status-bar': { __esModule: true, StatusBar: ExpoStatusBar, setStatusBarStyle: () => undefined, setStatusBarHidden: () => undefined },
    'expo-linear-gradient': { __esModule: true, LinearGradient, default: LinearGradient },
    'react-native-safe-area-context': safeAreaModule(),
    'expo-haptics': hapticsModule(),
    ...vectorIconModules(),
  };
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const withStack = error;
    if (!locateInStack(error.stack) && info.componentStack) {
      withStack.stack = `${error.stack ?? ''}\n${info.componentStack}`;
    }
    report(withStack, 'render', true);
  }
  render() {
    if (this.state.error) return <CrashScreen error={this.state.error} />;
    return this.props.children;
  }
}

function CrashScreen({ error }: { error: Error }) {
  return (
    <RNW.View style={{ flex: 1, backgroundColor: '#1a0b0b', padding: 20, justifyContent: 'center' }}>
      <RNW.Text style={{ color: '#ff8a80', fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>APP CRASHED</RNW.Text>
      <RNW.Text style={{ color: '#fff', fontSize: 16, marginTop: 8, lineHeight: 22 }}>{error.message}</RNW.Text>
      <RNW.Text style={{ color: '#bdbdbd', fontSize: 12, marginTop: 16 }}>Details and an AI fix are shown in the Studio.</RNW.Text>
    </RNW.View>
  );
}

function colorAt(x: number, y: number): string | undefined {
  let el = document.elementFromPoint(x, y) as HTMLElement | null;
  while (el && el !== document.documentElement) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(bg)) return bg;
    el = el.parentElement;
  }
  return undefined;
}

/** Reports the colours at the top and bottom edges so the phone frame can blend in. */
function useStatusBarTint() {
  React.useEffect(() => {
    let last = '';
    const sample = () => {
      const top = colorAt(window.innerWidth / 2, 1);
      const bottom = colorAt(window.innerWidth / 2, window.innerHeight - 2);
      const key = `${top}|${bottom}`;
      if (key !== last) {
        last = key;
        post({ type: 'tint', top, bottom });
      }
    };
    const first = setTimeout(sample, 60);
    const timer = setInterval(sample, 400);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
}

function Shell({ children }: { children: React.ReactNode }) {
  useStatusBarTint();
  React.useEffect(() => {
    post({ type: 'rendered', runId });
  }, []);
  return (
    <RNW.View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      {children}
      <OverlayHost />
    </RNW.View>
  );
}

function run(payload: PreviewRunPayload) {
  if (started) {
    // Each run gets a fresh iframe (clean globals and timers), so a second
    // message means the host reused us — reload to stay isolated.
    location.reload();
    return;
  }
  started = true;
  runId = payload.runId;

  let App: React.ComponentType;
  try {
    const system = createModuleSystem(payload.modules, createBuiltins(payload));
    const exports = system.require(payload.entry) as { default?: unknown } | undefined;
    const candidate = (exports && typeof exports === 'object' && 'default' in exports ? exports.default : exports) as unknown;
    if (typeof candidate !== 'function' && !(candidate && typeof candidate === 'object' && '$$typeof' in candidate)) {
      throw new Error(`${payload.entry} must \`export default\` a React component (got ${candidate === undefined ? 'undefined' : typeof candidate}).`);
    }
    App = candidate as React.ComponentType;
  } catch (error) {
    report(error, 'module', true);
    renderRoot(<CrashScreen error={error instanceof Error ? error : new Error(String(error))} />);
    return;
  }
  renderRoot(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

function renderRoot(node: React.ReactNode) {
  const container = document.getElementById('root')!;
  const root = createRoot(container, {
    onUncaughtError: (error) => report(error, 'render', true),
  });
  root.render(<Shell>{node}</Shell>);
}

installConsoleBridge();
window.addEventListener('error', (event) => {
  report(event.error ?? event.message, 'runtime', false);
});
window.addEventListener('unhandledrejection', (event) => {
  report(event.reason, 'promise', false);
});
window.addEventListener('message', (event: MessageEvent<HostToPreview>) => {
  if (event.source !== window.parent) return;
  const data = event.data;
  if (!data || data.source !== 'lunor-host' || data.type !== 'run') return;
  run(data.payload);
});

void loadFamily('Ionicons');
post({ type: 'ready' });
