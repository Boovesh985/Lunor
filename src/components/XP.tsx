import { Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { levelFor, useXP } from '../lib/xp';

export function XPPill() {
  const xp = useXP((s) => s.xp);
  const { level, title, next, progress } = levelFor(xp);
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-line bg-elevated py-1 pl-1.5 pr-3"
      title={next ? `${next.min - xp} XP to ${next.title}` : 'Max level reached'}
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-gradient-brand">
        <Zap className="size-3.5 fill-white text-white" />
      </span>
      <span className="leading-none">
        <span className="block text-[12px] font-semibold tabular-nums text-fg">{xp} XP</span>
        <span className="mt-1 flex items-center gap-1.5">
          <span className="text-[10px] text-muted">
            Lv {level} · {title}
          </span>
          <span className="hidden h-1 w-10 overflow-hidden rounded-full bg-white/10 sm:block">
            <span className="block h-full bg-gradient-brand" style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        </span>
      </span>
    </div>
  );
}

export function XPToaster() {
  const toasts = useXP((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="flex items-center gap-2 rounded-full border border-brand/30 bg-[#1a0f0d]/95 px-4 py-2 shadow-xl backdrop-blur"
          >
            <Zap className="size-4 fill-brand-2 text-brand-2" />
            <span className="text-sm font-semibold text-fg">+{toast.amount} XP</span>
            <span className="text-sm text-muted">{toast.label}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
