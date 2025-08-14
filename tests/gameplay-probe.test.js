import { test, expect } from '@playwright/test';
import {
  INDEX_PAGE,
  setDeterministicSeed,
  gotoIndex,
} from './playwright.setup.js';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';

// Print all browser console logs to the test runner output for every test
// This makes browser-side errors and logs visible in CI and local runs
test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => {
    // Print all browser logs to the test runner output
    console.log(`[browser][${msg.type()}] ${msg.text()}`);
  });
});

process.on('uncaughtException', (err) =>
  DebugLogger.log('Uncaught Exception (test)', err)
);
process.on('unhandledRejection', (err) =>
  DebugLogger.log('Unhandled Rejection (test)', err)
);

test.beforeAll(() => {
  DebugLogger.log('Playwright test suite started');
});

// Basic gameplay probe using Playwright evaluation

test.describe('Gameplay Probes', () => {
  test('Liveness probe passes', async ({ page }) => {
    try {
      await gotoIndex(page);
      await page.waitForSelector('canvas');
      await setDeterministicSeed(page, 1337);
      await page.click('canvas');
      await page.waitForFunction(
        () =>
          window.gameState &&
          window.gameState.gameState === 'playing' &&
          window.player,
        {},
        { timeout: 15000 }
      );
      const probe = await page.evaluate(async () => {
        try {
          const mod = await import('@vibe/tooling/probes/ai-liveness-probe.js');
          return mod.default;
        } catch (err) {
          window.__playwrightImportError = err.stack || err.toString();
          return { failure: 'Import failed', error: err.toString() };
        }
      });
      if (probe.failure || probe.error) {
        DebugLogger.log(
          'Liveness probe import or runtime failure',
          probe.error || probe.failure
        );
      }
      expect(probe.failure).toBeNull();
      expect(probe.playerAlive).toBe(true);
    } catch (err) {
      DebugLogger.log('Playwright test failed: Liveness probe passes', err);
      throw err;
    }
  });

  test('Game mechanics respond', async ({ page }) => {
    try {
      await gotoIndex(page);
      await page.waitForSelector('canvas');
      await setDeterministicSeed(page, 1337);
      await page.click('canvas');
      await page.waitForFunction(() => window.testRunner && window.player);
      const result = await page.evaluate(async () => {
        try {
          return await window.testRunner.testGameMechanics();
        } catch (err) {
          window.__playwrightTestRunnerError = err.stack || err.toString();
          return { error: err.toString() };
        }
      });
      if (result.error) {
        DebugLogger.log('Game mechanics probe error', result.error);
      }
      expect(result.movement).toBeTruthy();
      expect(result.shooting).toBeTruthy();
      expect(result.enemies).toBeTruthy();
    } catch (err) {
      DebugLogger.log('Playwright test failed: Game mechanics respond', err);
      throw err;
    }
  });
});
