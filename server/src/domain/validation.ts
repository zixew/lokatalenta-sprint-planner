import {
  AGENTS_BY_ID,
  isValidAgentId,
  isValidCeremonyType,
  isValidDivision,
  isValidSprintItemStatus,
  isValidSprintStatus,
  type CeremonyType,
  type DivisionId,
  type SprintItemStatus,
  type SprintStatus,
} from '../contracts/canonical.js';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly details?: string[];

  constructor(statusCode: number, message: string, details?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface CeremonyActionItem {
  readonly text: string;
  readonly ownerAgentId: number | null;
  readonly done: boolean;
}

const SPRINT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/;
const ISO_DATE_PREFIX_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;
const AGENT_KEY_PATTERN = /^(?:[0-9]|1[0-9]|2[0-3])$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseCalendarDate(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, `${fieldName} must be a valid YYYY-MM-DD date string`);
  }
  const trimmed = value.trim();
  const match = ISO_DATE_PREFIX_PATTERN.exec(trimmed);
  if (!match) {
    throw new ApiError(400, `${fieldName} must be in YYYY-MM-DD format`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new ApiError(400, `${fieldName} is not a valid calendar date`);
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    throw new ApiError(400, `${fieldName} (${trimmed}) is not a valid calendar date`);
  }

  if (trimmed.length > 10 && Number.isNaN(Date.parse(trimmed))) {
    throw new ApiError(400, `${fieldName} (${trimmed}) is not a valid ISO timestamp`);
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function parseIsoTimestamp(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, `${fieldName} must be an ISO date or timestamp string`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ApiError(400, `${fieldName} must not be empty`);
  }

  // Validate calendar date component first to catch rollovers like 2026-02-30
  const datePart = parseCalendarDate(trimmed, fieldName);
  if (trimmed.length === 10) {
    return `${datePart}T00:00:00.000Z`;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    throw new ApiError(400, `${fieldName} must be a valid ISO timestamp`);
  }
  return new Date(parsed).toISOString();
}

export function validateSprintId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'Sprint id must be a string');
  }
  const trimmed = value.trim();
  if (!SPRINT_ID_PATTERN.test(trimmed)) {
    throw new ApiError(
      400,
      'Sprint id must be 2..64 characters starting with alphanumeric and using only letters, numbers, hyphens, or underscores',
    );
  }
  return trimmed;
}

export function validateSprintName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'Sprint name must be a non-empty string');
  }
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 160) {
    throw new ApiError(400, 'Sprint name must be 1..160 characters');
  }
  return trimmed;
}

export function validateSprintGoal(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'Sprint goal must be a string');
  }
  const trimmed = value.trim();
  if (trimmed.length > 1000) {
    throw new ApiError(400, 'Sprint goal must be at most 1000 characters');
  }
  return trimmed;
}

export function validateCapacityNumber(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10000) {
    throw new ApiError(400, `${fieldName} must be a finite number between 0 and 10000`);
  }
  return Math.round(value * 100) / 100;
}

export function validateStoryPoints(value: unknown, fieldName = 'storyPoints'): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000) {
    throw new ApiError(400, `${fieldName} must be a finite number between 0 and 1000`);
  }
  return Math.round(value * 100) / 100;
}

export function validateDivisionCapacities(
  value: unknown,
): Partial<Record<DivisionId, number>> {
  if (!isRecord(value)) {
    throw new ApiError(400, 'divisionCapacities must be an object keyed by canonical divisionId');
  }
  const result: Partial<Record<DivisionId, number>> = {};
  for (const [key, rawPoints] of Object.entries(value)) {
    if (!isValidDivision(key)) {
      throw new ApiError(400, `Invalid divisionId "${key}" in divisionCapacities`);
    }
    result[key] = validateCapacityNumber(rawPoints, `divisionCapacities.${key}`);
  }
  return result;
}

