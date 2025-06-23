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
  const apiProcess = spawn('bun', ['ticket-api.js'], {
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
        reject(new Error('Ticket API failed to start in time.'));
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