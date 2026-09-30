/**
 * @expo/vector-icons for the browser preview: the real icon fonts and glyph
 * maps from @expo/vector-icons@15 on jsDelivr, loaded on first use.
 */
import { useEffect, useReducer } from 'react';
import { Text } from 'react-native-web';

const CDN = 'https://cdn.jsdelivr.net/npm/@expo/vector-icons@15.0.2/build/vendor/react-native-vector-icons';

export const ICON_FAMILIES = ['Ionicons', 'MaterialIcons', 'MaterialCommunityIcons', 'Feather', 'FontAwesome', 'AntDesign', 'Entypo'] as const;
type Family = (typeof ICON_FAMILIES)[number];

const glyphMaps = new Map<Family, Record<string, number>>();
const pending = new Map<Family, Promise<void>>();
const listeners = new Set<() => void>();
const warned = new Set<string>();

export function loadFamily(family: Family): Promise<void> {
  if (glyphMaps.has(family)) return Promise.resolve();
  const existing = pending.get(family);
  if (existing) return existing;
  const style = document.createElement('style');
  style.textContent = `@font-face{font-family:'${family}';src:url('${CDN}/Fonts/${family}.ttf') format('truetype');font-display:block;}`;
  document.head.appendChild(style);
  const promise = fetch(`${CDN}/glyphmaps/${family}.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((map: Record<string, number>) => {
      glyphMaps.set(family, map);
      listeners.forEach((l) => l());
    });
  pending.set(family, promise);
  return promise;
}

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: unknown;
  [key: string]: unknown;
}

function createIconSet(family: Family) {
  function Icon({ name, size = 12, color = 'black', style, ...rest }: IconProps) {
    const [, force] = useReducer((n: number) => n + 1, 0);
    useEffect(() => {
      listeners.add(force);
      void loadFamily(family);
      return () => void listeners.delete(force);
    }, []);
    const map = glyphMaps.get(family);
    let glyph = '';
    if (map) {
      const code = map[name];
      if (code === undefined) {
        const key = `${family}:${name}`;
        if (!warned.has(key)) {
          warned.add(key);
          console.warn(`"${name}" is not a valid icon name for family "${family}"`);
        }
        glyph = '?';
      } else {
        glyph = String.fromCodePoint(code);
      }
    }
    return (
      <Text
        selectable={false}
        {...rest}
        style={[{ fontFamily: family, fontSize: size, color, fontWeight: 'normal', fontStyle: 'normal', lineHeight: size * 1.15 }, style as never]}
      >
        {glyph}
      </Text>
    );
  }
  Icon.displayName = family;
  Icon.getRawGlyphMap = () => glyphMaps.get(family) ?? {};
  Icon.hasIcon = (name: string) => Boolean(glyphMaps.get(family)?.[name]);
  return Icon;
}

export const iconSets = Object.fromEntries(ICON_FAMILIES.map((f) => [f, createIconSet(f)])) as Record<Family, ReturnType<typeof createIconSet>>;

/** Module records for '@expo/vector-icons' and its per-family subpaths. */
export function vectorIconModules(): Record<string, unknown> {
  const modules: Record<string, unknown> = {
    '@expo/vector-icons': { __esModule: true, ...iconSets, createIconSet: () => iconSets.Ionicons },
  };
  for (const family of ICON_FAMILIES) {
    modules[`@expo/vector-icons/${family}`] = { __esModule: true, default: iconSets[family] };
  }
  return modules;
}
