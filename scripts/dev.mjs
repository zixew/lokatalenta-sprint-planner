import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const serverProc = spawn(npmCmd, ['run', 'dev:server'], {
  stdio: 'inherit',
  env: process.env,
});

const clientProc = spawn(npmCmd, ['run', 'dev:client'], {
  stdio: 'inherit',
  env: process.env,
});

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  serverProc.kill('SIGTERM');
  clientProc.kill('SIGTERM');
  setTimeout(() => process.exit(exitCode), 150).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

serverProc.on('exit', (code) => {
  if (!shuttingDown) shutdown(code ?? 1);
});

clientProc.on('exit', (code) => {
  if (!shuttingDown) shutdown(code ?? 1);
});
