import { BookOpen, Check, Compass, GraduationCap, Hammer, Lightbulb, type LucideIcon } from 'lucide-react';
import type { StageId } from '../../shared/schemas.ts';
import type { Project } from '../lib/projects';
import { cn } from '../lib/utils';
import type { RunStatus } from '../store/studio';

export const STAGE_META: Record<StageId, { label: string; icon: LucideIcon; blurb: string }> = {
  understand: { label: 'Understand', icon: Lightbulb, blurb: 'What are we really building?' },
  plan: { label: 'Plan', icon: Compass, blurb: 'Screens, data and architecture' },
  build: { label: 'Build', icon: Hammer, blurb: 'Generate and run the app' },
  explain: { label: 'Explain', icon: BookOpen, blurb: 'Walk through every file' },
  learn: { label: 'Learn', icon: GraduationCap, blurb: 'Concepts, quiz and challenges' },
};

export const STAGE_ORDER: StageId[] = ['understand', 'plan', 'build', 'explain', 'learn'];

export function isStageAvailable(project: Project, stage: StageId, status: Record<StageId, RunStatus>): boolean {
  switch (stage) {
    case 'understand':
      return true;
    case 'plan':
      return Boolean(project.understanding) || status.plan === 'running';
    case 'build':
      return Boolean(project.plan) || status.build !== 'idle' || Object.keys(project.files).length > 0;
    case 'explain':
    case 'learn':
      return project.buildComplete;
  }
}

interface StageStepperProps {
  project: Project;
  current: StageId;
  status: Record<StageId, RunStatus>;
  onSelect(stage: StageId): void;
}

export function StageStepper({ project, current, status, onSelect }: StageStepperProps) {
  return (
    <nav aria-label="Pipeline stages" className="scrollbar-none flex items-center gap-1 overflow-x-auto">
      {STAGE_ORDER.map((stage, index) => {
        const meta = STAGE_META[stage];
        const available = isStageAvailable(project, stage, status);
        const state = status[stage];
        const active = current === stage;
        const Icon = meta.icon;
        return (
          <div key={stage} className="flex shrink-0 items-center">
            {index > 0 && <span className={cn('mx-1 h-px w-4 lg:w-6', available ? 'bg-line-strong' : 'bg-line')} />}
            <button
              type="button"
              disabled={!available}
              onClick={() => onSelect(stage)}
              title={meta.blurb}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'group flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13px] font-medium transition-all',
                active ? 'border-brand/40 bg-brand/10 text-fg' : 'border-transparent text-muted hover:text-soft',
                !available && 'cursor-not-allowed opacity-40 hover:text-muted',
              )}
            >
              <span
                className={cn(
                  'flex size-6 items-center justify-center rounded-full text-[11px]',
                  active ? 'bg-gradient-brand text-white' : state === 'done' ? 'bg-white/10 text-fg' : 'bg-white/[0.05]',
                )}
              >
                {state === 'running' ? (
                  <span className="size-2.5 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                ) : state === 'done' && !active ? (
                  <Check className="size-3.5" />
                ) : (
                  <Icon className="size-3.5" />
                )}
              </span>
              <span className={cn(active ? 'hidden sm:inline' : 'hidden xl:inline')}>{meta.label}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
