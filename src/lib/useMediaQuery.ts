import { useSyncExternalStore } from 'react';

/** Render one layout or the other — never both (e.g. to avoid two live preview iframes). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}
