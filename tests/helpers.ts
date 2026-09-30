import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const SAMPLES_DIR = join(process.cwd(), 'samples');

export const sampleIds = () => readdirSync(SAMPLES_DIR).filter((name) => statSync(join(SAMPLES_DIR, name)).isDirectory());

export function readSampleDoc<T = any>(sampleId: string, doc: string): T {
  return JSON.parse(readFileSync(join(SAMPLES_DIR, sampleId, `${doc}.json`), 'utf8')) as T;
}

export function readSampleApp(sampleId: string): Record<string, string> {
  const root = join(SAMPLES_DIR, sampleId, 'app');
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files[relative(root, full).replace(/\\/g, '/')] = readFileSync(full, 'utf8');
    }
  };
  walk(root);
  return files;
}

/** Collect a full NDJSON response body into parsed events. */
export async function readNdjson(response: Response): Promise<any[]> {
  const text = await response.text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
