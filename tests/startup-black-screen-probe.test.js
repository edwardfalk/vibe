import { test, expect } from '@playwright/test';
import { INDEX_PAGE } from './playwright.setup.js';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';

/**
 * Startup Black-Screen Probe
 * -------------------------
 * 1. Loads the root URL (Five Server dev server assumed on /).
 * 2. Clicks the canvas to unlock audio / start the game.
 * 3. Waits two seconds for GameLoop setup.
 * 4. Evaluates critical runtime indicators (player, enemies, gameState).
 * 5. Fails the test and captures a screenshot if the game fails to enter the
 *    expected 'playing' state (symptom: black screen with only start text).
 */

test.describe('Startup Black-Screen Probe', () => {
  test.beforeAll(() => {
    DebugLogger.log('Playwright startup black screen probe started');
  });

  test('Game enters playing state after launch', async ({ page }, testInfo) => {
    try {
      await page.goto(INDEX_PAGE);
      await page.waitForSelector('canvas', { timeout: 5000 });

      // Simulate user interaction so Audio + p5 start correctly
      await page.click('canvas');

      // Give the GameLoop a moment to bootstrap everything
      await page.waitForTimeout(2000);

      const status = await page.evaluate(() => {
        return {
          playerExists: Boolean(window.player),
          enemiesCount: Array.isArray(window.enemies)
            ? window.enemies.length
            : -1,
          gameState: window.gameState?.gameState || null,
        };
      });

      if (!status.playerExists || status.gameState !== 'playing') {
        const screenshotPath = `tests/bug-reports/startup-failure-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        DebugLogger.log('🚨 Startup black-screen detected', status);
        DebugLogger.log('🚨 Screenshot captured at', screenshotPath);
      }

      // Assertions: must have a player and be in 'playing' state
      expect(status.playerExists).toBe(true);
      expect(status.gameState).toBe('playing');
    } catch (err) {
      DebugLogger.log('❌ Startup probe failure', err);
      throw err;
    }
  });
});
