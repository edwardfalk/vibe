// minimal-import-probe.test.js
// Playwright probe to test minimal import of @vibe/game and capture all browser errors/console output
import { test, expect } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

const resultsDir = path.resolve('test-results');
const logFile = path.join(resultsDir, 'playwright-browser-console-errors.log');

// Utility to ensure results dir exists
async function ensureResultsDir() {
  try {
    await fs.mkdir(resultsDir, { recursive: true });
  } catch (e) {
    // ignore
  }
}

async function writeLogs(logs) {
  try {
    await ensureResultsDir();
    await fs.writeFile(logFile, logs.join('\n'), 'utf8');
    console.log(`[PROBE] Wrote logs to ${logFile}`);
  } catch (e) {
    console.error(
      `[PROBE] Failed to write to test-results, falling back to root:`,
      e
    );
    try {
      await fs.writeFile(
        'playwright-browser-console-errors.log',
        logs.join('\n'),
        'utf8'
      );
      console.log(
        '[PROBE] Wrote logs to fallback playwright-browser-console-errors.log'
      );
    } catch (e2) {
      console.error('[PROBE] Failed to write logs anywhere:', e2);
    }
  }
}

test('Minimal import of @vibe/game should not throw or cause duplicate declaration', async ({
  page,
}) => {
  const logs = [];
  page.on('console', (msg) => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    console.log(`[BROWSER][${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (error) => {
    const errorDetails = [
      `Error: ${error && (error.message || error.toString())}`,
      error && error.stack ? `\nStack:\n${error.stack}` : '',
      error && error.fileName ? `\nFile: ${error.fileName}` : '',
      error && error.lineNumber ? `\nLine: ${error.lineNumber}` : '',
      error && error.columnNumber ? `\nColumn: ${error.columnNumber}` : '',
      '\nFull error object:',
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
    ].join('\n');
    logs.push(`[PAGE ERROR DETAILS]\n${errorDetails}`);
    console.error(`[BROWSER][PAGE ERROR DETAILS]\n${errorDetails}`);
  });
  page.on('requestfailed', (req) => {
    logs.push(`[REQUEST FAILED] ${req.url()} - ${req.failure()?.errorText}`);
    console.error(
      `[BROWSER][REQUEST FAILED] ${req.url()} - ${req.failure()?.errorText}`
    );
  });
  page.on('response', (response) => {
    if (!response.ok()) {
      logs.push(
        `[RESPONSE ERROR] ${response.url()} - ${response.status()} ${response.statusText()}`
      );
      console.error(
        `[BROWSER][RESPONSE ERROR] ${response.url()} - ${response.status()} ${response.statusText()}`
      );
    }
  });

  await page.goto('/test-minimal.html');
  await page.waitForTimeout(3000); // Wait longer for errors to surface

  // Check DOM for error message
  const statusText = await page.textContent('#test-status');
  if (statusText && statusText.includes('failed')) {
    logs.push(`[DOM ERROR] #test-status: ${statusText}`);
    // Log error details from DOM if present
    const errorDetails = await page.textContent('#error-details');
    if (errorDetails) logs.push(`[DOM ERROR DETAILS]\n${errorDetails}`);
    // Log page HTML for diagnosis
    const html = await page.content();
    logs.push(`[PAGE HTML]\n${html}`);
  }

  // Always write a log file, even if empty
  await writeLogs(logs);

  // If any critical error or duplicate declaration, fail the test
  // Only count truly critical signals for this probe
  const errorLogs = logs.filter((l) => {
    const s = l.toLowerCase();
    const critical =
      s.includes('syntaxerror') ||
      s.includes('duplicate') ||
      s.includes('[page error details]') ||
      s.includes('[dom error]');
    return critical;
  });
  if (errorLogs.length) {
    console.log(
      '[MINIMAL-PROBE] critical logs:',
      JSON.stringify(errorLogs, null, 2)
    );
  }
  expect(errorLogs.length).toBe(0);
});
