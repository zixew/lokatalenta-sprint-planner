import { ArrowDownToLine, ChevronDown, ChevronRight, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
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

        <div className="mt-4 space-y-3">
          {visibleDivisions.map((division) => {
            const divCommitted = sprint.items
              .filter((item) => item.ownerDivision === division.id)
              .reduce((acc, item) => acc + item.storyPoints, 0);
            const divCapacity = divDraft[division.id] ?? 0;
            const tone = getTone(divCommitted, divCapacity);
            const isExpanded = expandedDivisions[division.id];
            const divAgents = CANONICAL_AGENTS.filter(
              (agent) => agent.divisionId === division.id,
            );

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
                    className="flex items-center gap-2 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] rounded"
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
                    {divCommitted > divCapacity && (
                      <Badge tone="rose">Overallocated</Badge>
                    )}

                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-mono-tabular font-semibold text-[#18181B] dark:text-slate-100">
                        {divCommitted}
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
                    </div>
                  </div>
                </div>

                <div className="px-3.5 pb-3">
                  <ProgressBar
                    value={divCommitted}
                    max={Math.max(divCapacity, divCommitted, 1)}
                    tone={tone}
                    label={`${division.shortName} utilization`}
                  />
                </div>

                {isExpanded && (
                  <div className="border-t border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] divide-y divide-[#E5E3DC] dark:divide-zinc-800 rounded-b-lg">
                    {divAgents.map((agent) => {
                      const agentCommitted = sprint.items
                        .filter((item) => item.ownerAgentId === agent.id)
                        .reduce((acc, item) => acc + item.storyPoints, 0);
                      const agentCapacity = agentDraft[agent.id] ?? 0;
                      const agentOver = agentCommitted > agentCapacity;

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
                              {agentCommitted} SP load
                            </span>
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
        </div>
      </section>

      <section
        data-testid="sprint-items-list"
        className="lg:col-span-5 rounded-xl border border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] p-5"
      >
        <div className="flex items-center justify-between border-b border-[#E5E3DC] dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-[#18181B] dark:text-slate-100">
              Assigned Sprint Scope
            </h2>
            <p className="text-xs text-[#52525B] dark:text-slate-400">
              Track progress from In Sprint to Done (updates burndown &amp; Backlog sync).
            </p>
          </div>
          <Badge tone="teal" className="font-mono-tabular">
            {sprint.items.length} items
          </Badge>
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
        ) : (
          <div className="mt-4 space-y-2.5">
            {sprint.items.map((item) => {
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
