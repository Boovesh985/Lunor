import { Allow, parse } from 'partial-json';

/** Parse a JSON document that is still streaming in (unclosed strings, arrays, objects). */
export function parsePartial<T>(text: string): T | undefined {
  if (!text.trim()) return undefined;
  try {
    const value = parse(text, Allow.ALL) as unknown;
    return value && typeof value === 'object' ? (value as T) : undefined;
  } catch {
    return undefined;
  }
}

/** Throttle with a trailing call and an explicit flush — keeps streaming UIs cheap. */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;
  const run = () => {
    timer = null;
    last = Date.now();
    if (pending) {
      const args = pending;
      pending = null;
      fn(...args);
    }
  };
  const throttled = (...args: A) => {
    pending = args;
    const wait = ms - (Date.now() - last);
    if (wait <= 0 && !timer) run();
    else if (!timer) timer = setTimeout(run, wait);
  };
  throttled.flush = () => {
    if (timer) clearTimeout(timer);
    run();
  };
  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };
  return throttled;
}
