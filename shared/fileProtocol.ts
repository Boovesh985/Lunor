/**
 * Streaming-friendly protocol for AI-generated code.
 *
 * The model writes files as tagged blocks:
 *
 *   <file path="src/screens/HomeScreen.js">
 *   ...raw code...
 *   </file>
 *   <delete path="src/old.js" />
 *
 * Anything outside the blocks is prose (used by the mentor chat). The parser
 * is re-run on the whole accumulated text as it streams, so it must tolerate
 * an unfinished final block.
 */

export interface FileBlock {
  path: string;
  content: string;
  /** false while the closing tag has not streamed in yet. */
  complete: boolean;
}

export interface ParsedOutput {
  files: FileBlock[];
  deletes: string[];
  /** Text outside file blocks, with the blocks replaced by a marker line. */
  prose: string;
}

const OPEN_RE = /<file\s+path\s*=\s*["']([^"']+)["']\s*>/g;
const DELETE_RE = /<delete\s+path\s*=\s*["']([^"']+)["']\s*\/?>/g;
const CLOSE_TAG = '</file>';

export function normalizePath(path: string): string {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\/+/, '')
    .replace(/\/{2,}/g, '/');
}

/** Remove a markdown fence the model may have wrapped around file contents. */
export function stripCodeFence(content: string): string {
  let text = content.replace(/^\s*\n/, '');
  const fence = /^\s*```[\w-]*\s*\n/;
  if (fence.test(text)) {
    text = text.replace(fence, '');
    text = text.replace(/\n?\s*```\s*$/, '');
  }
  return text.replace(/\s+$/, '') + '\n';
}

export function parseFileBlocks(text: string): ParsedOutput {
  const files: FileBlock[] = [];
  const deletes: string[] = [];
  let prose = '';
  let cursor = 0;

  OPEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = OPEN_RE.exec(text))) {
    prose += text.slice(cursor, match.index);
    const path = normalizePath(match[1]!);
    const bodyStart = match.index + match[0].length;
    const closeIdx = text.indexOf(CLOSE_TAG, bodyStart);
    if (closeIdx === -1) {
      // Still streaming: hide a partially-written closing tag from the content.
      let body = text.slice(bodyStart);
      const partial = partialSuffix(body, CLOSE_TAG);
      if (partial) body = body.slice(0, -partial);
      files.push({ path, content: stripFenceStreaming(body), complete: false });
      cursor = text.length;
      break;
    }
    files.push({ path, content: stripCodeFence(text.slice(bodyStart, closeIdx)), complete: true });
    prose += `\n[[file:${path}]]\n`;
    cursor = closeIdx + CLOSE_TAG.length;
    OPEN_RE.lastIndex = cursor;
  }
  if (cursor < text.length) prose += text.slice(cursor);

  // A trailing partial "<file ..." opener should not leak into prose.
  const opener = prose.lastIndexOf('<file');
  if (opener !== -1 && !prose.slice(opener).includes('>')) prose = prose.slice(0, opener);

  prose = prose.replace(DELETE_RE, (_m, p: string) => {
    deletes.push(normalizePath(p));
    return '';
  });

  // Merge duplicate paths (last write wins) while keeping first-seen order.
  const merged = new Map<string, FileBlock>();
  for (const file of files) merged.set(file.path, file);

  return { files: [...merged.values()], deletes, prose: prose.replace(/\n{3,}/g, '\n\n').trim() };
}

/** Length of the longest suffix of `text` that is a proper prefix of `tag`. */
function partialSuffix(text: string, tag: string): number {
  for (let len = Math.min(tag.length - 1, text.length); len > 0; len--) {
    if (text.endsWith(tag.slice(0, len))) return len;
  }
  return 0;
}

function stripFenceStreaming(body: string): string {
  return body.replace(/^\s*\n/, '').replace(/^\s*```[\w-]*\s*\n/, '');
}

/** Serialise files back into the protocol (used for prompts and tests). */
export function toFileBlocks(files: Record<string, string>): string {
  return Object.entries(files)
    .map(([path, content]) => `<file path="${path}">\n${content.replace(/\s+$/, '')}\n</file>`)
    .join('\n\n');
}

/** Prefix every line with its number — gives the model exact line references. */
export function withLineNumbers(content: string): string {
  const lines = content.replace(/\n$/, '').split('\n');
  const width = String(lines.length).length;
  return lines.map((line, i) => `${String(i + 1).padStart(width, ' ')}| ${line}`).join('\n');
}
