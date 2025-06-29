// playwright.setup.js
// Extends the base Playwright test runner with custom functionality.
// See: https://playwright.dev/docs/test-advanced#test-fixtures
//
// This setup file now only exports helpers. Hooks must be registered in test files.

import { test as base, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

const errorWarnLogs = [];
const allLogs = [];
const verbose = process.env.VERBOSE_CONSOLE_LOGS === '1';
const resultsDir = path.resolve('test-results');

// Standard entry page for all browser tests
// Keep in sync with dev-server --root setting (`.`) and actual HTML location
export const INDEX_PAGE = '/public/index.html';

async function ensureResultsDir() {
  try {
    await fs.mkdir(resultsDir, { recursive: true });
  } catch (e) {
    console.error('[Playwright setup] Failed to create test-results directory:', e);
  }
}

// Helper to set up console log interception on a page
function setupConsoleLogInterception(page) {
  page.on('console', (msg) => {
    const entry = `[${new Date().toISOString()}] [${msg.type()}] ${msg.text()}`;
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errorWarnLogs.push(entry);
    }
    if (verbose) {
      allLogs.push(entry);
    }
  });
}

// Helper to write logs after all tests
async function writeConsoleLogs() {
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
}

export { setupConsoleLogInterception, writeConsoleLogs }; 