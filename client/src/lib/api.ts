import type {
  CeremonyType,
  DivisionId,
  SprintItemStatus,
  SprintStatus,
} from '../contracts/canonical.ts';

export interface CeremonyActionItem {
  readonly text: string;
  readonly ownerAgentId: number | null;
  readonly done: boolean;
}

export interface CeremonyRecord {
  readonly id: string;
  readonly sprintId: string;
  readonly type: CeremonyType;
  readonly facilitatorAgentId: number;
  readonly notes: string;
  readonly actionItems: CeremonyActionItem[];
  readonly recordedAt: string;
  readonly createdAt: string;
}

export interface SprintItemRecord {
  readonly sprintId: string;
  readonly itemId: string;
  readonly title: string;
  readonly storyPoints: number;
  readonly ownerDivision: DivisionId;
  readonly ownerAgentId: number | null;
  readonly status: SprintItemStatus;
  readonly backlogSynced: boolean;
  readonly assignedAt: string;
  readonly completedAt: string | null;
  readonly updatedAt: string;
}

export interface SprintRecord {
  readonly id: string;
  readonly name: string;
  readonly goal: string;
  readonly status: SprintStatus;
  readonly startDate: string;
  readonly endDate: string;
  readonly divisionCapacities: Record<DivisionId, number>;
  readonly agentCapacities: Record<number, number>;
  readonly items: SprintItemRecord[];
  readonly ceremonies: CeremonyRecord[];
  readonly metrics: {
    readonly committedPoints: number;
    readonly completedPoints: number;
    readonly remainingPoints: number;
    readonly totalCapacityPoints: number;
    readonly totalAgentCapacityPoints: number;
    readonly itemCount: number;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
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

export interface BurndownPoint {
  readonly dayIndex: number;
  readonly date: string;
  readonly idealRemaining: number;
  readonly actualRemaining: number;
  readonly completedOnDay: number;
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

export interface SprintSummary {
  readonly sprintId: string;
  readonly name: string;
  readonly status: SprintStatus;
  readonly startDate: string;
  readonly endDate: string;
  readonly totals: {
    readonly committedPoints: number;
    readonly completedPoints: number;
    readonly remainingPoints: number;
    readonly totalCapacityPoints: number;
    readonly totalAgentCapacityPoints: number;
    readonly completionRatePct: number;
    readonly itemCounts: {
      readonly total: number;
      readonly in_sprint: number;
      readonly in_progress: number;
      readonly review: number;
      readonly done: number;
    };
  };
  readonly divisionBreakdown: DivisionBreakdownItem[];
  readonly agentBreakdown: AgentBreakdownItem[];
  readonly velocity: {
    readonly series: VelocitySeriesItem[];
    readonly completedSprintCount: number;
    readonly averageCompletedVelocity: number;
  };
  readonly burndown: BurndownPoint[];
}

export interface BacklogSyncResult {
  readonly synced: boolean;
  readonly statusCode?: number;
  readonly warning?: string;
}

export interface BacklogCandidateItem {
  readonly id: string;
  readonly type?: string;
  readonly title: string;
  readonly description?: string;
  readonly storyPoints?: number;
  readonly priority?: string;
  readonly moscow?: string;
  readonly status?: string;
  readonly ownerDivision?: DivisionId;
  readonly ownerAgentId?: number | null;
}

export interface HealthResponse {
  readonly ok: boolean;
  readonly service: string;
  readonly port: number;
  readonly backlogApiUrl: string;
  readonly eventGatewayUrl: string;
  readonly timestamp: string;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const sprintPlannerApi = {
  getHealth(): Promise<HealthResponse> {
    return requestJson<HealthResponse>('/api/health');
  },

  listSprints(status?: SprintStatus): Promise<{ sprints: SprintRecord[] }> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return requestJson<{ sprints: SprintRecord[] }>(`/api/sprints${qs}`);
  },

  createSprint(payload: {
    id?: string;
    name: string;
    goal?: string;
    status?: SprintStatus;
    startDate: string;
    endDate: string;
    divisionCapacities?: Partial<Record<DivisionId, number>>;
    agentCapacities?: Partial<Record<number, number>>;
  }): Promise<{ sprint: SprintRecord }> {
    return requestJson<{ sprint: SprintRecord }>('/api/sprints', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSprint(
    sprintId: string,
    payload: {
      name?: string;
      goal?: string;
      status?: SprintStatus;
      startDate?: string;
      endDate?: string;
      divisionCapacities?: Partial<Record<DivisionId, number>>;
      agentCapacities?: Partial<Record<number, number>>;
    },
  ): Promise<{ sprint: SprintRecord }> {
    return requestJson<{ sprint: SprintRecord }>(
      `/api/sprints/${encodeURIComponent(sprintId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
  },

  updateCapacity(
    sprintId: string,
    payload: {
      divisionCapacities?: Partial<Record<DivisionId, number>>;
      agentCapacities?: Partial<Record<number, number>>;
    },
  ): Promise<{ sprint: SprintRecord }> {
    return requestJson<{ sprint: SprintRecord }>(
      `/api/sprints/${encodeURIComponent(sprintId)}/capacity`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    );
  },

  getSummary(sprintId: string): Promise<SprintSummary> {
    return requestJson<SprintSummary>(
      `/api/sprints/${encodeURIComponent(sprintId)}/summary`,
    );
  },

  getBacklogCandidates(
    sprintId: string,
    includeAll = false,
  ): Promise<{
    sprintId: string;
    candidates: BacklogCandidateItem[];
    backlogSync: BacklogSyncResult;
  }> {
    const qs = includeAll ? '?includeAll=true' : '';
    return requestJson(
      `/api/sprints/${encodeURIComponent(sprintId)}/backlog-candidates${qs}`,
    );
  },

  assignItem(
    sprintId: string,
    payload: {
      itemId: string;
      title?: string;
      storyPoints?: number;
      ownerDivision?: DivisionId;
      ownerAgentId?: number | null;
      status?: SprintItemStatus;
    },
  ): Promise<{
    sprint: SprintRecord;
    assignment: SprintItemRecord;
    backlogSync: BacklogSyncResult;
  }> {
    return requestJson(
      `/api/sprints/${encodeURIComponent(sprintId)}/assign`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  updateSprintItem(
    sprintId: string,
    itemId: string,
    payload: {
      status?: SprintItemStatus;
      storyPoints?: number;
      ownerDivision?: DivisionId;
      ownerAgentId?: number | null;
      title?: string;
    },
  ): Promise<{
    sprint: SprintRecord;
    assignment: SprintItemRecord;
    backlogSync: BacklogSyncResult;
  }> {
    return requestJson(
      `/api/sprints/${encodeURIComponent(sprintId)}/items/${encodeURIComponent(itemId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
  },

  removeSprintItem(
    sprintId: string,
    itemId: string,
  ): Promise<{
    sprint: SprintRecord;
    removedItemId: string;
    backlogSync: BacklogSyncResult;
  }> {
    return requestJson(
      `/api/sprints/${encodeURIComponent(sprintId)}/items/${encodeURIComponent(itemId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  addCeremony(
    sprintId: string,
    payload: {
      type: CeremonyType;
      facilitatorAgentId: number;
      notes: string;
      actionItems?: Array<{ text: string; ownerAgentId?: number | null; done?: boolean }>;
      recordedAt?: string;
    },
  ): Promise<{ ceremony: CeremonyRecord; sprint: SprintRecord }> {
    return requestJson(
      `/api/sprints/${encodeURIComponent(sprintId)}/ceremonies`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },
};
