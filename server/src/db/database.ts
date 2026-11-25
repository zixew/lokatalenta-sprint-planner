import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from './migrations.js';

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

  runMigrations(db);

  return db;
}
