import { X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  CANONICAL_AGENTS,
  CANONICAL_DIVISIONS,
  type DivisionId,
} from '../../contracts/canonical.ts';
import { sanitizeUserText } from '../../lib/securityGuards.ts';
import { Button } from '../ui/Button.tsx';

export function CreateSprintModal({
  open,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    goal: string;
    startDate: string;
    endDate: string;
    divisionCapacities: Record<DivisionId, number>;
    agentCapacities: Record<number, number>;
  }) => Promise<void>;
  submitting: boolean;
}) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() =>
    new Date(Date.now() + 13 * 86_400_000).toISOString().slice(0, 10),
  );
  const [defaultAgentSp, setDefaultAgentSp] = useState(5);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const cleanName = sanitizeUserText(name, 160);
    const cleanGoal = sanitizeUserText(goal, 1000);
    if (!cleanName) {
      setError('Sprint name is required.');
      return;
    }
    if (endDate < startDate) {
      setError('End date must be on or after start date.');
      return;
    }

    const agentCapacities: Record<number, number> = {};
    for (const agent of CANONICAL_AGENTS) {
      agentCapacities[agent.id] = defaultAgentSp;
    }
    const divisionCapacities = Object.fromEntries(
      CANONICAL_DIVISIONS.map((div) => [div.id, div.agentIds.length * defaultAgentSp]),
    ) as Record<DivisionId, number>;

    try {
      await onSubmit({
        name: cleanName,
        goal: cleanGoal,
        startDate,
        endDate,
        divisionCapacities,
        agentCapacities,
      });
      setName('');
      setGoal('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sprint');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-sprint-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E5E3DC] dark:border-zinc-800 pb-3">
          <h2
            id="create-sprint-title"
            className="text-base font-bold text-[#18181B] dark:text-slate-100"
          >
            Create New Sprint
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-[#52525B] dark:text-slate-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="new-sprint-name"
              className="block text-xs font-semibold text-[#18181B] dark:text-slate-200"
            >
              Sprint Name
            </label>
            <input
              id="new-sprint-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint 16 — Production Telemetry & Polish"
              className="mt-1 w-full rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white px-3 py-2 text-sm text-[#18181B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] dark:focus-visible:ring-[#14b8a6]"
            />
          </div>

          <div>
            <label
              htmlFor="new-sprint-goal"
              className="block text-xs font-semibold text-[#18181B] dark:text-slate-200"
            >
              Sprint Goal
            </label>
            <textarea
              id="new-sprint-goal"
              rows={2}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Stabilize cross-division capacity & ship telemetry hooks."
              className="mt-1 w-full rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white px-3 py-2 text-sm text-[#18181B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] dark:focus-visible:ring-[#14b8a6]"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="new-sprint-start"
                className="block text-xs font-semibold text-[#18181B] dark:text-slate-200"
              >
                Start Date
              </label>
              <input
                id="new-sprint-start"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white px-3 py-2 text-sm font-mono-tabular focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] dark:focus-visible:ring-[#14b8a6]"
              />
            </div>
            <div>
              <label
                htmlFor="new-sprint-end"
                className="block text-xs font-semibold text-[#18181B] dark:text-slate-200"
              >
                End Date
              </label>
              <input
                id="new-sprint-end"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white px-3 py-2 text-sm font-mono-tabular focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] dark:focus-visible:ring-[#14b8a6]"
              />
            </div>
            <div>
              <label
                htmlFor="new-sprint-default-sp"
                className="block text-xs font-semibold text-[#18181B] dark:text-slate-200"
              >
                Seed SP / Agent
              </label>
              <input
                id="new-sprint-default-sp"
                type="number"
                min={0}
                max={100}
                value={defaultAgentSp}
                onChange={(e) => setDefaultAgentSp(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1 w-full rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white px-3 py-2 text-sm font-mono-tabular focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] dark:focus-visible:ring-[#14b8a6]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Sprint'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
