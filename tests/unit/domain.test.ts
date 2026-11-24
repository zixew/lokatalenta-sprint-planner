import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isOriginAllowed,
  normalizeBacklogBaseUrl,
  normalizeGatewayBaseUrl,
  parseCorsOrigins,
  resolveDbPath,
  VERCEL_SQLITE_DB_PATH,
} from '../../server/src/config.js';
import {
  CANONICAL_AGENTS,
  CANONICAL_DIVISIONS,
  isValidAgentId,
  isValidDivision,
} from '../../server/src/contracts/canonical.js';
import {
  computeBurndown,
  computeLoadVsCapacity,
  computeVelocity,
} from '../../server/src/domain/summary.js';
import {
  ApiError,
  parseCalendarDate,
  validateActionItems,
  validateAssignItemBody,
  validateCeremonyBody,
} from '../../server/src/domain/validation.js';
import { isSafeHttpUrl, sanitizeUserText } from '../../client/src/lib/securityGuards.js';

describe('Canonical contracts & config normalization', () => {
  it('embeds all 6 canonical divisions and 24 canonical agents (0..23)', () => {
    expect(CANONICAL_DIVISIONS).toHaveLength(6);
    expect(CANONICAL_AGENTS).toHaveLength(24);
    expect(CANONICAL_AGENTS.map((a) => a.id)).toEqual(
      Array.from({ length: 24 }, (_, idx) => idx),
    );
    expect(isValidDivision('engineering')).toBe(true);
    expect(isValidDivision('marketing')).toBe(false);
    expect(isValidAgentId(0)).toBe(true);
    expect(isValidAgentId(23)).toBe(true);
    expect(isValidAgentId(-1)).toBe(false);
    expect(isValidAgentId(24)).toBe(false);
    expect(isValidAgentId(1.5)).toBe(false);
  });

  it('normalizes BACKLOG_API_URL stripping trailing slashes and /api suffix', () => {
    expect(normalizeBacklogBaseUrl(undefined)).toBe('http://localhost:4102');
    expect(normalizeBacklogBaseUrl('')).toBe('http://localhost:4102');
    expect(normalizeBacklogBaseUrl('http://localhost:4102')).toBe('http://localhost:4102');
    expect(normalizeBacklogBaseUrl('http://localhost:4102/')).toBe('http://localhost:4102');
    expect(normalizeBacklogBaseUrl('http://localhost:4102/api')).toBe('http://localhost:4102');
    expect(normalizeBacklogBaseUrl('http://localhost:4102/api/')).toBe('http://localhost:4102');
    expect(normalizeBacklogBaseUrl('http://127.0.0.1:55123/api/')).toBe(
      'http://127.0.0.1:55123',
    );
  });

  it('normalizes EVENT_GATEWAY_URL and supports disabled state', () => {
    expect(normalizeGatewayBaseUrl(undefined)).toBe('http://localhost:4101');
    expect(normalizeGatewayBaseUrl('http://localhost:4101/')).toBe('http://localhost:4101');
    expect(normalizeGatewayBaseUrl('')).toBe('');
    expect(normalizeGatewayBaseUrl('disabled')).toBe('');
  });

  it('resolves SQLite DB path for VERCEL=1, explicit DB_PATH, and local default', () => {
    expect(resolveDbPath({ VERCEL: '1' })).toBe(VERCEL_SQLITE_DB_PATH);
    expect(
      resolveDbPath({ VERCEL: '1', DB_PATH: '/custom/override.db' }),
    ).toBe('/custom/override.db');
    expect(resolveDbPath({})).toBe(
      path.resolve(process.cwd(), 'data/lokatalenta-sprint-planner.db'),
    );
  });

  it('matches CORS_ORIGINS patterns for vercel.app, localhost:*, and explicit origins', () => {
    const defaultOrigins = parseCorsOrigins(undefined);
    expect(isOriginAllowed(undefined, defaultOrigins)).toBe(true);
    expect(isOriginAllowed('http://localhost:4113', defaultOrigins)).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:4103', defaultOrigins)).toBe(true);
    expect(isOriginAllowed('https://lokatalenta-sprint.vercel.app', defaultOrigins)).toBe(
      true,
    );
    expect(isOriginAllowed('https://evil.example.com', defaultOrigins)).toBe(false);

    const custom = parseCorsOrigins('https://custom.domain.dev, *.vercel.app, localhost:*');
    expect(isOriginAllowed('https://custom.domain.dev', custom)).toBe(true);
    expect(isOriginAllowed('https://preview-123.vercel.app', custom)).toBe(true);
    expect(isOriginAllowed('http://localhost:5173', custom)).toBe(true);
    expect(isOriginAllowed('https://attacker.dev', custom)).toBe(false);
  });
});

