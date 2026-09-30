import { AlertTriangle, KeyRound, RotateCcw, Play } from 'lucide-react';
import { navigate } from '../lib/router';
import { useSettings } from '../lib/settings';
import { useUI } from '../lib/uiState';
import type { StageError as StageErrorInfo } from '../store/studio';
import { Button } from './ui';

interface StageErrorProps {
  error: StageErrorInfo;
  onRetry(): void;
  onResume?(): void;
  title?: string;
}

export function StageError({ error, onRetry, onResume, title = 'This stage hit a problem' }: StageErrorProps) {
  const openSettings = useUI((s) => s.openSettings);
  const hasOwnKey = useSettings((s) => Boolean(s.userApiKey));
  const needsKey = error.code === 'no_api_key' || error.code === 'auth';
  // The demo's shared quota ran out (provider quota or our per-IP limit).
  const outOfQuota = error.code === 'rate_limit' || error.code === 'rate_limited';
  const demoButton = (
    <Button variant="outline" size="sm" onClick={() => navigate('/#demos')}>
      Try an instant demo
    </Button>
  );
  return (
    <div className="rounded-card border border-brand/25 bg-brand/[0.06] p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-[#ff8a80]">
          {needsKey ? <KeyRound className="size-4" /> : <AlertTriangle className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-fg">{needsKey ? 'Live AI needs an API key' : outOfQuota ? 'The free AI quota ran out' : title}</h3>
          <p className="mt-1 text-sm text-soft">{error.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {error.resumable && onResume && (
              <Button variant="primary" size="sm" onClick={onResume}>
                <Play className="size-3.5" /> Resume build
              </Button>
            )}
            {needsKey ? (
              <>
                <Button variant="primary" size="sm" onClick={openSettings}>
                  <KeyRound className="size-3.5" /> Add API key
                </Button>
                {demoButton}
              </>
            ) : (
              <>
                <Button variant={error.resumable ? 'outline' : 'primary'} size="sm" onClick={onRetry}>
                  <RotateCcw className="size-3.5" /> {error.resumable ? 'Start over' : 'Try again'}
                </Button>
                {outOfQuota && !hasOwnKey && (
                  <Button variant="outline" size="sm" onClick={openSettings}>
                    <KeyRound className="size-3.5" /> Add API key
                  </Button>
                )}
                {outOfQuota && demoButton}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
