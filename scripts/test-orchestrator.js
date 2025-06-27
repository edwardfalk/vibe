// scripts/test-orchestrator.js
// Purpose: Deterministically start Five-Server (port 5500) and Ticket-API (port 3001),
// wait for them to become healthy, then invoke Playwright tests. If servers are
// already healthy they are reused. Otherwise the ports are force-freed and fresh
// instances are started. All spawned processes are cleaned up on exit.

import { spawn } from 'child_process';
import net from 'net';
import { setTimeout as delay } from 'timers/promises';
import { execSync } from 'child_process';

const ROOT = new URL('..', import.meta.url).pathname;
console.log('DEBUG: ROOT directory for process spawning is:', ROOT);

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
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
    ...options,
  });
}

async function getProcessOnPort(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`);
    const lines = output.toString().split('\n').filter(Boolean);
    if (lines.length === 0) return null;
    // Take the first listening process
    const parts = lines[0].trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    const tasklist = execSync(`tasklist /FI "PID eq ${pid}"`).toString();
    const match = tasklist.match(/^(\S+)/m);
    const procName = match ? match[1] : 'Unknown';
    let cmdLine = '';
    try {
      cmdLine = execSync(`wmic process where ProcessId=${pid} get CommandLine`).toString();
    } catch {}
    return { pid, procName, cmdLine };
  } catch {
    return null;
  }
}

(async () => {
  // Ensure ports free or healthy
  const servers = [];

  // Five-Server (5500)
  const proc = await getProcessOnPort(5500);
  if (proc) {
    console.log(`[DEBUG] Port 5500 procName: ${proc.procName}`);
    console.log(`[DEBUG] Port 5500 cmdLine: ${proc.cmdLine}`);
    if (
      proc.cmdLine.includes('five-server') &&
      proc.cmdLine.includes('--port 5500')
    ) {
      console.log('✅ Five Server already running on port 5500, reusing.');
      // Optionally, could check health here
    } else {
      console.log(`⚠️ Port 5500 is in use by PID ${proc.pid} (${proc.procName}), not Five Server. Killing and starting fresh.`);
      await killPort(5500);
      const five = launch('bunx', [
        'five-server',
        '--port',
        '5500',
        '--root',
        'public',
        '--no-browser',
      ]);
      servers.push(five);
      if (!(await waitForHttp('http://localhost:5500/index.html'))) {
        console.error(
          '❌ Five-Server failed to start on port 5500. Make sure nothing else is using this port.'
        );
        process.exit(1);
      }
    }
  } else {
    // Port is free
    const five = launch('bunx', [
      'five-server',
      '--port',
      '5500',
      '--root',
      'public',
      '--no-browser',
    ]);
    servers.push(five);
    if (!(await waitForHttp('http://localhost:5500/index.html'))) {
      console.error(
        '❌ Five-Server failed to start on port 5500. Make sure nothing else is using this port.'
      );
      process.exit(1);
    }
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
