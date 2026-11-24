import {
  CANONICAL_AGENTS,
  CANONICAL_DIVISIONS,
  type DivisionId,
  type SprintItemStatus,
  type SprintStatus,
} from '../contracts/canonical.js';

export interface SummaryItemInput {
  readonly itemId: string;
  readonly title: string;
  readonly storyPoints: number;
  readonly ownerDivision: DivisionId;
  readonly ownerAgentId: number | null;
  readonly status: SprintItemStatus;
  readonly completedAt: string | null;
  readonly updatedAt: string;
}

export interface VelocitySprintInput {
  readonly id: string;
  readonly name: string;
  readonly status: SprintStatus;
  readonly startDate: string;
  readonly endDate: string;
  readonly committedPoints: number;
  readonly completedPoints: number;
}

export interface BurndownPoint {
  readonly dayIndex: number;
  readonly date: string;
  readonly idealRemaining: number;
  readonly actualRemaining: number;
  readonly completedOnDay: number;
}

export interface DivisionBreakdownItem {
  readonly divisionId: DivisionId;
  readonly name: string;
  readonly shortName: string;
  readonly color: string;
  readonly defaultFloor: 1 | 2 | 3;
  readonly capacityPoints: number;
  readonly committedPoints: number;
  readonly completedPoints: number;
  readonly remainingPoints: number;
  readonly utilizationPct: number;
  readonly overCapacity: boolean;
  readonly itemCount: number;
}

export interface AgentBreakdownItem {
  readonly agentId: number;
  readonly name: string;
  readonly shortName: string;
  readonly divisionId: DivisionId;
  readonly role: string;
  readonly avatar: string;
  readonly capacityPoints: number;
  readonly committedPoints: number;
  readonly completedPoints: number;
  readonly remainingPoints: number;
  readonly utilizationPct: number;
  readonly overCapacity: boolean;
  readonly itemCount: number;
}

export interface VelocitySeriesItem {
  readonly sprintId: string;
  readonly name: string;
  readonly status: SprintStatus;
  readonly startDate: string;
  readonly endDate: string;
  readonly committedPoints: number;
  readonly completedPoints: number;
}

export interface VelocitySummary {
  readonly series: VelocitySeriesItem[];
  readonly completedSprintCount: number;
  readonly averageCompletedVelocity: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function enumerateUtcDays(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  let cursor = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  const days: string[] = [];

  while (cursor <= endMs) {
    const dt = new Date(cursor);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    days.push(`${yyyy}-${mm}-${dd}`);
    cursor += 86_400_000;
  }

  return days.length > 0 ? days : [startDate];
}

export function computeBurndown(
  startDate: string,
  endDate: string,
  committedPoints: number,
  items: readonly SummaryItemInput[],
): BurndownPoint[] {
  const days = enumerateUtcDays(startDate, endDate);
  const totalDays = days.length;
  const completedByDay = new Map<string, number>();

  for (const item of items) {
    if (item.status !== 'done') {
      continue;
    }
    const rawDay = (item.completedAt ?? item.updatedAt).slice(0, 10);
    const effectiveDay =
      rawDay < startDate ? startDate : rawDay > endDate ? endDate : rawDay;
    completedByDay.set(
      effectiveDay,
      round2((completedByDay.get(effectiveDay) ?? 0) + item.storyPoints),
    );
  }

  let burnedCumulative = 0;
  return days.map((date, dayIndex) => {
    const idealRemaining =
      totalDays === 1
        ? 0
        : round2(committedPoints * (1 - dayIndex / (totalDays - 1)));
    const completedOnDay = completedByDay.get(date) ?? 0;
    burnedCumulative = round2(burnedCumulative + completedOnDay);
    const actualRemaining = round2(Math.max(0, committedPoints - burnedCumulative));

    return {
      dayIndex,
      date,
      idealRemaining,
      actualRemaining,
      completedOnDay,
    };
  });
}

export function computeVelocity(
  sprints: readonly VelocitySprintInput[],
): VelocitySummary {
  const relevant = sprints.filter(
    (sprint) => sprint.status === 'completed' || sprint.status === 'active',
  );
  const series: VelocitySeriesItem[] = relevant.map((sprint) => ({
    sprintId: sprint.id,
    name: sprint.name,
    status: sprint.status,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    committedPoints: round2(sprint.committedPoints),
    completedPoints: round2(sprint.completedPoints),
  }));

  const completed = series.filter((s) => s.status === 'completed');
  const completedSprintCount = completed.length;
  const totalCompletedPoints = completed.reduce(
    (acc, s) => acc + s.completedPoints,
    0,
  );
  const averageCompletedVelocity =
    completedSprintCount > 0 ? round1(totalCompletedPoints / completedSprintCount) : 0;

  return {
    series,
    completedSprintCount,
    averageCompletedVelocity,
  };
}

export function computeLoadVsCapacity(
  divisionCapacities: Readonly<Record<DivisionId, number>>,
  agentCapacities: Readonly<Record<number, number>>,
  items: readonly SummaryItemInput[],
): {
  divisionBreakdown: DivisionBreakdownItem[];
  agentBreakdown: AgentBreakdownItem[];
} {
  const divisionBreakdown: DivisionBreakdownItem[] = CANONICAL_DIVISIONS.map((division) => {
    const divItems = items.filter((item) => item.ownerDivision === division.id);
    const capacityPoints = round2(divisionCapacities[division.id] ?? 0);
    const committedPoints = round2(
      divItems.reduce((acc, item) => acc + item.storyPoints, 0),
    );
    const completedPoints = round2(
      divItems
        .filter((item) => item.status === 'done')
        .reduce((acc, item) => acc + item.storyPoints, 0),
    );
    const remainingPoints = round2(Math.max(0, committedPoints - completedPoints));
    const utilizationPct =
      capacityPoints > 0
        ? round1((committedPoints / capacityPoints) * 100)
        : committedPoints > 0
          ? 100
          : 0;

    return {
      divisionId: division.id,
      name: division.name,
      shortName: division.shortName,
      color: division.color,
      defaultFloor: division.defaultFloor,
      capacityPoints,
      committedPoints,
      completedPoints,
      remainingPoints,
      utilizationPct,
      overCapacity: committedPoints > capacityPoints,
      itemCount: divItems.length,
    };
  });

  const agentBreakdown: AgentBreakdownItem[] = CANONICAL_AGENTS.map((agent) => {
    const agentItems = items.filter((item) => item.ownerAgentId === agent.id);
    const capacityPoints = round2(agentCapacities[agent.id] ?? 0);
    const committedPoints = round2(
      agentItems.reduce((acc, item) => acc + item.storyPoints, 0),
    );
    const completedPoints = round2(
      agentItems
        .filter((item) => item.status === 'done')
        .reduce((acc, item) => acc + item.storyPoints, 0),
    );
    const remainingPoints = round2(Math.max(0, committedPoints - completedPoints));
    const utilizationPct =
      capacityPoints > 0
        ? round1((committedPoints / capacityPoints) * 100)
        : committedPoints > 0
          ? 100
          : 0;

    return {
      agentId: agent.id,
      name: agent.name,
      shortName: agent.shortName,
      divisionId: agent.divisionId,
      role: agent.role,
      avatar: agent.avatar,
      capacityPoints,
      committedPoints,
      completedPoints,
      remainingPoints,
      utilizationPct,
      overCapacity: committedPoints > capacityPoints,
      itemCount: agentItems.length,
    };
  });

  return {
    divisionBreakdown,
    agentBreakdown,
  };
}
