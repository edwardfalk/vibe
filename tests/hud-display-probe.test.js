import { test, expect } from '@playwright/test';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';

/**
 * HUD Display Probe
 * -----------------
 * Ensures that the core HUD elements render with their initial values.
 * This guards against regressions where the UI fails to mount or shows
 * incorrect defaults before the game loop begins.
 */

test.describe('HUD Display Probe', () => {
  test('shows initial score, health and level', async ({ page }) => {
    try {
      await page.goto('/index.html');
      await page.waitForSelector('#score');

      const scoreText = await page.textContent('#score');
      const healthText = await page.textContent('#health');
      const levelText = await page.textContent('#level');

      expect(scoreText).toBe('Score: 0');
      expect(healthText).toBe('Health: 100');
      expect(levelText).toBe('Level: 1');
    } catch (err) {
      DebugLogger.log('HUD probe failure', err);
      throw err;
    }
  });
});
