import { CalendarRange } from 'lucide-react';

export function BrandLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#0F766E] text-white border border-[#0F766E]">
        <CalendarRange className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-tight text-[#18181B] dark:text-slate-100">
          LokaTalenta
        </div>
        <div className="text-[11px] font-medium text-[#52525B] dark:text-slate-400">
          Sprint Planner · 4103
        </div>
      </div>
    </div>
  );
}