export function validateAgentCapacities(value: unknown): Partial<Record<number, number>> {
  if (!isRecord(value)) {
    throw new ApiError(400, 'agentCapacities must be an object keyed by canonical agentId (0..23)');
  }
  const result: Partial<Record<number, number>> = {};
  for (const [key, rawPoints] of Object.entries(value)) {
    if (!AGENT_KEY_PATTERN.test(key)) {
      throw new ApiError(400, `Invalid agentId key "${key}" in agentCapacities (expected 0..23)`);
    }
    const agentId = Number(key);
    result[agentId] = validateCapacityNumber(rawPoints, `agentCapacities.${key}`);
  }
  return result;
}

export function validateCreateSprintBody(body: unknown): {
  id?: string;
  name: string;
  goal: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  divisionCapacities?: Partial<Record<DivisionId, number>>;
  agentCapacities?: Partial<Record<number, number>>;
} {
  if (!isRecord(body)) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }

  const id = body.id !== undefined ? validateSprintId(body.id) : undefined;
  const name = validateSprintName(body.name);
  const goal = body.goal !== undefined ? validateSprintGoal(body.goal) : '';

  let status: SprintStatus = 'planned';
  if (body.status !== undefined) {
    if (!isValidSprintStatus(body.status)) {
      throw new ApiError(400, 'status must be one of: planned, active, completed');
    }
    status = body.status;
  }

  const startDate = parseCalendarDate(body.startDate, 'startDate');
  const endDate = parseCalendarDate(body.endDate, 'endDate');
  if (endDate < startDate) {
    throw new ApiError(400, 'endDate must be on or after startDate');
  }

  const divisionCapacities =
    body.divisionCapacities !== undefined
      ? validateDivisionCapacities(body.divisionCapacities)
      : undefined;
  const agentCapacities =
    body.agentCapacities !== undefined
      ? validateAgentCapacities(body.agentCapacities)
      : undefined;

  return {
    id,
    name,
    goal,
    status,
    startDate,
    endDate,
    divisionCapacities,
    agentCapacities,
  };
}

export function validateUpdateSprintBody(body: unknown): {
  name?: string;
  goal?: string;
  status?: SprintStatus;
  startDate?: string;
  endDate?: string;
  divisionCapacities?: Partial<Record<DivisionId, number>>;
  agentCapacities?: Partial<Record<number, number>>;
} {
  if (!isRecord(body)) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }

  const result: {
    name?: string;
    goal?: string;
    status?: SprintStatus;
    startDate?: string;
    endDate?: string;
    divisionCapacities?: Partial<Record<DivisionId, number>>;
    agentCapacities?: Partial<Record<number, number>>;
  } = {};

  if (body.name !== undefined) {
    result.name = validateSprintName(body.name);
  }
  if (body.goal !== undefined) {
    result.goal = validateSprintGoal(body.goal);
  }
  if (body.status !== undefined) {
    if (!isValidSprintStatus(body.status)) {
      throw new ApiError(400, 'status must be one of: planned, active, completed');
    }
    result.status = body.status;
  }
  if (body.startDate !== undefined) {
    result.startDate = parseCalendarDate(body.startDate, 'startDate');
  }
  if (body.endDate !== undefined) {
    result.endDate = parseCalendarDate(body.endDate, 'endDate');
  }
  if (body.divisionCapacities !== undefined) {
    result.divisionCapacities = validateDivisionCapacities(body.divisionCapacities);
  }
  if (body.agentCapacities !== undefined) {
    result.agentCapacities = validateAgentCapacities(body.agentCapacities);
  }

  if (Object.keys(result).length === 0) {
    throw new ApiError(400, 'At least one updatable field is required');
  }

  return result;
}

