import type { DatabaseSync } from 'node:sqlite';
import { CANONICAL_AGENTS, CANONICAL_DIVISIONS, type DivisionId } from '../contracts/canonical.js';
import { runInTransaction, toPlain } from './database.js';

function buildSeedDivisionCapacities(multiplier: number): Record<DivisionId, number> {
  return {
    executive: Math.round(12 * multiplier),
    architecture: Math.round(18 * multiplier),
    engineering: Math.round(35 * multiplier),
    qa: Math.round(24 * multiplier),
    devops: Math.round(25 * multiplier),
    lounge: Math.round(16 * multiplier),
  };
}

function buildSeedAgentCapacities(multiplier: number): Record<number, number> {
  const result: Record<number, number> = {};
  for (const agent of CANONICAL_AGENTS) {
    const base =
      agent.divisionId === 'engineering'
        ? 10
        : agent.divisionId === 'qa' || agent.divisionId === 'architecture'
          ? 9
          : agent.divisionId === 'devops'
            ? 7
            : 6;
    result[agent.id] = Math.round(base * multiplier);
  }
  return result;
}

export function seedIfEmpty(db: DatabaseSync): boolean {
  const row = toPlain<{ count: number }>(
    db.prepare('SELECT COUNT(*) AS count FROM sprints').get(),
  );
  if (row.count > 0) {
    return false;
  }

  runInTransaction(db, () => {
    const insertSprint = db.prepare(`
      INSERT INTO sprints (id, name, goal, status, start_date, end_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertDivCap = db.prepare(`
      INSERT INTO sprint_division_capacities (sprint_id, division_id, capacity_points)
      VALUES (?, ?, ?)
    `);
    const insertAgentCap = db.prepare(`
      INSERT INTO sprint_agent_capacities (sprint_id, agent_id, capacity_points)
      VALUES (?, ?, ?)
    `);
    const insertItem = db.prepare(`
      INSERT INTO sprint_items (
        sprint_id, item_id, title, story_points, owner_division, owner_agent_id,
        status, backlog_synced, assigned_at, completed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertCeremony = db.prepare(`
      INSERT INTO sprint_ceremonies (
        id, sprint_id, type, facilitator_agent_id, notes, action_items_json, recorded_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const spr14Created = '2026-11-01T08:00:00.000Z';
    insertSprint.run(
      'SPR-14',
      'Sprint 14 — Core LMS Telemetry & Contracts',
      'Establish canonical 6-division / 24-agent contracts and non-blocking LMS telemetry.',
      'completed',
      '2026-11-02',
      '2026-11-13',
      spr14Created,
      '2026-11-13T17:00:00.000Z',
    );
    const spr14DivCaps = buildSeedDivisionCapacities(1);
    const spr14AgentCaps = buildSeedAgentCapacities(1);
    for (const div of CANONICAL_DIVISIONS) {
      insertDivCap.run('SPR-14', div.id, spr14DivCaps[div.id]);
    }
    for (const agent of CANONICAL_AGENTS) {
      insertAgentCap.run('SPR-14', agent.id, spr14AgentCaps[agent.id]);
    }
    insertItem.run(
      'SPR-14',
      'ARC-101',
      'Publish canonical 24-agent and 6-division JSON contracts',
      8,
      'architecture',
      4,
      'done',
      1,
      '2026-11-02T09:00:00.000Z',
      '2026-11-05T16:00:00.000Z',
      '2026-11-05T16:00:00.000Z',
    );
    insertItem.run(
      'SPR-14',
      'BL-102',
      'Implement non-blocking LMS telemetry emitter with PII scrubbing',
      13,
      'engineering',
      6,
      'done',
      1,
      '2026-11-02T09:30:00.000Z',
      '2026-11-09T15:00:00.000Z',
      '2026-11-09T15:00:00.000Z',
    );
    insertItem.run(
      'SPR-14',
      'QAE-103',
      'Automate contract schema regression test suite',
      8,
      'qa',
      8,
      'done',
      1,
      '2026-11-03T10:00:00.000Z',
      '2026-11-12T14:00:00.000Z',
      '2026-11-12T14:00:00.000Z',
    );
    insertCeremony.run(
      'CER-SPR14-RETRO',
      'SPR-14',
      'retrospective',
      2,
      'Canonical contracts stabilized zero-drift cross-app schema validation across all 6 divisions.',
      JSON.stringify([
        { text: 'Preserve fail-open telemetry timeouts under 1500ms', ownerAgentId: 22, done: true },
        { text: 'Sync Sprint 15 backlog candidates prior to kickoff', ownerAgentId: 2, done: true },
      ]),
      '2026-11-13T16:30:00.000Z',
      '2026-11-13T16:30:00.000Z',
    );

    const spr15Created = '2026-11-16T08:00:00.000Z';
    insertSprint.run(
      'SPR-15',
      'Sprint 15 — Decoupled Ecosystem & 3D Telemetry',
      'Deliver Backlog, Sprint Planner, Docs Hub, and real-time Event Gateway integration.',
      'completed',
      '2026-11-16',
      '2026-11-27',
      spr15Created,
      '2026-11-25T09:00:00.000Z',
    );
    const spr15DivCaps = buildSeedDivisionCapacities(1);
    const spr15AgentCaps = buildSeedAgentCapacities(1);
    for (const div of CANONICAL_DIVISIONS) {
      insertDivCap.run('SPR-15', div.id, spr15DivCaps[div.id]);
    }
    for (const agent of CANONICAL_AGENTS) {
      insertAgentCap.run('SPR-15', agent.id, spr15AgentCaps[agent.id]);
    }
    insertItem.run(
      'SPR-15',
      'ECO-201',
      'Deploy Unified Ecosystem Switcher bar across all standalone apps',
      5,
      'engineering',
      5,
      'done',
      0,
      '2026-11-16T09:15:00.000Z',
      '2026-11-18T17:30:00.000Z',
      '2026-11-18T17:30:00.000Z',
    );
    insertItem.run(
      'SPR-15',
      'ARC-202',
      'Define Event Gateway WS/SSE snapshot and delta fan-out contract',
      8,
      'architecture',
      3,
      'done',
      0,
      '2026-11-16T10:00:00.000Z',
      '2026-11-20T15:00:00.000Z',
      '2026-11-20T15:00:00.000Z',
    );
    insertItem.run(
      'SPR-15',
      'BL-203',
      'Implement resilient Backlog API sync with offline fallback',
      8,
      'engineering',
      19,
      'done',
      0,
      '2026-11-17T08:30:00.000Z',
      '2026-11-24T14:30:00.000Z',
      '2026-11-24T14:30:00.000Z',
    );
    insertItem.run(
      'SPR-15',
      'QAE-204',
      'Execute ephemeral port integration tests for Sprint Planner & Gateway',
      5,
      'qa',
      8,
      'done',
      0,
      '2026-11-18T09:00:00.000Z',
      '2026-11-24T16:00:00.000Z',
      '2026-11-24T16:00:00.000Z',
    );
    insertItem.run(
      'SPR-15',
      'OPS-205',
      'Verify HMAC-SHA256 telemetry signing and SRE latency thresholds',
      5,
      'devops',
      17,
      'done',
      0,
      '2026-11-19T11:00:00.000Z',
      '2026-11-24T17:15:00.000Z',
      '2026-11-24T17:15:00.000Z',
    );
    insertItem.run(
      'SPR-15',
      'UX-206',
      'Validate recruiter and educator journey across decoupled switcher',
      5,
      'lounge',
      23,
      'done',
      0,
      '2026-11-19T13:00:00.000Z',
      '2026-11-24T18:00:00.000Z',
      '2026-11-24T18:00:00.000Z',
    );
    insertCeremony.run(
      'CER-SPR15-PLAN',
      'SPR-15',
      'planning',
      2,
      'Committed 36 SP across 6 divisions with explicit capacity buffers for E2E verification.',
      JSON.stringify([
        { text: 'Keep client JS chunks strictly under 250 kB', ownerAgentId: 18, done: true },
        { text: 'Verify offline fallback when Backlog port 4102 is unreachable', ownerAgentId: 8, done: true },
      ]),
      '2026-11-16T09:00:00.000Z',
      '2026-11-24T18:00:00.000Z',
    );

    const spr16Created = '2026-11-24T12:00:00.000Z';
    insertSprint.run(
      'SPR-16',
      'Sprint 16 — Tech Debt, Complex Responsive & 3-POV QA',
      'Enforce 100% free-access policy, audit Mermaid/ELK & serverless /tmp tech debt, and execute 375px/768px/1280px+ 3-POV QA.',
      'active',
      '2026-11-30',
      '2026-12-11',
      spr16Created,
      '2026-11-25T09:00:00.000Z',
    );
    const spr16DivCaps = buildSeedDivisionCapacities(1);
    const spr16AgentCaps = buildSeedAgentCapacities(1);
    for (const div of CANONICAL_DIVISIONS) {
      insertDivCap.run('SPR-16', div.id, spr16DivCaps[div.id]);
    }
    for (const agent of CANONICAL_AGENTS) {
      insertAgentCap.run('SPR-16', agent.id, spr16AgentCaps[agent.id]);
    }
    insertItem.run(
      'SPR-16',
      'FREE-001',
      'Enforce 100% Free-Access Policy & Zero Paywall Guardrails',
      3,
      'executive',
      1,
      'done',
      1,
      spr16Created,
      '2026-11-24T19:00:00.000Z',
      '2026-11-24T19:00:00.000Z',
    );
    insertItem.run(
      'SPR-16',
      'DEBT-161',
      'Audit Mermaid/ELK Chunk Budget & Serverless /tmp SQLite Persistence',
      5,
      'architecture',
      4,
      'done',
      1,
      spr16Created,
      '2026-11-24T20:30:00.000Z',
      '2026-11-24T20:30:00.000Z',
    );
    insertItem.run(
      'SPR-16',
      'QAE-161',
      'Sprint 16 Complex Responsive Matrix (375px/768px/1280px+) & 3-POV E2E Suite',
      8,
      'qa',
      8,
      'done',
      1,
      spr16Created,
      '2026-11-25T01:15:00.000Z',
      '2026-11-25T01:15:00.000Z',
    );
    insertItem.run(
      'SPR-16',
      'SEC-161',
      'Multi-Step Race Condition, XSS/CSV Injection & State Recovery Verification',
      5,
      'devops',
      17,
      'done',
      1,
      spr16Created,
      '2026-11-25T01:40:00.000Z',
      '2026-11-25T01:40:00.000Z',
    );
    insertItem.run(
      'SPR-16',
      'UX-161',
      'Verify 3-POV (Student/Candidate, Teacher/Recruiter, Admin) Responsive Journeys',
      5,
      'lounge',
      13,
      'review',
      1,
      spr16Created,
      null,
      '2026-11-25T08:45:00.000Z',
    );
    insertCeremony.run(
      'CER-SPR16-PLAN',
      'SPR-16',
      'planning',
      2,
      'Sprint 16 locked for 100% Free-Access governance, tech debt mitigation, and complex 375px/768px/1280px+ 3-POV QA.',
      JSON.stringify([
        { text: 'Verify 0 horizontal overflow on 375px mobile across all apps', ownerAgentId: 7, done: true },
        { text: 'Verify XSS, CSV injection, race conditions, and state recovery', ownerAgentId: 17, done: true },
      ]),
      spr16Created,
      '2026-11-25T08:45:00.000Z',
    );
  });

  return true;
}
