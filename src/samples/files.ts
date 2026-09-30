/** Lazily loads a bundled sample app's source files as raw strings. */
const appFiles = import.meta.glob<string>('/samples/*/app/**/*.{js,jsx,json}', { query: '?raw', import: 'default' });

export async function loadSampleFiles(sampleId: string): Promise<Record<string, string>> {
  const prefix = `/samples/${sampleId}/app/`;
  const entries = Object.entries(appFiles).filter(([path]) => path.startsWith(prefix));
  const files: Record<string, string> = {};
  await Promise.all(
    entries.map(async ([path, load]) => {
      files[path.slice(prefix.length)] = await load();
    }),
  );
  return files;
}