export function validateCapacityUpdateBody(body: unknown): {
  divisionCapacities?: Partial<Record<DivisionId, number>>;
  agentCapacities?: Partial<Record<number, number>>;
} {
  if (!isRecord(body)) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }
  if (body.divisionCapacities === undefined && body.agentCapacities === undefined) {
    throw new ApiError(
      400,
      'At least one of divisionCapacities or agentCapacities must be provided',
    );
  }

  return {
    divisionCapacities:
      body.divisionCapacities !== undefined
        ? validateDivisionCapacities(body.divisionCapacities)
        : undefined,
    agentCapacities:
      body.agentCapacities !== undefined
        ? validateAgentCapacities(body.agentCapacities)
        : undefined,
  };
}

export function validateAssignItemBody(body: unknown): {
  itemId: string;
  title?: string;
  storyPoints?: number;
  ownerDivision?: DivisionId;
  ownerAgentId?: number | null;
  status?: SprintItemStatus;
} {
  if (!isRecord(body)) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }

  if (typeof body.itemId !== 'string' || body.itemId.trim().length === 0) {
    throw new ApiError(400, 'itemId must be a non-empty string');
  }
  const itemId = body.itemId.trim();
  if (itemId.length > 128) {
    throw new ApiError(400, 'itemId must be at most 128 characters');
  }

  let title: string | undefined;
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      throw new ApiError(400, 'title must be a non-empty string when provided');
    }
    title = body.title.trim().slice(0, 240);
  }

  const storyPoints =
    body.storyPoints !== undefined ? validateStoryPoints(body.storyPoints) : undefined;

  let ownerDivision: DivisionId | undefined;
  if (body.ownerDivision !== undefined) {
    if (!isValidDivision(body.ownerDivision)) {
      throw new ApiError(
        400,
        'ownerDivision must be one of: executive, architecture, engineering, qa, devops, lounge',
      );
    }
    ownerDivision = body.ownerDivision;
  }

  let ownerAgentId: number | null | undefined;
  if (body.ownerAgentId !== undefined) {
    if (body.ownerAgentId === null) {
      ownerAgentId = null;
    } else if (!isValidAgentId(body.ownerAgentId)) {
      throw new ApiError(400, 'ownerAgentId must be an integer between 0 and 23');
    } else {
      ownerAgentId = body.ownerAgentId;
    }
  }

  if (ownerDivision === undefined && typeof ownerAgentId === 'number') {
    ownerDivision = AGENTS_BY_ID[ownerAgentId]?.divisionId;
  }

  let status: SprintItemStatus | undefined;
  if (body.status !== undefined) {
    if (!isValidSprintItemStatus(body.status)) {
      throw new ApiError(
        400,
        'status must be one of: in_sprint, in_progress, review, done',
      );
    }
    status = body.status;
  }

  return {
    itemId,
    title,
    storyPoints,
    ownerDivision,
    ownerAgentId,
    status,
  };
}

export function validateUpdateSprintItemBody(body: unknown): {
  title?: string;
  storyPoints?: number;
  ownerDivision?: DivisionId;
  ownerAgentId?: number | null;
  status?: SprintItemStatus;
  completedAt?: string | null;
} {
  if (!isRecord(body)) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }

  const result: {
    title?: string;
    storyPoints?: number;
    ownerDivision?: DivisionId;
    ownerAgentId?: number | null;
    status?: SprintItemStatus;
    completedAt?: string | null;
  } = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      throw new ApiError(400, 'title must be a non-empty string');
    }
    result.title = body.title.trim().slice(0, 240);
  }
  if (body.storyPoints !== undefined) {
    result.storyPoints = validateStoryPoints(body.storyPoints);
  }
  if (body.ownerDivision !== undefined) {
    if (!isValidDivision(body.ownerDivision)) {
      throw new ApiError(
        400,
        'ownerDivision must be one of: executive, architecture, engineering, qa, devops, lounge',
      );
    }
    result.ownerDivision = body.ownerDivision;
  }
  if (body.ownerAgentId !== undefined) {
    if (body.ownerAgentId === null) {
      result.ownerAgentId = null;
    } else if (!isValidAgentId(body.ownerAgentId)) {
      throw new ApiError(400, 'ownerAgentId must be an integer between 0 and 23');
    } else {
      result.ownerAgentId = body.ownerAgentId;
    }
  }
  if (body.status !== undefined) {
    if (!isValidSprintItemStatus(body.status)) {
      throw new ApiError(
        400,
        'status must be one of: in_sprint, in_progress, review, done',
      );
    }
    result.status = body.status;
  }
  if (body.completedAt !== undefined) {
    if (body.completedAt === null) {
      result.completedAt = null;
    } else {
      result.completedAt = parseIsoTimestamp(body.completedAt, 'completedAt');
    }
  }

  if (Object.keys(result).length === 0) {
    throw new ApiError(400, 'At least one updatable field is required');
  }

  return result;
}

