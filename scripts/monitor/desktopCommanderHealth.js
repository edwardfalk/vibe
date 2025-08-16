// desktopCommanderHealth.js – Checks Desktop Commander process & HTTP health every minute
import {
  writeFileSync,
  appendFileSync,
  statSync,
  renameSync,
  mkdirSync,
  existsSync,
} from 'fs';
import { join, dirname } from 'path';

// -----------------------------
// Simple CLI arg parser (very small)
// -----------------------------
const args = process.argv.slice(2);
function readFlag(flag, defaultVal) {
  const idx = args.findIndex((a) => a === flag || a.startsWith(flag + '='));
  if (idx === -1) return defaultVal;
  const val = args[idx].includes('=') ? args[idx].split('=')[1] : args[idx + 1];
  return val !== undefined ? val : defaultVal;
}

const INTERVAL_SEC = parseInt(readFlag('--interval', 60), 10);
const PROC_MATCH = readFlag('--proc', 'desktop-commander');
const PORT = readFlag('--port', '');
const ITERATIONS = readFlag('--iterations', ''); // for CI / tests

const LOG_DIR = join(process.cwd(), '.debug');
const LOG_FILE = join(LOG_DIR, 'desktop-commander-health.log');
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

function rotateIfNeeded() {
  try {
    const s = statSync(LOG_FILE);
    if (s.size > MAX_SIZE_BYTES) {
      const backup = LOG_FILE + '.1';
      try {
        renameSync(LOG_FILE, backup);
      } catch (_) {
        /* ignore */
      }
      writeFileSync(LOG_FILE, '');
    }
  } catch (_) {
    // file probably doesn’t exist yet – ignore
  }
}

function log(entryObj) {
  rotateIfNeeded();
  appendFileSync(LOG_FILE, JSON.stringify(entryObj) + '\n', 'utf8');
}

function isProcessRunning() {
  const proc = Bun.spawnSync(['tasklist', '/v', '/fo', 'csv']);
  const txt = proc.stdout.toString();
  return txt.toLowerCase().includes(PROC_MATCH.toLowerCase());
}

async function pingHTTP() {
  if (!PORT) return { ok: undefined, latency: undefined, note: 'http-skip' };
  const url = `http://127.0.0.1:${PORT}/get_config`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return { ok: res.ok, latency: Date.now() - start };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, latency: undefined, note: err.message };
  }
}

async function checkOnce() {
  const ts = new Date().toISOString();
  const procFound = isProcessRunning();
  const httpRes = await pingHTTP();
  log({ ts, procFound, ...httpRes });
}

async function main() {
  let remaining = ITERATIONS ? parseInt(ITERATIONS, 10) : Infinity;
  while (remaining > 0) {
    await checkOnce();
    remaining -= 1;
    if (remaining === 0) break;
    await new Promise((r) => setTimeout(r, INTERVAL_SEC * 1000));
  }
}

main();
