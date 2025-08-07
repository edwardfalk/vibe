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
const FIVE_EXPECT = 'live-server';
const API_EXPECT = null;

// --- Child-process tracking & cleanup --------------------------------------
const children = new Set();

/**
 * Spawn a child process and keep a reference so we can clean it up later.
 * Uses stdio: 'inherit' and shell: true by default (can be overridden).
 */
function spawnTracked(cmd, args, opts = {}) {
  const cp = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  children.add(cp);
  cp.on('exit', () => children.delete(cp));
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
  let proc = getProcessOnPort(DEV_PORT);
  if (proc && isExpectedProcess(proc.cmdLine, FIVE_EXPECT)) {
    console.log(`✅ Live-Server already running (PID ${proc.pid})`);
  } else {
    if (proc) {
      console.log(
        `⚠️ Port ${DEV_PORT} occupied by PID ${proc.pid}, freeing...`
      );
      freePort(DEV_PORT);
      await waitForPortFree(DEV_PORT);
    }
    console.log('🚀 Starting live-server...');
    spawnTracked('bunx', [
      'live-server',
      '--port=' + DEV_PORT,
      '--host=localhost',
      '--no-browser',
      '--cors',
      '.',
    ]);
    const ok = await waitForHttp(
      `http://localhost:${DEV_PORT}/`,
      30000
    );
    if (!ok) {
      reportError(
        'LIVE_SERVER_START_FAILURE',
        'Live-Server failed to become READY',
        { port: DEV_PORT }
      );
    }
    console.log('✅ Live-Server READY');
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

function status() {
  const dev = getProcessOnPort(DEV_PORT);
  // Ticket API row removed
  console.table([
    {
      service: 'Live-Server',
      port: DEV_PORT,
      running: !!dev,
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
      status();
  }
}

main();
