import { lazy, Suspense, useEffect } from 'react';
import { SettingsDialog } from './components/SettingsDialog';
import { Spinner } from './components/ui';
import { XPToaster } from './components/XP';
import { matchStudio, navigate, usePathname } from './lib/router';
import { useServerConfig } from './lib/settings';
import { Landing } from './pages/Landing';

const Studio = lazy(() => import('./pages/Studio').then((m) => ({ default: m.Studio })));
const PreviewTest = import.meta.env.DEV ? lazy(() => import('./dev/PreviewTest')) : null;

export function App() {
  const pathname = usePathname();
  const loadConfig = useServerConfig((s) => s.load);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const projectId = matchStudio(pathname);
  const previewTest = !!PreviewTest && pathname === '/__preview-test';

  // Any other path shows the landing page, so make the address bar say so too.
  useEffect(() => {
    if (!projectId && !previewTest && pathname !== '/') navigate(`/${location.hash}`, { replace: true });
  }, [pathname, projectId, previewTest]);

  let page = <Landing />;
  if (projectId) page = <Studio projectId={projectId} />;
  else if (previewTest && PreviewTest) page = <PreviewTest />;

  return (
    <>
      <Suspense
        fallback={
          <div className="flex h-dvh items-center justify-center">
            <Spinner className="size-6" />
          </div>
        }
      >
        {page}
      </Suspense>
      <SettingsDialog />
      <XPToaster />
    </>
  );
}
