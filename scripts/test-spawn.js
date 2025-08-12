import { spawn } from 'child_process';

const proc = spawn('bunx', ['--version'], {
  shell: true,
  stdio: 'inherit',
});

proc.on('close', (code) => {
  console.log('Process exited with code', code);
});
