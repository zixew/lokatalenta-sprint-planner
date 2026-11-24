import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function toPlain<T extends Record<string, unknown>>(row: unknown): T {
  return { ...(row as Record<string, unknown>) } as T;
}

export function toPlainRows<T extends Record<string, unknown>>(rows: readonly unknown[]): T[] {
  return rows.map((row) => toPlain<T>(row));
}

export function runInTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // ignore rollback errors if transaction was already closed
    }
    throw error;
  }
}

export function openDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ':memory:') {
    const parentDir = path.dirname(dbPath);
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sprints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      goal TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('planned', 'active', 'completed')),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sprint_division_capacities (
      sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
      division_id TEXT NOT NULL CHECK (division_id IN ('executive','architecture','engineering','qa','devops','lounge')),
      capacity_points REAL NOT NULL DEFAULT 0 CHECK (capacity_points >= 0),
      PRIMARY KEY (sprint_id, division_id)
    );

    CREATE TABLE IF NOT EXISTS sprint_agent_capacities (
      sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
      agent_id INTEGER NOT NULL CHECK (agent_id >= 0 AND agent_id <= 23),
      capacity_points REAL NOT NULL DEFAULT 0 CHECK (capacity_points >= 0),
      PRIMARY KEY (sprint_id, agent_id)
    );

    CREATE TABLE IF NOT EXISTS sprint_items (
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
    );

    CREATE TABLE IF NOT EXISTS sprint_ceremonies (
      id TEXT PRIMARY KEY,
      sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('planning', 'review', 'retrospective')),
      facilitator_agent_id INTEGER NOT NULL CHECK (facilitator_agent_id >= 0 AND facilitator_agent_id <= 23),
      notes TEXT NOT NULL,
      action_items_json TEXT NOT NULL DEFAULT '[]',
      recorded_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sprint_items_sprint ON sprint_items(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_sprint_ceremonies_sprint ON sprint_ceremonies(sprint_id, recorded_at);
  `);

  return db;
}
