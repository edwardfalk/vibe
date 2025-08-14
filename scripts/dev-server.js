// scripts/dev-server.js
// Dev server manager CLI: start | stop | status | restart
// Usage: bun run dev-server <cmd>
// Focuses on Windows-first environment; uses port-utils for robustness.

import { spawn } from 'child_process';
import { CONFIG } from '../packages/core/src/config.js';
import {
  getProcessOnPort,
  isExpectedProcess,
  freePort,
  waitForHttp,
  waitForPortFree,
} from './port-utils.js';
import { reportError } from '../packages/tooling/src/ErrorReporter.js';

const DEV_PORT = CONFIG.DEV_SERVER.PORT;
// Ticket API removed
const API_PORT = null;
const FIVE_EXPECT = 'five-server';
const API_EXPECT = null;

// --- Child-process tracking & cleanup --------------------------------------
const children = new Set();

/**
 * Spawn a child process and keep a reference so we can clean it up later.
 * Uses stdio: 'inherit' and shell: true by default (can be overridden).
 */
function spawnTracked(cmd, args, opts = {}) {
  // Support detached/background mode so orchestrated scripts can continue after spawning.
  const detached = !!opts.detached;
  // Build spawn options; ensure we have sensible defaults.
  const spawnOpts = { shell: true, ...opts };
  if (!('stdio' in spawnOpts)) {
    // If running detached, ignore stdio so parent can exit immediately.
    spawnOpts.stdio = detached ? 'ignore' : 'inherit';
  }
  // Prevent flashing a new console window on Windows when spawning children
  if (
    process.platform === 'win32' &&
    typeof spawnOpts.windowsHide === 'undefined'
  ) {
    spawnOpts.windowsHide = true;
  }
  // Ensure detached flag propagates.
  spawnOpts.detached = detached;

  const cp = spawn(cmd, args, spawnOpts);

  if (detached) {
    // Detach allows Node process to exit without waiting for child.
    cp.unref();
  } else {
    children.add(cp);
    cp.on('exit', () => children.delete(cp));
  }

  return cp;
}

/**
 * Terminate all tracked child processes.
 */
function cleanExit() {
  for (const cp of children) {
    if (cp.killed) continue;
    if (process.platform === 'win32') {
      // Kill entire process tree on Windows
      spawn('taskkill', ['/PID', String(cp.pid), '/T', '/F']);
    } else {
      cp.kill('SIGTERM');
    }
  }
}

// Handle parent termination signals
['SIGINT', 'SIGTERM', 'SIGBREAK'].forEach((sig) => {
  process.on(sig, () => {
    cleanExit();
    process.exit(0);
  });
});
process.on('exit', cleanExit);

async function start() {
  // Live-Server
  const proc = getProcessOnPort(DEV_PORT);
  if (proc && isExpectedProcess(proc.cmdLine, FIVE_EXPECT)) {
    console.log(`✅ Five-Server already running (PID ${proc.pid})`);
  } else {
    if (proc) {
      console.log(
        `⚠️ Port ${DEV_PORT} occupied by PID ${proc.pid}, freeing...`
      );
      freePort(DEV_PORT);
      await waitForPortFree(DEV_PORT);
    }
    console.log('🚀 Starting five-server...');
    // Windows Terminal sometimes opens a new tab for detached console processes.
    // Use `cmd /c start "" /B` so it runs in the current console without creating a new window/tab.
    if (process.platform === 'win32') {
      spawnTracked(
        'cmd',
        [
          '/c',
          'start',
          '',
          '/B',
          'bun',
          'x',
          'five-server',
          '--port=' + DEV_PORT,
          '--root=.',
          '--host=localhost',
          '--no-browser',
          '--cors',
        ],
        { detached: true, shell: false, stdio: 'ignore', windowsHide: true }
      );
    } else {
      // POSIX: use a detached child without opening a console window
      spawnTracked(
        'bun',
        [
          'x',
          'five-server',
          '--port=' + DEV_PORT,
          '--root=.',
          '--host=localhost',
          '--no-browser',
          '--cors',
        ],
        { detached: true, shell: false, stdio: 'ignore', windowsHide: true }
      );
    }
    const ok = await waitForHttp(`http://localhost:${DEV_PORT}/`, 30000);
    if (!ok) {
      reportError(
        'FIVE_SERVER_START_FAILURE',
        'Five-Server failed to become READY',
        { port: DEV_PORT }
      );
    }
    console.log('✅ Five-Server READY');
  }

  // Ticket API removed – nothing to start

  console.log('🎉 Dev environment READY');
}

function stop() {
  if (children.size) {
    cleanExit();
    console.log('🛑 Servers stopped (tracked)');
    return;
  }

  let killed = false;
  if (freePort(DEV_PORT)) killed = true;
  // API port removed
  if (killed) console.log('🛑 Servers stopped (port sweep)');
  else console.log('ℹ️ No servers running');
}

async function status() {
  const dev = getProcessOnPort(DEV_PORT);
  const httpAlive = await waitForHttp(`http://localhost:${DEV_PORT}/`, 1500);
  // Report both transport and process views; consider running if either is true
  console.table([
    {
      service: 'Five-Server',
      port: DEV_PORT,
      running: httpAlive || !!dev,
      http: httpAlive,
      pid: dev?.pid || '-',
    },
  ]);
}

async function main() {
  const cmd = process.argv[2] || 'status';
  switch (cmd) {
    case 'start':
      await start();
      break;
    case 'stop':
      stop();
      break;
    case 'restart':
      stop();
      await start();
      break;
    case 'status':
    default:
      await status();
  }
}

main();
