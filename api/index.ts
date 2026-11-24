import type { Express } from 'express';
import { createApp, type SprintPlannerAppContext } from '../server/src/app.js';
import { loadConfig } from '../server/src/config.js';

let cachedContext: SprintPlannerAppContext | null = null;

export function getServerlessContext(): SprintPlannerAppContext {
  if (!cachedContext) {
    const config = loadConfig();
    cachedContext = createApp({
      dbPath: config.dbPath,
      seed: true,
      port: config.port,
      backlogApiUrl: config.backlogApiUrl,
      eventGatewayUrl: config.eventGatewayUrl,
      gatewaySecret: config.gatewaySecret,
      corsOrigins: config.corsOrigins,
    });
  }
  return cachedContext;
}

export const app: Express = getServerlessContext().app;
export default app;
