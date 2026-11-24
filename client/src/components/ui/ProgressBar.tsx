type ProgressTone = 'teal' | 'emerald' | 'amber' | 'rose';

const TONE_FILL: Readonly<Record<ProgressTone, string>> = {
  teal: 'bg-[#0F766E] dark:bg-[#14b8a6]',
  emerald: 'bg-[#059669] dark:bg-emerald-500',
  amber: 'bg-[#D97706] dark:bg-amber-500',
  rose: 'bg-[#E11D48] dark:bg-rose-500',
};

export function ProgressBar({
  value,
  max = 100,
  tone = 'teal',
  label,
}: {
  value: number;
  max?: number;
  tone?: ProgressTone;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full transition-all duration-200 ease-out ${TONE_FILL[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
