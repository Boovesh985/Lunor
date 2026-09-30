import { describe, expect, it } from 'vitest';
import { normalizePath, parseFileBlocks, stripCodeFence, toFileBlocks, withLineNumbers } from '../shared/fileProtocol.ts';

describe('parseFileBlocks', () => {
  it('extracts complete files and keeps prose with markers', () => {
    const text = 'Here is the app.\n<file path="App.js">\nexport default 1;\n</file>\nDone!';
    const out = parseFileBlocks(text);
    expect(out.files).toEqual([{ path: 'App.js', content: 'export default 1;\n', complete: true }]);
    expect(out.prose).toBe('Here is the app.\n\n[[file:App.js]]\n\nDone!');
  });

  it('marks the last block incomplete while streaming and hides a partial closing tag', () => {
    const out = parseFileBlocks('<file path="src/a.js">\nconst a = 1;\n</fi');
    expect(out.files).toHaveLength(1);
    expect(out.files[0]).toMatchObject({ path: 'src/a.js', complete: false });
    expect(out.files[0]!.content).toBe('const a = 1;\n');
  });

  it('does not leak a half-written opening tag into prose', () => {
    const out = parseFileBlocks('Intro text\n<file pa');
    expect(out.files).toHaveLength(0);
    expect(out.prose).toBe('Intro text');
  });

  it('strips markdown fences the model may add', () => {
    const out = parseFileBlocks('<file path="a.js">\n```javascript\nconst x = 1;\n```\n</file>');
    expect(out.files[0]!.content).toBe('const x = 1;\n');
  });

  it('collects deletes, normalises paths and lets the last write win', () => {
    const out = parseFileBlocks(
      '<file path="./src\\x.js">\nv1\n</file>\n<delete path="src/old.js" />\n<file path="src/x.js">\nv2\n</file>',
    );
    expect(out.deletes).toEqual(['src/old.js']);
    expect(out.files).toEqual([{ path: 'src/x.js', content: 'v2\n', complete: true }]);
  });

  it('round-trips through toFileBlocks', () => {
    const files = { 'App.js': 'export default function App() {}\n', 'src/theme.js': 'export const colors = {};\n' };
    const parsed = parseFileBlocks(toFileBlocks(files));
    expect(Object.fromEntries(parsed.files.map((f) => [f.path, f.content]))).toEqual(files);
    expect(parsed.files.every((f) => f.complete)).toBe(true);
  });
});

describe('helpers', () => {
  it('normalizePath', () => {
    expect(normalizePath(' ./src//screens\\Home.js ')).toBe('src/screens/Home.js');
    expect(normalizePath('/App.js')).toBe('App.js');
  });

  it('stripCodeFence leaves unfenced code alone apart from trailing whitespace', () => {
    expect(stripCodeFence('\nconst a = 1;   \n\n')).toBe('const a = 1;\n');
  });

  it('withLineNumbers pads numbers to a fixed width', () => {
    const numbered = withLineNumbers(Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n'));
    expect(numbered.split('\n')[0]).toBe(' 1| line 1');
    expect(numbered.split('\n')[9]).toBe('10| line 10');
  });
});
