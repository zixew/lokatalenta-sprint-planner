import type { DatabaseSync } from 'node:sqlite';
import { createClient, type Client, type InStatement } from '@libsql/client';
import { MIGRATIONS } from './migrations.js';

export interface TursoConfig {
  readonly url: string;
  readonly authToken?: string;
}

export interface TursoHealthStatus {
  readonly configured: boolean;
  readonly healthy: boolean;
  readonly latencyMs: number | null;
  readonly error?: string;
}

export function loadTursoConfig(env: NodeJS.ProcessEnv = process.env): TursoConfig | null {
  const url = env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    return null;
  }
  const authToken = env.TURSO_AUTH_TOKEN?.trim() || undefined;
  return { url, authToken };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 150;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
  throw lastError;
}

/**
 * Cloud database adapter for Turso/libSQL with retry logic, health check,
 * idempotent schema sync, and bidirectional state synchronization.
 */
export class TursoAdapter {
  private readonly config: TursoConfig | null;
  private readonly client: Client | null;

  constructor(config: TursoConfig | null = loadTursoConfig()) {
    this.config = config;
    this.client = config
      ? createClient({
          url: config.url,
          authToken: config.authToken,
        })
      : null;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  get url(): string | null {
    return this.config?.url ?? null;
  }

  async checkHealth(): Promise<TursoHealthStatus> {
    if (!this.client) {
      return { configured: false, healthy: false, latencyMs: null };
    }
    const start = Date.now();
    try {
      await withRetry(() => this.client!.execute('SELECT 1 AS ok'), {
        maxAttempts: 2,
        baseDelayMs: 50,
      });
      return {
        configured: true,
        healthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        configured: true,
        healthy: false,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Turso health check failed',
      };
    }
  }

  async ensureSchema(): Promise<void> {
    if (!this.client) return;
    const statements: InStatement[] = [
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )`,
    ];
    for (const migration of MIGRATIONS) {
      for (const sql of migration.statements) {
        statements.push(sql);
      }
    }
    await withRetry(() => this.client!.batch(statements, 'write'));
  }

  /**
   * Pulls persisted sprint state from Turso into a local DatabaseSync instance.
   * Returns number of sprints hydrated, or 0 if Turso is empty/unconfigured.
   */
  async pullToLocal(db: DatabaseSync): Promise<number> {
    if (!this.client) return 0;

    await this.ensureSchema();

    const sprintsRes = await withRetry(() =>
      this.client!.execute('SELECT * FROM sprints ORDER BY start_date DESC'),
    );
    if (sprintsRes.rows.length === 0) {
      return 0;
    }

    const [divRes, agentRes, itemsRes, ceremoniesRes] = await Promise.all([
      withRetry(() => this.client!.execute('SELECT * FROM sprint_division_capacities')),
      withRetry(() => this.client!.execute('SELECT * FROM sprint_agent_capacities')),
      withRetry(() => this.client!.execute('SELECT * FROM sprint_items')),
      withRetry(() => this.client!.execute('SELECT * FROM sprint_ceremonies')),
    ]);

    db.exec('BEGIN IMMEDIATE;');
    try {
      db.exec('DELETE FROM sprint_ceremonies;');
      db.exec('DELETE FROM sprint_items;');
      db.exec('DELETE FROM sprint_agent_capacities;');
      db.exec('DELETE FROM sprint_division_capacities;');
      db.exec('DELETE FROM sprints;');

      const insertSprint = db.prepare(
        `INSERT INTO sprints (id, name, goal, status, start_date, end_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const r of sprintsRes.rows) {
        insertSprint.run(
          String(r.id),
          String(r.name),
          String(r.goal ?? ''),
          String(r.status),
          String(r.start_date),
          String(r.end_date),
          String(r.created_at),
          String(r.updated_at),
        );
      }

      const insertDiv = db.prepare(
        `INSERT INTO sprint_division_capacities (sprint_id, division_id, capacity_points)
         VALUES (?, ?, ?)`,
      );
      for (const r of divRes.rows) {
        insertDiv.run(String(r.sprint_id), String(r.division_id), Number(r.capacity_points));
      }

      const insertAgent = db.prepare(
        `INSERT INTO sprint_agent_capacities (sprint_id, agent_id, capacity_points)
         VALUES (?, ?, ?)`,
      );
      for (const r of agentRes.rows) {
        insertAgent.run(String(r.sprint_id), Number(r.agent_id), Number(r.capacity_points));
      }

      const insertItem = db.prepare(
        `INSERT INTO sprint_items (sprint_id, item_id, title, story_points, owner_division, owner_agent_id, status, backlog_synced, assigned_at, completed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const r of itemsRes.rows) {
        insertItem.run(
          String(r.sprint_id),
          String(r.item_id),
          String(r.title),
          Number(r.story_points),
          String(r.owner_division),
          r.owner_agent_id === null || r.owner_agent_id === undefined
            ? null
            : Number(r.owner_agent_id),
          String(r.status),
          Number(r.backlog_synced),
          String(r.assigned_at),
          r.completed_at === null || r.completed_at === undefined ? null : String(r.completed_at),
          String(r.updated_at),
        );
      }

      const insertCeremony = db.prepare(
        `INSERT INTO sprint_ceremonies (id, sprint_id, type, facilitator_agent_id, notes, action_items_json, recorded_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const r of ceremoniesRes.rows) {
        insertCeremony.run(
          String(r.id),
          String(r.sprint_id),
          String(r.type),
          Number(r.facilitator_agent_id),
          String(r.notes),
          String(r.action_items_json ?? '[]'),
          String(r.recorded_at),
          String(r.created_at),
        );
      }

      db.exec('COMMIT;');
      return sprintsRes.rows.length;
    } catch (error) {
      try {
        db.exec('ROLLBACK;');
      } catch {
        // ignore rollback failure
      }
      throw error;
    }
  }

  /**
   * Pushes full local sprint state to Turso in a single atomic batch write.
   */
  async pushFromLocal(db: DatabaseSync): Promise<void> {
    if (!this.client) return;

    await this.ensureSchema();

    const sprints = db.prepare('SELECT * FROM sprints').all() as Array<Record<string, unknown>>;
    const divs = db
      .prepare('SELECT * FROM sprint_division_capacities')
      .all() as Array<Record<string, unknown>>;
    const agents = db
      .prepare('SELECT * FROM sprint_agent_capacities')
      .all() as Array<Record<string, unknown>>;
    const items = db.prepare('SELECT * FROM sprint_items').all() as Array<Record<string, unknown>>;
    const ceremonies = db
      .prepare('SELECT * FROM sprint_ceremonies')
      .all() as Array<Record<string, unknown>>;

    const statements: InStatement[] = [
      'DELETE FROM sprint_ceremonies',
      'DELETE FROM sprint_items',
      'DELETE FROM sprint_agent_capacities',
      'DELETE FROM sprint_division_capacities',
      'DELETE FROM sprints',
    ];

    for (const r of sprints) {
      statements.push({
        sql: `INSERT INTO sprints (id, name, goal, status, start_date, end_date, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          String(r.id),
          String(r.name),
          String(r.goal ?? ''),
          String(r.status),
          String(r.start_date),
          String(r.end_date),
          String(r.created_at),
          String(r.updated_at),
        ],
      });
    }

    for (const r of divs) {
      statements.push({
        sql: `INSERT INTO sprint_division_capacities (sprint_id, division_id, capacity_points)
              VALUES (?, ?, ?)`,
        args: [String(r.sprint_id), String(r.division_id), Number(r.capacity_points)],
      });
    }

    for (const r of agents) {
      statements.push({
        sql: `INSERT INTO sprint_agent_capacities (sprint_id, agent_id, capacity_points)
              VALUES (?, ?, ?)`,
        args: [String(r.sprint_id), Number(r.agent_id), Number(r.capacity_points)],
      });
    }

    for (const r of items) {
      statements.push({
        sql: `INSERT INTO sprint_items (sprint_id, item_id, title, story_points, owner_division, owner_agent_id, status, backlog_synced, assigned_at, completed_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          String(r.sprint_id),
          String(r.item_id),
          String(r.title),
          Number(r.story_points),
          String(r.owner_division),
          r.owner_agent_id === null || r.owner_agent_id === undefined
            ? null
            : Number(r.owner_agent_id),
          String(r.status),
          Number(r.backlog_synced),
          String(r.assigned_at),
          r.completed_at === null || r.completed_at === undefined ? null : String(r.completed_at),
          String(r.updated_at),
        ],
      });
    }

    for (const r of ceremonies) {
      statements.push({
        sql: `INSERT INTO sprint_ceremonies (id, sprint_id, type, facilitator_agent_id, notes, action_items_json, recorded_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          String(r.id),
          String(r.sprint_id),
          String(r.type),
          Number(r.facilitator_agent_id),
          String(r.notes),
          String(r.action_items_json ?? '[]'),
          String(r.recorded_at),
          String(r.created_at),
        ],
      });
    }

    await withRetry(() => this.client!.batch(statements, 'write'));
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.close();
    }
  }
}
