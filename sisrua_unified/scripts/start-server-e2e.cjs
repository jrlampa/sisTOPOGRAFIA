const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('[server:e2e] Building backend with emit-on-error enabled...');
const build = spawnSync(
  npxCmd,
  ['tsc', '--project', 'tsconfig.server.json', '--noEmitOnError', 'false'],
  { stdio: 'inherit' }
);

if (build.status !== 0) {
  console.warn('[server:e2e] Type errors detected, continuing with emitted JS for E2E startup.');
}

const entry = path.resolve('dist', 'server', 'server', 'index.js');
if (!fs.existsSync(entry)) {
  console.error(`[server:e2e] Compiled entry not found: ${entry}`);
  process.exit(1);
}

console.log(`[server:e2e] Starting backend from ${entry}`);
const child = spawn(process.execPath, [entry], { stdio: 'inherit' });

const forwardSignal = signal => {
  if (!child.killed) child.kill(signal);
};

process.on('SIGINT', () => forwardSignal('SIGINT'));
process.on('SIGTERM', () => forwardSignal('SIGTERM'));

child.on('exit', code => {
  process.exit(code ?? 0);
});
