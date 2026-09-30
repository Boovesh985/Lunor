/** Small Expo packages used by generated apps: status bar, gradients, safe areas, haptics. */
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native-web';
import { post } from '../bridge.ts';

type BarStyle = 'light' | 'dark' | 'auto';

function toStyle(style: string | undefined): BarStyle {
  if (style === 'light' || style === 'light-content') return 'light';
  if (style === 'dark' || style === 'dark-content') return 'dark';
  return 'auto';
}

/** expo-status-bar <StatusBar style="light" /> → recolours the phone frame's status bar. */
export function ExpoStatusBar({ style, backgroundColor }: { style?: string; backgroundColor?: string }) {
  useEffect(() => {
    post({ type: 'statusbar', style: toStyle(style), background: backgroundColor });
  }, [style, backgroundColor]);
  return null;
}

/** react-native's StatusBar component + imperative API. */
export function createNativeStatusBar() {
  function StatusBar({ barStyle, backgroundColor }: { barStyle?: string; backgroundColor?: string }) {
    useEffect(() => {
      post({ type: 'statusbar', style: toStyle(barStyle), background: backgroundColor });
    }, [barStyle, backgroundColor]);
    return null;
  }
  StatusBar.setBarStyle = (style: string) => post({ type: 'statusbar', style: toStyle(style) });
  StatusBar.setBackgroundColor = (color: string) => post({ type: 'statusbar', style: 'auto', background: color });
  StatusBar.setHidden = () => undefined;
  StatusBar.setTranslucent = () => undefined;
  StatusBar.setNetworkActivityIndicatorVisible = () => undefined;
  StatusBar.currentHeight = 0;
  return StatusBar;
}

interface GradientProps {
  colors: string[];
  start?: { x: number; y: number } | [number, number];
  end?: { x: number; y: number } | [number, number];
  locations?: number[];
  style?: unknown;
  children?: ReactNode;
  [key: string]: unknown;
}

const point = (p: GradientProps['start'], fallback: { x: number; y: number }) =>
  Array.isArray(p) ? { x: p[0], y: p[1] } : (p ?? fallback);

/** expo-linear-gradient via CSS linear-gradient (react-native-web supports backgroundImage). */
export function LinearGradient({ colors = [], start, end, locations, style, children, ...rest }: GradientProps) {
  const s = point(start, { x: 0.5, y: 0 });
  const e = point(end, { x: 0.5, y: 1 });
  const angle = (Math.atan2(e.x - s.x, -(e.y - s.y)) * 180) / Math.PI;
  const stops = colors.map((c, i) => (locations?.[i] != null ? `${c} ${Math.round(locations[i]! * 100)}%` : c)).join(', ');
  return (
    <View {...rest} style={[style as never, { backgroundImage: `linear-gradient(${angle}deg, ${stops})` } as never]}>
      {children}
    </View>
  );
}

const zeroInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function safeAreaModule() {
  const SafeAreaProvider = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const SafeAreaView = ({ children, edges: _edges, ...props }: { children?: ReactNode; edges?: unknown; [k: string]: unknown }) => <View {...props}>{children}</View>;
  return {
    __esModule: true,
    SafeAreaProvider,
    SafeAreaView,
    useSafeAreaInsets: () => zeroInsets,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }),
    initialWindowMetrics: { insets: zeroInsets, frame: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight } },
    SafeAreaInsetsContext: { Consumer: ({ children }: { children: (i: typeof zeroInsets) => ReactNode }) => <>{children(zeroInsets)}</> },
  };
}

export function hapticsModule() {
  const noop = async () => undefined;
  return {
    __esModule: true,
    impactAsync: noop,
    notificationAsync: noop,
    selectionAsync: noop,
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Soft: 'soft', Rigid: 'rigid' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  };
}
