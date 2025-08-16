// restart-desktopCommander.js – Restarts Desktop Commander MCP
import { spawn, spawnSync } from 'bun';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const LOG_DIR = join(process.cwd(), '.debug');
const LOG_FILE = join(LOG_DIR, 'desktop-commander-restart.log');
const PORT = 4333;

if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
const log = (msg) => {
  const ts = new Date().toISOString();
  appendFileSync(LOG_FILE, `[${ts}] ${msg}\n`, 'utf8');
};

function killExisting() {
  try {
    const out = spawnSync(['tasklist', '/v', '/fo', 'csv']);
    const txt = out.stdout.toString();
    const lines = txt.split('\n');
    // CSV columns: Image Name","PID",...
    const pids = [];
    for (const line of lines) {
      if (line.toLowerCase().includes('desktop-commander')) {
        const parts = line.split(',');
        if (parts.length > 1) {
          const pid = parts[1].replace(/"/g, '').trim();
          pids.push(pid);
        }
      }
    }
    if (pids.length) {
      for (const pid of pids) {
        spawnSync(['taskkill', '/F', '/PID', pid]);
        log(`Killed existing Desktop Commander PID ${pid}`);
      }
    }
  } catch (err) {
    log(`Error during killExisting: ${err.message}`);
  }
}

function startNew() {
  const child = spawn(
    [
      'bun',
      'x',
      '-y',
      '@wonderwhy-er/desktop-commander@latest',
      `--port=${PORT}`,
    ],
    {
      stdout: 'inherit',
      stderr: 'inherit',
      stdin: 'ignore',
      detached: true,
    }
  );
  log(`Spawned new Desktop Commander (pid ${child.pid}) on port ${PORT}`);
  child.unref();
  child.exited.then((code) => {
    log(`Desktop Commander exited with code ${code}`);
  });
}

async function main() {
  log('Restart attempt initiated');
  killExisting();
  startNew();
}

main();
