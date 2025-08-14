// Deterministic lint runner for chat environments (cmd.exe)
// - Redirects full output to logs/lint.txt
// - Writes exit code to logs/lint.exit
// - Prints a one-line summary only
// - Always exits 0 to avoid hanging chat flows on non-zero exits

import { spawn } from 'child_process';
import { mkdirSync, createWriteStream, writeFileSync } from 'fs';
import { join } from 'path';

function ensureDir(p) {
  try {
    mkdirSync(p, { recursive: true });
  } catch {}
}

const cwd = process.cwd();
const logsDir = join(cwd, 'logs');
ensureDir(logsDir);
const logPath = join(logsDir, 'lint.txt');
const exitPath = join(logsDir, 'lint.exit');

const out = createWriteStream(logPath, { flags: 'w' });
const err = out; // combine

const args = [
  'eslint',
  '--cache',
  '--ext',
  '.js',
  'packages/**/*.js',
  'scripts/**/*.js',
  '*.js',
];

const bunx = process.platform === 'win32' ? 'bunx.cmd' : 'bunx';
const child = spawn(bunx, args, {
  cwd,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

child.stdout.pipe(out);
child.stderr.pipe(err);

child.on('close', (code) => {
  try {
    writeFileSync(exitPath, String(code ?? 0));
  } catch {}
  out.end(() => {
    const exitCode = code ?? 0;
    console.log(`lint finished: exit=${exitCode} log=logs/lint.txt`);
    // Exit 0 to avoid non-zero aborting higher-level orchestrations in chat
    process.exit(0);
  });
});
