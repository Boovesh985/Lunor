import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { exportExpoZip, projectDependencies, slugify, snackData, snackEmbedUrl } from '../src/lib/exporters.ts';
import { emptyProgress, type Project } from '../src/lib/projects.ts';
import { readSampleApp, readSampleDoc } from './helpers.ts';

function sampleProject(id: string): Project {
  const files = readSampleApp(id);
  return {
    id: 'test',
    createdAt: 0,
    updatedAt: 0,
    idea: readSampleDoc(id, 'meta').idea,
    level: readSampleDoc(id, 'meta').level,
    source: 'sample',
    sampleId: id,
    understanding: readSampleDoc(id, 'understanding'),
    decisions: {},
    excludedFeatures: [],
    plan: readSampleDoc(id, 'plan'),
    files,
    generatedFiles: files,
    buildComplete: true,
    explanation: readSampleDoc(id, 'explanation'),
    learn: readSampleDoc(id, 'learn'),
    chat: [],
    thinking: {},
    models: {},
    progress: emptyProgress(),
  };
}

describe('Expo project export', () => {
  it('slugifies app names', () => {
    expect(slugify('SplitMate')).toBe('splitmate');
    expect(slugify('  Habit Hero! 2.0 ')).toBe('habit-hero-2-0');
    expect(slugify('💸')).toBe('lunor-app');
  });

  it('pins Expo SDK versions for exactly the packages the code imports', () => {
    const deps = projectDependencies(readSampleApp('split-mate'));
    expect(deps).toMatchObject({ expo: expect.any(String), react: expect.any(String), 'react-native': expect.any(String) });
    expect(Object.keys(deps)).toEqual(expect.arrayContaining(['expo-haptics', 'expo-linear-gradient', '@react-native-async-storage/async-storage']));
    expect(Object.keys(deps)).toEqual([...Object.keys(deps)].sort());
  });

  it('produces a runnable project with README and learning notes', async () => {
    const project = sampleProject('split-mate');
    const { blob, filename } = await exportExpoZip(project);
    expect(filename).toBe('splitmate.zip');
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const names = Object.keys(zip.files).filter((name) => !name.endsWith('/'));
    for (const path of Object.keys(project.files)) expect(names).toContain(`splitmate/${path}`);
    expect(names).toEqual(expect.arrayContaining(['splitmate/package.json', 'splitmate/app.json', 'splitmate/index.js', 'splitmate/README.md', 'splitmate/LEARNING_NOTES.md']));

    const pkg = JSON.parse(await zip.file('splitmate/package.json')!.async('string'));
    expect(pkg.main).toBe('index.js');
    expect(pkg.scripts.start).toBe('expo start');
    expect(await zip.file('splitmate/index.js')!.async('string')).toContain('registerRootComponent(App)');

    const notes = await zip.file('splitmate/LEARNING_NOTES.md')!.async('string');
    expect(notes).toContain('## Code walkthrough');
    expect(notes).toContain('## Quiz');
    expect(notes).toMatch(/Lunor level \d+/);
  });
});

describe('Expo Snack embed', () => {
  it('builds an embed URL that waits for data, with encoded parameters', () => {
    const url = new URL(snackEmbedUrl(sampleProject('split-mate'), 'abc123'));
    expect(url.origin + url.pathname).toBe('https://snack.expo.dev/embedded');
    expect(url.searchParams.get('iframeId')).toBe('abc123');
    expect(url.searchParams.get('waitForData')).toBe('true');
    expect(url.searchParams.get('platform')).toBe('mydevice');
    expect(url.searchParams.get('name')).toBe('SplitMate');
  });

  it('sends files as a JSON string and dependencies as a comma list', () => {
    const project = sampleProject('split-mate');
    const data = snackData(project, 'abc123');
    expect(data.iframeId).toBe('abc123');
    const files = JSON.parse(data.files);
    expect(Object.keys(files).sort()).toEqual(Object.keys(project.files).sort());
    expect(files['App.js']).toEqual({ type: 'CODE', contents: project.files['App.js'] });
    expect(data.dependencies.split(',')).toEqual(expect.arrayContaining(['@expo/vector-icons', 'expo-haptics']));
    expect(data.dependencies).not.toMatch(/react-native,|^react,/);
  });
});
