import { Router } from 'express';
import { CANONICAL_AGENTS, CANONICAL_DIVISIONS } from '../contracts/canonical.js';

export function createHealthRouter(options: {
  port: number;
  backlogApiUrl: string;
  eventGatewayUrl: string;
}): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({
      ok: true,
      service: 'lokatalenta-sprint-planner',
      port: options.port,
      backlogApiUrl: options.backlogApiUrl,
      eventGatewayUrl: options.eventGatewayUrl,
      persistence: process.env.VERCEL === '1' ? 'ephemeral-tmp-seeded' : 'local-sqlite',
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
