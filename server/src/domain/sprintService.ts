import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  CANONICAL_AGENTS,
  CANONICAL_DIVISIONS,
  type CeremonyType,
  type DivisionId,
  type SprintItemStatus,
  type SprintStatus,
} from '../contracts/canonical.js';
import { runInTransaction, toPlain, toPlainRows } from '../db/database.js';
import {
  computeBurndown,
  computeLoadVsCapacity,
  computeVelocity,
  type AgentBreakdownItem,
  type BurndownPoint,
  type DivisionBreakdownItem,
  type VelocitySummary,
} from './summary.js';
import { ApiError, type CeremonyActionItem } from './validation.js';

export interface SprintItemRecord {
  readonly sprintId: string;
  readonly itemId: string;
  readonly title: string;
  readonly storyPoints: number;
  readonly ownerDivision: DivisionId;
  readonly ownerAgentId: number | null;
  readonly status: SprintItemStatus;
  readonly backlogSynced: boolean;
  readonly assignedAt: string;
  readonly completedAt: string | null;
  readonly updatedAt: string;
}

export interface CeremonyRecord {
  readonly id: string;
  readonly sprintId: string;
  readonly type: CeremonyType;
  readonly facilitatorAgentId: number;
  readonly notes: string;
  readonly actionItems: CeremonyActionItem[];
  readonly recordedAt: string;
  readonly createdAt: string;
}

export interface SprintMetrics {
  readonly committedPoints: number;
  readonly completedPoints: number;
  readonly remainingPoints: number;
  readonly totalCapacityPoints: number;
  readonly totalAgentCapacityPoints: number;
  readonly itemCount: number;
}

