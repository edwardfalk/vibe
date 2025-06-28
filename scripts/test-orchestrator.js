// scripts/test-orchestrator.js
// Purpose: ensure dev env is running via dev-server CLI, then execute Playwright tests.

import { spawn } from 'child_process';
import { waitForHttp } from './port-utils.js';
import { CONFIG } from '../packages/core/src/config.js';

function launch(cmd, args, opts = {}) {
  console.log(`🚀 ${cmd} ${args.join(' ')}`);
  return spawn(cmd, args, { shell: true, stdio: 'inherit', ...opts });
}

(async () => {
  const servers = [];
  if (!process.argv.includes('--no-server')) {
    // Start (or reuse) servers via dev:start script
    const starter = launch('bun', ['run', 'dev:start']);
    servers.push(starter);
    const ok = await waitForHttp(`http://localhost:${CONFIG.DEV_SERVER.PORT}/index.html`);
    if (!ok) {
      console.error('❌ Dev server failed to become READY');
      process.exit(1);
    }
  }

  // Run Playwright tests
  const tests = launch('bunx', ['playwright', 'test']);

  tests.on('close', (code) => {
    if (!process.argv.includes('--no-server')) {
      launch('bun', ['run', 'dev:stop']);
    }
    process.exit(code);
  });

  process.on('SIGINT', () => {
    if (!process.argv.includes('--no-server')) {
      launch('bun', ['run', 'dev:stop']);
    }
    process.exit(130);
  });
})();
