import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import {
  DEFAULT_BACKLOG_API_URL,
  DEFAULT_EVENT_GATEWAY_URL,
  DEFAULT_PORT,
  isOriginAllowed,
  normalizeBacklogBaseUrl,
  normalizeGatewayBaseUrl,
  parseCorsOrigins,
} from './config.js';
import { openDatabase } from './db/database.js';
import { seedIfEmpty } from './db/seed.js';
import { TursoAdapter } from './db/tursoAdapter.js';
import { SprintService } from './domain/sprintService.js';
import { ApiError } from './domain/validation.js';
import { BacklogClient } from './integrations/backlogClient.js';
import { GatewayEmitter } from './integrations/gatewayEmitter.js';
import { createBacklogRouter } from './routes/backlog.js';
import { createHealthRouter } from './routes/health.js';
import { createSprintsRouter } from './routes/sprints.js';

export interface CreateAppOptions {
  readonly dbPath?: string;
  readonly seed?: boolean;
  readonly port?: number;
  readonly backlogApiUrl?: string;
  readonly eventGatewayUrl?: string;
  readonly gatewaySecret?: string;
  readonly corsOrigins?: readonly string[];
  readonly fetchImpl?: typeof fetch;
  readonly clientDistDir?: string;
  readonly tursoAdapter?: TursoAdapter;
}

export interface SprintPlannerAppContext {
  readonly app: Express;
  readonly db: DatabaseSync;
  readonly tursoAdapter: TursoAdapter;
  readonly ready: () => Promise<void>;
  readonly syncToTurso: () => Promise<void>;
  readonly close: () => void;
}

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CLIENT_DIST_DIR = path.resolve(currentDir, '../../client/dist');

export function createApp(options: CreateAppOptions = {}): SprintPlannerAppContext {
  const port = options.port ?? DEFAULT_PORT;
  const dbPath = options.dbPath ?? ':memory:';
  const backlogApiUrl = normalizeBacklogBaseUrl(
    options.backlogApiUrl ?? DEFAULT_BACKLOG_API_URL,
  );
  const eventGatewayUrl = normalizeGatewayBaseUrl(
    options.eventGatewayUrl ?? DEFAULT_EVENT_GATEWAY_URL,
  );
  const corsOrigins = options.corsOrigins ?? parseCorsOrigins(process.env.CORS_ORIGINS);

  const db = openDatabase(dbPath);
  if (options.seed) {
    seedIfEmpty(db);
  }

  const tursoAdapter = options.tursoAdapter ?? new TursoAdapter();
  const initPromise: Promise<void> = tursoAdapter.isConfigured
    ? tursoAdapter
        .pullToLocal(db)
        .then(async (count) => {
          if (count === 0) {
            await tursoAdapter.pushFromLocal(db);
          }
        })
        .catch((err) => {
          console.error('[sprint-planner] Turso cold-start hydration failed, using local DB:', err);
        })
    : Promise.resolve();

  const syncToTurso = async (): Promise<void> => {
    if (!tursoAdapter.isConfigured) return;
    try {
      await tursoAdapter.pushFromLocal(db);
    } catch (err) {
      console.error('[sprint-planner] Turso write-through sync failed:', err);
    }
  };

  const sprintService = new SprintService(db);
  const backlogClient = new BacklogClient({
    baseUrl: backlogApiUrl,
    fetchImpl: options.fetchImpl,
  });
  const gatewayEmitter = new GatewayEmitter({
    gatewayUrl: eventGatewayUrl,
    secret: options.gatewaySecret,
    fetchImpl: options.fetchImpl,
  });

  const app = express();
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isOriginAllowed(origin, corsOrigins));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', async (_req, _res, next) => {
    await initPromise;
    next();
  });

  app.use(
    '/api',
    createHealthRouter({
      port,
      backlogApiUrl,
      eventGatewayUrl,
      tursoAdapter,
    }),
  );
  app.use('/api/sprints', (req, res, next) => {
    if (tursoAdapter.isConfigured && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          void syncToTurso();
        }
      });
    }
    next();
  });
  app.use(
    '/api/sprints',
    createSprintsRouter({
      sprintService,
      backlogClient,
      gatewayEmitter,
    }),
  );
  app.use('/api/backlog', createBacklogRouter(backlogClient));

  // Explicit JSON 404 for unmatched /api/* endpoints before static/SPA fallback
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found' });
  });

  const clientDistDir = options.clientDistDir ?? DEFAULT_CLIENT_DIST_DIR;
  const indexHtmlPath = path.join(clientDistDir, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    app.use(express.static(clientDistDir));
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        res.sendFile(indexHtmlPath);
        return;
      }
      next();
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({
        error: err.message,
        ...(err.details ? { details: err.details } : {}),
      });
      return;
    }

    if (
      err instanceof SyntaxError &&
      typeof (err as unknown as Record<string, unknown>).status === 'number' &&
      (err as unknown as Record<string, unknown>).status === 400
    ) {
      res.status(400).json({ error: 'Invalid JSON payload' });
      return;
    }

    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[sprint-planner] unexpected error:', err);
    res.status(500).json({ error: message });
  });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    void tursoAdapter.close();
    db.close();
  };

  return { app, db, tursoAdapter, ready: () => initPromise, syncToTurso, close };
}
