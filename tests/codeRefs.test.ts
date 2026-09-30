import { describe, expect, it } from 'vitest';
import { resolveRange, sliceLines } from '../shared/codeRefs.ts';

const code = ['import x from "y";', '', 'function a() {', '  return 1;', '}', '', 'function b() {', '  return 2;', '}'].join('\n');

describe('resolveRange', () => {
  it('keeps a correct reference as is', () => {
    expect(resolveRange(code, { startLine: 3, endLine: 5, anchor: 'function a() {' })).toEqual({ start: 3, end: 5, anchored: true });
  });

  it('shifts a wrong line number to the anchor and keeps the span', () => {
    expect(resolveRange(code, { startLine: 5, endLine: 7, anchor: 'function b() {' })).toEqual({ start: 7, end: 9, anchored: true });
  });

  it('picks the occurrence nearest to the suggested line', () => {
    const repeated = ['return (', 'a', 'return (', 'b', 'return ('].join('\n');
    expect(resolveRange(repeated, { startLine: 4, endLine: 4, anchor: 'return (' }).start).toBe(3);
    expect(resolveRange(repeated, { startLine: 5, endLine: 5, anchor: 'return (' }).start).toBe(5);
  });

  it('ignores whitespace differences in the anchor', () => {
    expect(resolveRange(code, { startLine: 1, endLine: 1, anchor: '  return   2; ' }).start).toBe(8);
  });

  it('clamps out-of-range lines when the anchor is missing', () => {
    expect(resolveRange(code, { startLine: 40, endLine: 50, anchor: 'nothing like this' })).toEqual({ start: 9, end: 9, anchored: false });
    expect(resolveRange(code, { startLine: 0, endLine: -3 })).toEqual({ start: 1, end: 1, anchored: false });
  });

  it('never ends past the file when the span is shifted down', () => {
    expect(resolveRange(code, { startLine: 1, endLine: 6, anchor: 'function b() {' })).toEqual({ start: 7, end: 9, anchored: true });
  });

  it('handles a missing file', () => {
    expect(resolveRange(undefined, { startLine: 3, endLine: 4 })).toEqual({ start: 1, end: 1, anchored: false });
  });
});

describe('sliceLines', () => {
  it('returns an inclusive 1-based range', () => {
    expect(sliceLines(code, 3, 5)).toBe('function a() {\n  return 1;\n}');
  });
});
