/**
 * Host-side compiler for the preview: Sucrase turns JSX + ES modules into
 * CommonJS while preserving line numbers, so runtime stack traces point at
 * the exact line in the editor. Also flags imports the preview can't serve.
 */
import { transform } from 'sucrase';
import { findImports, isAllowedModule, packageName } from '../../shared/runtimeContract.ts';

export interface CompileProblem {
  file: string;
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface CompileResult {
  modules: Record<string, string>;
  problems: CompileProblem[];
  entry: string | null;
}

const ENTRY_CANDIDATES = ['App.js', 'App.jsx', 'App.tsx', 'App.ts'];

function lineOf(code: string, needle: string): number | undefined {
  const index = code.indexOf(needle);
  return index === -1 ? undefined : code.slice(0, index).split('\n').length;
}

export function compileProject(files: Record<string, string>): CompileResult {
  const modules: Record<string, string> = {};
  const problems: CompileProblem[] = [];

  for (const [path, code] of Object.entries(files)) {
    if (path.endsWith('.json')) {
      try {
        JSON.parse(code);
        modules[path] = code;
      } catch (error) {
        problems.push({ file: path, message: `Invalid JSON: ${(error as Error).message}`, severity: 'error' });
      }
      continue;
    }
    if (!/\.(jsx?|tsx?)$/.test(path)) continue;

    try {
      const isTypeScript = /\.tsx?$/.test(path);
      modules[path] = transform(code, {
        transforms: isTypeScript ? ['typescript', 'jsx', 'imports'] : ['jsx', 'imports'],
        jsxRuntime: 'automatic',
        production: true,
        disableESTransforms: true,
        filePath: path,
      }).code;
    } catch (error) {
      const err = error as Error & { loc?: { line: number; column: number } };
      problems.push({
        file: path,
        line: err.loc?.line,
        column: err.loc?.column,
        message: err.message.replace(/^Error transforming [^:]+: /, '').replace(/\s*\(\d+:\d+\)$/, ''),
        severity: 'error',
      });
    }

    for (const spec of findImports(code)) {
      if (spec.startsWith('.') || spec.startsWith('/')) continue;
      if (isAllowedModule(spec) || isAllowedModule(packageName(spec))) continue;
      problems.push({
        file: path,
        line: lineOf(code, spec),
        message: `"${packageName(spec)}" isn't available in the preview. Use React Native core APIs or a supported package.`,
        severity: 'error',
      });
    }
  }

  const entry = ENTRY_CANDIDATES.find((file) => file in files) ?? null;
  if (!entry) problems.push({ file: 'App.js', message: 'Missing App.js — the app needs an entry component.', severity: 'error' });

  return { modules, problems, entry };
}
