import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = ''): string {
  const random = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}${Date.now().toString(36)}${random[0]!.toString(36)}${random[1]!.toString(36)}`.slice(0, prefix.length + 16);
}

export function plural(count: number, word: string, pluralWord = `${word}s`) {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(timestamp).toLocaleDateString();
}

export function fileName(path: string) {
  return path.split('/').pop() ?? path;
}

export function countLines(files: Record<string, string>) {
  return Object.values(files).reduce((sum, code) => sum + code.replace(/\n$/, '').split('\n').length, 0);
}

/** localStorage that never throws (private mode, quota, sandboxed previews). */
export const safeStorage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  /** Removes everything this app stores (every key starts with "lunor:"). */
  clearAll() {
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith('lunor:')) localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