describe('Domain validation & analytics math', () => {
  it('validates calendar dates strictly without rollover', () => {
    expect(parseCalendarDate('2024-02-29', 'startDate')).toBe('2024-02-29');
    expect(() => parseCalendarDate('2026-02-29', 'startDate')).toThrow(ApiError);
    expect(() => parseCalendarDate('2026-02-30', 'startDate')).toThrow(ApiError);
    expect(() => parseCalendarDate('2026-13-01', 'startDate')).toThrow(ApiError);
  });

  it('validates ceremony actionItems as strings or { text, ownerAgentId?, done? }', () => {
    expect(
      validateActionItems([
        'Keep bundle < 250 kB',
        { text: 'Verify gateway HMAC', ownerAgentId: 17, done: true },
      ]),
    ).toEqual([
      { text: 'Keep bundle < 250 kB', ownerAgentId: null, done: false },
      { text: 'Verify gateway HMAC', ownerAgentId: 17, done: true },
    ]);

    expect(() => validateActionItems(['   '])).toThrow(ApiError);
    expect(() => validateActionItems([{ text: 'Bad owner', ownerAgentId: 99 }])).toThrow(
      ApiError,
    );
    expect(() =>
      validateCeremonyBody({
        type: 'standup',
        facilitatorAgentId: 2,
        notes: 'Notes',
      }),
    ).toThrow(ApiError);
  });

  it('derives ownerDivision from ownerAgentId when division is omitted', () => {
    const parsed = validateAssignItemBody({
      itemId: 'QAE-99',
      ownerAgentId: 8,
      storyPoints: 5,
    });
    expect(parsed.ownerDivision).toBe('qa');
  });

  it('computes deterministic daily burndown including 1-day sprint & date clamping', () => {
    const burndown = computeBurndown('2026-11-16', '2026-11-20', 10, [
      {
        itemId: 'A',
        title: 'Early item',
        storyPoints: 3,
        ownerDivision: 'engineering',
        ownerAgentId: 5,
        status: 'done',
        completedAt: '2026-11-17T12:00:00.000Z',
        updatedAt: '2026-11-17T12:00:00.000Z',
      },
      {
        itemId: 'B',
        title: 'Late clamped item',
        storyPoints: 7,
        ownerDivision: 'qa',
        ownerAgentId: 8,
        status: 'done',
        completedAt: '2026-11-25T10:00:00.000Z',
        updatedAt: '2026-11-25T10:00:00.000Z',
      },
    ]);

    expect(burndown.map((p) => p.idealRemaining)).toEqual([10, 7.5, 5, 2.5, 0]);
    expect(burndown.map((p) => p.actualRemaining)).toEqual([10, 7, 7, 7, 0]);

    const oneDay = computeBurndown('2026-11-16', '2026-11-16', 5, []);
    expect(oneDay).toEqual([
      {
        dayIndex: 0,
        date: '2026-11-16',
        idealRemaining: 0,
        actualRemaining: 5,
        completedOnDay: 0,
      },
    ]);
  });

  it('computes multi-sprint velocity over completed sprints while listing active sprints', () => {
    const velocity = computeVelocity([
      {
        id: 'SPR-1',
        name: 'S1',
        status: 'completed',
        startDate: '2026-10-01',
        endDate: '2026-10-10',
        committedPoints: 20,
        completedPoints: 18,
      },
      {
        id: 'SPR-2',
        name: 'S2',
        status: 'completed',
        startDate: '2026-10-11',
        endDate: '2026-10-20',
        committedPoints: 25,
        completedPoints: 22,
      },
      {
        id: 'SPR-3',
        name: 'S3',
        status: 'active',
        startDate: '2026-10-21',
        endDate: '2026-10-30',
        committedPoints: 30,
        completedPoints: 10,
      },
      {
        id: 'SPR-4',
        name: 'S4',
        status: 'planned',
        startDate: '2026-11-01',
        endDate: '2026-11-10',
        committedPoints: 15,
        completedPoints: 0,
      },
    ]);

    expect(velocity.completedSprintCount).toBe(2);
    expect(velocity.averageCompletedVelocity).toBe(20);
    expect(velocity.series.map((s) => s.sprintId)).toEqual(['SPR-1', 'SPR-2', 'SPR-3']);
  });

  it('computes 6-division & 24-agent load vs capacity with overallocation detection', () => {
    const divCaps = {
      executive: 10,
      architecture: 10,
      engineering: 5,
      qa: 10,
      devops: 10,
      lounge: 10,
    };
    const agentCaps = Object.fromEntries(
      Array.from({ length: 24 }, (_, idx) => [idx, idx === 5 ? 4 : 5]),
    );
    const { divisionBreakdown, agentBreakdown } = computeLoadVsCapacity(
      divCaps,
      agentCaps,
      [
        {
          itemId: 'BL-1',
          title: 'Overload',
          storyPoints: 8,
          ownerDivision: 'engineering',
          ownerAgentId: 5,
          status: 'in_progress',
          completedAt: null,
          updatedAt: '2026-11-16T00:00:00.000Z',
        },
      ],
    );

    expect(divisionBreakdown).toHaveLength(6);
    expect(agentBreakdown).toHaveLength(24);
    const eng = divisionBreakdown.find((d) => d.divisionId === 'engineering')!;
    expect(eng.overCapacity).toBe(true);
    expect(eng.utilizationPct).toBe(160);
    const agent5 = agentBreakdown.find((a) => a.agentId === 5)!;
    expect(agent5.overCapacity).toBe(true);
    expect(agent5.utilizationPct).toBe(200);
  });

  it('sanitizes user text and rejects unsafe URLs in client securityGuards', () => {
    expect(sanitizeUserText('<script>alert(1)</script>Hello javascript:bad onclick=x')).toBe(
      'alert(1)Hello bad x',
    );
    expect(isSafeHttpUrl('http://localhost:4103')).toBe(true);
    expect(isSafeHttpUrl('https://sprint.vercel.app')).toBe(true);
    expect(isSafeHttpUrl('/sprints')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('//evil.com')).toBe(false);
  });
});
