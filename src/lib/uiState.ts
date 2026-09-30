import { create } from 'zustand';

/** App-wide UI state that isn't part of a project (dialogs). */
interface UIState {
  settingsOpen: boolean;
  openSettings(): void;
  setSettingsOpen(open: boolean): void;
  phoneOpen: boolean;
  openPhone(): void;
  setPhoneOpen(open: boolean): void;
}

export const useUI = create<UIState>((set) => ({
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  phoneOpen: false,
  openPhone: () => set({ phoneOpen: true }),
  setPhoneOpen: (phoneOpen) => set({ phoneOpen }),
}));
