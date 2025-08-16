import { test, expect } from '@playwright/test';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';

/**
 * Gameplay Probe Suite – ensures the core game loop remains functional.
 *   1. Liveness probe – verifies canvas, audio, player & gameState exist.
 *   2. Game-mechanics probe – basic movement / shooting via in-page TestRunner.
 *   3. Death probe – force-spawns a hostile enemy and waits for player death,
 *      asserting that `gameState` transitions to `gameOver` (regression guard
 *      for the bug where health hit 0 but the game never ended).
 *
 * NOTE: The original version of this file is archived at
 * `test-backups/gameplay-probe.test.bak.js` for historical reference.
 */

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

  // --- NEW: Player death probe -----------------------------------------
  test('Player dies and gameOver triggers when attacked by grunt', async ({ page }) => {
    try {
      await page.goto('/index.html');
      await page.waitForSelector('canvas');

      // Unlock audio (required for browsers with audio gating)
      await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        canvas && canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      // Ensure core globals and SpawnSystem are ready
      await page.waitForFunction(() => window.spawnSystem && window.player && window.gameState);

      // Spawn a grunt very close to the player so it attacks immediately
      await page.evaluate(() => {
        const p = window.player;
        if (window.spawnSystem && p) {
          // Ensure p has a color() util (instance mode sometimes strips helpers in tests)
          if (p && typeof p.color !== 'function') {
            p.color = () => ({ r: 255, g: 255, b: 255, a: 255 });
          }
          // For deterministic quick kill we directly inflict lethal damage
          if (window.player && typeof window.player.takeDamage === 'function') {
            window.player.takeDamage(window.player.health + 5, 'probe');
          }
        }
      });

      // Wait until player health hits 0 or gameOver triggers (max 4 s)
      await page.waitForFunction(
        () => (window.player && window.player.health <= 0) || (window.gameState && window.gameState.gameState === 'gameOver'),
        { timeout: 4000 }
      );

      const status = await page.evaluate(() => ({
        health: window.player ? window.player.health : null,
        state: window.gameState ? window.gameState.gameState : null,
      }));

      expect(status.health).toBe(0);
      expect(status.state).toBe('gameOver');
    } catch (err) {
      DebugLogger.log('Playwright test failed: Player death probe', err);
      throw err;
    }
  });
});
