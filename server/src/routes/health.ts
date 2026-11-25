import { Router } from 'express';
import { CANONICAL_AGENTS, CANONICAL_DIVISIONS } from '../contracts/canonical.js';
import type { TursoAdapter } from '../db/tursoAdapter.js';

export function createHealthRouter(options: {
  port: number;
  backlogApiUrl: string;
  eventGatewayUrl: string;
  tursoAdapter?: TursoAdapter;
}): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const turso = options.tursoAdapter
      ? await options.tursoAdapter.checkHealth()
      : { configured: false, healthy: false, latencyMs: null };

    const persistence = turso.configured
      ? 'turso-libsql'
      : process.env.VERCEL === '1'
        ? 'ephemeral-tmp-seeded'
        : 'local-sqlite';

    res.status(200).json({
      ok: true,
      service: 'lokatalenta-sprint-planner',
      port: options.port,
      backlogApiUrl: options.backlogApiUrl,
      eventGatewayUrl: options.eventGatewayUrl,
      persistence,
      turso,
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/contracts', (_req, res) => {
    res.status(200).json({
      divisions: CANONICAL_DIVISIONS,
      agents: CANONICAL_AGENTS,
    });
  });

  return router;
}
