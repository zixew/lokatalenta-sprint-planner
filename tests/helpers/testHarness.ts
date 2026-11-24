import crypto from 'node:crypto';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, type CreateAppOptions } from '../../server/src/app.js';
import {
  isValidAgentId,
  isValidDivision,
  isValidFloor,
  isValidSeverity,
  isValidZone,
} from '../../server/src/contracts/canonical.js';

export interface MockBacklogItem {
  id: string;
  title: string;
  storyPoints: number;
  ownerDivision: string;
  ownerAgentId: number | null;
  status: string;
  sprintId: string | null;
  priority?: string;
  moscow?: string;
}

export async function startAppServer(options: CreateAppOptions = {}) {
  const ctx = createApp(options);
  const server = http.createServer(ctx.app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    baseUrl,
    port: addr.port,
    db: ctx.db,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      ctx.close();
    },
  };
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export async function startMockBacklogServer(initialItems: MockBacklogItem[] = []) {
  let items: MockBacklogItem[] = initialItems.map((item) => ({ ...item }));
  let mode: 'ok' | 'error500' | 'timeout' = 'ok';
  const requests: Array<{ method: string; url: string; body?: unknown }> = [];

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    if (mode === 'timeout') {
      // Hang longer than client timeout (2000ms) so AbortSignal triggers cleanly
      await new Promise((resolve) => setTimeout(resolve, 2600));
      if (!res.writableEnded) {
        sendJson(res, 504, { error: 'Timeout' });
      }
      return;
    }

    if (mode === 'error500') {
      requests.push({ method, url });
      sendJson(res, 500, { error: 'Simulated Backlog 500' });
      return;
    }

    if (method === 'GET' && url.startsWith('/api/items')) {
      requests.push({ method, url });
      const parsed = new URL(url, 'http://127.0.0.1');
      const divFilter = parsed.searchParams.get('division');
      const filtered = divFilter
        ? items.filter((item) => item.ownerDivision === divFilter)
        : items;
      sendJson(res, 200, { items: filtered });
      return;
    }

    if (method === 'PATCH' && url.startsWith('/api/items/')) {
      const id = decodeURIComponent(url.slice('/api/items/'.length).split('?')[0]);
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      requests.push({ method, url, body });

      const idx = items.findIndex((item) => item.id === id);
      if (idx === -1) {
        sendJson(res, 404, { error: 'Item not found' });
        return;
      }
      const next: MockBacklogItem = {
        ...items[idx],
        ...(body.sprintId !== undefined ? { sprintId: body.sprintId as string | null } : {}),
        ...(typeof body.status === 'string' ? { status: body.status } : {}),
      };
      items[idx] = next;
      sendJson(res, 200, { item: next });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;

  return {
    port: addr.port,
    url: `http://127.0.0.1:${addr.port}`,
    urlWithApi: `http://127.0.0.1:${addr.port}/api`,
    requests,
    setMode(nextMode: 'ok' | 'error500' | 'timeout') {
      mode = nextMode;
    },
    setItems(nextItems: MockBacklogItem[]) {
      items = nextItems.map((item) => ({ ...item }));
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export const EVENT_SCHEMA_REQUIRED_KEYS = [
  'id',
  'timestamp',
  'source',
  'type',
  'divisionId',
  'agentId',
  'entityId',
  'title',
  'summary',
  'targetZone',
  'targetFloor',
  'severity',
  'metadata',
] as const;

export function assertValidEventSchema(payload: unknown): void {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('Event payload must be a JSON object');
  }
  const obj = payload as Record<string, unknown>;
  const keys = Object.keys(obj);
  for (const requiredKey of EVENT_SCHEMA_REQUIRED_KEYS) {
    if (!(requiredKey in obj)) {
      throw new Error(`Missing required event field: ${requiredKey}`);
    }
  }
  if (keys.length !== EVENT_SCHEMA_REQUIRED_KEYS.length) {
    throw new Error(`Unexpected extra top-level keys in event: ${keys.join(', ')}`);
  }

  if (typeof obj.id !== 'string' || obj.id.length < 1 || obj.id.length > 128) {
    throw new Error('Invalid event id');
  }
  if (typeof obj.timestamp !== 'string' || Number.isNaN(Date.parse(obj.timestamp))) {
    throw new Error('Invalid event timestamp');
  }
  if (obj.source !== 'sprint-planner') {
    throw new Error(`Invalid event source: ${String(obj.source)}`);
  }
  if (obj.type !== 'sprint.updated') {
    throw new Error(`Invalid event type: ${String(obj.type)}`);
  }
  if (!isValidDivision(obj.divisionId)) {
    throw new Error(`Invalid event divisionId: ${String(obj.divisionId)}`);
  }
  if (!isValidAgentId(obj.agentId)) {
    throw new Error(`Invalid event agentId: ${String(obj.agentId)}`);
  }
  if (
    obj.entityId !== null &&
    (typeof obj.entityId !== 'string' || obj.entityId.length > 128)
  ) {
    throw new Error(`Invalid event entityId: ${String(obj.entityId)}`);
  }
  if (typeof obj.title !== 'string' || obj.title.length < 1 || obj.title.length > 160) {
    throw new Error('Invalid event title');
  }
  if (typeof obj.summary !== 'string' || obj.summary.length < 1 || obj.summary.length > 500) {
    throw new Error('Invalid event summary');
  }
  if (!isValidZone(obj.targetZone)) {
    throw new Error(`Invalid event targetZone: ${String(obj.targetZone)}`);
  }
  if (!isValidFloor(obj.targetFloor)) {
    throw new Error(`Invalid event targetFloor: ${String(obj.targetFloor)}`);
  }
  if (!isValidSeverity(obj.severity)) {
    throw new Error(`Invalid event severity: ${String(obj.severity)}`);
  }
  if (
    typeof obj.metadata !== 'object' ||
    obj.metadata === null ||
    Array.isArray(obj.metadata)
  ) {
    throw new Error('Invalid event metadata');
  }
}

export async function startMockGatewayServer(expectedSecret?: string) {
  let secret = expectedSecret;
  const events: Array<Record<string, unknown>> = [];
  const authFailures: string[] = [];

  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/events') {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        try {
          const parsed = JSON.parse(rawBody) as Record<string, unknown>;
          assertValidEventSchema(parsed);

          if (secret) {
            const authHeader = req.headers.authorization;
            const sigHeader = req.headers['x-lokatalenta-signature'];
            const expectedHmac = crypto
              .createHmac('sha256', secret)
              .update(rawBody, 'utf8')
              .digest('hex');

            if (authHeader !== `Bearer ${secret}`) {
              authFailures.push(`Bad Authorization header: ${String(authHeader)}`);
              sendJson(res, 401, { error: 'Unauthorized' });
              return;
            }
            if (sigHeader !== `sha256=${expectedHmac}`) {
              authFailures.push(`Bad signature header: ${String(sigHeader)}`);
              sendJson(res, 401, { error: 'Invalid signature' });
              return;
            }
          }

          events.push(parsed);
          sendJson(res, 202, { ok: true, event: parsed });
        } catch (err) {
          sendJson(res, 400, {
            error: err instanceof Error ? err.message : 'Invalid event',
          });
        }
      });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as AddressInfo;

  return {
    port: addr.port,
    url: `http://127.0.0.1:${addr.port}`,
    events,
    authFailures,
    setSecret(next?: string) {
      secret = next;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