export function validateActionItems(value: unknown): CeremonyActionItem[] {
  if (!Array.isArray(value)) {
    throw new ApiError(400, 'actionItems must be an array');
  }

  return value.map((item, idx) => {
    if (typeof item === 'string') {
      const text = item.trim();
      if (text.length < 1 || text.length > 500) {
        throw new ApiError(400, `actionItems[${idx}] must be a non-empty string (1..500 chars)`);
      }
      return {
        text,
        ownerAgentId: null,
        done: false,
      };
    }

    if (isRecord(item)) {
      if (typeof item.text !== 'string') {
        throw new ApiError(400, `actionItems[${idx}].text must be a non-empty string`);
      }
      const text = item.text.trim();
      if (text.length < 1 || text.length > 500) {
        throw new ApiError(
          400,
          `actionItems[${idx}].text must be a non-empty string (1..500 chars)`,
        );
      }

      let ownerAgentId: number | null = null;
      if (item.ownerAgentId !== undefined && item.ownerAgentId !== null) {
        if (!isValidAgentId(item.ownerAgentId)) {
          throw new ApiError(
            400,
            `actionItems[${idx}].ownerAgentId must be an integer between 0 and 23`,
          );
        }
        ownerAgentId = item.ownerAgentId;
      }

      let done = false;
      if (item.done !== undefined) {
        if (typeof item.done !== 'boolean') {
          throw new ApiError(400, `actionItems[${idx}].done must be a boolean`);
        }
        done = item.done;
      }

      return {
        text,
        ownerAgentId,
        done,
      };
    }

    throw new ApiError(
      400,
      `actionItems[${idx}] must be a non-empty string or { text, ownerAgentId?, done? }`,
    );
  });
}

export function validateCeremonyBody(body: unknown): {
  type: CeremonyType;
  facilitatorAgentId: number;
  notes: string;
  actionItems: CeremonyActionItem[];
  recordedAt: string;
} {
  if (!isRecord(body)) {
    throw new ApiError(400, 'Request body must be a JSON object');
  }

  if (!isValidCeremonyType(body.type)) {
    throw new ApiError(400, 'type must be one of: planning, review, retrospective');
  }

  if (!isValidAgentId(body.facilitatorAgentId)) {
    throw new ApiError(400, 'facilitatorAgentId must be an integer between 0 and 23');
  }

  if (typeof body.notes !== 'string') {
    throw new ApiError(400, 'notes must be a non-empty string');
  }
  const notes = body.notes.trim();
  if (notes.length < 1 || notes.length > 4000) {
    throw new ApiError(400, 'notes must be 1..4000 characters');
  }

  const actionItems =
    body.actionItems !== undefined ? validateActionItems(body.actionItems) : [];

  const recordedAt =
    body.recordedAt !== undefined
      ? parseIsoTimestamp(body.recordedAt, 'recordedAt')
      : new Date().toISOString();

  return {
    type: body.type,
    facilitatorAgentId: body.facilitatorAgentId,
    notes,
    actionItems,
    recordedAt,
  };
}
