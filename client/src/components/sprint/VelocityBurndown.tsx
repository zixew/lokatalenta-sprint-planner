import type { SprintSummary } from '../../lib/api.ts';
import { Badge } from '../ui/Badge.tsx';

export function VelocityBurndown({ summary }: { summary: SprintSummary | null }) {
  if (!summary) {
    return (
      <div
        data-testid="velocity-burndown-panel"
        className="rounded-xl border border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] p-6 text-center text-sm text-[#52525B] dark:text-slate-400"
      >
        Loading sprint analytics...
      </div>
    );
  }

  const width = 640;
  const height = 260;
  const pad = { top: 20, right: 24, bottom: 38, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const burndown = summary.burndown;
  const maxBurndownSp = Math.max(
    1,
    ...burndown.map((p) => Math.max(p.idealRemaining, p.actualRemaining)),
  );

  const toX = (idx: number, total: number) =>
    total <= 1 ? pad.left + plotW / 2 : pad.left + (idx / (total - 1)) * plotW;
  const toY = (val: number) => pad.top + plotH - (val / maxBurndownSp) * plotH;

  const idealPointsAttr = burndown
    .map((pt, i) => `${toX(i, burndown.length)},${toY(pt.idealRemaining)}`)
    .join(' ');
  const actualPointsAttr = burndown
    .map((pt, i) => `${toX(i, burndown.length)},${toY(pt.actualRemaining)}`)
    .join(' ');

  const gridTicks = [0, 0.25, 0.5, 0.75, 1];
  const velocitySeries = summary.velocity.series;
  const maxVelocitySp = Math.max(
    1,
    ...velocitySeries.map((v) => Math.max(v.committedPoints, v.completedPoints)),
  );

  return (
    <div
      data-testid="velocity-burndown-panel"
      className="grid grid-cols-1 gap-6 lg:grid-cols-12"
    >
      <section className="lg:col-span-7 rounded-xl border border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E3DC] dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-[#18181B] dark:text-slate-100">
              Sprint Burndown ({summary.sprintId})
            </h2>
            <p className="text-xs text-[#52525B] dark:text-slate-400">
              Ideal linear burn vs. actual remaining story points across {burndown.length} calendar days.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-[#52525B] dark:text-slate-300">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-slate-400" />
              Ideal
            </span>
            <span className="inline-flex items-center gap-1.5 text-[#0F766E] dark:text-teal-400 font-medium">
              <span className="h-0.5 w-4 bg-[#0F766E] dark:bg-[#14b8a6]" />
              Actual
            </span>
          </div>
        </div>

        {summary.totals.committedPoints === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] dark:bg-[#0D1117] p-8 text-center text-xs text-[#52525B] dark:text-slate-400">
            Assign items to {summary.sprintId} to plot the daily burndown trajectory.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <svg
              data-testid="burndown-chart"
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto min-w-[440px]"
              role="img"
              aria-label={`Burndown chart for ${summary.name}`}
            >
              {gridTicks.map((ratio) => {
                const y = pad.top + plotH * (1 - ratio);
                const val = Math.round(maxBurndownSp * ratio * 10) / 10;
                return (
                  <g key={ratio}>
                    <line
                      x1={pad.left}
                      y1={y}
                      x2={width - pad.right}
                      y2={y}
                      className="stroke-zinc-200 dark:stroke-zinc-800"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                    />
                    <text
                      x={pad.left - 8}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-zinc-500 dark:fill-slate-400 text-[10px] font-mono-tabular"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              <polyline
                fill="none"
                stroke="#94A3B8"
                strokeWidth={2}
                strokeDasharray="5 4"
                points={idealPointsAttr}
              />

              <polyline
                fill="none"
                className="stroke-[#0F766E] dark:stroke-[#14b8a6]"
                strokeWidth={2.5}
                points={actualPointsAttr}
              />

              {burndown.map((pt, idx) => {
                const x = toX(idx, burndown.length);
                const y = toY(pt.actualRemaining);
                const showTick =
                  burndown.length <= 8 ||
                  idx === 0 ||
                  idx === burndown.length - 1 ||
                  idx % Math.ceil(burndown.length / 6) === 0;
                return (
                  <g key={pt.date}>
                    <circle
                      cx={x}
                      cy={y}
                      r={3.5}
                      className="fill-[#0F766E] dark:fill-[#14b8a6]"
                    >
                      <title>
                        {pt.date}: Ideal {pt.idealRemaining} SP | Actual {pt.actualRemaining} SP
                      </title>
                    </circle>
                    {showTick && (
                      <text
                        x={x}
                        y={height - 12}
                        textAnchor="middle"
                        className="fill-zinc-500 dark:fill-slate-400 text-[10px] font-mono-tabular"
                      >
                        {pt.date.slice(5)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </section>

      <section className="lg:col-span-5 rounded-xl border border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-[#E5E3DC] dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-[#18181B] dark:text-slate-100">
              Multi-Sprint Velocity
            </h2>
            <p className="text-xs text-[#52525B] dark:text-slate-400">
              Completed vs. committed SP across active &amp; completed sprints.
            </p>
          </div>
          <Badge tone="teal" className="font-mono-tabular">
            Avg {summary.velocity.averageCompletedVelocity} SP
          </Badge>
        </div>

        <div data-testid="velocity-chart" className="space-y-3">
          {velocitySeries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#E5E3DC] dark:border-zinc-700 p-4 text-center text-xs text-[#52525B] dark:text-slate-400">
              Start or complete a sprint to track cross-sprint velocity.
            </div>
          ) : (
            velocitySeries.map((sprint) => {
              const committedW = Math.round((sprint.committedPoints / maxVelocitySp) * 100);
              const completedW = Math.round((sprint.completedPoints / maxVelocitySp) * 100);
              return (
                <div key={sprint.sprintId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#18181B] dark:text-slate-100">
                      {sprint.sprintId}
                      <span className="ml-1.5 font-normal text-[#71717A] dark:text-slate-400">
                        ({sprint.status})
                      </span>
                    </span>
                    <span className="font-mono-tabular text-[#52525B] dark:text-slate-300">
                      {sprint.completedPoints} / {sprint.committedPoints} SP
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-full rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-zinc-400 dark:bg-zinc-600 rounded"
                        style={{ width: `${committedW}%` }}
                      />
                    </div>
                    <div className="h-2 w-full rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-[#0F766E] dark:bg-[#14b8a6] rounded"
                        style={{ width: `${completedW}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-[#E5E3DC] dark:border-zinc-800 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#52525B] dark:text-slate-400">
            Division Delivery Breakdown
          </h3>
          <div className="mt-3 space-y-2">
            {summary.divisionBreakdown.map((div) => (
              <div
                key={div.divisionId}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: div.color }}
                  />
                  <span className="truncate text-[#18181B] dark:text-slate-200">
                    {div.shortName}
                  </span>
                </div>
                <span className="font-mono-tabular text-[#52525B] dark:text-slate-300 shrink-0">
                  {div.completedPoints}/{div.committedPoints} SP ({div.capacityPoints} cap)
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
