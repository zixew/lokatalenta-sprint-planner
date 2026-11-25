import { CheckSquare, Plus, Square, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  AGENTS_BY_ID,
  CANONICAL_AGENTS,
  CANONICAL_DIVISIONS,
  type CeremonyType,
} from '../../contracts/canonical.ts';
import type { SprintRecord } from '../../lib/api.ts';
import { sanitizeUserText } from '../../lib/securityGuards.ts';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';

interface DraftActionItem {
  text: string;
  ownerAgentId: number | null;
  done: boolean;
}

const CEREMONY_TABS: readonly { id: CeremonyType; label: string }[] = [
  { id: 'planning', label: 'Sprint Planning' },
  { id: 'review', label: 'Sprint Review' },
  { id: 'retrospective', label: 'Retrospective' },
];

export function CeremoniesPanel({
  sprint,
  onAddCeremony,
}: {
  sprint: SprintRecord;
  onAddCeremony: (payload: {
    type: CeremonyType;
    facilitatorAgentId: number;
    notes: string;
    actionItems: DraftActionItem[];
  }) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<CeremonyType>('planning');
  const [facilitatorAgentId, setFacilitatorAgentId] = useState<number>(2);
  const [notes, setNotes] = useState('');
  const [actionDraftText, setActionDraftText] = useState('');
  const [actionDraftOwner, setActionDraftOwner] = useState<number | ''>('');
  const [actionItems, setActionItems] = useState<DraftActionItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddActionItem = () => {
    const clean = sanitizeUserText(actionDraftText, 500);
    if (!clean) return;
    setActionItems((prev) => [
      ...prev,
      {
        text: clean,
        ownerAgentId: actionDraftOwner === '' ? null : actionDraftOwner,
        done: false,
      },
    ]);
    setActionDraftText('');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const cleanNotes = sanitizeUserText(notes, 4000);
    if (!cleanNotes) {
      setError('Ceremony notes are required.');
      return;
    }

    setSaving(true);
    try {
      await onAddCeremony({
        type: activeTab,
        facilitatorAgentId,
        notes: cleanNotes,
        actionItems,
      });
      setNotes('');
      setActionItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record ceremony');
    } finally {
      setSaving(false);
    }
  };

  const tabCeremonies = sprint.ceremonies.filter((c) => c.type === activeTab);

  return (
    <div
      data-testid="ceremonies-panel"
      className="grid grid-cols-1 gap-6 lg:grid-cols-12"
    >
      <section className="lg:col-span-6 rounded-xl border border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] p-5">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E3DC] dark:border-zinc-800 pb-3">
          {CEREMONY_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`ceremony-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] ${
                  active
                    ? 'bg-[#0F766E] text-white'
                    : 'bg-[#F6F5F1] dark:bg-[#0D1117] text-[#52525B] dark:text-slate-300 border border-[#E5E3DC] dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="ceremony-facilitator"
              className="block text-xs font-semibold text-[#18181B] dark:text-slate-200"
            >
              Facilitator Agent (#0–#23)
            </label>
            <select
              id="ceremony-facilitator"
              data-testid="ceremony-facilitator-select"
              value={facilitatorAgentId}
              onChange={(e) => setFacilitatorAgentId(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] px-3 py-2 text-xs font-medium"
            >
              {CANONICAL_DIVISIONS.map((div) => (
                <optgroup key={div.id} label={div.shortName}>
                  {CANONICAL_AGENTS.filter((a) => a.divisionId === div.id).map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      #{agent.id} {agent.name} — {agent.role}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="ceremony-notes"
              className="block text-xs font-semibold text-[#18181B] dark:text-slate-200"
            >
              Ceremony Notes ({activeTab})
            </label>
            <textarea
              id="ceremony-notes"
              data-testid="ceremony-notes-input"
              rows={4}
              required
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`Document key decisions, blockers, and alignment from ${activeTab}...`}
              className="mt-1 w-full rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="ceremony-action-input"
              className="block text-xs font-semibold text-[#18181B] dark:text-slate-200"
            >
              Action Items
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="ceremony-action-input"
                data-testid="ceremony-action-item-input"
                type="text"
                value={actionDraftText}
                onChange={(e) => setActionDraftText(e.target.value)}
                placeholder="Add concrete follow-up action..."
                className="flex-1 rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-white px-3 py-1.5 text-xs"
              />
              <select
                aria-label="Action item owner agent"
                value={actionDraftOwner}
                onChange={(e) =>
                  setActionDraftOwner(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="rounded-lg border border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] px-2.5 py-1.5 text-xs"
              >
                <option value="">Any Owner</option>
                {CANONICAL_AGENTS.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    #{agent.id} {agent.shortName}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                data-testid="ceremony-add-action-btn"
                onClick={handleAddActionItem}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add
              </Button>
            </div>

            {actionItems.length > 0 && (
              <ul className="space-y-1.5 pt-1">
                {actionItems.map((item, idx) => {
                  const owner =
                    item.ownerAgentId !== null ? AGENTS_BY_ID[item.ownerAgentId] : undefined;
                  return (
                    <li
                      key={`${item.text}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-[#E5E3DC] dark:border-zinc-800 bg-[#F6F5F1] dark:bg-[#0D1117] px-2.5 py-1.5 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setActionItems((prev) =>
                            prev.map((a, i) => (i === idx ? { ...a, done: !a.done } : a)),
                          )
                        }
                        className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left cursor-pointer"
                      >
                        {item.done ? (
                          <CheckSquare className="h-3.5 w-3.5 text-[#0F766E] dark:text-teal-400" />
                        ) : (
                          <Square className="h-3.5 w-3.5 text-[#71717A]" />
                        )}
                        <span className={item.done ? 'line-through text-[#71717A]' : ''}>
                          {item.text}
                        </span>
                        {owner && <Badge tone="neutral">#{owner.id} {owner.shortName}</Badge>}
                      </button>

                      <button
                        type="button"
                        aria-label="Remove action item"
                        onClick={() =>
                          setActionItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-[#71717A] hover:text-[#E11D48] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              type="submit"
              data-testid="ceremony-save-btn"
              disabled={saving}
            >
              {saving ? 'Recording...' : 'Save Ceremony Entry'}
            </Button>
          </div>
        </form>
      </section>

      <section className="lg:col-span-6 rounded-xl border border-[#E5E3DC] dark:border-zinc-800 bg-white dark:bg-[#161B22] p-5">
        <div className="flex items-center justify-between border-b border-[#E5E3DC] dark:border-zinc-800 pb-3">
          <h3 className="text-base font-bold text-[#18181B] dark:text-slate-100">
            Recorded {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Log
          </h3>
          <Badge tone="teal" className="font-mono-tabular">
            {tabCeremonies.length} entries
          </Badge>
        </div>

        {tabCeremonies.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-[#E5E3DC] dark:border-zinc-700 bg-[#F6F5F1] dark:bg-[#0D1117] p-6 text-center text-xs text-[#52525B] dark:text-slate-400">
            No {activeTab} notes recorded for {sprint.id} yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {tabCeremonies.map((entry) => {
              const facilitator = AGENTS_BY_ID[entry.facilitatorAgentId];
              return (
                <article
                  key={entry.id}
                  className="rounded-lg border border-[#E5E3DC] dark:border-zinc-800 bg-[#F6F5F1] dark:bg-[#0D1117] p-3.5 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone="teal">{entry.type}</Badge>
                      <span className="text-xs font-semibold text-[#18181B] dark:text-slate-100">
                        Facilitator: #{entry.facilitatorAgentId}{' '}
                        {facilitator?.shortName ?? 'Agent'}
                      </span>
                    </div>
                    <span className="font-mono-tabular text-[11px] text-[#71717A] dark:text-slate-400">
                      {entry.recordedAt.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>

                  <p className="text-sm text-[#18181B] dark:text-slate-200 whitespace-pre-wrap">
                    {entry.notes}
                  </p>

                  {entry.actionItems.length > 0 && (
                    <ul className="space-y-1 border-t border-[#E5E3DC] dark:border-zinc-800 pt-2">
                      {entry.actionItems.map((act, idx) => {
                        const owner =
                          act.ownerAgentId !== null ? AGENTS_BY_ID[act.ownerAgentId] : undefined;
                        return (
                          <li
                            key={`${entry.id}-act-${idx}`}
                            className="flex items-center justify-between gap-2 text-xs text-[#52525B] dark:text-slate-300"
                          >
                            <span>
                              {act.done ? '✓' : '•'} {act.text}
                            </span>
                            {owner && (
                              <Badge tone="neutral">#{owner.id} {owner.shortName}</Badge>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
