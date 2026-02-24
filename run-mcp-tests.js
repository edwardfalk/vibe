/**
 * run-mcp-tests.js
 * Real smoke test runner for gameplay probes.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_GAME_PORT = 5500;
const SERVER_WAIT_TIMEOUT_MS = 30000;
const SERVER_POLL_INTERVAL_MS = 500;
const PROBE_TEST_FILE = 'tests/gameplay-probe.test.js';
const MAX_PORT_ATTEMPTS = 10;

/**
 * Log tagged messages for CI visibility.
 */
function log(category, message, data = null) {
  const emojiByCategory = {
    test: '🧪',
    pass: '✅',
    fail: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    server: '🌐',
    error: '💥',
  };

  const emoji = emojiByCategory[category] || '📝';
  if (data) {
    console.log(`${emoji} ${message}`, data);
    return;
  }

  console.log(`${emoji} ${message}`);
}

/**
 * Start the local dev server used by Playwright smoke probes.
 */
function startServer(port) {
  log('server', `Starting local game server on port ${port}...`);
  const serverProcess = spawn('bun', ['run', 'five-server', `--port=${port}`], {
    cwd: __dirname,
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', (data) => {
    log('server', data.toString().trim());
  });

  serverProcess.stderr.on('data', (data) => {
    log('warn', data.toString().trim());
  });

  serverProcess.on('error', (error) => {
    log('error', 'Failed to start game server', error.message);
  });

  return serverProcess;
}

/**
 * Poll HTTP endpoint until the local server is ready.
 */
async function waitForServerReady(gameUrl) {
  const deadline = Date.now() + SERVER_WAIT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(gameUrl);
      if (response.ok) {
        log('pass', `Server is ready at ${gameUrl}`);
        return;
      }
    } catch (_error) {
      // Server not ready yet.
    }

    await new Promise((resolve) =>
      setTimeout(resolve, SERVER_POLL_INTERVAL_MS)
    );
  }

  throw new Error(
    `Server did not become ready within ${SERVER_WAIT_TIMEOUT_MS}ms`
  );
}

/**
 * Run gameplay probe tests through Playwright and return the exit code.
 */
function runPlaywrightSmoke(gameUrl) {
  return new Promise((resolve, reject) => {
    log('test', `Running Playwright smoke probes from ${PROBE_TEST_FILE}...`);
    const testProcess = spawn(
      'bunx',
      ['playwright', 'test', PROBE_TEST_FILE, '--reporter=line'],
      {
        cwd: __dirname,
        stdio: 'inherit',
        env: {
          ...process.env,
          GAME_URL: gameUrl,
        },
      }
    );

    testProcess.on('error', reject);
    testProcess.on('close', (exitCode) => resolve(exitCode ?? 1));
  });
}

/**
 * Stop local server process safely.
 */
function stopServer(serverProcess) {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  log('server', 'Stopping local game server...');
  serverProcess.kill('SIGTERM');
}

/**
 * Check whether a TCP port is available for binding.
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * Pick a port for the local test server.
 */
async function chooseGamePort() {
  for (let i = 0; i < MAX_PORT_ATTEMPTS; i++) {
    const candidatePort = DEFAULT_GAME_PORT + i;
    const available = await isPortAvailable(candidatePort);
    if (available) {
      return candidatePort;
    }
  }

  throw new Error(
    `Could not find an available port in range ${DEFAULT_GAME_PORT}-${DEFAULT_GAME_PORT + MAX_PORT_ATTEMPTS - 1}`
  );
}

/**
 * Orchestrate server startup, smoke probe execution, and shutdown.
 */
async function runMcpTests() {
  const startTime = Date.now();
  let serverProcess = null;
  let exitCode = 0;
  let gameUrl;

  try {
    if (process.env.GAME_URL) {
      gameUrl = process.env.GAME_URL;
    } else {
      const selectedPort = await chooseGamePort();
      gameUrl = `http://localhost:${selectedPort}`;
      serverProcess = startServer(selectedPort);
    }

    await waitForServerReady(gameUrl);

    const probeExitCode = await runPlaywrightSmoke(gameUrl);
    if (probeExitCode !== 0) {
      log('fail', `Gameplay probes failed with exit code ${probeExitCode}`);
      exitCode = probeExitCode;
    } else {
      log('pass', 'Gameplay probes passed');
      log('info', `Duration: ${Date.now() - startTime}ms`);
    }
  } catch (error) {
    log('error', 'MCP smoke runner failed', error.message);
    exitCode = 1;
  } finally {
    stopServer(serverProcess);
  }

  process.exit(exitCode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMcpTests().catch((err) => {
    log('error', 'MCP smoke runner failed', err.message);
    process.exit(1);
  });
}

export default runMcpTests;
