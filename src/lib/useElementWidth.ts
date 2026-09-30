import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Width of an element, kept in sync with a ResizeObserver. Stages lay out
 * against the space they actually have (the mentor panel can take 440px),
 * not the window width. Returns a callback ref, so it keeps working when a
 * component swaps the element it renders.
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>(fallback = 1200) {
  const [width, setWidth] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((element: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    observer.current = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    observer.current.observe(element);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);
  return [ref, width] as const;
}
