/**
 * A tiny CommonJS module system for the generated app.
 *
 * The host compiles every file with Sucrase (JSX + ESM→CJS, line numbers
 * preserved). Here we evaluate them lazily with `require`, resolving relative
 * paths like Metro would (./x → ./x.js, ./x/index.js, …) and serving
 * react / react-native / Expo packages from the built-in shim registry.
 */

export type ModuleRecord = Record<string, unknown>;

export class PreviewModuleError extends Error {
  constructor(message: string, readonly file?: string) {
    super(message);
    this.name = 'ModuleError';
  }
}

const EXTENSIONS = ['', '.js', '.jsx', '.ts', '.tsx', '.json'];
const INDEX_FILES = ['/index.js', '/index.jsx', '/index.ts', '/index.tsx'];

function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

type ModuleFactory = (require: (spec: string) => unknown, module: { exports: unknown }, exports: unknown) => void;

function compile(path: string, code: string): ModuleFactory {
  // Wrapper on the same line as the first line of code keeps line numbers 1:1,
  // and sourceURL gives stack traces real file names.
  const source = `(function (require, module, exports) {${code}\n})\n//# sourceURL=lunor-app:///${path}`;
  // Indirect eval runs in global scope, like a real module.
  return (0, eval)(source) as ModuleFactory;
}

export function createModuleSystem(files: Record<string, string>, builtins: Record<string, unknown>) {
  const cache = new Map<string, { exports: unknown }>();

  function resolve(from: string, spec: string): string | null {
    const base = spec.startsWith('/') ? spec : `${dirname(from)}/${spec}`;
    const target = normalize(base);
    for (const ext of EXTENSIONS) if (target + ext in files) return target + ext;
    for (const index of INDEX_FILES) if (target + index in files) return target + index;
    return null;
  }

  function load(path: string): unknown {
    const cached = cache.get(path);
    if (cached) return cached.exports;
    const module = { exports: {} as unknown };
    cache.set(path, module);
    const code = files[path]!;
    if (path.endsWith('.json')) {
      module.exports = JSON.parse(code);
      return module.exports;
    }
    try {
      compile(path, code)(makeRequire(path), module, module.exports);
    } catch (error) {
      cache.delete(path);
      throw error;
    }
    return module.exports;
  }

  function makeRequire(from: string) {
    return (spec: string): unknown => {
      if (spec in builtins) return builtins[spec];
      if (spec.startsWith('.') || spec.startsWith('/')) {
        const resolved = resolve(from, spec);
        if (!resolved) throw new PreviewModuleError(`Unable to resolve "${spec}" from "${from}". Check the file path and its export.`, from);
        return load(resolved);
      }
      const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      throw new PreviewModuleError(
        `The package "${pkg}" isn't available in the Lunor preview. Use React Native core components or one of the supported packages instead.`,
        from,
      );
    };
  }

  return {
    require(entry: string): unknown {
      const resolved = resolve('', entry);
      if (!resolved) throw new PreviewModuleError(`Entry file "${entry}" was not found.`);
      return load(resolved);
    },
  };
}

/** Wrap a namespace as an ES module record Sucrase's interop understands. */
export function esModule<T extends object>(namespace: T, defaultExport?: unknown): ModuleRecord {
  return { ...namespace, default: defaultExport ?? (namespace as { default?: unknown }).default ?? namespace, __esModule: true };
}
