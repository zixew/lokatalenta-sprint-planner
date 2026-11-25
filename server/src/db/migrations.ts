import type { DatabaseSync } from 'node:sqlite';

export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly statements: readonly string[];
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial_sprint_planner_schema',
    statements: [
      `CREATE TABLE IF NOT EXISTS sprints (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        goal TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'completed')),
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sprint_division_capacities (
        sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
        division_id TEXT NOT NULL CHECK (division_id IN ('executive','architecture','engineering','qa','devops','lounge')),
        capacity_points REAL NOT NULL DEFAULT 0 CHECK (capacity_points >= 0),
        PRIMARY KEY (sprint_id, division_id)
      )`,
      `CREATE TABLE IF NOT EXISTS sprint_agent_capacities (
        sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
        agent_id INTEGER NOT NULL CHECK (agent_id >= 0 AND agent_id <= 23),
        capacity_points REAL NOT NULL DEFAULT 0 CHECK (capacity_points >= 0),
        PRIMARY KEY (sprint_id, agent_id)
      )`,
      `CREATE TABLE IF NOT EXISTS sprint_items (
        sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
        item_id TEXT NOT NULL,
        title TEXT NOT NULL,
        story_points REAL NOT NULL DEFAULT 0 CHECK (story_points >= 0),
        owner_division TEXT NOT NULL CHECK (owner_division IN ('executive','architecture','engineering','qa','devops','lounge')),
        owner_agent_id INTEGER NULL CHECK (owner_agent_id IS NULL OR (owner_agent_id >= 0 AND owner_agent_id <= 23)),
        status TEXT NOT NULL DEFAULT 'in_sprint' CHECK (status IN ('in_sprint', 'in_progress', 'review', 'done')),
        backlog_synced INTEGER NOT NULL DEFAULT 0 CHECK (backlog_synced IN (0, 1)),
        assigned_at TEXT NOT NULL,
        completed_at TEXT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (sprint_id, item_id)
      )`,
      `CREATE TABLE IF NOT EXISTS sprint_ceremonies (
        id TEXT PRIMARY KEY,
        sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK (type IN ('planning', 'review', 'retrospective')),
        facilitator_agent_id INTEGER NOT NULL CHECK (facilitator_agent_id >= 0 AND facilitator_agent_id <= 23),
        notes TEXT NOT NULL,
        action_items_json TEXT NOT NULL DEFAULT '[]',
        recorded_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sprint_items_sprint ON sprint_items(sprint_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sprint_ceremonies_sprint ON sprint_ceremonies(sprint_id, recorded_at)`,
    ],
  },
  {
    version: 2,
    name: 'sprint_items_status_index',
    statements: [
      `CREATE INDEX IF NOT EXISTS idx_sprint_items_status ON sprint_items(sprint_id, status)`,
    ],
  },
];

export interface MigrationResult {
  readonly applied: number[];
  readonly currentVersion: number;
}

/**
 * Ensures schema_migrations tracking table exists and applies any pending migrations idempotently.
 */
export function runMigrations(db: DatabaseSync): MigrationResult {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const rows = db
    .prepare('SELECT version FROM schema_migrations ORDER BY version ASC')
    .all() as Array<{ version: number }>;
  const appliedSet = new Set(rows.map((r) => Number(r.version)));
  const newlyApplied: number[] = [];

  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.version)) {
      continue;
    }

    db.exec('BEGIN IMMEDIATE;');
    try {
      for (const sql of migration.statements) {
        db.exec(sql);
      }
      db.prepare(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      ).run(migration.version, migration.name, new Date().toISOString());
      db.exec('COMMIT;');
      newlyApplied.push(migration.version);
      appliedSet.add(migration.version);
    } catch (error) {
      try {
        db.exec('ROLLBACK;');
      } catch {
        // ignore rollback error
      }
      throw error;
    }
  }

  const maxVersion = Math.max(0, ...appliedSet);
  return { applied: newlyApplied, currentVersion: maxVersion };
}

/**
 * Returns all applied migration versions and names for diagnostics.
 */
export function getAppliedMigrations(
  db: DatabaseSync,
): Array<{ version: number; name: string; appliedAt: string }> {
  const rows = db
    .prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC')
    .all() as Array<{ version: number; name: string; applied_at: string }>;
  return rows.map((r) => ({
    version: Number(r.version),
    name: String(r.name),
    appliedAt: String(r.applied_at),
  }));
}
