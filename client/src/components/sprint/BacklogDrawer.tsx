import { AlertTriangle, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  AGENTS_BY_ID,
  CANONICAL_AGENTS,
  CANONICAL_DIVISIONS,
  type DivisionId,
} from '../../contracts/canonical.ts';
import {
  sprintPlannerApi,
  type BacklogCandidateItem,
  type BacklogSyncResult,
} from '../../lib/api.ts';
import { sanitizeUserText } from '../../lib/securityGuards.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';

export function BacklogDrawer({
  open,
  sprintId,
  onClose,
  onAssign,
}: {
  open: boolean;
  sprintId: string | null;
  onClose: () => void;
  onAssign: (payload: {
    itemId: string;
    title?: string;
    storyPoints?: number;
    ownerDivision?: DivisionId;
    ownerAgentId?: number | null;
  }) => Promise<BacklogSyncResult>;
}) {
  const [candidates, setCandidates] = useState<BacklogCandidateItem[]>([]);
  const [backlogSync, setBacklogSync] = useState<BacklogSyncResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [divisionFilter, setDivisionFilter] = useState<DivisionId | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'P0' | 'P1' | 'P2'>('all');
  const [overrides, setOverrides] = useState<
    Record<string, { ownerDivision: DivisionId; ownerAgentId: number | null }>
  >({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Manual fallback form state
  const [manualId, setManualId] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualPoints, setManualPoints] = useState(3);
  const [manualDivision, setManualDivision] = useState<DivisionId>('engineering');
  const [manualAgentId, setManualAgentId] = useState<number>(5);
  const [manualError, setManualError] = useState<string | null>(null);

  const fetchCandidatesForSprint = async (id: string) => {
    const data = await sprintPlannerApi.getBacklogCandidates(id);
    const nextOverrides: Record<
      string,
      { ownerDivision: DivisionId; ownerAgentId: number | null }
    > = {};
    for (const item of data.candidates) {
      const div =
        item.ownerDivision && CANONICAL_DIVISIONS.some((d) => d.id === item.ownerDivision)
          ? item.ownerDivision
          : 'engineering';
      nextOverrides[item.id] = {
        ownerDivision: div,
        ownerAgentId: typeof item.ownerAgentId === 'number' ? item.ownerAgentId : null,
      };
    }
    return { data, nextOverrides };
  };

  const loadCandidates = async (id: string) => {
    setLoading(true);
    setSyncNotice(null);
    try {
      const { data, nextOverrides } = await fetchCandidatesForSprint(id);
      setCandidates(data.candidates);
      setBacklogSync(data.backlogSync);
      setOverrides(nextOverrides);
    } catch (err) {
      setCandidates([]);
      setBacklogSync({
        synced: false,
        warning: err instanceof Error ? err.message : 'Unable to reach Backlog candidates endpoint',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !sprintId) {
      return;
    }
    let cancelled = false;
    fetchCandidatesForSprint(sprintId)
      .then(({ data, nextOverrides }) => {
        if (cancelled) return;
        setCandidates(data.candidates);
        setBacklogSync(data.backlogSync);
        setOverrides(nextOverrides);
        setSyncNotice(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setCandidates([]);
        setBacklogSync({
          synced: false,
          warning:
            err instanceof Error ? err.message : 'Unable to reach Backlog candidates endpoint',
        });
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, sprintId]);

  if (!open || !sprintId) {
    return null;
  }

  const filteredCandidates = candidates.filter((item) => {
    const ov = overrides[item.id];
    const effectiveDiv = ov?.ownerDivision ?? item.ownerDivision;
    if (divisionFilter !== 'all' && effectiveDiv !== divisionFilter) {
      return false;
    }
    if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
      return false;
    }
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      return (
        item.id.toLowerCase().includes(needle) ||
        item.title.toLowerCase().includes(needle)
      );
    }
    return true;
  });

  const handleAssignCandidate = async (item: BacklogCandidateItem) => {
    setAssigningId(item.id);
    setSyncNotice(null);
    const ov = overrides[item.id];
    try {
      const sync = await onAssign({
        itemId: item.id,
        title: item.title,
        storyPoints: typeof item.storyPoints === 'number' ? item.storyPoints : 0,
        ownerDivision: ov?.ownerDivision ?? item.ownerDivision ?? 'engineering',
        ownerAgentId:
          ov?.ownerAgentId !== undefined ? ov.ownerAgentId : item.ownerAgentId ?? null,
      });
      setCandidates((prev) => prev.filter((c) => c.id !== item.id));
      if (!sync.synced && sync.warning) {
        setSyncNotice(sync.warning);
      }
    } finally {
      setAssigningId(null);
    }
  };

  const handleManualSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setManualError(null);
    setSyncNotice(null);

    const cleanId = sanitizeUserText(manualId, 64);
    const cleanTitle = sanitizeUserText(manualTitle, 240);
    if (!cleanId || !cleanTitle) {
      setManualError('Both Item ID and Title are required.');
      return;
    }

    setAssigningId(cleanId);
    try {
      const sync = await onAssign({
        itemId: cleanId,
        title: cleanTitle,
        storyPoints: Math.max(0, manualPoints),
        ownerDivision: manualDivision,
        ownerAgentId: manualAgentId,
      });
      setManualId('');
      setManualTitle('');
      if (!sync.synced && sync.warning) {
        setSyncNotice(sync.warning);
      }
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Failed to assign item');
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-[4px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backlog-drawer-title"
      data-testid="backlog-drawer"
    >
      <div className="transition-drawer-enter flex h-full w-full max-w-xl flex-col border-l border-[#D4D4CE] dark:border-zinc-800 bg-white dark:bg-[#161B24]">
        <div className="flex items-center justify-between border-b border-[#D4D4CE] dark:border-zinc-800 px-5 py-4">
          <div>
            <h2
              id="backlog-drawer-title"
              className="text-base font-bold text-[#18181B] dark:text-slate-100"
            >
              Pull Backlog Candidates → {sprintId}
            </h2>
            <p className="text-xs text-[#52525B] dark:text-slate-400">
              Syncs with Backlog service (port 4102) or commits locally when offline.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadCandidates(sprintId)}
              disabled={loading}
              aria-label="Refresh backlog candidates"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="rounded-lg p-1.5 text-[#52525B] dark:text-slate-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {backlogSync && !backlogSync.synced && (
            <div
              data-testid="backlog-offline-banner"
              className="flex items-start gap-2.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-3 text-xs text-amber-900 dark:text-amber-200"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[#D97706]" aria-hidden="true" />
              <div>
                <div className="font-semibold">
                  Backlog service (4102) is currently offline.
                </div>
                <div className="mt-0.5 text-amber-800 dark:text-amber-300">
                  You can still link manual/local items directly to {sprintId}. ({backlogSync.warning})
                </div>
              </div>
            </div>
          )}

          {syncNotice && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              Item committed locally; remote Backlog sync note: {syncNotice}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="relative sm:col-span-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#71717A]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ID or title..."
                className="w-full rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] pl-8 pr-2.5 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]"
              />
            </div>

            <select
              aria-label="Filter candidates by division"
              value={divisionFilter}
              onChange={(e) => setDivisionFilter(e.target.value as DivisionId | 'all')}
              className="rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] px-2.5 py-1.5 text-xs"
            >
              <option value="all">All Divisions</option>
              {CANONICAL_DIVISIONS.map((div) => (
                <option key={div.id} value={div.id}>
                  {div.shortName}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter candidates by priority"
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(e.target.value as 'all' | 'P0' | 'P1' | 'P2')
              }
              className="rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] px-2.5 py-1.5 text-xs"
            >
              <option value="all">All Priorities</option>
              <option value="P0">P0</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
            </select>
          </div>

          <div className="space-y-2.5">
            {loading ? (
              <div className="rounded-lg border border-[#E5E3DC] dark:border-zinc-800 p-4 text-center text-xs text-[#71717A]">
                Loading groomed Backlog candidates...
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] dark:bg-[#0D1117] p-4 text-center text-xs text-[#52525B] dark:text-slate-400">
                No remote groomed candidates available. Use the manual sprint item form below.
              </div>
            ) : (
              filteredCandidates.map((item) => {
                const ov = overrides[item.id] ?? {
                  ownerDivision: (item.ownerDivision as DivisionId) ?? 'engineering',
                  ownerAgentId: item.ownerAgentId ?? null,
                };
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-[#E5E3DC] dark:border-zinc-800 bg-[#F6F5F1] dark:bg-[#0D1117] p-3.5 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono-tabular text-xs font-bold text-[#0F766E] dark:text-teal-400">
                            {item.id}
                          </span>
                          {item.priority && <Badge tone="amber">{item.priority}</Badge>}
                          {item.moscow && <Badge tone="neutral">{item.moscow}</Badge>}
                          <Badge tone="teal" className="font-mono-tabular">
                            {item.storyPoints ?? 0} SP
                          </Badge>
                        </div>
                        <div className="mt-1 text-sm font-semibold text-[#18181B] dark:text-slate-100">
                          {item.title}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <select
                        aria-label={`Division for ${item.id}`}
                        value={ov.ownerDivision}
                        onChange={(e) =>
                          setOverrides((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...ov,
                              ownerDivision: e.target.value as DivisionId,
                            },
                          }))
                        }
                        className="rounded border border-[#E5E3DC] dark:border-zinc-700 bg-white px-2 py-1 text-xs"
                      >
                        {CANONICAL_DIVISIONS.map((div) => (
                          <option key={div.id} value={div.id}>
                            {div.shortName}
                          </option>
                        ))}
                      </select>

                      <select
                        aria-label={`Agent for ${item.id}`}
                        value={ov.ownerAgentId ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          const agentDiv =
                            val !== null ? AGENTS_BY_ID[val]?.divisionId : undefined;
                          setOverrides((prev) => ({
                            ...prev,
                            [item.id]: {
                              ownerDivision: agentDiv ?? ov.ownerDivision,
                              ownerAgentId: val,
                            },
                          }));
                        }}
                        className="rounded border border-[#E5E3DC] dark:border-zinc-700 bg-white px-2 py-1 text-xs"
                      >
                        <option value="">Unassigned Agent</option>
                        {CANONICAL_AGENTS.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            #{agent.id} {agent.shortName} ({agent.divisionId})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="primary"
                        size="sm"
                        className="transition-subtle active:scale-[0.97]"
                        data-testid={`assign-candidate-${item.id}`}
                        onClick={() => void handleAssignCandidate(item)}
                        disabled={assigningId === item.id}
                      >
                        {assigningId === item.id ? 'Assigning...' : 'Assign to Sprint'}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form
            data-testid="manual-assign-form"
            onSubmit={handleManualSubmit}
            className="rounded-xl border border-[#D4D4CE] dark:border-zinc-800 bg-[#F3F3F0] dark:bg-[#0E1015] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-[#52525B] dark:text-slate-300">
                Manual / Offline Sprint Item Assignment
              </h3>
            </div>

            {manualError && (
              <div className="rounded border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1.5 text-xs text-rose-700 dark:text-rose-300">
                {manualError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <input
                type="text"
                placeholder="ID (e.g. BL-301)"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                required
                className="rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white px-2.5 py-1.5 text-xs font-mono-tabular"
              />
              <input
                type="text"
                placeholder="Item title"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                required
                className="sm:col-span-2 rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white px-2.5 py-1.5 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <input
                type="number"
                min={0}
                max={1000}
                value={manualPoints}
                onChange={(e) => setManualPoints(Math.max(0, Number(e.target.value) || 0))}
                aria-label="Manual story points"
                className="rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white px-2.5 py-1.5 text-xs font-mono-tabular"
              />

              <select
                aria-label="Manual division"
                value={manualDivision}
                onChange={(e) => setManualDivision(e.target.value as DivisionId)}
                className="rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white px-2.5 py-1.5 text-xs"
              >
                {CANONICAL_DIVISIONS.map((div) => (
                  <option key={div.id} value={div.id}>
                    {div.shortName}
                  </option>
                ))}
              </select>

              <select
                aria-label="Manual agent"
                value={manualAgentId}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setManualAgentId(id);
                  const div = AGENTS_BY_ID[id]?.divisionId;
                  if (div) setManualDivision(div);
                }}
                className="rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white px-2.5 py-1.5 text-xs"
              >
                {CANONICAL_AGENTS.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    #{agent.id} {agent.shortName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={assigningId === manualId && manualId !== ''}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Assign Item to {sprintId}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
