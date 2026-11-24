import { ArrowDownToLine, CheckCircle2, Play, Plus } from 'lucide-react';
import type { SprintRecord } from '../../lib/api.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';

function statusBadgeTone(status: SprintRecord['status']): 'amber' | 'teal' | 'slate' {
  if (status === 'active') return 'teal';
  if (status === 'completed') return 'slate';
  return 'amber';
}

export function SprintHeaderBar({
  sprints,
  selectedSprint,
  onSelectSprint,
  onOpenCreate,
  onOpenBacklogDrawer,
  onStartSprint,
  onRequestCompleteSprint,
  mutating,
}: {
  sprints: readonly SprintRecord[];
  selectedSprint: SprintRecord | null;
  onSelectSprint: (sprintId: string) => void;
  onOpenCreate: () => void;
  onOpenBacklogDrawer: () => void;
  onStartSprint: () => void;
  onRequestCompleteSprint: () => void;
  mutating: boolean;
}) {
  const committed = selectedSprint?.metrics.committedPoints ?? 0;
  const capacity = selectedSprint?.metrics.totalCapacityPoints ?? 0;
  const utilizationPct =
    capacity > 0 ? Math.round((committed / capacity) * 100) : committed > 0 ? 100 : 0;

  return (
    <section className="rounded-xl border border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="sprint-selector" className="sr-only">
              Select Sprint
            </label>
            <select
              id="sprint-selector"
              data-testid="sprint-selector"
              value={selectedSprint?.id ?? ''}
              onChange={(e) => onSelectSprint(e.target.value)}
              disabled={sprints.length === 0}
              className="min-h-[40px] max-w-full rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] dark:bg-[#0D1117] px-3 py-1.5 text-sm font-semibold text-[#18181B] dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] dark:focus-visible:ring-[#14b8a6]"
            >
              {sprints.length === 0 ? (
                <option value="">No sprints available</option>
              ) : (
                sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.id} · {sprint.name} ({sprint.status.toUpperCase()} · {sprint.metrics.committedPoints} SP)
                  </option>
                ))
              )}
            </select>

            {selectedSprint && (
              <Badge tone={statusBadgeTone(selectedSprint.status)}>
                {selectedSprint.status.toUpperCase()}
              </Badge>
            )}

            {selectedSprint && (
              <span className="font-mono-tabular text-xs text-[#52525B] dark:text-slate-400">
                {selectedSprint.startDate} → {selectedSprint.endDate}
              </span>
            )}
          </div>

          {selectedSprint && (
            <p className="text-sm text-[#52525B] dark:text-slate-300">
              {selectedSprint.goal || 'No sprint goal recorded yet.'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            data-testid="create-sprint-btn"
            onClick={onOpenCreate}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New Sprint
          </Button>

          {selectedSprint && (
            <Button
              variant="secondary"
              size="sm"
              data-testid="open-backlog-drawer-btn"
              onClick={onOpenBacklogDrawer}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
              Pull Backlog Items
            </Button>
          )}

          {selectedSprint?.status === 'planned' && (
            <Button
              variant="primary"
              size="sm"
              data-testid="start-sprint-btn"
              onClick={onStartSprint}
              disabled={mutating}
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              Start Sprint
            </Button>
          )}

          {selectedSprint?.status === 'active' && (
            <Button
              variant="primary"
              size="sm"
              data-testid="complete-sprint-btn"
              onClick={onRequestCompleteSprint}
              disabled={mutating}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Complete Sprint
            </Button>
          )}
        </div>
      </div>

      {selectedSprint && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-[#E5E3DC] dark:border-zinc-800 bg-[#F6F5F1] dark:bg-[#0D1117] p-3">
            <div className="text-xs font-medium text-[#52525B] dark:text-slate-400">
              Total Capacity
            </div>
            <div className="mt-1 font-mono-tabular text-xl font-bold text-[#18181B] dark:text-slate-100">
              {capacity} <span className="text-xs font-normal text-[#71717A]">SP</span>
            </div>
          </div>

          <div className="rounded-lg border border-[#E5E3DC] dark:border-zinc-800 bg-[#F6F5F1] dark:bg-[#0D1117] p-3">
            <div className="text-xs font-medium text-[#52525B] dark:text-slate-400">
              Committed / Done
            </div>
            <div className="mt-1 font-mono-tabular text-xl font-bold text-[#18181B] dark:text-slate-100">
              {committed}
              <span className="text-sm font-medium text-[#0F766E] dark:text-teal-400">
                {' '}
                / {selectedSprint.metrics.completedPoints} SP
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-[#E5E3DC] dark:border-zinc-800 bg-[#F6F5F1] dark:bg-[#0D1117] p-3">
            <div className="text-xs font-medium text-[#52525B] dark:text-slate-400">
              Utilization
            </div>
            <div
              className={`mt-1 font-mono-tabular text-xl font-bold ${
                utilizationPct > 100
                  ? 'text-[#E11D48] dark:text-rose-400'
                  : utilizationPct >= 85
                    ? 'text-[#D97706] dark:text-amber-400'
                    : 'text-[#0F766E] dark:text-teal-400'
              }`}
            >
              {utilizationPct}%
            </div>
          </div>

          <div className="rounded-lg border border-[#E5E3DC] dark:border-zinc-800 bg-[#F6F5F1] dark:bg-[#0D1117] p-3">
            <div className="text-xs font-medium text-[#52525B] dark:text-slate-400">
              Assigned Items
            </div>
            <div className="mt-1 font-mono-tabular text-xl font-bold text-[#18181B] dark:text-slate-100">
              {selectedSprint.metrics.itemCount}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
