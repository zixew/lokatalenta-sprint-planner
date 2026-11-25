import { ArrowDownToLine, ChevronDown, ChevronRight, Save, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  AGENTS_BY_ID,
  CANONICAL_AGENTS,
  CANONICAL_DIVISIONS,
  DIVISIONS_BY_ID,
  type DivisionId,
  type SprintItemStatus,
} from '../../contracts/canonical.ts';
import type { SprintRecord } from '../../lib/api.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { ProgressBar } from '../ui/ProgressBar.tsx';

type AgentAvailabilityFilter = 'all' | 'overallocated' | 'available';
type ScopeStatusFilter = 'all' | SprintItemStatus;

const SCOPE_STATUS_OPTIONS: ReadonlyArray<{ id: ScopeStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'in_sprint', label: 'In Sprint' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'done', label: 'Done' },
];

function getTone(committed: number, capacity: number): 'teal' | 'amber' | 'rose' {
  if (committed > capacity) return 'rose';
  if (capacity > 0 && committed / capacity >= 0.85) return 'amber';
  return 'teal';
}

export function CapacityMatrix({
  sprint,
  onSaveCapacities,
  onUpdateItemStatus,
  onRemoveItem,
  onOpenBacklogDrawer,
  savingCapacity,
}: {
  sprint: SprintRecord;
  onSaveCapacities: (payload: {
    divisionCapacities: Record<DivisionId, number>;
    agentCapacities: Record<number, number>;
  }) => Promise<void>;
  onUpdateItemStatus: (itemId: string, status: SprintItemStatus) => Promise<void>;
  onRemoveItem: (itemId: string) => Promise<void>;
  onOpenBacklogDrawer: () => void;
  savingCapacity: boolean;
}) {
  const [expandedDivisions, setExpandedDivisions] = useState<Record<DivisionId, boolean>>({
    executive: true,
    architecture: true,
    engineering: true,
    qa: true,
    devops: true,
    lounge: true,
  });
  const [divisionFilter, setDivisionFilter] = useState<DivisionId | 'all'>('all');
  const [scopeStatusFilter, setScopeStatusFilter] = useState<ScopeStatusFilter>('all');

  return (
    <CapacityMatrixInner
      key={`${sprint.id}:${sprint.updatedAt}`}
      sprint={sprint}
      expandedDivisions={expandedDivisions}
      onToggleDivision={(divisionId) =>
        setExpandedDivisions((prev) => ({ ...prev, [divisionId]: !prev[divisionId] }))
      }
      divisionFilter={divisionFilter}
      onChangeDivisionFilter={setDivisionFilter}
      scopeStatusFilter={scopeStatusFilter}
      onChangeScopeStatusFilter={setScopeStatusFilter}
      onSaveCapacities={onSaveCapacities}
      onUpdateItemStatus={onUpdateItemStatus}
      onRemoveItem={onRemoveItem}
      onOpenBacklogDrawer={onOpenBacklogDrawer}
      savingCapacity={savingCapacity}
    />
  );
}