export interface SprintRecord {
  readonly id: string;
  readonly name: string;
  readonly goal: string;
  readonly status: SprintStatus;
  readonly startDate: string;
  readonly endDate: string;
  readonly divisionCapacities: Record<DivisionId, number>;
  readonly agentCapacities: Record<number, number>;
  readonly items: SprintItemRecord[];
  readonly ceremonies: CeremonyRecord[];
  readonly metrics: SprintMetrics;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SprintSummary {
  readonly sprintId: string;
  readonly name: string;
  readonly status: SprintStatus;
  readonly startDate: string;
  readonly endDate: string;
  readonly totals: {
    readonly committedPoints: number;
    readonly completedPoints: number;
    readonly remainingPoints: number;
    readonly totalCapacityPoints: number;
    readonly totalAgentCapacityPoints: number;
    readonly completionRatePct: number;
    readonly itemCounts: {
      readonly total: number;
      readonly in_sprint: number;
      readonly in_progress: number;
      readonly review: number;
      readonly done: number;
    };
  };
  readonly divisionBreakdown: DivisionBreakdownItem[];
  readonly agentBreakdown: AgentBreakdownItem[];
  readonly velocity: VelocitySummary;
  readonly burndown: BurndownPoint[];
}

interface RawSprintRow extends Record<string, unknown> {
  id: string;
  name: string;
  goal: string;
  status: SprintStatus;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

interface RawDivCapRow extends Record<string, unknown> {
  division_id: DivisionId;
  capacity_points: number;
}

interface RawAgentCapRow extends Record<string, unknown> {
  agent_id: number;
  capacity_points: number;
}

interface RawSprintItemRow extends Record<string, unknown> {
  sprint_id: string;
  item_id: string;
  title: string;
  story_points: number;
  owner_division: DivisionId;
  owner_agent_id: number | null;
  status: SprintItemStatus;
  backlog_synced: number;
  assigned_at: string;
  completed_at: string | null;
  updated_at: string;
}

interface RawCeremonyRow extends Record<string, unknown> {
  id: string;
  sprint_id: string;
  type: CeremonyType;
  facilitator_agent_id: number;
  notes: string;
  action_items_json: string;
  recorded_at: string;
  created_at: string;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function defaultDivisionCapacities(): Record<DivisionId, number> {
  return {
    executive: 0,
    architecture: 0,
    engineering: 0,
    qa: 0,
    devops: 0,
    lounge: 0,
  };
}

function defaultAgentCapacities(): Record<number, number> {
  const result: Record<number, number> = {};
  for (const agent of CANONICAL_AGENTS) {
    result[agent.id] = 0;
  }
  return result;
}

function mapSprintItemRow(row: RawSprintItemRow): SprintItemRecord {
  return {
    sprintId: row.sprint_id,
    itemId: row.item_id,
    title: row.title,
    storyPoints: Number(row.story_points),
    ownerDivision: row.owner_division,
    ownerAgentId: row.owner_agent_id === null ? null : Number(row.owner_agent_id),
    status: row.status,
    backlogSynced: Boolean(row.backlog_synced),
    assignedAt: row.assigned_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

function mapCeremonyRow(row: RawCeremonyRow): CeremonyRecord {
  let actionItems: CeremonyActionItem[] = [];
  try {
    const parsed = JSON.parse(row.action_items_json);
    if (Array.isArray(parsed)) {
      actionItems = parsed.map((entry) => {
        if (typeof entry === 'string') {
          return { text: entry, ownerAgentId: null, done: false };
        }
        return {
          text: String((entry as Record<string, unknown>).text ?? ''),
          ownerAgentId:
            typeof (entry as Record<string, unknown>).ownerAgentId === 'number'
              ? ((entry as Record<string, unknown>).ownerAgentId as number)
              : null,
          done: Boolean((entry as Record<string, unknown>).done),
        };
      });
    }
  } catch {
    actionItems = [];
  }

  return {
    id: row.id,
    sprintId: row.sprint_id,
    type: row.type,
    facilitatorAgentId: Number(row.facilitator_agent_id),
    notes: row.notes,
    actionItems,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

export class SprintService {
  readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  private hydrateSprint(row: RawSprintRow): SprintRecord {
    const divisionCapacities = defaultDivisionCapacities();
    const divRows = toPlainRows<RawDivCapRow>(
      this.db
        .prepare(
          'SELECT division_id, capacity_points FROM sprint_division_capacities WHERE sprint_id = ?',
        )
        .all(row.id),
    );
    for (const divRow of divRows) {
      divisionCapacities[divRow.division_id] = Number(divRow.capacity_points);
    }

    const agentCapacities = defaultAgentCapacities();
    const agentRows = toPlainRows<RawAgentCapRow>(
      this.db
        .prepare(
          'SELECT agent_id, capacity_points FROM sprint_agent_capacities WHERE sprint_id = ?',
        )
        .all(row.id),
    );
    for (const agentRow of agentRows) {
      agentCapacities[Number(agentRow.agent_id)] = Number(agentRow.capacity_points);
    }

    const itemRows = toPlainRows<RawSprintItemRow>(
      this.db
        .prepare(
          'SELECT * FROM sprint_items WHERE sprint_id = ? ORDER BY assigned_at ASC, item_id ASC',
        )
        .all(row.id),
    );
    const items = itemRows.map(mapSprintItemRow);

    const ceremonyRows = toPlainRows<RawCeremonyRow>(
      this.db
        .prepare(
          'SELECT * FROM sprint_ceremonies WHERE sprint_id = ? ORDER BY recorded_at DESC, created_at DESC',
        )
        .all(row.id),
    );
    const ceremonies = ceremonyRows.map(mapCeremonyRow);

    const committedPoints = round2(items.reduce((acc, item) => acc + item.storyPoints, 0));
    const completedPoints = round2(
      items
        .filter((item) => item.status === 'done')
        .reduce((acc, item) => acc + item.storyPoints, 0),
    );
    const remainingPoints = round2(Math.max(0, committedPoints - completedPoints));
    const totalCapacityPoints = round2(
      Object.values(divisionCapacities).reduce((acc, pts) => acc + pts, 0),
    );
    const totalAgentCapacityPoints = round2(
      Object.values(agentCapacities).reduce((acc, pts) => acc + pts, 0),
    );

    return {
      id: row.id,
      name: row.name,
      goal: row.goal,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      divisionCapacities,
      agentCapacities,
      items,
      ceremonies,
      metrics: {
        committedPoints,
        completedPoints,
        remainingPoints,
        totalCapacityPoints,
        totalAgentCapacityPoints,
        itemCount: items.length,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private getRawSprintOrThrow(id: string): RawSprintRow {
    const row = this.db.prepare('SELECT * FROM sprints WHERE id = ?').get(id);
    if (!row) {
      throw new ApiError(404, `Sprint "${id}" not found`);
    }
    return toPlain<RawSprintRow>(row);
  }

  private nextGeneratedSprintId(): string {
    const rows = toPlainRows<{ id: string }>(this.db.prepare('SELECT id FROM sprints').all());
    let maxNum = 0;
    for (const row of rows) {
      const match = /^SPR-(\d+)$/i.exec(row.id);
      if (match) {
        const num = Number(match[1]);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
    let candidate = `SPR-${maxNum + 1}`;
    while (this.db.prepare('SELECT 1 FROM sprints WHERE id = ?').get(candidate)) {
      maxNum += 1;
      candidate = `SPR-${maxNum + 1}`;
    }
    return candidate;
  }

  private applyCapacities(
    sprintId: string,
    divisionCapacities?: Partial<Record<DivisionId, number>>,
    agentCapacities?: Partial<Record<number, number>>,
  ): void {
    if (divisionCapacities) {
      const stmt = this.db.prepare(`
        INSERT INTO sprint_division_capacities (sprint_id, division_id, capacity_points)
        VALUES (?, ?, ?)
        ON CONFLICT(sprint_id, division_id)
        DO UPDATE SET capacity_points = excluded.capacity_points
      `);
      for (const [divisionId, points] of Object.entries(divisionCapacities)) {
        if (points !== undefined) {
          stmt.run(sprintId, divisionId, points);
        }
      }
    }

    if (agentCapacities) {
      const stmt = this.db.prepare(`
        INSERT INTO sprint_agent_capacities (sprint_id, agent_id, capacity_points)
        VALUES (?, ?, ?)
        ON CONFLICT(sprint_id, agent_id)
        DO UPDATE SET capacity_points = excluded.capacity_points
      `);
      for (const [agentKey, points] of Object.entries(agentCapacities)) {
        if (points !== undefined) {
          stmt.run(sprintId, Number(agentKey), points);
        }
      }
    }
  }

  listSprints(statusFilter?: SprintStatus): SprintRecord[] {
    const rows = statusFilter
      ? toPlainRows<RawSprintRow>(
          this.db
            .prepare(
              'SELECT * FROM sprints WHERE status = ? ORDER BY start_date DESC, created_at DESC',
            )
            .all(statusFilter),
        )
      : toPlainRows<RawSprintRow>(
          this.db
            .prepare('SELECT * FROM sprints ORDER BY start_date DESC, created_at DESC')
            .all(),
        );
    return rows.map((row) => this.hydrateSprint(row));
  }

  getSprint(id: string): SprintRecord {
    const row = this.getRawSprintOrThrow(id);
    return this.hydrateSprint(row);
  }

  createSprint(input: {
    id?: string;
    name: string;
    goal: string;
    status: SprintStatus;
    startDate: string;
    endDate: string;
    divisionCapacities?: Partial<Record<DivisionId, number>>;
    agentCapacities?: Partial<Record<number, number>>;
  }): SprintRecord {
    const id = input.id ?? this.nextGeneratedSprintId();
    const existing = this.db.prepare('SELECT id FROM sprints WHERE id = ?').get(id);
    if (existing) {
      throw new ApiError(409, `Sprint "${id}" already exists`);
    }

    const now = new Date().toISOString();
    runInTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO sprints (id, name, goal, status, start_date, end_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          input.name,
          input.goal,
          input.status,
          input.startDate,
          input.endDate,
          now,
          now,
        );

      const divStmt = this.db.prepare(
        'INSERT INTO sprint_division_capacities (sprint_id, division_id, capacity_points) VALUES (?, ?, ?)',
      );
      for (const division of CANONICAL_DIVISIONS) {
        const val = input.divisionCapacities?.[division.id] ?? 0;
        divStmt.run(id, division.id, val);
      }

      const agentStmt = this.db.prepare(
        'INSERT INTO sprint_agent_capacities (sprint_id, agent_id, capacity_points) VALUES (?, ?, ?)',
      );
      for (const agent of CANONICAL_AGENTS) {
        const val = input.agentCapacities?.[agent.id] ?? 0;
        agentStmt.run(id, agent.id, val);
      }
    });

    return this.getSprint(id);
  }

  updateSprint(
    id: string,
    input: {
      name?: string;
      goal?: string;
      status?: SprintStatus;
      startDate?: string;
      endDate?: string;
      divisionCapacities?: Partial<Record<DivisionId, number>>;
      agentCapacities?: Partial<Record<number, number>>;
    },
  ): { previousStatus: SprintStatus; sprint: SprintRecord } {
    const current = this.getRawSprintOrThrow(id);
    const nextStart = input.startDate ?? current.start_date;
    const nextEnd = input.endDate ?? current.end_date;

    if (nextEnd < nextStart) {
      throw new ApiError(400, 'endDate must be on or after startDate');
    }

    const now = new Date().toISOString();
    runInTransaction(this.db, () => {
      this.db
        .prepare(
          `UPDATE sprints
           SET name = ?, goal = ?, status = ?, start_date = ?, end_date = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          input.name ?? current.name,
          input.goal ?? current.goal,
          input.status ?? current.status,
          nextStart,
          nextEnd,
          now,
          id,
        );

      this.applyCapacities(id, input.divisionCapacities, input.agentCapacities);
    });

    return {
      previousStatus: current.status,
      sprint: this.getSprint(id),
    };
  }

  updateCapacities(
    id: string,
    input: {
      divisionCapacities?: Partial<Record<DivisionId, number>>;
      agentCapacities?: Partial<Record<number, number>>;
    },
  ): SprintRecord {
    this.getRawSprintOrThrow(id);
    const now = new Date().toISOString();
    runInTransaction(this.db, () => {
      this.applyCapacities(id, input.divisionCapacities, input.agentCapacities);
      this.db.prepare('UPDATE sprints SET updated_at = ? WHERE id = ?').run(now, id);
    });
    return this.getSprint(id);
  }

  assignItem(
    sprintId: string,
    input: {
      itemId: string;
      title: string;
      storyPoints: number;
      ownerDivision: DivisionId;
      ownerAgentId: number | null;
      status: SprintItemStatus;
      backlogSynced: boolean;
    },
  ): { sprint: SprintRecord; assignment: SprintItemRecord } {
    this.getRawSprintOrThrow(sprintId);
    const now = new Date().toISOString();
    const existingRow = this.db
      .prepare('SELECT * FROM sprint_items WHERE sprint_id = ? AND item_id = ?')
      .get(sprintId, input.itemId);
    const existing = existingRow ? toPlain<RawSprintItemRow>(existingRow) : null;

    const assignedAt = existing?.assigned_at ?? now;
    const completedAt =
      input.status === 'done' ? existing?.completed_at ?? now : null;

    runInTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO sprint_items (
            sprint_id, item_id, title, story_points, owner_division, owner_agent_id,
            status, backlog_synced, assigned_at, completed_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(sprint_id, item_id) DO UPDATE SET
            title = excluded.title,
            story_points = excluded.story_points,
            owner_division = excluded.owner_division,
            owner_agent_id = excluded.owner_agent_id,
            status = excluded.status,
            backlog_synced = excluded.backlog_synced,
            completed_at = excluded.completed_at,
            updated_at = excluded.updated_at`,
        )
        .run(
          sprintId,
          input.itemId,
          input.title,
          input.storyPoints,
          input.ownerDivision,
          input.ownerAgentId,
          input.status,
          input.backlogSynced ? 1 : 0,
          assignedAt,
          completedAt,
          now,
        );

      this.db.prepare('UPDATE sprints SET updated_at = ? WHERE id = ?').run(now, sprintId);
    });

    const sprint = this.getSprint(sprintId);
    const assignment = sprint.items.find((item) => item.itemId === input.itemId)!;
    return { sprint, assignment };
  }

  updateSprintItem(
    sprintId: string,
    itemId: string,
    input: {
      title?: string;
      storyPoints?: number;
      ownerDivision?: DivisionId;
      ownerAgentId?: number | null;
      status?: SprintItemStatus;
      completedAt?: string | null;
      backlogSynced?: boolean;
    },
  ): { sprint: SprintRecord; assignment: SprintItemRecord } {
    this.getRawSprintOrThrow(sprintId);
    const existingRow = this.db
      .prepare('SELECT * FROM sprint_items WHERE sprint_id = ? AND item_id = ?')
      .get(sprintId, itemId);
    if (!existingRow) {
      throw new ApiError(404, `Item "${itemId}" not found in sprint "${sprintId}"`);
    }
    const existing = toPlain<RawSprintItemRow>(existingRow);
    const now = new Date().toISOString();
    const nextStatus = input.status ?? existing.status;

    let nextCompletedAt: string | null = existing.completed_at;
    if (input.completedAt !== undefined) {
      nextCompletedAt = input.completedAt;
    } else if (input.status !== undefined) {
      if (input.status === 'done') {
        nextCompletedAt = existing.completed_at ?? now;
      } else {
        nextCompletedAt = null;
      }
    }

    runInTransaction(this.db, () => {
      this.db
        .prepare(
          `UPDATE sprint_items
           SET title = ?, story_points = ?, owner_division = ?, owner_agent_id = ?,
               status = ?, backlog_synced = ?, completed_at = ?, updated_at = ?
           WHERE sprint_id = ? AND item_id = ?`,
        )
        .run(
          input.title ?? existing.title,
          input.storyPoints ?? Number(existing.story_points),
          input.ownerDivision ?? existing.owner_division,
          input.ownerAgentId !== undefined
            ? input.ownerAgentId
            : existing.owner_agent_id,
          nextStatus,
          input.backlogSynced !== undefined
            ? input.backlogSynced
              ? 1
              : 0
            : existing.backlog_synced,
          nextCompletedAt,
          now,
          sprintId,
          itemId,
        );

      this.db.prepare('UPDATE sprints SET updated_at = ? WHERE id = ?').run(now, sprintId);
    });

    const sprint = this.getSprint(sprintId);
    const assignment = sprint.items.find((item) => item.itemId === itemId)!;
    return { sprint, assignment };
  }

  removeSprintItem(
    sprintId: string,
    itemId: string,
  ): { sprint: SprintRecord; removedItem: SprintItemRecord } {
    this.getRawSprintOrThrow(sprintId);
    const existingRow = this.db
      .prepare('SELECT * FROM sprint_items WHERE sprint_id = ? AND item_id = ?')
      .get(sprintId, itemId);
    if (!existingRow) {
      throw new ApiError(404, `Item "${itemId}" not found in sprint "${sprintId}"`);
    }
    const removedItem = mapSprintItemRow(toPlain<RawSprintItemRow>(existingRow));
    const now = new Date().toISOString();

    runInTransaction(this.db, () => {
      this.db
        .prepare('DELETE FROM sprint_items WHERE sprint_id = ? AND item_id = ?')
        .run(sprintId, itemId);
      this.db.prepare('UPDATE sprints SET updated_at = ? WHERE id = ?').run(now, sprintId);
    });

    return {
      sprint: this.getSprint(sprintId),
      removedItem,
    };
  }

  listCeremonies(sprintId: string): CeremonyRecord[] {
    this.getRawSprintOrThrow(sprintId);
    const rows = toPlainRows<RawCeremonyRow>(
      this.db
        .prepare(
          'SELECT * FROM sprint_ceremonies WHERE sprint_id = ? ORDER BY recorded_at DESC, created_at DESC',
        )
        .all(sprintId),
    );
    return rows.map(mapCeremonyRow);
  }

  addCeremony(
    sprintId: string,
    input: {
      type: CeremonyType;
      facilitatorAgentId: number;
      notes: string;
      actionItems: CeremonyActionItem[];
      recordedAt: string;
    },
  ): { ceremony: CeremonyRecord; sprint: SprintRecord } {
    this.getRawSprintOrThrow(sprintId);
    const ceremonyId = `CER-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    runInTransaction(this.db, () => {
      this.db
        .prepare(
          `INSERT INTO sprint_ceremonies (
            id, sprint_id, type, facilitator_agent_id, notes, action_items_json, recorded_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          ceremonyId,
          sprintId,
          input.type,
          input.facilitatorAgentId,
          input.notes,
          JSON.stringify(input.actionItems),
          input.recordedAt,
          now,
        );
      this.db.prepare('UPDATE sprints SET updated_at = ? WHERE id = ?').run(now, sprintId);
    });

    const sprint = this.getSprint(sprintId);
    const ceremony = sprint.ceremonies.find((c) => c.id === ceremonyId)!;
    return { ceremony, sprint };
  }

  getSummary(sprintId: string): SprintSummary {
    const sprint = this.getSprint(sprintId);
    const allSprintsAsc = toPlainRows<RawSprintRow>(
      this.db
        .prepare('SELECT * FROM sprints ORDER BY start_date ASC, created_at ASC')
        .all(),
    ).map((row) => this.hydrateSprint(row));

    const itemCounts = {
      total: sprint.items.length,
      in_sprint: sprint.items.filter((i) => i.status === 'in_sprint').length,
      in_progress: sprint.items.filter((i) => i.status === 'in_progress').length,
      review: sprint.items.filter((i) => i.status === 'review').length,
      done: sprint.items.filter((i) => i.status === 'done').length,
    };

    const { divisionBreakdown, agentBreakdown } = computeLoadVsCapacity(
      sprint.divisionCapacities,
      sprint.agentCapacities,
      sprint.items,
    );

    const velocity = computeVelocity(
      allSprintsAsc.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        committedPoints: s.metrics.committedPoints,
        completedPoints: s.metrics.completedPoints,
      })),
    );

    const burndown = computeBurndown(
      sprint.startDate,
      sprint.endDate,
      sprint.metrics.committedPoints,
      sprint.items,
    );

    const completionRatePct =
      sprint.metrics.committedPoints > 0
        ? round1((sprint.metrics.completedPoints / sprint.metrics.committedPoints) * 100)
        : 0;

    return {
      sprintId: sprint.id,
      name: sprint.name,
      status: sprint.status,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      totals: {
        committedPoints: sprint.metrics.committedPoints,
        completedPoints: sprint.metrics.completedPoints,
        remainingPoints: sprint.metrics.remainingPoints,
        totalCapacityPoints: sprint.metrics.totalCapacityPoints,
        totalAgentCapacityPoints: sprint.metrics.totalAgentCapacityPoints,
        completionRatePct,
        itemCounts,
      },
      divisionBreakdown,
      agentBreakdown,
      velocity,
      burndown,
    };
  }
}
