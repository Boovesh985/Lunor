/**
 * Gamification in the spirit of Lunor's roadmap (XP, levels, badges).
 * Every award has a unique key so progress can't be farmed by repeating it.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { safeLocalStorage } from './settings';

export const XP_LEVELS = [
  { min: 0, title: 'Rookie' },
  { min: 100, title: 'Builder' },
  { min: 250, title: 'Maker' },
  { min: 500, title: 'Engineer' },
  { min: 850, title: 'Architect' },
  { min: 1300, title: 'App Hero' },
] as const;

export function levelFor(xp: number) {
  let index = 0;
  XP_LEVELS.forEach((level, i) => {
    if (xp >= level.min) index = i;
  });
  const current = XP_LEVELS[index]!;
  const next = XP_LEVELS[index + 1];
  const progress = next ? (xp - current.min) / (next.min - current.min) : 1;
  return { level: index + 1, title: current.title, next, progress };
}

export interface XPToast {
  id: number;
  amount: number;
  label: string;
}

interface XPState {
  xp: number;
  awarded: Record<string, number>;
  toasts: XPToast[];
  award(key: string, amount: number, label: string): void;
  dismiss(id: number): void;
  reset(): void;
}

let toastId = 1;

export const useXP = create<XPState>()(
  persist(
    (set, get) => ({
      xp: 0,
      awarded: {},
      toasts: [],
      award(key, amount, label) {
        if (get().awarded[key]) return;
        const id = toastId++;
        set((s) => ({ xp: s.xp + amount, awarded: { ...s.awarded, [key]: amount }, toasts: [...s.toasts, { id, amount, label }] }));
        setTimeout(() => get().dismiss(id), 2600);
      },
      dismiss(id) {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      },
      reset() {
        set({ xp: 0, awarded: {}, toasts: [] });
      },
    }),
    {
      name: 'lunor:xp',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({ xp: s.xp, awarded: s.awarded }),
    },
  ),
);

export const award = (key: string, amount: number, label: string) => useXP.getState().award(key, amount, label);