function CapacityMatrixInner({
  sprint,
  expandedDivisions,
  onToggleDivision,
  divisionFilter,
  onChangeDivisionFilter,
  scopeStatusFilter,
  onChangeScopeStatusFilter,
  onSaveCapacities,
  onUpdateItemStatus,
  onRemoveItem,
  onOpenBacklogDrawer,
  savingCapacity,
}: {
  sprint: SprintRecord;
  expandedDivisions: Record<DivisionId, boolean>;
  onToggleDivision: (divisionId: DivisionId) => void;
  divisionFilter: DivisionId | 'all';
  onChangeDivisionFilter: (value: DivisionId | 'all') => void;
  scopeStatusFilter: ScopeStatusFilter;
  onChangeScopeStatusFilter: (value: ScopeStatusFilter) => void;
  onSaveCapacities: (payload: {
    divisionCapacities: Record<DivisionId, number>;
    agentCapacities: Record<number, number>;
  }) => Promise<void>;
  onUpdateItemStatus: (itemId: string, status: SprintItemStatus) => Promise<void>;
  onRemoveItem: (itemId: string) => Promise<void>;
  onOpenBacklogDrawer: () => void;
  savingCapacity: boolean;
}) {
  const [divDraft, setDivDraft] = useState<Record<DivisionId, number>>(sprint.divisionCapacities);
  const [agentDraft, setAgentDraft] = useState<Record<number, number>>(sprint.agentCapacities);
  const [dirty, setDirty] = useState(false);
  const [agentFilter, setAgentFilter] = useState<AgentAvailabilityFilter>('all');
  const [loadMetric, setLoadMetric] = useState<'active' | 'committed'>('active');

  const agentLoads = useMemo(() => {
    const activeMap = new Map<number, number>();
    const doneMap = new Map<number, number>();
    const totalMap = new Map<number, number>();
    for (const item of sprint.items) {
      if (item.ownerAgentId != null) {
        const curTotal = totalMap.get(item.ownerAgentId) ?? 0;
        totalMap.set(item.ownerAgentId, curTotal + item.storyPoints);
        if (item.status === 'done') {
          const curDone = doneMap.get(item.ownerAgentId) ?? 0;
          doneMap.set(item.ownerAgentId, curDone + item.storyPoints);
        } else {
          const curActive = activeMap.get(item.ownerAgentId) ?? 0;
          activeMap.set(item.ownerAgentId, curActive + item.storyPoints);
        }
      }
    }
    return { activeMap, doneMap, totalMap };
  }, [sprint.items]);

  const agentLoadById = useMemo(() => {
    return loadMetric === 'active' ? agentLoads.activeMap : agentLoads.totalMap;
  }, [loadMetric, agentLoads]);

  const { overallocatedCount, availableCount } = useMemo(() => {
    let over = 0;
    let avail = 0;
    for (const agent of CANONICAL_AGENTS) {
      const load = agentLoadById.get(agent.id) ?? 0;
      const cap = agentDraft[agent.id] ?? 0;
      if (load > cap) over += 1;
      else if (cap > load) avail += 1;
    }
    return { overallocatedCount: over, availableCount: avail };
  }, [agentLoadById, agentDraft]);

  const handleAgentCapacityChange = (agentId: number, divisionId: DivisionId, nextValue: number) => {
    const clamped = Math.max(0, Math.min(1000, Number.isFinite(nextValue) ? nextValue : 0));
    const nextAgents = { ...agentDraft, [agentId]: clamped };
    const divisionAgentIds = DIVISIONS_BY_ID[divisionId].agentIds;
    const divisionTotal = divisionAgentIds.reduce(
      (sum, id) => sum + (nextAgents[id] ?? 0),
      0,
    );
    setAgentDraft(nextAgents);
    setDivDraft((prev) => ({ ...prev, [divisionId]: divisionTotal }));
    setDirty(true);
  };

  const handleDivisionCapacityChange = (divisionId: DivisionId, nextValue: number) => {
    const clamped = Math.max(0, Math.min(10000, Number.isFinite(nextValue) ? nextValue : 0));
    setDivDraft((prev) => ({ ...prev, [divisionId]: clamped }));
    setDirty(true);
  };

  const handleSave = async () => {
    await onSaveCapacities({
      divisionCapacities: divDraft,
      agentCapacities: agentDraft,
    });
    setDirty(false);
  };

  const toggleDivision = onToggleDivision;
  const setDivisionFilter = onChangeDivisionFilter;

  const scopeStatusCounts = useMemo(() => {
    const counts: Record<ScopeStatusFilter, number> = {
      all: sprint.items.length,
      in_sprint: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };
    for (const item of sprint.items) {
      counts[item.status] += 1;
    }
    return counts;
  }, [sprint.items]);

  const filteredScopeItems = useMemo(() => {
    if (scopeStatusFilter === 'all') return sprint.items;
    return sprint.items.filter((item) => item.status === scopeStatusFilter);
  }, [sprint.items, scopeStatusFilter]);

  const visibleDivisions =
    divisionFilter === 'all'
      ? CANONICAL_DIVISIONS
      : CANONICAL_DIVISIONS.filter((d) => d.id === divisionFilter);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <section
        data-testid="capacity-matrix"
        className="lg:col-span-7 rounded-xl border border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E5E3DC] dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-[#18181B] dark:text-slate-100">
              6-Division &amp; 24-Agent Capacity Matrix
            </h2>
            <p className="text-xs text-[#52525B] dark:text-slate-400">
              Allocate story-point budgets across divisions and all 24 canonical agents (#0–#23).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter capacity by division"
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value as DivisionId | 'all')}
              className="min-h-[36px] rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] dark:bg-[#0D1117] px-2.5 py-1 text-xs font-medium"
            >
              <option value="all">All 6 Divisions</option>
              {CANONICAL_DIVISIONS.map((div) => (
                <option key={div.id} value={div.id}>
                  {div.shortName}
                </option>
              ))}
            </select>

            <Button
              variant="primary"
              size="sm"
              data-testid="save-capacity-btn"
              onClick={handleSave}
              disabled={!dirty || savingCapacity}
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              {savingCapacity ? 'Saving...' : 'Save Capacities'}
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E3DC] pb-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter agents by availability">
            <button
              type="button"
              data-testid="agent-filter-all"
              aria-pressed={agentFilter === 'all'}
              onClick={() => setAgentFilter('all')}
              className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                agentFilter === 'all'
                  ? 'border-[#0F766E] bg-teal-50 text-[#0F766E] dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-300'
                  : 'border-[#E5E3DC] bg-[#F6F5F1] text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-[#0D1117] dark:text-slate-300 dark:hover:bg-zinc-800'
              }`}
            >
              All Agents ({CANONICAL_AGENTS.length})
            </button>
            <button
              type="button"
              data-testid="agent-filter-overallocated"
              aria-pressed={agentFilter === 'overallocated'}
              onClick={() => setAgentFilter('overallocated')}
              className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                agentFilter === 'overallocated'
                  ? 'border-[#E11D48] bg-rose-50 text-[#E11D48] dark:border-rose-500 dark:bg-rose-950/60 dark:text-rose-300'
                  : 'border-[#E5E3DC] bg-[#F6F5F1] text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-[#0D1117] dark:text-slate-300 dark:hover:bg-zinc-800'
              }`}
            >
              Overallocated ({overallocatedCount})
            </button>
            <button
              type="button"
              data-testid="agent-filter-available"
              aria-pressed={agentFilter === 'available'}
              onClick={() => setAgentFilter('available')}
              className={`inline-flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                agentFilter === 'available'
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-[#E5E3DC] bg-[#F6F5F1] text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-[#0D1117] dark:text-slate-300 dark:hover:bg-zinc-800'
              }`}
            >
              Available ({availableCount})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] dark:bg-[#0D1117] p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setLoadMetric('active')}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                  loadMetric === 'active'
                    ? 'bg-white dark:bg-zinc-800 text-[#0F766E] dark:text-teal-300 shadow-xs'
                    : 'text-[#71717A] hover:text-[#18181B] dark:hover:text-slate-200'
                }`}
              >
                Active Load (In-Flight)
              </button>
              <button
                type="button"
                onClick={() => setLoadMetric('committed')}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                  loadMetric === 'committed'
                    ? 'bg-white dark:bg-zinc-800 text-[#0F766E] dark:text-teal-300 shadow-xs'
                    : 'text-[#71717A] hover:text-[#18181B] dark:hover:text-slate-200'
                }`}
              >
                Total Committed
              </button>
            </div>

            {divisionFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setDivisionFilter('all')}
                className="text-xs font-semibold text-[#0F766E] underline hover:no-underline dark:text-teal-400"
              >
                Show all 6 divisions
              </button>
            ) : null}
          </div>
        </div>

        {/* Interactive Division Utilization Overview */}
        <div
          data-testid="division-utilization-strip"
          className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {CANONICAL_DIVISIONS.map((div) => {
            const committed = sprint.items
              .filter((item) => item.ownerDivision === div.id)
              .reduce((acc, item) => acc + item.storyPoints, 0);
            const done = sprint.items
              .filter((item) => item.ownerDivision === div.id && item.status === 'done')
              .reduce((acc, item) => acc + item.storyPoints, 0);
            const active = committed - done;
            const displayPoints = loadMetric === 'active' ? active : committed;
            const cap = divDraft[div.id] ?? 0;
            const pct = cap > 0 ? Math.round((displayPoints / cap) * 100) : displayPoints > 0 ? 100 : 0;
            const selected = divisionFilter === div.id;
            const tone = getTone(displayPoints, cap);

            return (
              <button
                key={div.id}
                type="button"
                onClick={() => setDivisionFilter(selected ? 'all' : div.id)}
                className={`rounded-lg border p-2 text-left transition-all duration-150 ${
                  selected
                    ? 'border-[#0F766E] bg-teal-50/70 dark:border-teal-500 dark:bg-teal-950/40'
                    : 'border-[#E5E3DC] bg-[#FAF9F6] hover:border-zinc-300 dark:border-zinc-800 dark:bg-[#0D1117] dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1 text-[11px]">
                  <span className="truncate font-semibold text-zinc-800 dark:text-slate-200">
                    {div.shortName}
                  </span>
                  <span
                    className={`font-mono-tabular font-bold ${
                      tone === 'rose'
                        ? 'text-[#E11D48] dark:text-rose-400'
                        : tone === 'amber'
                          ? 'text-[#D97706] dark:text-amber-400'
                          : 'text-[#0F766E] dark:text-teal-400'
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${
                      tone === 'rose'
                        ? 'bg-[#E11D48]'
                        : tone === 'amber'
                          ? 'bg-[#D97706]'
                          : 'bg-[#0F766E] dark:bg-[#14b8a6]'
                    }`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </button>
            );
          })}
          {agentFilter !== 'all' &&
          ((agentFilter === 'overallocated' && overallocatedCount === 0) ||
            (agentFilter === 'available' && availableCount === 0)) ? (
            <div className="rounded-lg border border-dashed border-[#E5E3DC] bg-[#FAF9F6] p-6 text-center text-xs text-zinc-600 dark:border-zinc-800 dark:bg-[#0D1117] dark:text-slate-400">
              {agentFilter === 'overallocated'
                ? 'No overallocated agents in this sprint — all agent loads are within capacity.'
                : 'No agents with remaining available capacity.'}
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {visibleDivisions.map((division) => {
            const divCommitted = sprint.items
              .filter((item) => item.ownerDivision === division.id)
              .reduce((acc, item) => acc + item.storyPoints, 0);
            const divDone = sprint.items
              .filter((item) => item.ownerDivision === division.id && item.status === 'done')
              .reduce((acc, item) => acc + item.storyPoints, 0);
            const divActive = divCommitted - divDone;
            const divEffective = loadMetric === 'active' ? divActive : divCommitted;
            const divCapacity = divDraft[division.id] ?? 0;
            const tone = getTone(divEffective, divCapacity);
            const isExpanded = expandedDivisions[division.id];
            const divAgents = CANONICAL_AGENTS.filter((agent) => {
              if (agent.divisionId !== division.id) return false;
              const load = agentLoadById.get(agent.id) ?? 0;
              const cap = agentDraft[agent.id] ?? 0;
              if (agentFilter === 'overallocated') return load > cap;
              if (agentFilter === 'available') return cap > load;
              return true;
            });

            if (agentFilter !== 'all' && divAgents.length === 0) {
              return null;
            }

            return (
              <div
                key={division.id}
                data-testid={`division-capacity-card-${division.id}`}
                className="rounded-lg border border-[#E5E3DC] dark:border-zinc-800 bg-[#F6F5F1] dark:bg-[#0D1117]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                  <button
                    type="button"
                    onClick={() => toggleDivision(division.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-[#52525B]" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#52525B]" aria-hidden="true" />
                    )}
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: division.color }}
                    />
                    <div>
                      <div className="text-sm font-bold text-[#18181B] dark:text-slate-100">
                        {division.shortName}
                      </div>
                      <div className="text-[11px] text-[#71717A] dark:text-slate-400">
                        Floor {division.defaultFloor} · {division.agentIds.length} agents
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-3">
                    {divEffective > divCapacity && (
                      <Badge tone="rose">Overallocated</Badge>
                    )}

                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-mono-tabular font-semibold text-[#18181B] dark:text-slate-100">
                        {divEffective}
                      </span>
                      <span className="text-[#71717A]">/</span>
                      <label className="sr-only" htmlFor={`div-cap-${division.id}`}>
                        {division.shortName} capacity points
                      </label>
                      <input
                        id={`div-cap-${division.id}`}
                        type="number"
                        min={0}
                        max={10000}
                        value={divCapacity}
                        onChange={(e) =>
                          handleDivisionCapacityChange(division.id, Number(e.target.value))
                        }
                        className="w-16 rounded border border-[#E5E3DC] dark:border-zinc-700 bg-white px-2 py-1 text-right font-mono-tabular text-xs font-semibold"
                      />
                      <span className="text-[#71717A]">SP</span>
                      {loadMetric === 'active' && divDone > 0 ? (
                        <span className="font-mono-tabular text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          ({divDone} done)
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="px-3.5 pb-3">
                  <ProgressBar
                    value={divEffective}
                    max={Math.max(divCapacity, divEffective, 1)}
                    tone={tone}
                    label={`${division.shortName} utilization`}
                  />
                </div>

                {isExpanded && (
                  <div className="border-t border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] divide-y divide-[#E5E3DC] dark:divide-zinc-800 rounded-b-lg">
                    {divAgents.map((agent) => {
                      const agentCommitted = agentLoads.totalMap.get(agent.id) ?? 0;
                      const agentDone = agentLoads.doneMap.get(agent.id) ?? 0;
                      const agentActive = agentLoads.activeMap.get(agent.id) ?? 0;
                      const agentEffective = loadMetric === 'active' ? agentActive : agentCommitted;
                      const agentCapacity = agentDraft[agent.id] ?? 0;
                      const agentOver = agentEffective > agentCapacity;

                      return (
                        <div
                          key={agent.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono-tabular text-xs text-[#71717A] dark:text-slate-400">
                                #{agent.id}
                              </span>
                              <span className="text-xs font-semibold text-[#18181B] dark:text-slate-100 truncate">
                                {agent.name}
                              </span>
                              {agentOver && <Badge tone="rose">Overallocated</Badge>}
                            </div>
                            <div className="text-[11px] text-[#71717A] dark:text-slate-400 truncate">
                              {agent.role}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-mono-tabular text-[#52525B] dark:text-slate-300">
                              {agentEffective} SP {loadMetric === 'active' ? 'active' : 'load'}
                            </span>
                            {loadMetric === 'active' && agentDone > 0 ? (
                              <span className="font-mono-tabular text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                ({agentDone} done)
                              </span>
                            ) : null}
                            <label className="sr-only" htmlFor={`agent-cap-${agent.id}`}>
                              Capacity for {agent.name}
                            </label>
                            <input
                              id={`agent-cap-${agent.id}`}
                              data-testid={`agent-capacity-input-${agent.id}`}
                              type="number"
                              min={0}
                              max={1000}
                              value={agentCapacity}
                              onChange={(e) =>
                                handleAgentCapacityChange(
                                  agent.id,
                                  division.id,
                                  Number(e.target.value),
                                )
                              }
                              className="w-16 rounded border border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] px-2 py-1 text-right font-mono-tabular text-xs font-semibold"
                            />
                            <span className="text-[#71717A]">SP</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {agentFilter !== 'all' &&
          ((agentFilter === 'overallocated' && overallocatedCount === 0) ||
            (agentFilter === 'available' && availableCount === 0)) ? (
            <div className="rounded-lg border border-dashed border-[#E5E3DC] bg-[#FAF9F6] p-6 text-center text-xs text-zinc-600 dark:border-zinc-800 dark:bg-[#0D1117] dark:text-slate-400">
              {agentFilter === 'overallocated'
                ? 'No overallocated agents in this sprint — all agent loads are within capacity.'
                : 'No agents with remaining available capacity.'}
            </div>
          ) : null}
        </div>
      </section>

      <section
        data-testid="sprint-items-list"
        className="lg:col-span-5 rounded-xl border border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] p-5"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#E5E3DC] dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-[#18181B] dark:text-slate-100">
              Assigned Sprint Scope
            </h2>
            <p className="text-xs text-[#52525B] dark:text-slate-400">
              Track progress from In Sprint to Done (updates burndown &amp; Backlog sync).
            </p>
          </div>
          <Badge tone="teal" className="shrink-0 font-mono-tabular">
            {filteredScopeItems.length === sprint.items.length
              ? `${sprint.items.length} items`
              : `${filteredScopeItems.length} / ${sprint.items.length} items`}
          </Badge>
        </div>

        <div
          data-testid="scope-status-filters"
          role="group"
          aria-label="Filter sprint scope by status"
          className="mt-3 flex flex-wrap items-center gap-1.5"
        >
          {SCOPE_STATUS_OPTIONS.map((opt) => {
            const active = scopeStatusFilter === opt.id;
            const count = scopeStatusCounts[opt.id];
            return (
              <button
                key={opt.id}
                type="button"
                data-testid={`scope-filter-${opt.id}`}
                aria-pressed={active}
                onClick={() => onChangeScopeStatusFilter(opt.id)}
                className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] lg:min-h-[28px] ${
                  active
                    ? 'border-[#0F766E] bg-teal-50 text-[#0F766E] dark:border-teal-500 dark:bg-teal-950/60 dark:text-teal-300'
                    : 'border-[#E5E3DC] bg-[#F6F5F1] text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-[#0D1117] dark:text-slate-300 dark:hover:bg-zinc-800'
                }`}
              >
                <span>{opt.label}</span>
                <span className="font-mono-tabular text-[11px] opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        {sprint.items.length === 0 ? (
          <div
            data-testid="empty-items-state"
            className="mt-6 rounded-lg border border-dashed border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] dark:bg-[#0D1117] p-6 text-center"
          >
            <p className="text-sm font-semibold text-[#18181B] dark:text-slate-100">
              No items assigned to {sprint.id} yet
            </p>
            <p className="mt-1 text-xs text-[#52525B] dark:text-slate-400">
              Pull groomed items from the Backlog service or add a local sprint item.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={onOpenBacklogDrawer}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
              Pull from Backlog
            </Button>
          </div>
        ) : filteredScopeItems.length === 0 ? (
          <div
            data-testid="empty-scope-filter-state"
            className="mt-4 rounded-lg border border-dashed border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] dark:bg-[#0D1117] p-5 text-center"
          >
            <p className="text-xs font-medium text-[#52525B] dark:text-slate-400">
              No committed sprint items match this status filter.
            </p>
            <button
              type="button"
              onClick={() => onChangeScopeStatusFilter('all')}
              className="mt-2 text-xs font-semibold text-[#0F766E] underline hover:no-underline dark:text-teal-400"
            >
              Show all items
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {filteredScopeItems.map((item) => {
              const division = DIVISIONS_BY_ID[item.ownerDivision];
              const agent =
                item.ownerAgentId !== null ? AGENTS_BY_ID[item.ownerAgentId] : undefined;
              return (
                <div
                  key={item.itemId}
                  data-testid={`sprint-item-row-${item.itemId}`}
                  className="rounded-lg border border-[#E5E3DC] dark:border-zinc-800 bg-[#F6F5F1] dark:bg-[#0D1117] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono-tabular text-xs font-bold text-[#0F766E] dark:text-teal-400">
                          {item.itemId}
                        </span>
                        <Badge tone="neutral" className="font-mono-tabular">
                          {item.storyPoints} SP
                        </Badge>
                        {item.backlogSynced ? (
                          <Badge tone="emerald">Synced</Badge>
                        ) : (
                          <Badge tone="amber">Local</Badge>
                        )}
                      </div>
                      <div className="mt-1 text-sm font-medium text-[#18181B] dark:text-slate-100">
                        {item.title}
                      </div>
                      <div className="mt-1 text-xs text-[#52525B] dark:text-slate-400">
                        {division.shortName}
                        {agent ? ` · #${agent.id} ${agent.shortName}` : ''}
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label={`Remove ${item.itemId}`}
                      onClick={() => onRemoveItem(item.itemId)}
                      className="rounded p-1.5 text-[#71717A] hover:bg-rose-50 hover:text-[#E11D48] dark:hover:bg-rose-950/50 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <label className="text-[11px] font-medium text-[#71717A] dark:text-slate-400">
                      Status
                    </label>
                    <select
                      aria-label={`Status for ${item.itemId}`}
                      value={item.status}
                      onChange={(e) =>
                        onUpdateItemStatus(item.itemId, e.target.value as SprintItemStatus)
                      }
                      className="rounded-md border border-[#E5E3DC] dark:border-zinc-700 bg-white px-2.5 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]"
                    >
                      <option value="in_sprint">In Sprint</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">In Review</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
