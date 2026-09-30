import { useEffect, useState } from 'react';
import { PreviewFrame, type PreviewEvent } from '../preview/PreviewFrame';
import { loadSampleFiles } from '../samples/files';

/**
 * Dev-only harness for the preview runtime, served at /__preview-test by
 * `npm run dev` (it is not part of production builds). ?sample=split-mate
 * picks the sample app; the log shows every event the runtime posts.
 */
export default function PreviewTest() {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [log, setLog] = useState<string[]>([]);
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios');
  useEffect(() => {
    void loadSampleFiles(new URLSearchParams(location.search).get('sample') ?? 'habit-hero').then(setFiles);
  }, []);
  const onEvent = (e: PreviewEvent) => setLog((l) => [...l, JSON.stringify(e).slice(0, 400)]);
  return (
    <div className="flex h-dvh gap-4 p-4">
      <div className="w-[460px]">
        <button className="mb-2 rounded border border-line px-3 py-1" onClick={() => setPlatform((p) => (p === 'ios' ? 'android' : 'ios'))}>
          platform: {platform}
        </button>
        <div className="h-[calc(100%-40px)]">
          <PreviewFrame projectId="test" files={files} platform={platform} onEvent={onEvent} unsafeSameOriginForTests />
        </div>
      </div>
      <pre id="log" className="flex-1 overflow-auto whitespace-pre-wrap text-xs text-muted">{Object.keys(files).join('\n')}{'\n---\n'}{log.join('\n')}</pre>
    </div>
  );
}
