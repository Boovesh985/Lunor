import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { Level } from '../../shared/schemas.ts';

/** localStorage that tolerates private mode / blocked storage. */
export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* ignore */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

interface SettingsState {
  /** Optional personal Anthropic key — kept in this browser only, sent per request, never stored server-side. */
  userApiKey: string;
  defaultLevel: Level;
  setUserApiKey(key: string): void;
  setDefaultLevel(level: Level): void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      userApiKey: '',
      defaultLevel: 'beginner',
      setUserApiKey: (userApiKey) => set({ userApiKey: userApiKey.trim() }),
      setDefaultLevel: (defaultLevel) => set({ defaultLevel }),
    }),
    { name: 'lunor:settings', storage: createJSONStorage(() => safeLocalStorage) },
  ),
);

export interface ServerConfig {
  aiAvailable: boolean;
  mock: boolean;
  /** Which provider serves requests on the server's key (null = none configured). */
  provider?: 'anthropic' | 'gemini' | 'mock' | null;
  model: string;
  /** Model used when a visitor brings their own Anthropic key. */
  userKeyModel?: string;
}

interface ServerConfigState {
  /** null until /api/config has answered (or failed). */
  config: ServerConfig | null;
  load(): Promise<void>;
}

const NO_AI: ServerConfig = { aiAvailable: false, mock: false, model: '' };
let loading: Promise<void> | null = null;

async function fetchConfig(): Promise<ServerConfig> {
  // One retry: a cold serverless function occasionally fails the first request.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch('/api/config');
      if (response.ok) return (await response.json()) as ServerConfig;
    } catch {
      /* network error — retry once */
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 800));
  }
  return NO_AI;
}

export const useServerConfig = create<ServerConfigState>((set, get) => ({
  config: null,
  load() {
    if (get().config) return Promise.resolve();
    // Every caller shares one request.
    loading ??= fetchConfig().then((config) => set({ config }));
    return loading;
  },
}));

/** Whether live AI calls can be made right now, and why. `loading` = the server hasn't answered yet. */
export function useLiveAI(): { live: boolean; via: 'user-key' | 'server' | 'mock' | 'none'; model: string; loading: boolean } {
  const userKey = useSettings((s) => s.userApiKey);
  const config = useServerConfig((s) => s.config);
  if (userKey) return { live: true, via: 'user-key', model: config?.userKeyModel || 'claude-opus-5-5', loading: false };
  if (config?.aiAvailable) return { live: true, via: config.mock ? 'mock' : 'server', model: config.model, loading: false };
  return { live: false, via: 'none', model: '', loading: config === null };
}

export function isLiveAIAvailable(): boolean {
  return Boolean(useSettings.getState().userApiKey) || Boolean(useServerConfig.getState().config?.aiAvailable);
}
