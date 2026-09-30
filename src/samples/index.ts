/**
 * Bundled sample projects: complete, hand-verified outputs for every stage.
 * They power the instant demos (no API key needed) and the dev mock mode.
 */
import type { Level } from '../../shared/schemas.ts';

export { loadSampleFiles } from './files';

export interface SampleMeta {
  id: string;
  title: string;
  emoji: string;
  level: Level;
  idea: string;
  description: string;
  accent: string;
  tags: string[];
}

export interface MentorQA {
  question: string;
  answer: string;
}

const metas = import.meta.glob<SampleMeta>('/samples/*/meta.json', { eager: true, import: 'default' });
export const SAMPLES: SampleMeta[] = Object.values(metas).sort((a, b) => a.title.localeCompare(b.title));

export function getSample(id: string | undefined): SampleMeta | undefined {
  return SAMPLES.find((s) => s.id === id);
}

const jsonFiles = import.meta.glob('/samples/*/*.json', { import: 'default' });

export type SampleDoc = 'understanding' | 'plan' | 'explanation' | 'learn' | 'thinking' | 'mentor';

export async function loadSampleDoc<T>(sampleId: string, doc: SampleDoc): Promise<T | null> {
  const loader = jsonFiles[`/samples/${sampleId}/${doc}.json`];
  return loader ? ((await loader()) as T) : null;
}
