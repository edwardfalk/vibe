// scripts/port-utils.js
// Cross-platform port & process helpers for dev-server management.
// Windows-first implementation (netstat / wmic / taskkill) but POSIX fallback included.
// Author: Vibe Dev Automation

import { execSync, spawnSync } from 'child_process';
import { setTimeout as delay } from 'timers/promises';

/**
 * Return process info listening on the given TCP port, or null if free.
 * @param {number} port
 * @returns {{pid: number, cmdLine: string}|null}
 */
export function getProcessOnPort(port) {
  try {
    // Windows: netstat -ano | findstr :<port>
    const netstatRaw = execSync(`netstat -ano -p tcp | findstr :${port}`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: true,
      encoding: 'utf8',
    });
    const line = netstatRaw
      .split(/\r?\n/)
      .find((l) => l.includes('LISTENING'));
    if (!line) return null;
    const parts = line.trim().split(/\s+/);
    const pid = parseInt(parts.at(-1));
    if (isNaN(pid)) return null;

    let cmdLine = '';
    try {
      // wmic is present on Windows; for other OS we fall back to ps
      cmdLine = execSync(
        process.platform === 'win32'
          ? `wmic process where ProcessId=${pid} get CommandLine`
          : `ps -p ${pid} -o command=`,
        { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', shell: true }
      ).trim();
    } catch {
      /* ignore */
    }
    return { pid, cmdLine };
  } catch {
    return null; // no matches
  }
}

/**
 * Fuzzy check if cmdLine contains the expected identifier.
 * @param {string} cmdLine
 * @param {string|string[]} expect One or multiple substrings that must ALL match.
 */
export function isExpectedProcess(cmdLine = '', expect) {
  if (!cmdLine) return false;
  if (Array.isArray(expect)) return expect.every((e) => cmdLine.includes(e));
  return cmdLine.includes(expect);
}

/**
 * Kill the process on a port **only if** it's not the expected one.
 * If expected is falsy, always free the port (dangerous!).
 * @param {number} port
 * @param {string|string[]} [expect]
 */
export function freePort(port, expect) {
  const proc = getProcessOnPort(port);
  if (!proc) return false;
  if (expect && isExpectedProcess(proc.cmdLine, expect)) {
    // expected process, keep it
    return false;
  }
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', proc.pid, '/F', '/T'], { stdio: 'inherit' });
  } else {
    spawnSync('kill', ['-9', proc.pid], { stdio: 'inherit' });
  }
  return true;
}

/**
 * Simple HTTP GET poll until success or timeout (ms). Returns true if OK.
 */
export async function waitForHttp(url, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      // Try HEAD then GET; accept any <500 status as server alive (Five-Server may respond 304)
      let res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (res.status >= 500 || res.status === 405) {
        // Some static servers don't support HEAD – fall back to GET
        res = await fetch(url, { method: 'GET', cache: 'no-store' });
      }
      if (res.status < 500) {
        console.log(`[waitForHttp] ${url} alive with status ${res.status}`);
        return true;
      }
    } catch {
      // ignore
    }
    await delay(1000);
  }
  return false;
} 