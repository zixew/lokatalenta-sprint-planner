import { loadConfig } from '../server/src/config.js';
import { openDatabase } from '../server/src/db/database.js';
import { getAppliedMigrations, runMigrations } from '../server/src/db/migrations.js';
import { seedIfEmpty } from '../server/src/db/seed.js';
import { TursoAdapter } from '../server/src/db/tursoAdapter.js';

async function main(): Promise<void> {
  const startMs = Date.now();
  const config = loadConfig();
  const db = openDatabase(config.dbPath);

  const migrationResult = runMigrations(db);
  const seeded = seedIfEmpty(db);
  const applied = getAppliedMigrations(db);

  const turso = new TursoAdapter();
  let tursoSynced = false;
  if (turso.isConfigured) {
    await turso.ensureSchema();
    const existingCount = await turso.pullToLocal(db);
    if (existingCount === 0) {
      await turso.pushFromLocal(db);
    }
    tursoSynced = true;
    await turso.close();
  }

  db.close();
  const elapsedMs = Date.now() - startMs;

  console.log(
    JSON.stringify({
      ok: true,
      dbPath: config.dbPath,
      newlyAppliedMigrations: migrationResult.applied,
      currentSchemaVersion: migrationResult.currentVersion,
      totalMigrations: applied.length,
      seededInitialData: seeded,
      tursoSynced,
      elapsedMs,
    }),
  );
}

main().catch((err) => {
  console.error('[db:migrate] failed:', err);
  process.exitCode = 1;
});
