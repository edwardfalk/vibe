import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup() {
  const url = 'http://localhost:3001/api/health';
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) {
      console.log('✅ Ticket API already running.');
      return;
    }
  } catch {
    // not running – spawn detached API server
  }

  console.log('⚙️  Starting Ticket API for Playwright tests…');

  // Attempt to free port 3001 first to avoid EADDRINUSE
  try {
    await new Promise((resolve) => {
      const kill = spawn('bunx', ['kill-port', '3001'], {
        shell: true,
        stdio: 'inherit',
      });
      kill.on('close', () => resolve());
    });
    console.log('🚪 Cleared port 3001');
  } catch {}

  const apiProcess = spawn('bun', ['run', 'api'], {
    cwd: path.resolve(__dirname, '..'), // run from project root
    shell: true,
    stdio: 'pipe',
    detached: true,
  });

  apiProcess.stdout.on('data', (data) => {
    console.log(`[TicketAPI STDOUT]: ${data}`);
  });

  apiProcess.stderr.on('data', (data) => {
    console.error(`[TicketAPI STDERR]: ${data}`);
  });

  apiProcess.on('close', (code) => {
    console.log(`[TicketAPI] process exited with code ${code}`);
  });

  apiProcess.unref();

  // Wait for the server to be ready
  await new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 15) { // ~15 seconds timeout
        clearInterval(interval);
        console.warn('⚠️ Ticket API did not respond within 15 seconds. Assuming it\'s already running and proceeding.');
        resolve();
        return;
      }

      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) {
          clearInterval(interval);
          console.log('✅ Ticket API started successfully.');
          resolve();
        }
      } catch {
        // ignore, try again
      }
    }, 1000);
  });
}

export default globalSetup; 