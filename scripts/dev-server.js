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
} from './port-utils.js';

const DEV_PORT = CONFIG.DEV_SERVER.PORT;
const API_PORT = CONFIG.TICKET_API.PORT;
const FIVE_EXPECT = 'five-server';
const API_EXPECT = 'ticket-api.js';

async function start() {
  // Five-Server
  let proc = getProcessOnPort(DEV_PORT);
  if (proc && isExpectedProcess(proc.cmdLine, FIVE_EXPECT)) {
    console.log(`✅ Five-Server already running (PID ${proc.pid})`);
  } else {
    if (proc) {
      console.log(`⚠️ Port ${DEV_PORT} occupied by PID ${proc.pid}, freeing...`);
      freePort(DEV_PORT);
    }
    console.log('🚀 Starting Five-Server...');
    spawn('bunx', ['five-server', '--port', DEV_PORT, '--root', 'public', '--no-browser'], {
      stdio: 'inherit',
      shell: true,
    });
    const ok = await waitForHttp(`http://localhost:${DEV_PORT}/index.html`, 30000);
    if (!ok) {
      console.error('❌ Five-Server failed to become READY');
      process.exit(1);
    }
    console.log('✅ Five-Server READY');
  }

  // Ticket API
  proc = getProcessOnPort(API_PORT);
  if (proc && isExpectedProcess(proc.cmdLine, API_EXPECT)) {
    console.log(`✅ Ticket-API already running (PID ${proc.pid})`);
  } else {
    if (proc) {
      console.log(`⚠️ Port ${API_PORT} occupied by PID ${proc.pid}, freeing...`);
      freePort(API_PORT);
    }
    console.log('🚀 Starting Ticket-API...');
    spawn('bun', ['run', 'api'], { stdio: 'inherit', shell: true });
    const okApi = await waitForHttp(`http://localhost:${API_PORT}/api/health`, 20000);
    if (!okApi) {
      console.error('❌ Ticket-API failed to start');
      process.exit(1);
    }
    console.log('✅ Ticket-API READY');
  }

  console.log('🎉 Dev environment READY');
}

function stop() {
  let killed = false;
  if (freePort(DEV_PORT)) killed = true;
  if (freePort(API_PORT)) killed = true;
  if (killed) console.log('🛑 Servers stopped');
  else console.log('ℹ️ No servers running');
}

function status() {
  const dev = getProcessOnPort(DEV_PORT);
  const api = getProcessOnPort(API_PORT);
  console.table([
    {
      service: 'Five-Server',
      port: DEV_PORT,
      running: !!dev,
      pid: dev?.pid || '-',
    },
    { service: 'Ticket-API', port: API_PORT, running: !!api, pid: api?.pid || '-' },
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