import { post } from '../bridge.ts';

/**
 * AsyncStorage backed by an in-memory map seeded from the host. Every write is
 * mirrored to the Studio (the sandbox has no localStorage of its own), so app
 * data survives preview reloads — just like on a real device.
 */
export function createAsyncStorage(initial: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(initial));

  const set = (key: string, value: string) => {
    store.set(key, value);
    post({ type: 'storage', op: 'set', key, value });
  };
  const remove = (key: string) => {
    store.delete(key);
    post({ type: 'storage', op: 'remove', key });
  };
  const assertString = (key: string, value: unknown) => {
    if (typeof value !== 'string') {
      console.warn(`[AsyncStorage] Value for key "${key}" is not a string. Use JSON.stringify(value) before saving objects.`);
    }
    return String(value);
  };

  const api = {
    getItem: async (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: async (key: string, value: string) => set(key, assertString(key, value)),
    removeItem: async (key: string) => remove(key),
    mergeItem: async (key: string, value: string) => {
      const previous = store.get(key);
      const merged = { ...(previous ? JSON.parse(previous) : {}), ...JSON.parse(value) };
      set(key, JSON.stringify(merged));
    },
    clear: async () => {
      store.clear();
      post({ type: 'storage', op: 'clear' });
    },
    getAllKeys: async () => [...store.keys()],
    multiGet: async (keys: string[]) => keys.map((k) => [k, store.get(k) ?? null] as [string, string | null]),
    multiSet: async (pairs: [string, string][]) => pairs.forEach(([k, v]) => set(k, assertString(k, v))),
    multiRemove: async (keys: string[]) => keys.forEach(remove),
    multiMerge: async (pairs: [string, string][]) => {
      for (const [k, v] of pairs) await api.mergeItem(k, v);
    },
    flushGetRequests: () => undefined,
  };

  const useAsyncStorage = (key: string) => ({
    getItem: () => api.getItem(key),
    setItem: (value: string) => api.setItem(key, value),
    mergeItem: (value: string) => api.mergeItem(key, value),
    removeItem: () => api.removeItem(key),
  });

  return { __esModule: true, default: api, ...api, useAsyncStorage };
}
