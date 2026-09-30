import { describe, expect, it } from 'vitest';
import { locateInStack } from '../shared/previewProtocol.ts';
import { compileProject } from '../src/preview/compiler.ts';

describe('compileProject', () => {
  it('compiles JSX and ES modules to CommonJS without shifting line numbers', () => {
    const app = [
      "import { Text } from 'react-native';",
      '',
      'export default function App() {',
      '  return <Text>Hello</Text>;',
      '}',
    ].join('\n');
    const result = compileProject({ 'App.js': app });
    expect(result.problems).toEqual([]);
    expect(result.entry).toBe('App.js');
    const compiled = result.modules['App.js']!;
    expect(compiled).toContain('require(');
    expect(compiled).toContain('react/jsx-runtime');
    // Line 4 still holds the JSX, so runtime stack traces map straight back to the editor.
    expect(compiled.split('\n')[3]).toContain('Hello');
  });

  it('reports syntax errors with a location', () => {
    const result = compileProject({ 'App.js': 'export default function App() {\n  return <View>;\n}' });
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatchObject({ file: 'App.js', severity: 'error' });
    expect(result.problems[0]!.line).toBeGreaterThanOrEqual(2);
  });

  it('flags packages the preview cannot provide, with the line', () => {
    const result = compileProject({ 'App.js': "import { View } from 'react-native';\nimport axios from 'axios';\nexport default () => null;" });
    expect(result.problems).toEqual([expect.objectContaining({ file: 'App.js', line: 2, message: expect.stringContaining('"axios"') })]);
  });

  it('requires an App entry and validates JSON files', () => {
    const result = compileProject({ 'src/data.json': '{ not json', 'src/a.js': 'export const a = 1;' });
    expect(result.entry).toBeNull();
    expect(result.problems.map((p) => p.file).sort()).toEqual(['App.js', 'src/data.json']);
  });
});

describe('locateInStack', () => {
  it('finds the first user-code frame', () => {
    const stack = 'TypeError: x is undefined\n    at render (runtime.js:10:5)\n    at HabitCard (lunor-app:///src/components/HabitCard.js:24:17)';
    expect(locateInStack(stack)).toEqual({ file: 'src/components/HabitCard.js', line: 24, column: 17 });
  });

  it('returns null when no frame belongs to the app', () => {
    expect(locateInStack('Error\n    at foo (runtime.js:1:1)')).toBeNull();
    expect(locateInStack(undefined)).toBeNull();
  });
});
