// scripts/test-orchestrator.js
// Purpose: Deterministically start Five-Server (port 5500) and Ticket-API (port 3001),
// wait for them to become healthy, then invoke Playwright tests. If servers are
// already healthy they are reused. Otherwise the ports are force-freed and fresh
// instances are started. All spawned processes are cleaned up on exit.

import { spawn } from 'child_process';
import net from 'net';
import { setTimeout as delay } from 'timers/promises';

const ROOT = new URL('..', import.meta.url).pathname;

/** Simple TCP probe to see if something is listening on the port */
function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => resolve(false));
    socket.connect(port, '127.0.0.1');
  });
}

async function killPort(port) {
  return new Promise((resolve) => {
    const proc = spawn('bunx', ['kill-port', String(port)], {
      shell: true,
      stdio: 'inherit',
    });
    proc.on('close', () => resolve());
  });
}

async function waitForHttp(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await delay(1000);
  }
  return false;
}

function launch(cmd, args, options = {}) {
  console.log(`🚀 Launching ${cmd} ${args.join(' ')}`);
  return spawn(cmd, args, {
    cwd: ROOT,
    shell: true,
    stdio: 'inherit',
    ...options,
  });
}

(async () => {
  // Ensure ports free or healthy
  const servers = [];

  // Five-Server (5500)
  if (!(await isPortOpen(5500))) {
    await killPort(5500);
    const five = launch('bunx', [
      'five-server',
      '--port',
      '5500',
      '--root',
      '.',
      '--no-browser',
    ]);
    servers.push(five);
    if (!(await waitForHttp('http://localhost:5500/index.html'))) {
      console.error('❌ Five-Server failed to start');
      process.exit(1);
    }
  } else {
    console.log('ℹ️ Five-Server already running – reusing.');
  }

  // Ticket-API (3001)
  if (!(await isPortOpen(3001))) {
    await killPort(3001);
    const api = launch('bun', ['run', 'api']);
    servers.push(api);
    if (!(await waitForHttp('http://localhost:3001/api/health'))) {
      console.error('❌ Ticket-API failed to start');
      process.exit(1);
    }
  } else {
    console.log('ℹ️ Ticket-API already running – reusing.');
  }

  // Run Playwright tests
  const tests = launch('bunx', ['playwright', 'test']);

  tests.on('close', (code) => {
    for (const p of servers) {
      try {
        process.kill(-p.pid);
      } catch {}
    }
    process.exit(code);
  });

  // Ensure Ctrl+C cleans up
  process.on('SIGINT', () => {
    for (const p of servers) {
      try {
        process.kill(-p.pid);
      } catch {}
    }
    process.exit(130);
  });
})();
