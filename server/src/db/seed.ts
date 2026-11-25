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
      'completed',
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
      'done',
      1,
      spr16Created,
      '2026-11-25T08:45:00.000Z',
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
    insertCeremony.run(
      'CER-SPR16-REV',
      'SPR-16',
      'review',
      0,
      'All 5 items (26 SP) verified live across Sprint Planner, Backlog, Docs Hub, and 3D Office.',
      '[]',
      '2026-11-25T09:00:00.000Z',
      '2026-11-25T09:00:00.000Z',
    );
    insertCeremony.run(
      'CER-SPR16-RETRO',
      'SPR-16',
      'retrospective',
      1,
      'Adopted 4-Pillar Sync SOP and Anti-Slop design standards (DESIGN.md). Identified Turso migration as #1 priority.',
      '[]',
      '2026-11-25T09:30:00.000Z',
      '2026-11-25T09:30:00.000Z',
    );

    // ==========================================
    // SPR-17 — COMPLETED (47 SP)
    // ==========================================
    const spr17Created = '2026-12-01T08:00:00.000Z';
    insertSprint.run(
      'SPR-17',
      'Sprint 17 — Architecture Hardening, Persistent Storage Migration & Anti-Slop UI Cohesion',
      '0% Data Loss & <500ms State Reconciliation on cold-start; Industrial Precision Workbench UI cohesion across 4 pillars.',
      'completed',
      '2026-12-01',
      '2026-12-12',
      spr17Created,
      '2026-12-12T17:00:00.000Z',
    );
    const spr17DivCaps = buildSeedDivisionCapacities(1);
    const spr17AgentCaps = buildSeedAgentCapacities(1);
    for (const div of CANONICAL_DIVISIONS) {
      insertDivCap.run('SPR-17', div.id, spr17DivCaps[div.id]);
    }
    for (const agent of CANONICAL_AGENTS) {
      insertAgentCap.run('SPR-17', agent.id, spr17AgentCaps[agent.id]);
    }
    insertItem.run(
      'SPR-17',
      'ARC-171',
      'Setup Turso/libSQL Cloud Database Adapter',
      13,
      'architecture',
      4,
      'done',
      1,
      spr17Created,
      '2026-12-08T15:00:00.000Z',
      '2026-12-08T15:00:00.000Z',
    );
    insertItem.run(
      'SPR-17',
      'BL-171',
      'DB Schema Migration Scripts & Idempotent Seeding',
      13,
      'engineering',
      6,
      'done',
      1,
      spr17Created,
      '2026-12-09T16:00:00.000Z',
      '2026-12-09T16:00:00.000Z',
    );
    insertItem.run(
      'SPR-17',
      'BL-172',
      'Anti-Slop UI Cohesion: Docked Tabs, Palette Tokens & Skeleton Loader',
      8,
      'engineering',
      5,
      'done',
      1,
      spr17Created,
      '2026-12-10T14:00:00.000Z',
      '2026-12-10T14:00:00.000Z',
    );
    insertItem.run(
      'SPR-17',
      'BL-173',
      'CSS Motion System: Transition Tokens, Drawer Spring & Reduced-Motion',
      5,
      'engineering',
      20,
      'done',
      1,
      spr17Created,
      '2026-12-11T11:00:00.000Z',
      '2026-12-11T11:00:00.000Z',
    );
    insertItem.run(
      'SPR-17',
      'QAE-171',
      'Cold-Start E2E Resilience Suite',
      8,
      'qa',
      8,
      'done',
      1,
      spr17Created,
      '2026-12-12T16:00:00.000Z',
      '2026-12-12T16:00:00.000Z',
    );
    insertCeremony.run(
      'CER-SPR17-PLAN',
      'SPR-17',
      'planning',
      2,
      'Sprint 17 locked for Turso/libSQL persistent storage migration (ARC-171, BL-171), Anti-Slop UI cohesion & motion system (BL-172, BL-173), and Cold-Start E2E resilience (QAE-171). Total 47 SP committed.',
      JSON.stringify([
        { text: 'Deploy Turso/libSQL adapter and verify cold-start hydration', ownerAgentId: 4, done: true },
        { text: 'Run idempotent schema migrations and verify 0 duplication', ownerAgentId: 6, done: true },
        { text: 'Implement anti-slop tokens, docked tabs, skeleton loader', ownerAgentId: 5, done: true },
        { text: 'Add CSS motion tokens and prefers-reduced-motion reset', ownerAgentId: 20, done: true },
        { text: 'Execute cold-start resilience test suite (21/21 passed)', ownerAgentId: 8, done: true },
      ]),
      spr17Created,
      '2026-12-01T08:30:00.000Z',
    );
    insertCeremony.run(
      'CER-SPR17-REV',
      'SPR-17',
      'review',
      0,
      'All 5 items (47/47 SP) verified live and complete across Sprint Planner, Backlog, Docs Hub, and 3D Office.',
      '[]',
      '2026-12-12T16:30:00.000Z',
      '2026-12-12T16:30:00.000Z',
    );
    insertCeremony.run(
      'CER-SPR17-RETRO',
      'SPR-17',
      'retrospective',
      1,
      'Sprint 17 Retro: Ephemeral /tmp storage risk mitigated with Turso cloud adapter. Anti-slop UI tokens resolved visual inconsistencies across all viewports.',
      '[]',
      '2026-12-12T17:00:00.000Z',
      '2026-12-12T17:00:00.000Z',
    );

    // ==========================================
    // SPR-18 — COMPLETED (102/102 SP)
    // ==========================================
    const spr18Created = '2026-12-15T08:00:00.000Z';
    const spr18Closed = '2026-12-26T17:00:00.000Z';
    insertSprint.run(
      'SPR-18',
      'Sprint 18 — Multi-Repo Turso Propagation, Privacy Guardrails & 3D Office Live Telemetry',
      'Propagate Turso/libSQL persistent storage to Backlog & Docs Hub, enforce candidate privacy guardrails (REC-001), and synchronize 3D Office live agent floor telemetry.',
      'completed',
      '2026-12-15',
      '2026-12-26',
      spr18Created,
      spr18Closed,
    );
    const spr18DivCaps = buildSeedDivisionCapacities(1);
    const spr18AgentCaps = buildSeedAgentCapacities(1);
    for (const div of CANONICAL_DIVISIONS) {
      insertDivCap.run('SPR-18', div.id, spr18DivCaps[div.id]);
    }
    for (const agent of CANONICAL_AGENTS) {
      insertAgentCap.run('SPR-18', agent.id, spr18AgentCaps[agent.id]);
    }
    insertItem.run(
      'SPR-18',
      'REC-001',
      'Stakeholder Rubric & Candidate Telemetry Privacy Guardrails',
      2,
      'executive',
      2,
      'done',
      1,
      spr18Created,
      spr18Closed,
      spr18Closed,
    );
    insertItem.run(
      'SPR-18',
      'ARC-181',
      'Propagate Turso/libSQL Adapter to Backlog & Docs Hub Services',
      13,
      'architecture',
      4,
      'done',
      1,
      spr18Created,
      spr18Closed,
      spr18Closed,
    );
    insertItem.run(
      'SPR-18',
      'BL-181',
      'Unified Schema Migrations & Cross-Service Seeding Runner',
      8,
      'engineering',
      6,
      'done',
      1,
      spr18Created,
      spr18Closed,
      spr18Closed,
    );
    insertItem.run(
      'SPR-18',
      'ECO-REVAMP',
      'Epic: Ecosystem-Wide Anti-Slop UI/UX Revamp — Industrial Precision Workbench',
      21,
      'executive',
      0,
      'done',
      1,
      spr18Created,
      spr18Closed,
      spr18Closed,
    );
    insertItem.run(
      'SPR-18',
      'BL-REVAMP-01',
      'Unified Design Tokens, Color Palette & Typography Engine',
      8,
      'engineering',
      5,
      'done',
      1,
      spr18Created,
      spr18Closed,
      spr18Closed,
    );
    insertItem.run(
      'SPR-18',
      'BL-REVAMP-02',
      'Component De-Slop: Flatten Nested Cards & Docked Segmented Rails',
      8,
      'engineering',
      6,
      'done',
      1,
      spr18Created,
      spr18Closed,
      spr18Closed,
    );
    insertItem.run(
      'SPR-18',
      'BL-REVAMP-03',
      'Ecosystem Fluid Motion, Spring Physics & Reduced-Motion Guardrail',
      5,
      'engineering',
      20,
      'done',
      1,
      spr18Created,
      spr18Closed,
      spr18Closed,
    );
    insertItem.run(
      'SPR-18',
      'BL-REVAMP-04',
      'Backlog Hub & Docs Hub Client Production UI Revamp',
      8,
      'engineering',
      5,
      'done',
      1,
      spr18Created,
      spr18Closed,
      spr18Closed,
    );
    insertItem.run(
      'SPR-18',
      'OFC-REVAMP-01',
      '3D Office HUD & Agent Overlay Anti-Slop Visual Harmonization',
      5,
      'engineering',
      9,
      'done',
      1,
      spr18Created,
      spr18Closed,
      spr18Closed,
    );
    insertItem.run(
      'SPR-18',
      'QAE-REVAMP-01',
      'Anti-Slop Compliance Audit & Multi-Viewport Visual QA (375px/768px/1280px+)',
      8,
      'qa',
      8,
      'done',
      1,
      spr18Created,
      spr18Closed,
      spr18Closed,
    );
    insertItem.run(
      'SPR-18',
      'OFC-181',
      '3D Office Live Agent Floor Telemetry & Event Gateway Sync',
      8,
      'engineering',
      9,
      'done',
      1,
      spr18Created,
      spr18Closed,
      spr18Closed,
    );
    insertItem.run(
      'SPR-18',
      'QAE-181',
      'Cross-Service Multi-Repo Cold-Start & Telemetry E2E Suite',
      8,
      'qa',
      8,
      'done',
      1,
      spr18Created,
      spr18Closed,
      spr18Closed,
    );
    insertCeremony.run(
      'CER-SPR18-PLAN',
      'SPR-18',
      'planning',
      2,
      'Sprint 18 locked for Multi-Repo Turso Propagation, Privacy Guardrails, Anti-Slop UI Revamp, and 3D Office Live Telemetry. Total 102 SP committed.',
      JSON.stringify([
        { text: 'Implement TursoAdapter in lokatalenta-backlog and lokatalenta-docs', ownerAgentId: 4, done: true },
        { text: 'Build unified schema migrations runner for backlog and docs', ownerAgentId: 6, done: true },
        { text: 'Ship anti-slop docked tabs and palette tokens across all apps', ownerAgentId: 5, done: true },
        { text: 'Establish privacy filters on candidate telemetry events', ownerAgentId: 2, done: true },
        { text: 'Connect 3D Office agent positions to Event Gateway stream', ownerAgentId: 9, done: true },
        { text: 'Execute cross-service cold-start resilience and telemetry E2E suite', ownerAgentId: 8, done: true },
      ]),
      spr18Created,
      '2026-12-15T08:30:00.000Z',
    );
    insertCeremony.run(
      'CER-SPR18-REV',
      'SPR-18',
      'review',
      0,
      'Sprint 18 completed with 100% velocity (102/102 SP). Anti-slop UI tokens, Turso persistence, and 3D live telemetry all validated.',
      JSON.stringify([
        { text: 'Archive Sprint 18 deliverables into ecosystem audit log', ownerAgentId: 12, done: true },
        { text: 'Confirm live production zero-downtime deployment for all services', ownerAgentId: 10, done: true },
      ]),
      spr18Closed,
      '2026-12-26T15:30:00.000Z',
    );
    insertCeremony.run(
      'CER-SPR18-RET',
      'SPR-18',
      'retrospective',
      1,
      'Sprint 18 Retrospective: Excellent visual overhaul execution and testing rigor. Transitioning to Sprint 19 AI Evaluation Pipelines.',
      JSON.stringify([
        { text: 'Formalize Sprint 18 closure documentation on Docs Hub', ownerAgentId: 12, done: true },
        { text: 'Prepare Sprint 19 candidate matching backlog items', ownerAgentId: 2, done: true },
      ]),
      spr18Closed,
      '2026-12-26T16:30:00.000Z',
    );

    // ==========================================
    // SPR-19 — ACTIVE (47 SP COMMITTED)
    // ==========================================
    const spr19Created = '2026-12-27T08:00:00.000Z';
    insertSprint.run(
      'SPR-19',
      'Sprint 19 — AI Candidate Evaluation Pipelines & High-Throughput Matching',
      'Implement decoupled asynchronous AI evaluation scoring pipeline, automated multi-criteria rubrics, 3D Office AI Lab telemetry visualizer, and candidate batch ingestion with ethical governance.',
      'active',
      '2026-12-27',
      '2027-01-09',
      spr19Created,
      '2026-12-27T09:00:00.000Z',
    );
    const spr19DivCaps = buildSeedDivisionCapacities(1);
    const spr19AgentCaps = buildSeedAgentCapacities(1);
    for (const div of CANONICAL_DIVISIONS) {
      insertDivCap.run('SPR-19', div.id, spr19DivCaps[div.id]);
    }
    for (const agent of CANONICAL_AGENTS) {
      insertAgentCap.run('SPR-19', agent.id, spr19AgentCaps[agent.id]);
    }
    insertItem.run(
      'SPR-19',
      'ARC-191',
      'AI Evaluation Pipeline Engine & Asynchronous Scoring Worker',
      13,
      'architecture',
      4,
      'in_sprint',
      1,
      spr19Created,
      null,
      spr19Created,
    );
    insertItem.run(
      'SPR-19',
      'BL-191',
      'Automated Multi-Criteria Scoring Rubrics & Candidate Match UI',
      8,
      'engineering',
      5,
      'in_sprint',
      1,
      spr19Created,
      null,
      spr19Created,
    );
    insertItem.run(
      'SPR-19',
      'BL-192',
      'High-Throughput Candidate Batch Ingestion & CSV Export API',
      8,
      'engineering',
      6,
      'in_sprint',
      1,
      spr19Created,
      null,
      spr19Created,
    );
    insertItem.run(
      'SPR-19',
      'OFC-191',
      '3D Office AI Research Lab Live Evaluation HUD & Visual Indicators',
      5,
      'engineering',
      9,
      'in_sprint',
      1,
      spr19Created,
      null,
      spr19Created,
    );
    insertItem.run(
      'SPR-19',
      'QAE-191',
      'AI Assessment Pipeline E2E Load Test & Deterministic Scoring Validation',
      8,
      'qa',
      8,
      'in_sprint',
      1,
      spr19Created,
      null,
      spr19Created,
    );
    insertItem.run(
      'SPR-19',
      'REC-191',
      'Talent Benchmark Governance & Ethical Evaluation Rubric Charter',
      5,
      'executive',
      2,
      'in_sprint',
      1,
      spr19Created,
      null,
      spr19Created,
    );
    insertCeremony.run(
      'CER-SPR19-PLAN',
      'SPR-19',
      'planning',
      2,
      'Sprint 19 committed for AI Evaluation Pipeline Engine (ARC-191), Automated Multi-Criteria Rubrics (BL-191), Batch Ingestion API (BL-192), 3D Office AI Lab HUD (OFC-191), E2E Assessment Test Suite (QAE-191), and Ethical Rubric Charter (REC-191). Total 47 SP committed.',
      JSON.stringify([
        { text: 'Design asynchronous candidate scoring worker queue (ARC-191)', ownerAgentId: 4, done: false },
        { text: 'Build interactive rubric evaluator and match UI (BL-191)', ownerAgentId: 5, done: false },
        { text: 'Implement candidate batch CSV ingestion endpoint (BL-192)', ownerAgentId: 6, done: false },
        { text: 'Harmonize Floor 3 AI Lab visualization with real-time scoring activity (OFC-191)', ownerAgentId: 9, done: false },
        { text: 'Execute AI assessment determinism and stress test suite (QAE-191)', ownerAgentId: 8, done: false },
        { text: 'Publish ethical AI evaluation charter to Docs Hub (REC-191)', ownerAgentId: 2, done: false },
      ]),
      spr19Created,
      '2026-12-27T08:30:00.000Z',
    );
  });

  return true;
}
