// playwright.setup.js
// Extends the base Playwright test runner with custom functionality.
// See: https://playwright.dev/docs/test-advanced#test-fixtures
//
// This setup file does a few things:
// 1. **Custom Fixtures**: It could add custom fixtures if needed (none currently).
// 2. **Console Log Interception**: It intercepts all browser console logs.
//    - It prefixes them with `[BROWSER]` for easy identification.
//    - It filters out noisy, irrelevant logs from Vite and other tools.
// 3. **Exports**: It exports the modified `test` and `expect` objects for use
//    in the actual test files (`*.test.js`).

// Adjust the filter as needed for more/less verbosity.
import { test as base, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

const errorWarnLogs = [];
const allLogs = [];
const verbose = process.env.VERBOSE_CONSOLE_LOGS === '1';
const resultsDir = path.resolve('test-results');

async function ensureResultsDir() {
  try {
    await fs.mkdir(resultsDir, { recursive: true });
  } catch (e) {
    console.error('[Playwright setup] Failed to create test-results directory:', e);
  }
}

base.beforeEach(async ({ page }) => {
  page.on('console', (msg) => {
    const entry = `[${new Date().toISOString()}] [${msg.type()}] ${msg.text()}`;
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errorWarnLogs.push(entry);
    }
    if (verbose) {
      allLogs.push(entry);
    }
  });
});

base.afterAll(async () => {
  await ensureResultsDir();
  try {
    await fs.writeFile(path.join(resultsDir, 'playwright-browser-console-errors.log'), errorWarnLogs.join('\n'), 'utf8');
  } catch (e) {
    console.error('[Playwright setup] Failed to write errors/warnings log:', e);
  }
  if (verbose) {
    try {
      await fs.writeFile(path.join(resultsDir, 'playwright-browser-console-full.log'), allLogs.join('\n'), 'utf8');
    } catch (e) {
      console.error('[Playwright setup] Failed to write full verbose log:', e);
    }
  }
});

export { base as test, expect }; 