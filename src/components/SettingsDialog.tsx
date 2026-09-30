import { CheckCircle2, Cpu, Eye, EyeOff, KeyRound, RotateCcw, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LEVELS, type Level } from '../../shared/levels.ts';
import { useLiveAI, useServerConfig, useSettings } from '../lib/settings';
import { useUI } from '../lib/uiState';
import { cn } from '../lib/utils';
import { useXP } from '../lib/xp';
import { Badge, Button, Dialog } from './ui';

export function SettingsDialog() {
  const open = useUI((s) => s.settingsOpen);
  const setOpen = useUI((s) => s.setSettingsOpen);
  const { userApiKey, setUserApiKey, defaultLevel, setDefaultLevel } = useSettings();
  const config = useServerConfig((s) => s.config);
  const live = useLiveAI();
  const resetXP = useXP((s) => s.reset);
  const [draft, setDraft] = useState(userApiKey);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (open) setDraft(userApiKey);
  }, [open, userApiKey]);

  return (
    <Dialog open={open} onOpenChange={setOpen} title="Settings" description="AI connection and learning preferences.">
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Cpu className="size-4 text-brand-2" /> AI connection
        </h3>
        <div className="rounded-xl border border-line bg-panel p-3.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Status</span>
            {live.live ? (
              <Badge tone="ok">
                <CheckCircle2 className="size-3" /> {live.via === 'user-key' ? 'Your API key' : live.via === 'mock' ? 'Mock mode (dev)' : 'Connected'}
              </Badge>
            ) : live.loading ? (
              <Badge>Checking…</Badge>
            ) : (
              <Badge tone="warn">Demos only</Badge>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-muted">Model</span>
            <span className="font-mono text-xs text-soft">{live.model || config?.model || 'claude-opus-5-5'}</span>
          </div>
          {config && !config.aiAvailable && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              This deployment has no server API key. Instant demos work without one; to generate your own apps, add an Anthropic API key below.
            </p>
          )}
          {config?.provider === 'gemini' && live.via !== 'user-key' && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Running on Google Gemini's free tier. Add your own Anthropic API key below to use Claude instead.
            </p>
          )}
        </div>

        <label className="block text-sm">
          <span className="mb-1.5 flex items-center gap-2 font-medium">
            <KeyRound className="size-3.5 text-muted" /> Your Anthropic API key <span className="font-normal text-muted">(optional)</span>
          </span>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={reveal ? 'text' : 'password'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="sk-ant-…"
                autoComplete="off"
                spellCheck={false}
                className="h-10 w-full rounded-xl border border-line bg-bg px-3 pr-10 font-mono text-sm text-fg placeholder:text-subtle focus:border-brand/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-fg"
                aria-label={reveal ? 'Hide key' : 'Show key'}
              >
                {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button variant="primary" onClick={() => setUserApiKey(draft)} disabled={draft.trim() === userApiKey}>
              Save
            </Button>
          </div>
          {userApiKey && (
            <button type="button" onClick={() => { setUserApiKey(''); setDraft(''); }} className="mt-2 text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
              Remove saved key
            </button>
          )}
          <span className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-ok" />
            Stored only in this browser and sent over HTTPS with each AI request. The server never saves or logs it.
          </span>
        </label>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold">Default learning level</h3>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((level: Level) => (
            <button
              key={level}
              type="button"
              onClick={() => setDefaultLevel(level)}
              className={cn(
                'rounded-xl border px-3 py-2 text-sm capitalize transition-colors',
                defaultLevel === level ? 'border-brand/50 bg-brand/10 text-fg' : 'border-line text-muted hover:text-fg',
              )}
            >
              {level}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 flex items-center justify-between border-t border-line pt-4">
        <span className="text-xs text-muted">Progress and projects are saved locally in this browser.</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm('Reset your XP and level?')) resetXP();
          }}
        >
          <RotateCcw className="size-3.5" /> Reset XP
        </Button>
      </section>
    </Dialog>
  );
}
