import { cn } from '../lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-7', className)} aria-hidden>
      <defs>
        <linearGradient id="lunor-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ED2C2C" />
          <stop offset="1" stopColor="#F65F31" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#141414" stroke="#2a2a2a" />
      <rect x="10.5" y="6" width="11" height="20" rx="3" fill="none" stroke="url(#lunor-g)" strokeWidth="2" />
      <path d="M16 12.5l2.6 3.5-2.6 3.5-2.6-3.5z" fill="url(#lunor-g)" />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="flex items-baseline gap-2">
        <span className="font-display text-[15px] font-bold tracking-tight">
          Lunor<span className="text-gradient">.AI</span>
        </span>
        {!compact && (
          <span className="hidden rounded-md border border-line bg-elevated px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:inline">
            App Studio
          </span>
        )}
      </span>
    </span>
  );
}
