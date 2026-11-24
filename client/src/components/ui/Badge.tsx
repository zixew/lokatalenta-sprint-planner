import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'teal' | 'emerald' | 'amber' | 'rose' | 'slate';

const TONE_CLASSES: Readonly<Record<BadgeTone, string>> = {
  neutral:
    'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700',
  teal:
    'bg-teal-50 text-[#0F766E] border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
  emerald:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  amber:
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  rose:
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  slate:
    'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium leading-4 ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
