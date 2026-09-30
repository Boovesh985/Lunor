import { useSyncExternalStore } from 'react';

/** A tiny History-API router — the app only has two routes. */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

export function navigate(to: string, options: { replace?: boolean } = {}) {
  // Navigating to the page you're on (e.g. the logo on the landing page) just returns to the top.
  if (to !== location.pathname + location.search + location.hash) {
    if (options.replace) history.replaceState(null, '', to);
    else history.pushState(null, '', to);
    listeners.forEach((listener) => listener());
  }
  // A "#section" target is scrolled into view by the page that owns it (see Landing);
  // scrolling to the top here would cancel that.
  if (!to.includes('#')) window.scrollTo(0, 0);
}

export function usePathname() {
  return useSyncExternalStore(subscribe, () => location.pathname);
}

export function matchStudio(pathname: string): string | null {
  const match = /^\/studio\/([\w-]+)\/?$/.exec(pathname);
  return match ? match[1]! : null;
}
