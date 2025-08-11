import { withWatchdog } from './_common.js';
import { spawn } from 'child_process';

function run(cmd, args, label) {
  return new Promise((resolve, reject) => {
    const cp = spawn(cmd, args, {
      shell: true,
      stdio: 'inherit',
      windowsHide: true,
    });
    cp.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${label} exit ${code}`))
    );
    cp.on('error', reject);
  });
}

await withWatchdog(
  run('bunx', ['echo-cli', 'ok'], 'hp4-bunx-echo'),
  'hp4-bunx-echo',
  5000
);
process.exit(0);
