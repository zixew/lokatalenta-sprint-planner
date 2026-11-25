import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Copy,
  Play,
  Plus,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AGENTS_BY_ID,
  CANONICAL_AGENTS,
  CANONICAL_DIVISIONS,
  DIVISIONS_BY_ID,
} from '../../contracts/canonical.ts';
import type { SprintRecord } from '../../lib/api.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';

function statusBadgeTone(status: SprintRecord['status']): 'amber' | 'teal' | 'slate' {
  if (status === 'active') return 'teal';
  if (status === 'completed') return 'slate';
  return 'amber';
}

const ITEM_STATUS_LABELS: Record<SprintRecord['items'][number]['status'], string> = {
  in_sprint: 'In Sprint',
  in_progress: 'In Progress',
  review: 'In Review',
  done: 'Done',
};

function buildSprintMarkdownReport(
  sprint: SprintRecord,
  health: {
    label: string;
    overallocatedDivs: number;
    overallocatedAgents: number;
    hasGoal: boolean;
    hasScope: boolean;
    balancedLoad: boolean;
  },
  utilizationPct: number,
): string {
  const { committedPoints, completedPoints, remainingPoints, totalCapacityPoints } = sprint.metrics;
  const divisionLines = CANONICAL_DIVISIONS.map((div) => {
    const divCommitted = sprint.items
      .filter((item) => item.ownerDivision === div.id)
      .reduce((acc, item) => acc + item.storyPoints, 0);
    const divCap = sprint.divisionCapacities[div.id] ?? 0;
    const divPct = divCap > 0 ? Math.round((divCommitted / divCap) * 100) : divCommitted > 0 ? 100 : 0;
    return `| ${div.shortName} | ${divCommitted} SP | ${divCap} SP | ${divPct}% |`;
  });

  const scopeLines =
    sprint.items.length === 0
      ? ['- _No items assigned yet._']
      : sprint.items.map((item) => {
          const divName = DIVISIONS_BY_ID[item.ownerDivision].shortName;
          const agent = item.ownerAgentId !== null ? AGENTS_BY_ID[item.ownerAgentId] : undefined;
          const ownerLabel = agent ? `${divName} · #${agent.id} ${agent.shortName}` : divName;
          return `- \`${item.itemId}\` **[${ITEM_STATUS_LABELS[item.status]}]** ${item.title} (${item.storyPoints} SP · ${ownerLabel})`;
        });

  return [
    `# Sprint Readiness & Scope: ${sprint.id} — ${sprint.name}`,
    '',
    `- **Status:** ${sprint.status.toUpperCase()}`,
    `- **Window:** ${sprint.startDate} -> ${sprint.endDate}`,
    `- **Goal:** ${sprint.goal?.trim() || 'No sprint goal recorded.'}`,
    `- **Readiness:** ${health.label} (Goal: ${health.hasGoal ? 'Ready' : 'Missing'}, Scope: ${sprint.metrics.itemCount} items, Balance: ${health.balancedLoad ? `${utilizationPct}% load` : `${health.overallocatedDivs} div / ${health.overallocatedAgents} agent over`}, Ceremonies: ${sprint.ceremonies.length})`,
    `- **Velocity & Capacity:** ${committedPoints} / ${totalCapacityPoints} SP committed (${utilizationPct}%) · ${completedPoints} SP done · ${remainingPoints} SP remaining`,
    '',
    '## Division Capacity Breakdown',
    '| Division | Committed | Capacity | Utilization |',
    '| --- | ---: | ---: | ---: |',
    ...divisionLines,
    '',
    `## Sprint Scope (${sprint.items.length} items)`,
    ...scopeLines,
  ].join('\n');
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below when Clipboard API is restricted.
    }
  }
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  } finally {
    document.body.removeChild(textarea);
  }
  return ok;
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

  const [healthOpen, setHealthOpen] = useState(false);
  const [copiedSprintId, setCopiedSprintId] = useState<string | null>(null);
  const healthRef = useRef<HTMLDivElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const copied = Boolean(selectedSprint && copiedSprintId === selectedSprint.id);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!healthOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (healthRef.current && !healthRef.current.contains(e.target as Node)) {
        setHealthOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHealthOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEsc);
    };
  }, [healthOpen]);

  const health = useMemo(() => {
    if (!selectedSprint) return null;

    const overallocatedDivs = CANONICAL_DIVISIONS.filter((div) => {
      const divLoad = selectedSprint.items
        .filter((item) => item.ownerDivision === div.id)
        .reduce((acc, item) => acc + item.storyPoints, 0);
      return divLoad > (selectedSprint.divisionCapacities[div.id] ?? 0);
    }).length;

    const overallocatedAgents = CANONICAL_AGENTS.filter((agent) => {
      const agentLoad = selectedSprint.items
        .filter((item) => item.ownerAgentId === agent.id)
        .reduce((acc, item) => acc + item.storyPoints, 0);
      return agentLoad > (selectedSprint.agentCapacities[agent.id] ?? 0);
    }).length;

    const hasGoal = Boolean(selectedSprint.goal?.trim());
    const hasScope = selectedSprint.metrics.itemCount > 0;
    const hasCeremonies = selectedSprint.ceremonies.length > 0;
    const balancedLoad = utilizationPct <= 100 && overallocatedDivs === 0 && overallocatedAgents === 0;

    let label = 'Healthy';
    let tone: 'teal' | 'amber' | 'rose' = 'teal';

    if (!balancedLoad) {
      label = 'Overallocated';
      tone = 'rose';
    } else if (!hasScope || !hasGoal) {
      label = 'Needs Prep';
      tone = 'amber';
    } else if (utilizationPct >= 85) {
      label = 'Optimal Load';
      tone = 'teal';
    }

    return {
      label,
      tone,
      overallocatedDivs,
      overallocatedAgents,
      hasGoal,
      hasScope,
      hasCeremonies,
      balancedLoad,
    };
  }, [selectedSprint, utilizationPct]);

  const handleCopyMarkdown = async () => {
    if (!selectedSprint || !health) return;
    const markdown = buildSprintMarkdownReport(selectedSprint, health, utilizationPct);
    const copiedOk = await copyTextToClipboard(markdown);
    if (copiedOk) {
      setCopiedSprintId(selectedSprint.id);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedSprintId(null);
        copyTimerRef.current = null;
      }, 2000);
    }
  };

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

            {selectedSprint && health && (
              <div ref={healthRef} className="relative">
                <button
                  type="button"
                  data-testid="sprint-health-pill"
                  aria-expanded={healthOpen}
                  onClick={() => setHealthOpen((o) => !o)}
                  className={`inline-flex min-h-[26px] items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-all duration-150 ${
                    health.tone === 'rose'
                      ? 'border-rose-200 bg-rose-50 text-[#E11D48] hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                      : health.tone === 'amber'
                        ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'border-teal-200 bg-teal-50 text-[#0F766E] hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                  }`}
                >
                  {health.tone === 'rose' || health.tone === 'amber' ? (
                    <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Activity className="h-3 w-3" aria-hidden="true" />
                  )}
                  <span>Readiness: {health.label}</span>
                </button>

                {healthOpen && (
                  <div
                    data-testid="sprint-health-popover"
                    className="absolute left-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-xl border border-[#E5E3DC] bg-white p-3.5 text-xs shadow-xl dark:border-zinc-700 dark:bg-[#161B22]"
                  >
                    <div className="mb-2 border-b border-[#E5E3DC] pb-2 font-bold text-zinc-900 dark:border-zinc-800 dark:text-slate-100">
                      Sprint Readiness Checklist
                    </div>
                    <ul className="space-y-2">
                      <li className="flex items-center justify-between">
                        <span className="text-zinc-600 dark:text-slate-400">Sprint Goal Defined</span>
                        <span className={health.hasGoal ? 'font-semibold text-[#0F766E] dark:text-teal-400' : 'font-semibold text-amber-700 dark:text-amber-400'}>
                          {health.hasGoal ? 'Ready' : 'Missing'}
                        </span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-zinc-600 dark:text-slate-400">Scope Committed</span>
                        <span className={health.hasScope ? 'font-mono-tabular font-semibold text-[#0F766E] dark:text-teal-400' : 'font-semibold text-amber-700 dark:text-amber-400'}>
                          {health.hasScope ? `${selectedSprint.metrics.itemCount} items` : '0 items'}
                        </span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-zinc-600 dark:text-slate-400">Capacity Balance</span>
                        <span className={health.balancedLoad ? 'font-mono-tabular font-semibold text-[#0F766E] dark:text-teal-400' : 'font-mono-tabular font-semibold text-[#E11D48] dark:text-rose-400'}>
                          {health.balancedLoad
                            ? `${utilizationPct}% load`
                            : `${health.overallocatedDivs} div · ${health.overallocatedAgents} agent over`}
                        </span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-zinc-600 dark:text-slate-400">Ceremonies Logged</span>
                        <span className="font-mono-tabular font-semibold text-zinc-800 dark:text-slate-200">
                          {selectedSprint.ceremonies.length}
                        </span>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
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
            <>
              <Button
                variant="secondary"
                size="sm"
                data-testid="sprint-copy-md-btn"
                onClick={() => void handleCopyMarkdown()}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[#0F766E] dark:text-teal-400" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {copied ? 'Copied' : 'Copy MD'}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                data-testid="open-backlog-drawer-btn"
                onClick={onOpenBacklogDrawer}
              >
                <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
                Pull Backlog Items
              </Button>
            </>
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
