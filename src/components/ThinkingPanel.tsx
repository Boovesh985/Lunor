import { Brain, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';

interface ThinkingPanelProps {
  text?: string;
  /** Streaming right now. */
  active: boolean;
  label?: string;
  /** Shown while streaming until the first reasoning arrives (some models share little of it). */
  placeholder?: string;
  className?: string;
}

/**
 * Shows the model's summarized reasoning. While a stage runs it streams live
 * ("watch the AI think"); afterwards it stays available as a collapsed note.
 */
export function ThinkingPanel({ text = '', active, label = 'Lunor AI is thinking', placeholder = 'Thinking…', className }: ThinkingPanelProps) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [text, active]);

  if (!active && !text) return null;
  const expanded = active || open;

  return (
    <div className={cn('overflow-hidden rounded-card border border-line bg-panel', className)}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => !active && setOpen((o) => !o)}
        className={cn('flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm', !active && 'hover:bg-white/[0.02]')}
      >
        <span className={cn('flex size-7 items-center justify-center rounded-lg', active ? 'bg-brand/15 text-brand-2' : 'bg-white/[0.05] text-muted')}>
          <Brain className={cn('size-4', active && 'animate-pulse-soft')} />
        </span>
        <span className="flex-1">
          <span className="font-medium text-fg">{active ? label : 'How the AI reasoned'}</span>
          {active && <span className="ml-1 inline-flex gap-0.5 align-middle">{[0, 1, 2].map((i) => <span key={i} className="size-1 animate-pulse-soft rounded-full bg-brand-2" style={{ animationDelay: `${i * 0.2}s` }} />)}</span>}
          {!active && <span className="block text-xs text-muted">The AI's summarized reasoning for this stage</span>}
        </span>
        {!active && <ChevronDown className={cn('size-4 text-muted transition-transform', open && 'rotate-180')} />}
      </button>
      {expanded && (
        <div
          ref={bodyRef}
          className={cn(
            'max-h-44 overflow-y-auto whitespace-pre-wrap border-t border-line px-4 py-3 text-[13px] leading-relaxed text-muted',
            active && '[mask-image:linear-gradient(to_bottom,transparent,black_28px)]',
          )}
        >
          {text || placeholder}
        </div>
      )}
    </div>
  );
}
