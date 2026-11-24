import crypto from 'node:crypto';
import {
  DIVISIONS_BY_ID,
  isValidAgentId,
  isValidDivision,
  isValidFloor,
  isValidSeverity,
  isValidZone,
  type DivisionId,
  type EventSeverity,
  type SprintEventAction,
  type TargetFloor,
  type TargetZone,
} from '../contracts/canonical.js';
import { normalizeGatewayBaseUrl } from '../config.js';

export interface NormalizedSprintEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly source: 'sprint-planner';
  readonly type: 'sprint.updated';
  readonly divisionId: DivisionId;
  readonly agentId: number;
  readonly entityId: string | null;
  readonly title: string;
  readonly summary: string;
  readonly targetZone: TargetZone;
  readonly targetFloor: TargetFloor;
  readonly severity: EventSeverity;
  readonly metadata: Record<string, unknown>;
}

export interface EmitSprintEventInput {
  readonly action: SprintEventAction;
  readonly divisionId?: DivisionId;
  readonly agentId?: number;
  readonly entityId: string | null;
  readonly title: string;
  readonly summary: string;
  readonly targetZone?: TargetZone;
  readonly targetFloor?: TargetFloor;
  readonly severity?: EventSeverity;
  readonly metadata?: Record<string, unknown>;
}

export interface GatewayEmitResult {
  readonly delivered: boolean;
  readonly statusCode?: number;
  readonly error?: string;
  readonly event: NormalizedSprintEvent;
}

export interface GatewayEmitterOptions {
  readonly gatewayUrl: string;
  readonly secret?: string;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

export function buildSprintEventPayload(input: EmitSprintEventInput): NormalizedSprintEvent {
  const divisionId: DivisionId = isValidDivision(input.divisionId)
    ? input.divisionId
    : 'executive';
  const division = DIVISIONS_BY_ID[divisionId];
  const defaultAgentId = division.agentIds[0] ?? 0;
  const agentId = isValidAgentId(input.agentId) ? input.agentId : defaultAgentId;

  const targetZone: TargetZone = isValidZone(input.targetZone)
    ? input.targetZone
    : division.defaultZone;
  const derivedFloor: TargetFloor =
    targetZone === 'boardroom' ? 2 : division.defaultFloor;
  const targetFloor: TargetFloor = isValidFloor(input.targetFloor)
    ? input.targetFloor
    : derivedFloor;

  const severity: EventSeverity = isValidSeverity(input.severity) ? input.severity : 'info';

  const trimmedTitle = input.title.trim().slice(0, 160) || 'Sprint Planner Update';
  const trimmedSummary = input.summary.trim().slice(0, 500) || trimmedTitle;
  const entityId =
    input.entityId === null
      ? null
      : input.entityId.trim().slice(0, 128) || null;

  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    source: 'sprint-planner',
    type: 'sprint.updated',
    divisionId,
    agentId,
    entityId,
    title: trimmedTitle,
    summary: trimmedSummary,
    targetZone,
    targetFloor,
    severity,
    metadata: {
      ...(input.metadata ?? {}),
      action: input.action,
    },
  };
}

export class GatewayEmitter {
  readonly gatewayUrl: string;
  private readonly secret?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: GatewayEmitterOptions) {
    this.gatewayUrl = normalizeGatewayBaseUrl(options.gatewayUrl);
    this.secret = options.secret?.trim() || undefined;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? 1500;
  }

  async emit(input: EmitSprintEventInput): Promise<GatewayEmitResult> {
    const event = buildSprintEventPayload(input);
    if (!this.gatewayUrl) {
      return { delivered: false, error: 'Gateway URL disabled', event };
    }

    const body = JSON.stringify(event);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (this.secret) {
      const hmacHex = crypto
        .createHmac('sha256', this.secret)
        .update(body, 'utf8')
        .digest('hex');
      headers['Authorization'] = `Bearer ${this.secret}`;
      headers['x-lokatalenta-signature'] = `sha256=${hmacHex}`;
    }

    const endpoint = `${this.gatewayUrl}/events`;
    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const error = `Gateway returned HTTP ${response.status}`;
        console.warn(`[gateway-emitter] ${error} (${endpoint})`);
        return {
          delivered: false,
          statusCode: response.status,
          error,
          event,
        };
      }

      return {
        delivered: true,
        statusCode: response.status,
        event,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[gateway-emitter] failed to emit to ${endpoint}: ${message}`);
      return {
        delivered: false,
        error: message,
        event,
      };
    }
  }
}
