import { BarChart3, Layers, MessageSquareText, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell.tsx';
import { BacklogDrawer } from './components/sprint/BacklogDrawer.tsx';
import { CapacityMatrix } from './components/sprint/CapacityMatrix.tsx';
import { CeremoniesPanel } from './components/sprint/CeremoniesPanel.tsx';
import { CreateSprintModal } from './components/sprint/CreateSprintModal.tsx';
import { SprintHeaderBar } from './components/sprint/SprintHeaderBar.tsx';
import { VelocityBurndown } from './components/sprint/VelocityBurndown.tsx';
import { Button } from './components/ui/Button.tsx';
import { ConfirmDialog } from './components/ui/ConfirmDialog.tsx';
import type {
  CeremonyType,
  DivisionId,
  SprintItemStatus,
} from './contracts/canonical.ts';
import {
  sprintPlannerApi,
  type SprintRecord,
  type SprintSummary,
} from './lib/api.ts';
import { applyTheme, getInitialTheme, type ThemeMode } from './lib/theme.ts';

type PlannerTab = 'capacity' | 'analytics' | 'ceremonies';

export function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [sprints, setSprints] = useState<SprintRecord[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [summary, setSummary] = useState<SprintSummary | null>(null);
  const [activeTab, setActiveTab] = useState<PlannerTab>('capacity');
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [backlogOnline, setBacklogOnline] = useState<boolean | null>(null);
  const [gatewayConfigured, setGatewayConfigured] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const loadSummaryFor = useCallback(async (sprintId: string) => {
    try {
      const data = await sprintPlannerApi.getSummary(sprintId);
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([sprintPlannerApi.listSprints(), sprintPlannerApi.getHealth()])
      .then(async ([{ sprints: loadedSprints }, health]) => {
        if (cancelled) return;
        setSprints(loadedSprints);
        setGatewayConfigured(Boolean(health.eventGatewayUrl));

        const targetId =
          (loadedSprints.find((s) => s.status === 'active') ?? loadedSprints[0])?.id ?? null;

        setSelectedSprintId(targetId);
        if (targetId) {
          await loadSummaryFor(targetId);
          const candidateProbe = await sprintPlannerApi.getBacklogCandidates(targetId);
          if (!cancelled) {
            setBacklogOnline(candidateProbe.backlogSync.synced);
          }
        } else {
          setSummary(null);
          setBacklogOnline(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorBanner(
            err instanceof Error ? err.message : 'Failed to load sprint planner',
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadSummaryFor]);

  const selectedSprint =
    sprints.find((s) => s.id === selectedSprintId) ?? null;

  const replaceSprintInState = useCallback(
    async (updated: SprintRecord) => {
      setSprints((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      await loadSummaryFor(updated.id);
    },
    [loadSummaryFor],
  );

  const handleSelectSprint = async (sprintId: string) => {
    setSelectedSprintId(sprintId);
    await loadSummaryFor(sprintId);
  };

  const handleCreateSprint = async (payload: {
    name: string;
    goal: string;
    startDate: string;
    endDate: string;
    divisionCapacities: Record<DivisionId, number>;
    agentCapacities: Record<number, number>;
  }) => {
    setMutating(true);
    try {
      const { sprint } = await sprintPlannerApi.createSprint(payload);
      setSprints((prev) => [sprint, ...prev]);
      setSelectedSprintId(sprint.id);
      setCreateOpen(false);
      await loadSummaryFor(sprint.id);
    } finally {
      setMutating(false);
    }
  };

  const handleStartSprint = async () => {
    if (!selectedSprint) return;
    setMutating(true);
    setErrorBanner(null);
    try {
      const { sprint } = await sprintPlannerApi.updateSprint(selectedSprint.id, {
        status: 'active',
      });
      await replaceSprintInState(sprint);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to start sprint');
    } finally {
      setMutating(false);
    }
  };

  const handleCompleteSprint = async () => {
    if (!selectedSprint) return;
    setMutating(true);
    setErrorBanner(null);
    try {
      const { sprint } = await sprintPlannerApi.updateSprint(selectedSprint.id, {
        status: 'completed',
      });
      await replaceSprintInState(sprint);
      setCompleteConfirmOpen(false);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to complete sprint');
    } finally {
      setMutating(false);
    }
  };

  const handleSaveCapacities = async (payload: {
    divisionCapacities: Record<DivisionId, number>;
    agentCapacities: Record<number, number>;
  }) => {
    if (!selectedSprint) return;
    setMutating(true);
    setErrorBanner(null);
    try {
      const { sprint } = await sprintPlannerApi.updateCapacity(selectedSprint.id, payload);
      await replaceSprintInState(sprint);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to update capacities');
    } finally {
      setMutating(false);
    }
  };

  const handleAssignItem = async (payload: {
    itemId: string;
    title?: string;
    storyPoints?: number;
    ownerDivision?: DivisionId;
    ownerAgentId?: number | null;
  }) => {
    if (!selectedSprint) {
      throw new Error('No sprint selected');
    }
    const result = await sprintPlannerApi.assignItem(selectedSprint.id, payload);
    setBacklogOnline(result.backlogSync.synced);
    await replaceSprintInState(result.sprint);
    return result.backlogSync;
  };

  const handleUpdateItemStatus = async (itemId: string, status: SprintItemStatus) => {
    if (!selectedSprint) return;
    setErrorBanner(null);
    try {
      const result = await sprintPlannerApi.updateSprintItem(selectedSprint.id, itemId, {
        status,
      });
      setBacklogOnline(result.backlogSync.synced);
      await replaceSprintInState(result.sprint);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to update sprint item');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedSprint) return;
    setErrorBanner(null);
    try {
      const result = await sprintPlannerApi.removeSprintItem(selectedSprint.id, itemId);
      setBacklogOnline(result.backlogSync.synced);
      await replaceSprintInState(result.sprint);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to remove sprint item');
    }
  };

  const handleAddCeremony = async (payload: {
    type: CeremonyType;
    facilitatorAgentId: number;
    notes: string;
    actionItems: Array<{ text: string; ownerAgentId: number | null; done: boolean }>;
  }) => {
    if (!selectedSprint) return;
    const { sprint } = await sprintPlannerApi.addCeremony(selectedSprint.id, payload);
    await replaceSprintInState(sprint);
  };

  return (
    <AppShell
      theme={theme}
      onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      backlogOnline={backlogOnline}
      gatewayConfigured={gatewayConfigured}
    >
      <div className="space-y-6">
        {errorBanner && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-sm text-rose-800 dark:text-rose-200"
          >
            {errorBanner}
          </div>
        )}

        <SprintHeaderBar
          sprints={sprints}
          selectedSprint={selectedSprint}
          onSelectSprint={(id) => void handleSelectSprint(id)}
          onOpenCreate={() => setCreateOpen(true)}
          onOpenBacklogDrawer={() => setDrawerOpen(true)}
          onStartSprint={() => void handleStartSprint()}
          onRequestCompleteSprint={() => setCompleteConfirmOpen(true)}
          mutating={mutating}
        />

        {loading ? (
          <div className="rounded-xl border border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] p-10 text-center text-sm text-[#52525B] dark:text-slate-400">
            Loading sprints and division capacities...
          </div>
        ) : !selectedSprint ? (
          <div
            data-testid="empty-sprints-state"
            className="rounded-xl border border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] p-10 text-center"
          >
            <h2 className="text-lg font-bold text-[#18181B] dark:text-slate-100">
              No Sprints Created Yet
            </h2>
            <p className="mt-1.5 text-sm text-[#52525B] dark:text-slate-400">
              Create your first sprint to allocate capacity across the 6 divisions and 24 canonical agents.
            </p>
            <Button
              variant="primary"
              size="md"
              className="mt-5"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create First Sprint
            </Button>
          </div>
        ) : (
          <>
            <div
              data-testid="planner-tabs"
              role="tablist"
              aria-label="Sprint Planner Views"
              className="flex flex-wrap items-center gap-2 border-b border-[#E5E3DC] dark:border-zinc-800 pb-3"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'capacity'}
                data-testid="tab-capacity"
                onClick={() => setActiveTab('capacity')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer min-h-[40px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] ${
                  activeTab === 'capacity'
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-400 border border-teal-200 dark:border-teal-800'
                    : 'bg-white dark:bg-[#161B22] text-[#52525B] dark:text-slate-300 border border-[#E5E3DC] dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                Capacity &amp; Sprint Scope
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'analytics'}
                data-testid="tab-analytics"
                onClick={() => setActiveTab('analytics')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer min-h-[40px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] ${
                  activeTab === 'analytics'
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-400 border border-teal-200 dark:border-teal-800'
                    : 'bg-white dark:bg-[#161B22] text-[#52525B] dark:text-slate-300 border border-[#E5E3DC] dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                Velocity &amp; Burndown
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'ceremonies'}
                data-testid="tab-ceremonies"
                onClick={() => setActiveTab('ceremonies')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer min-h-[40px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] ${
                  activeTab === 'ceremonies'
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-400 border border-teal-200 dark:border-teal-800'
                    : 'bg-white dark:bg-[#161B22] text-[#52525B] dark:text-slate-300 border border-[#E5E3DC] dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                Ceremony Notes
              </button>
            </div>

            {activeTab === 'capacity' && (
              <CapacityMatrix
                sprint={selectedSprint}
                onSaveCapacities={handleSaveCapacities}
                onUpdateItemStatus={handleUpdateItemStatus}
                onRemoveItem={handleRemoveItem}
                onOpenBacklogDrawer={() => setDrawerOpen(true)}
                savingCapacity={mutating}
              />
            )}

            {activeTab === 'analytics' && <VelocityBurndown summary={summary} />}

            {activeTab === 'ceremonies' && (
              <CeremoniesPanel
                sprint={selectedSprint}
                onAddCeremony={handleAddCeremony}
              />
            )}
          </>
        )}
      </div>

      <CreateSprintModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateSprint}
        submitting={mutating}
      />

      <BacklogDrawer
        open={drawerOpen}
        sprintId={selectedSprint?.id ?? null}
        onClose={() => setDrawerOpen(false)}
        onAssign={handleAssignItem}
      />

      <ConfirmDialog
        open={completeConfirmOpen}
        title={`Complete ${selectedSprint?.id ?? 'Sprint'}?`}
        description="Completing this sprint locks in final velocity metrics and notifies the Event Gateway."
        confirmLabel="Complete Sprint"
        loading={mutating}
        onConfirm={() => void handleCompleteSprint()}
        onCancel={() => setCompleteConfirmOpen(false)}
      />
    </AppShell>
  );
}

export default App;
