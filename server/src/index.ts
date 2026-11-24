import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const { app, close } = createApp({
  dbPath: config.dbPath,
  seed: true,
  port: config.port,
  backlogApiUrl: config.backlogApiUrl,
  eventGatewayUrl: config.eventGatewayUrl,
  gatewaySecret: config.gatewaySecret,
});

const server = app.listen(config.port, () => {
  console.log(
    `[lokatalenta-sprint-planner] listening on http://localhost:${config.port} (backlog=${config.backlogApiUrl}, gateway=${config.eventGatewayUrl || 'disabled'})`,
  );
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[lokatalenta-sprint-planner] received ${signal}, shutting down...`);
  server.close(() => {
    close();
    process.exit(0);
  });
  setTimeout(() => {
    close();
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
