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
export const INDEX_PAGE = '/index.html';

export async function gotoIndex(page) {
  // Use 'commit' to avoid races; subsequent waits handle readiness
  return page.goto(INDEX_PAGE, {
    waitUntil: 'commit',
    timeout: 30000,
  });
}

// Navigate to index with query parameters (e.g., testMode/scenario)
export async function gotoIndexWithParams(page, query = '') {
  const q = typeof query === 'string' ? query : new URLSearchParams(query).toString();
  const url = q ? `${INDEX_PAGE}?${q}` : INDEX_PAGE;
  return page.goto(url, { waitUntil: 'commit', timeout: 30000 });
}

async function ensureResultsDir() {
  try {
    await fs.mkdir(resultsDir, { recursive: true });
  } catch (e) {
    console.error(
      '[Playwright setup] Failed to create test-results directory:',
      e
    );
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
    await fs.writeFile(
      path.join(resultsDir, 'playwright-browser-console-errors.log'),
      errorWarnLogs.join('\n'),
      'utf8'
    );
  } catch (e) {
    console.error('[Playwright setup] Failed to write errors/warnings log:', e);
  }
  if (verbose) {
    try {
      await fs.writeFile(
        path.join(resultsDir, 'playwright-browser-console-full.log'),
        allLogs.join('\n'),
        'utf8'
      );
    } catch (e) {
      console.error('[Playwright setup] Failed to write full verbose log:', e);
    }
  }
}

export { setupConsoleLogInterception, writeConsoleLogs };

// Readiness gate: wait until p5 draw loop has started
export async function waitForDrawStart(page, timeout = 4000) {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.removeAttribute('data-hidden');
        canvas.style.visibility = 'visible';
      }
      const p5fc = window.p5 && window.p5.instance && window.p5.instance.frameCount;
      const pInst = window.player && window.player.p;
      const fc = typeof p5fc === 'number' ? p5fc : pInst?.frameCount;
      return typeof fc === 'number' && fc > 0;
    },
    { timeout }
  );
}

// Deterministic run helper: call before starting gameplay in a test
export async function setDeterministicSeed(page, seed = 1337) {
  await page.evaluate(
    ([s]) => {
      // dynamic import to avoid bundler assumptions
      return import('/packages/core/src/index.js').then(({ setRandomSeed }) =>
        setRandomSeed(s)
      );
    },
    [seed]
  );
}
