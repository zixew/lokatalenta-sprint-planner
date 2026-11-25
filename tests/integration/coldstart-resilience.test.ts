import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type SprintPlannerAppContext } from '../../server/src/app.js';
import { openDatabase } from '../../server/src/db/database.js';
import { getAppliedMigrations, runMigrations } from '../../server/src/db/migrations.js';
import { seedIfEmpty } from '../../server/src/db/seed.js';
import { TursoAdapter, withRetry } from '../../server/src/db/tursoAdapter.js';

async function listenApp(ctx: SprintPlannerAppContext): Promise<string> {
  const server = http.createServer(ctx.app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    throw new Error('Failed to bind ephemeral port');
  }
  const origClose = ctx.close;
  (ctx as unknown as { _httpServer?: http.Server })._httpServer = server;
  (ctx as unknown as { close: () => void }).close = () => {
    server.close();
    origClose();
  };
  return `http://127.0.0.1:${addr.port}`;
}

describe('QAE-171: Cold-Start E2E Resilience & Idempotent Migration Suite', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
  });

  it('runs idempotent schema migrations and seeding multiple times with zero duplicates', () => {
    const db = openDatabase(':memory:');
    cleanups.push(() => db.close());

    // First migration already ran inside openDatabase
    const secondRun = runMigrations(db);
    expect(secondRun.applied).toEqual([]);
    expect(secondRun.currentVersion).toBe(2);

    const thirdRun = runMigrations(db);
    expect(thirdRun.applied).toEqual([]);
    expect(getAppliedMigrations(db)).toHaveLength(2);

    // Seed 3 times — only first run inserts seed rows
    expect(seedIfEmpty(db)).toBe(true);
    expect(seedIfEmpty(db)).toBe(false);
    expect(seedIfEmpty(db)).toBe(false);

    const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM sprints').get() as { cnt: number };
    expect(Number(countRow.cnt)).toBeGreaterThanOrEqual(3);
  });

  it('survives simulated Vercel cold-start via Turso/libSQL file adapter with 0% data loss and <500ms first request', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lt-coldstart-'));
    cleanups.push(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

    const tursoBackingFile = path.join(tmpRoot, 'turso-cloud.db');
    const tursoUrl = `file:${tursoBackingFile}`;
    const localColdTmpA = path.join(tmpRoot, 'instance-a', 'tmp.db');
    const localColdTmpB = path.join(tmpRoot, 'instance-b', 'tmp.db');

    // Instance A: boot, create SPR-17, assign item, update status, sync to Turso
    const adapterA = new TursoAdapter({ url: tursoUrl });
    const ctxA = createApp({
      dbPath: localColdTmpA,
      seed: true,
      eventGatewayUrl: 'disabled',
      tursoAdapter: adapterA,
    });
    cleanups.push(() => ctxA.close());
    await ctxA.ready();
    const baseUrlA = await listenApp(ctxA);

    const createRes = await fetch(`${baseUrlA}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'SPR-TEST-COLD',
        name: 'Sprint Test — Cold-Start Resilience',
        goal: '0% data loss across cold-starts',
        status: 'active',
        startDate: '2026-12-01',
        endDate: '2026-12-12',
      }),
    });
    expect(createRes.status).toBe(201);

    const assignRes = await fetch(`${baseUrlA}/api/sprints/SPR-TEST-COLD/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: 'ARC-171',
        title: 'Turso/libSQL Cloud Adapter',
        storyPoints: 13,
        ownerDivision: 'architecture',
        ownerAgentId: 4,
      }),
    });
    expect(assignRes.status).toBe(200);

    await ctxA.syncToTurso();
    ctxA.close();

    // Simulate Vercel cold-start: Instance B boots with a brand-new empty local /tmp path
    const adapterB = new TursoAdapter({ url: tursoUrl });
    const ctxB = createApp({
      dbPath: localColdTmpB,
      seed: true,
      eventGatewayUrl: 'disabled',
      tursoAdapter: adapterB,
    });
    cleanups.push(() => ctxB.close());
    const baseUrlB = await listenApp(ctxB);

    const t0 = performance.now();
    const [healthRes, sprintRes] = await Promise.all([
      fetch(`${baseUrlB}/api/health`),
      fetch(`${baseUrlB}/api/sprints/SPR-TEST-COLD`),
    ]);
    const elapsedMs = performance.now() - t0;

    expect(healthRes.status).toBe(200);
    const healthJson = (await healthRes.json()) as {
      ok: boolean;
      persistence: string;
      turso: { configured: boolean; healthy: boolean };
    };
    expect(healthJson.ok).toBe(true);
    expect(healthJson.persistence).toBe('turso-libsql');
    expect(healthJson.turso.configured).toBe(true);
    expect(healthJson.turso.healthy).toBe(true);

    expect(sprintRes.status).toBe(200);
    const sprintJson = (await sprintRes.json()) as {
      sprint: { id: string; status: string; items: Array<{ itemId: string; storyPoints: number }> };
    };
    expect(sprintJson.sprint.id).toBe('SPR-TEST-COLD');
    expect(sprintJson.sprint.status).toBe('active');
    expect(sprintJson.sprint.items.some((i) => i.itemId === 'ARC-171' && i.storyPoints === 13)).toBe(
      true,
    );
    expect(elapsedMs).toBeLessThan(500);
  });

  it('retries transient errors with backoff and degrades gracefully on unreachable Turso', async () => {
    let attempts = 0;
    const value = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error('transient network blip');
        }
        return 'recovered';
      },
      { maxAttempts: 3, baseDelayMs: 5 },
    );
    expect(value).toBe('recovered');
    expect(attempts).toBe(3);

    const brokenAdapter = new TursoAdapter({ url: 'http://127.0.0.1:1', authToken: 'invalid' });
    const status = await brokenAdapter.checkHealth();
    expect(status.configured).toBe(true);
    expect(status.healthy).toBe(false);
    expect(status.error).toBeTruthy();
    await brokenAdapter.close();
  });
});
