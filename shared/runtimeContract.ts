/**
 * The contract between the code generator, the in-browser preview runtime and
 * the exported Expo project. Generated apps may only import these packages:
 * each one is implemented (or faithfully shimmed) by the preview runtime and
 * pinned to the Expo SDK 57 version in the downloadable project.
 */

export const EXPO_SDK_VERSION = '57.0.0';

/** Always present in the exported package.json. */
export const BASE_DEPENDENCIES: Record<string, string> = {
  expo: '~57.0.26',
  'expo-status-bar': '~57.0.1',
  react: '19.2.3',
  'react-dom': '19.2.3',
  'react-native': '0.86.3',
  'react-native-web': '~0.21.0',
};

export interface AllowedPackage {
  version: string;
  /** Shown to the model so it knows what the package offers in this project. */
  usage: string;
}

/** Third-party packages a generated app may import (besides react / react-native). */
export const ALLOWED_PACKAGES: Record<string, AllowedPackage> = {
  '@expo/vector-icons': {
    version: '^15.0.2',
    usage: "Icons. Prefer `import { Ionicons } from '@expo/vector-icons'` (MaterialIcons, MaterialCommunityIcons, Feather, FontAwesome, AntDesign and Entypo also work).",
  },
  '@react-native-async-storage/async-storage': {
    version: '2.2.0',
    usage: "Persistence. `import AsyncStorage from '@react-native-async-storage/async-storage'`; getItem/setItem/removeItem with JSON strings.",
  },
  'expo-status-bar': {
    version: '~57.0.1',
    usage: "`import { StatusBar } from 'expo-status-bar'`; render <StatusBar style=\"dark\" /> (or \"light\") once in App.js.",
  },
  'react-native-safe-area-context': {
    version: '~5.7.0',
    usage:
      "Safe areas (react-native's own SafeAreaView is deprecated). Wrap the app once in <SafeAreaProvider> in App.js and use `import { SafeAreaView } from 'react-native-safe-area-context'` as each screen's root with style={{ flex: 1 }}.",
  },
  'expo-linear-gradient': {
    version: '~57.0.2',
    usage: "Optional gradients: `import { LinearGradient } from 'expo-linear-gradient'` with colors={[...]} start/end props.",
  },
  'expo-haptics': {
    version: '~57.0.3',
    usage: 'Optional tactile feedback (no-op in the browser preview).',
  },
};

export const CORE_MODULES = ['react', 'react-native', 'react/jsx-runtime'] as const;

export function isAllowedModule(pkg: string): boolean {
  return (CORE_MODULES as readonly string[]).includes(pkg) || pkg in ALLOWED_PACKAGES;
}

/** Package name for a bare specifier: "@expo/vector-icons/Ionicons" → "@expo/vector-icons". */
export function packageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!;
}

const IMPORT_RE = /(?:import\s+(?:[\w*{}\s,]+\s+from\s+)?|export\s+(?:[\w*{}\s,]+\s+from\s+)|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;

/** All module specifiers a source file imports (static, dynamic and require). */
export function findImports(code: string): string[] {
  const specs = new Set<string>();
  // Strip comments so commented-out imports don't count.
  const stripped = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const match of stripped.matchAll(IMPORT_RE)) specs.add(match[1]!);
  return [...specs];
}

/** Third-party packages used across a project (excluding react/react-native). */
export function detectPackages(files: Record<string, string>): string[] {
  const pkgs = new Set<string>();
  for (const [path, code] of Object.entries(files)) {
    if (!/\.(jsx?|tsx?)$/.test(path)) continue;
    for (const spec of findImports(code)) {
      if (spec.startsWith('.') || spec.startsWith('/')) continue;
      const pkg = packageName(spec);
      if (pkg !== 'react' && pkg !== 'react-native') pkgs.add(pkg);
    }
  }
  return [...pkgs].sort();
}

/**
 * Relative imports that don't resolve to a project file, as project paths
 * (e.g. "src/components/Card.js"). Used to detect an incomplete build.
 */
export function findMissingImports(files: Record<string, string>): string[] {
  const missing = new Set<string>();
  const exts = ['', '.js', '.jsx', '.ts', '.tsx', '.json', '/index.js'];
  for (const [path, code] of Object.entries(files)) {
    if (!/\.(jsx?|tsx?)$/.test(path)) continue;
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    for (const spec of findImports(code)) {
      if (!spec.startsWith('.')) continue;
      const parts: string[] = [];
      for (const part of `${dir}/${spec}`.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') parts.pop();
        else parts.push(part);
      }
      const target = parts.join('/');
      if (!exts.some((ext) => target + ext in files)) missing.add(/\.\w+$/.test(target) ? target : `${target}.js`);
    }
  }
  return [...missing].sort();
}

/** Human-readable contract embedded in build / edit prompts. */
export function runtimeContractForPrompt(): string {
  const pkgs = Object.entries(ALLOWED_PACKAGES)
    .map(([name, p]) => `- ${name}: ${p.usage}`)
    .join('\n');
  return `Allowed imports — NOTHING else (the app runs in a browser preview AND as an Expo SDK ${EXPO_SDK_VERSION.split('.')[0]} project):
- react (hooks: useState, useEffect, useMemo, useCallback, useReducer, useContext, useRef, createContext)
- react-native core APIs: View, Text, Image, ScrollView, FlatList, SectionList, Pressable, TouchableOpacity, TextInput, Switch, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, StyleSheet, Platform, Dimensions, useWindowDimensions, Animated, Easing, Keyboard, Share, Linking (NOT SafeAreaView — use react-native-safe-area-context)
${pkgs}
- Relative imports between the project's own files.
Forbidden: react-navigation, expo-router, react-native-svg, styled-components, nativewind, redux, zustand, axios, any other npm package, TypeScript, native modules, image assets via require().`;
}
