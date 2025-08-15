import { test, expect } from '@playwright/test';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';

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
      await page.goto('/index.html');
      await page.waitForSelector('canvas');
      await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        canvas &&
          canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await page.waitForFunction(
        () => window.gameState && window.player && window.audio
      );
      const probe = await page.evaluate(async () => {
        try {
          const mod = await import(
            '/packages/tooling/src/probes/livenessProbe.js'
          );
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
      await page.goto('/index.html');
      await page.waitForSelector('canvas');
      await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        canvas &&
          canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
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
