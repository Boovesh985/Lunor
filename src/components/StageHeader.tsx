import type { ReactNode } from 'react';
import type { StageId } from '../../shared/schemas.ts';
import { STAGE_META, STAGE_ORDER } from './StageStepper';

export function StageHeader({ stage, subtitle, actions }: { stage: StageId; subtitle: ReactNode; actions?: ReactNode }) {
  const meta = STAGE_META[stage];
  const Icon = meta.icon;
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-brand text-white glow-brand">
          <Icon className="size-5" />
        </span>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-2">
            Stage {STAGE_ORDER.indexOf(stage) + 1} of 5
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{meta.label}</h1>
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
