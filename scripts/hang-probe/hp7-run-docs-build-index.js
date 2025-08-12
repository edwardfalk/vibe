import { spawn } from 'child_process';

function runWithWatchdog(cmd, args, label, ms = 60000) {
  console.log(`[${label}] starting, watchdog=${ms}ms`);
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      shell: true,
      stdio: 'inherit',
      windowsHide: true,
    });
    const timer = setTimeout(() => {
      const dur = Date.now() - started;
      console.error(
        `⏳ WATCHDOG: ${label} timed out after ${dur}ms, killing child...`
      );
      try {
        child.kill('SIGKILL');
      } catch {}
      resolve({ label, timedOut: true, durationMs: dur });
    }, ms);
    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      const dur = Date.now() - started;
      console.log(
        `✅ ${label} exited code=${code} signal=${signal} in ${dur}ms`
      );
      resolve({ label, code, signal, timedOut: false, durationMs: dur });
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      const dur = Date.now() - started;
      console.error(`❌ ${label} error after ${dur}ms:`, err?.message || err);
      reject(err);
    });
  });
}

const res = await runWithWatchdog(
  'bun',
  ['run', 'docs:build-index'],
  'hp7-docs-build-index',
  60000
);
if (res.timedOut) process.exit(124);
process.exit(res.code ?? 0);
