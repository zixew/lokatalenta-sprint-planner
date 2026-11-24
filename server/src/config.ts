import path from 'node:path';

export const DEFAULT_PORT = 4103;
export const DEFAULT_BACKLOG_API_URL = 'http://localhost:4102';
export const DEFAULT_EVENT_GATEWAY_URL = 'http://localhost:4101';
export const VERCEL_SQLITE_DB_PATH = '/tmp/lokatalenta-sprint-planner.db';
export const DEFAULT_CORS_ORIGINS: readonly string[] = [
  'http://localhost:*',
  'http://127.0.0.1:*',
  'https://*.vercel.app',
  'http://*.vercel.app',
];

export interface AppConfig {
  readonly port: number;
  readonly dbPath: string;
  readonly backlogApiUrl: string;
  readonly eventGatewayUrl: string;
  readonly gatewaySecret?: string;
  readonly corsOrigins: string[];
}

export function resolveDbPath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.DB_PATH && env.DB_PATH.trim().length > 0) {
    return env.DB_PATH.trim();
  }
  if (env.VERCEL === '1') {
    return VERCEL_SQLITE_DB_PATH;
  }
  return path.resolve(process.cwd(), 'data/lokatalenta-sprint-planner.db');
}

export function parseCorsOrigins(raw?: string): string[] {
  if (!raw || raw.trim().length === 0) {
    return [...DEFAULT_CORS_ORIGINS];
  }
  const parsed = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return parsed.length > 0 ? parsed : [...DEFAULT_CORS_ORIGINS];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchOriginPattern(origin: string, pattern: string): boolean {
  if (pattern === '*') {
    return true;
  }
  if (origin === pattern) {
    return true;
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  // Support shorthand patterns without scheme such as "localhost:*" or "*.vercel.app"
  if (!pattern.includes('://')) {
    const regex = new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, '.*')}$`, 'i');
    return regex.test(parsedOrigin.host) || regex.test(parsedOrigin.hostname);
  }

  // Support scheme + wildcard patterns such as "https://*.vercel.app" or "http://localhost:*"
  const regex = new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, '[^/]*')}$`, 'i');
  return regex.test(origin);
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedPatterns: readonly string[],
): boolean {
  if (!origin) {
    return true;
  }
  return allowedPatterns.some((pattern) => matchOriginPattern(origin, pattern));
}

export function normalizeBacklogBaseUrl(rawUrl?: string): string {
  const trimmed = (rawUrl ?? DEFAULT_BACKLOG_API_URL).trim();
  if (!trimmed) {
    return DEFAULT_BACKLOG_API_URL;
  }
  return trimmed.replace(/\/+$/, '').replace(/\/api$/i, '').replace(/\/+$/, '');
}

export function normalizeGatewayBaseUrl(rawUrl?: string): string {
  if (rawUrl === undefined) {
    return DEFAULT_EVENT_GATEWAY_URL;
  }
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.toLowerCase() === 'disabled') {
    return '';
  }
  return trimmed.replace(/\/+$/, '');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsedPort = Number(env.PORT ?? DEFAULT_PORT);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;
  const isVercel = env.VERCEL === '1';

  return {
    port,
    dbPath: resolveDbPath(env),
    backlogApiUrl: normalizeBacklogBaseUrl(
      env.BACKLOG_API_URL ?? (isVercel ? 'https://lokatalenta-backlog.vercel.app' : undefined),
    ),
    eventGatewayUrl: normalizeGatewayBaseUrl(
      env.EVENT_GATEWAY_URL ?? (isVercel ? 'https://lokatalenta-event-gateway.vercel.app' : undefined),
    ),
    gatewaySecret: env.GATEWAY_EVENT_SECRET?.trim() || undefined,
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
  };
}
