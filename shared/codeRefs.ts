/**
 * Resolves AI (or hand-written) references to code ranges.
 *
 * Models are good but not perfect at line numbers, so every reference also
 * carries an `anchor` — the verbatim text of its first line. We look the
 * anchor up in the real file (preferring the occurrence closest to the
 * suggested line) and shift the range to match, keeping its length.
 */

export interface RangeRef {
  startLine: number;
  endLine: number;
  anchor?: string;
}

export interface ResolvedRange {
  start: number;
  end: number;
  /** True when the anchor was found in the file. */
  anchored: boolean;
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

export function resolveRange(content: string | undefined, ref: RangeRef): ResolvedRange {
  const lines = (content ?? '').replace(/\n$/, '').split('\n');
  const total = Math.max(1, lines.length);
  const clamp = (n: number) => Math.min(total, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)));

  let start = clamp(ref.startLine);
  let end = clamp(Math.max(ref.endLine, ref.startLine));
  let anchored = false;

  const anchor = ref.anchor ? squash(ref.anchor) : '';
  if (anchor.length >= 3) {
    let best = -1;
    let bestDistance = Infinity;
    lines.forEach((line, i) => {
      const text = squash(line);
      if (!text) return;
      if (text === anchor || text.startsWith(anchor) || (anchor.length >= 12 && text.includes(anchor))) {
        const distance = Math.abs(i + 1 - start);
        if (distance < bestDistance) {
          best = i + 1;
          bestDistance = distance;
        }
      }
    });
    if (best !== -1) {
      const span = end - start;
      start = best;
      end = clamp(best + span);
      anchored = true;
    }
  }
  if (end < start) end = start;
  return { start, end, anchored };
}

/** Lines [start, end] (1-based, inclusive) of a file. */
export function sliceLines(content: string, start: number, end: number): string {
  return content.split('\n').slice(start - 1, end).join('\n');
}
