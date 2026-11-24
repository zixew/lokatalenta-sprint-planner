import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  startAppServer,
  startMockBacklogServer,
  startMockGatewayServer,
} from '../helpers/testHarness.js';

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length > 0) {
    const fn = cleanups.pop()!;
    await fn();
  }
});

describe('Sprint Planner REST API & Integrations', () => {
  it('supports sprint lifecycle, capacity updates, ceremonies, summary, and Gateway HMAC telemetry', async () => {
    const gateway = await startMockGatewayServer('top-secret-key');
    cleanups.push(gateway.close);

    const backlog = await startMockBacklogServer([
      {
        id: 'BL-101',
        title: 'Build multi-floor telemetry',
        storyPoints: 5,
        ownerDivision: 'engineering',
        ownerAgentId: 5,
        status: 'ready',
        sprintId: null,
        priority: 'P0',
        moscow: 'Must',
      },
      {
        id: 'QAE-102',
        title: 'Verify WS/SSE replay',
        storyPoints: 3,
        ownerDivision: 'qa',
        ownerAgentId: 8,
        status: 'groomed',
        sprintId: null,
        priority: 'P1',
        moscow: 'Should',
      },
    ]);
    cleanups.push(backlog.close);

    const server = await startAppServer({
      dbPath: ':memory:',
      backlogApiUrl: backlog.urlWithApi, // test /api suffix normalization!
      eventGatewayUrl: gateway.url,
      gatewaySecret: 'top-secret-key',
    });
    cleanups.push(server.close);

    // 1. Health & Contracts
    const healthRes = await fetch(`${server.baseUrl}/api/health`);
    expect(healthRes.status).toBe(200);
    const health = (await healthRes.json()) as {
      ok: boolean;
      service: string;
      backlogApiUrl: string;
    };
    expect(health.ok).toBe(true);
    expect(health.service).toBe('lokatalenta-sprint-planner');
    expect(health.backlogApiUrl).toBe(backlog.url);

    const contractsRes = await fetch(`${server.baseUrl}/api/contracts`);
    expect(contractsRes.status).toBe(200);
    const contracts = (await contractsRes.json()) as {
      divisions: unknown[];
      agents: unknown[];
    };
    expect(contracts.divisions).toHaveLength(6);
    expect(contracts.agents).toHaveLength(24);

    // 2. Create Sprint
    const createRes = await fetch(`${server.baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'SPR-20',
        name: 'Sprint 20 — Integration',
        goal: 'Ship Sprint Planner with full telemetry',
        startDate: '2026-11-16',
        endDate: '2026-11-20',
        divisionCapacities: { engineering: 12, qa: 8 },
        agentCapacities: { '5': 7, '8': 5 },
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { sprint: { id: string; status: string } };
    expect(created.sprint.id).toBe('SPR-20');
    expect(created.sprint.status).toBe('planned');

    // Duplicate ID -> 409
    const dupRes = await fetch(`${server.baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'SPR-20',
        name: 'Dup',
        startDate: '2026-11-16',
        endDate: '2026-11-20',
      }),
    });
    expect(dupRes.status).toBe(409);

    // 3. Backlog Candidates & Assign (live Backlog with /api normalized!)
    const candidatesRes = await fetch(
      `${server.baseUrl}/api/sprints/SPR-20/backlog-candidates`,
    );
    expect(candidatesRes.status).toBe(200);
    const candidatesJson = (await candidatesRes.json()) as {
      candidates: Array<{ id: string }>;
      backlogSync: { synced: boolean };
    };
    expect(candidatesJson.backlogSync.synced).toBe(true);
    expect(candidatesJson.candidates.map((c) => c.id)).toEqual(['BL-101', 'QAE-102']);

    const assignRes = await fetch(`${server.baseUrl}/api/sprints/SPR-20/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'BL-101' }),
    });
    expect(assignRes.status).toBe(200);
    const assigned = (await assignRes.json()) as {
      assignment: {
        itemId: string;
        title: string;
        storyPoints: number;
        ownerDivision: string;
        ownerAgentId: number;
        backlogSynced: boolean;
      };
      backlogSync: { synced: boolean; statusCode: number };
    };
    expect(assigned.backlogSync.synced).toBe(true);
    expect(assigned.assignment.title).toBe('Build multi-floor telemetry');
    expect(assigned.assignment.storyPoints).toBe(5);
    expect(assigned.assignment.ownerDivision).toBe('engineering');
    expect(assigned.assignment.ownerAgentId).toBe(5);
    expect(backlog.requests.some((r) => r.method === 'PATCH' && r.url === '/api/items/BL-101')).toBe(
      true,
    );

    // 4. Start Sprint -> Update Capacity -> Complete Item -> Record Ceremony -> Complete Sprint
    const startRes = await fetch(`${server.baseUrl}/api/sprints/SPR-20`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(startRes.status).toBe(200);

    const capRes = await fetch(`${server.baseUrl}/api/sprints/SPR-20/capacity`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        divisionCapacities: { engineering: 15, qa: 10 },
        agentCapacities: { '5': 10 },
      }),
    });
    expect(capRes.status).toBe(200);

    const doneRes = await fetch(`${server.baseUrl}/api/sprints/SPR-20/items/BL-101`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'done',
        completedAt: '2026-11-18T15:00:00.000Z',
      }),
    });
    expect(doneRes.status).toBe(200);

    const ceremonyRes = await fetch(`${server.baseUrl}/api/sprints/SPR-20/ceremonies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'review',
        facilitatorAgentId: 2,
        notes: 'Reviewed BL-101 telemetry end-to-end.',
        actionItems: [
          'Verify 3D Office ticker updates',
          { text: 'Audit HMAC signature headers', ownerAgentId: 17, done: true },
        ],
      }),
    });
    expect(ceremonyRes.status).toBe(201);

    const completeRes = await fetch(`${server.baseUrl}/api/sprints/SPR-20`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(completeRes.status).toBe(200);

    // 5. Summary verification
    const summaryRes = await fetch(`${server.baseUrl}/api/sprints/SPR-20/summary`);
    expect(summaryRes.status).toBe(200);
    const summary = (await summaryRes.json()) as {
      totals: { committedPoints: number; completedPoints: number; completionRatePct: number };
      divisionBreakdown: unknown[];
      agentBreakdown: unknown[];
      velocity: { averageCompletedVelocity: number; completedSprintCount: number };
      burndown: Array<{ date: string; actualRemaining: number }>;
    };
    expect(summary.totals.committedPoints).toBe(5);
    expect(summary.totals.completedPoints).toBe(5);
    expect(summary.totals.completionRatePct).toBe(100);
    expect(summary.divisionBreakdown).toHaveLength(6);
    expect(summary.agentBreakdown).toHaveLength(24);
    expect(summary.velocity.completedSprintCount).toBe(1);
    expect(summary.velocity.averageCompletedVelocity).toBe(5);
    expect(summary.burndown.find((b) => b.date === '2026-11-18')?.actualRemaining).toBe(0);

    // 6. Verify all Gateway events passed strict 13-key schema + HMAC signature
    expect(gateway.authFailures).toEqual([]);
    const actions = gateway.events.map(
      (ev) => (ev.metadata as Record<string, unknown>).action,
    );
    expect(actions).toEqual([
      'sprint.created',
      'sprint.item_assigned',
      'sprint.started',
      'sprint.capacity_updated',
      'sprint.item_updated',
      'sprint.ceremony_recorded',
      'sprint.completed',
    ]);
  });

  it('degrades gracefully when Backlog API and Event Gateway are offline, 500, or timing out', async () => {
    const backlog = await startMockBacklogServer([]);
    cleanups.push(backlog.close);

    // Use a closed port for Gateway to verify fail-open resilience
    const tempServer = http.createServer();
    await new Promise<void>((resolve) => tempServer.listen(0, '127.0.0.1', () => resolve()));
    const closedPort = (tempServer.address() as AddressInfo).port;
    await new Promise<void>((resolve) => tempServer.close(() => resolve()));

    const server = await startAppServer({
      dbPath: ':memory:',
      backlogApiUrl: backlog.url,
      eventGatewayUrl: `http://127.0.0.1:${closedPort}`,
    });
    cleanups.push(server.close);

    const createRes = await fetch(`${server.baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'SPR-OFFLINE',
        name: 'Offline Resilient Sprint',
        startDate: '2026-11-16',
        endDate: '2026-11-22',
      }),
    });
    expect(createRes.status).toBe(201);

    // Simulate Backlog 500
    backlog.setMode('error500');
    const cand500 = await fetch(
      `${server.baseUrl}/api/sprints/SPR-OFFLINE/backlog-candidates`,
    );
    expect(cand500.status).toBe(200);
    const cand500Json = (await cand500.json()) as {
      candidates: unknown[];
      backlogSync: { synced: boolean; statusCode: number };
    };
    expect(cand500Json.candidates).toEqual([]);
    expect(cand500Json.backlogSync.synced).toBe(false);
    expect(cand500Json.backlogSync.statusCode).toBe(500);

    // Simulate Backlog timeout (>2000ms) during assign -> still persists locally with 200!
    backlog.setMode('timeout');
    const assignRes = await fetch(`${server.baseUrl}/api/sprints/SPR-OFFLINE/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: 'LOCAL-1',
        title: 'Local fallback story',
        storyPoints: 3,
        ownerDivision: 'devops',
        ownerAgentId: 11,
      }),
    });
    expect(assignRes.status).toBe(200);
    const assignJson = (await assignRes.json()) as {
      assignment: { itemId: string; backlogSynced: boolean };
      backlogSync: { synced: boolean; warning?: string };
    };
    expect(assignJson.assignment.itemId).toBe('LOCAL-1');
    expect(assignJson.assignment.backlogSynced).toBe(false);
    expect(assignJson.backlogSync.synced).toBe(false);
    expect(assignJson.backlogSync.warning).toBeTruthy();

    // Unassign works even when Backlog offline
    backlog.setMode('error500');
    const delRes = await fetch(
      `${server.baseUrl}/api/sprints/SPR-OFFLINE/items/LOCAL-1`,
      { method: 'DELETE' },
    );
    expect(delRes.status).toBe(200);
    const delJson = (await delRes.json()) as {
      removedItemId: string;
      backlogSync: { synced: boolean };
    };
    expect(delJson.removedItemId).toBe('LOCAL-1');
    expect(delJson.backlogSync.synced).toBe(false);
  });

  it('rejects invalid inputs with 400 and missing resources with 404', async () => {
    const server = await startAppServer({
      dbPath: ':memory:',
      eventGatewayUrl: 'disabled',
    });
    cleanups.push(server.close);

    // Malformed JSON -> 400
    const badJson = await fetch(`${server.baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });
    expect(badJson.status).toBe(400);

    // Invalid calendar date -> 400
    const badDate = await fetch(`${server.baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bad Date Sprint',
        startDate: '2026-02-30',
        endDate: '2026-03-05',
      }),
    });
    expect(badDate.status).toBe(400);

    // Missing sprint -> 404
    const missing = await fetch(`${server.baseUrl}/api/sprints/SPR-NONE`);
    expect(missing.status).toBe(404);

    // Create valid sprint for negative validation tests
    await fetch(`${server.baseUrl}/api/sprints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'SPR-VAL',
        name: 'Validation Sprint',
        startDate: '2026-11-16',
        endDate: '2026-11-20',
      }),
    });

    const badCap = await fetch(`${server.baseUrl}/api/sprints/SPR-VAL/capacity`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        divisionCapacities: { marketing: 10 },
      }),
    });
    expect(badCap.status).toBe(400);

    const badAgentCap = await fetch(`${server.baseUrl}/api/sprints/SPR-VAL/capacity`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentCapacities: { '24': 5 },
      }),
    });
    expect(badAgentCap.status).toBe(400);

    const badAssign = await fetch(`${server.baseUrl}/api/sprints/SPR-VAL/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: 'BL-BAD',
        ownerDivision: 'engineering',
        ownerAgentId: 99,
      }),
    });
    expect(badAssign.status).toBe(400);

    const badCeremony = await fetch(`${server.baseUrl}/api/sprints/SPR-VAL/ceremonies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'standup',
        facilitatorAgentId: 2,
        notes: 'Invalid type',
      }),
    });
    expect(badCeremony.status).toBe(400);
  });

  it('serves static client/dist with SPA fallback, JSON 404 for /api/*, and CORS headers', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sprint-planner-dist-'));
    cleanups.push(async () => fs.rmSync(tmpDir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(tmpDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'index.html'), '<html><body>SPA OK</body></html>');
    fs.writeFileSync(path.join(tmpDir, 'assets', 'app.js'), 'console.log("ok");');

    const server = await startAppServer({
      dbPath: ':memory:',
      eventGatewayUrl: 'disabled',
      clientDistDir: tmpDir,
      corsOrigins: ['https://*.vercel.app', 'http://localhost:*'],
    });
    cleanups.push(server.close);

    const rootRes = await fetch(`${server.baseUrl}/`);
    expect(rootRes.status).toBe(200);
    expect(await rootRes.text()).toContain('SPA OK');

    const spaRouteRes = await fetch(`${server.baseUrl}/sprints/SPR-15`);
    expect(spaRouteRes.status).toBe(200);
    expect(await spaRouteRes.text()).toContain('SPA OK');

    const assetRes = await fetch(`${server.baseUrl}/assets/app.js`);
    expect(assetRes.status).toBe(200);
    expect(await assetRes.text()).toContain('console.log');

    const apiMissingRes = await fetch(`${server.baseUrl}/api/does-not-exist`);
    expect(apiMissingRes.status).toBe(404);
    expect(apiMissingRes.headers.get('content-type')).toContain('application/json');

    const allowedCors = await fetch(`${server.baseUrl}/api/health`, {
      headers: { Origin: 'https://lokatalenta-sprint.vercel.app' },
    });
    expect(allowedCors.headers.get('access-control-allow-origin')).toBe(
      'https://lokatalenta-sprint.vercel.app',
    );

    const blockedCors = await fetch(`${server.baseUrl}/api/health`, {
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(blockedCors.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('exports a working Express app from api/index.ts for Vercel serverless deployment', async () => {
    const prevDbPath = process.env.DB_PATH;
    const prevGatewayUrl = process.env.EVENT_GATEWAY_URL;
    process.env.DB_PATH = ':memory:';
    process.env.EVENT_GATEWAY_URL = 'disabled';

    try {
      const mod = await import('../../api/index.js');
      const serverlessApp = mod.default;
      const srv = http.createServer(serverlessApp);
      await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', () => resolve()));
      const port = (srv.address() as AddressInfo).port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`);
        expect(res.status).toBe(200);
        const body = (await res.json()) as { ok: boolean; service: string };
        expect(body.ok).toBe(true);
        expect(body.service).toBe('lokatalenta-sprint-planner');

        const sprintsRes = await fetch(`http://127.0.0.1:${port}/api/sprints`);
        expect(sprintsRes.status).toBe(200);
        const sprintsBody = (await sprintsRes.json()) as { sprints: unknown[] };
        expect(sprintsBody.sprints.length).toBeGreaterThanOrEqual(2);
      } finally {
        await new Promise<void>((resolve) => srv.close(() => resolve()));
      }
    } finally {
      if (prevDbPath === undefined) delete process.env.DB_PATH;
      else process.env.DB_PATH = prevDbPath;
      if (prevGatewayUrl === undefined) delete process.env.EVENT_GATEWAY_URL;
      else process.env.EVENT_GATEWAY_URL = prevGatewayUrl;
    }
  });
});
