import { test, expect } from '@playwright/test';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';

/**
 * Stabber telegraph test
 *
 * Spawns a stabber, forces a dash, and ensures the preparation indicator
 * appears before the enemy starts moving.
 */
test.describe('Stabber telegraph', () => {
  test('indicator shows before dash movement', async ({ page }) => {
    try {
      await page.goto('/index.html');

      // Unlock audio by interacting with the canvas
      await page.waitForSelector('canvas');
      await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        canvas &&
          canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      // Wait for core globals
      await page.waitForFunction(
        () =>
          window.player &&
          window.spawnSystem &&
          window.gameState &&
          Array.isArray(window.gameState.enemies),
        { timeout: 10000 }
      );

      // Always allow stabbers to attack
      await page.evaluate(() => {
        if (window.beatClock) {
          window.beatClock.canStabberAttack = () => true;
        }
      });

      // Spawn stabber and begin prepare phase
      const enemyInfo = await page.evaluate(() => {
        const p = window.player;
        const spawnSystem = window.spawnSystem;
        if (!p || !spawnSystem) return null;
        if (p && typeof p.color !== 'function') {
          p.color = () => ({ r: 255, g: 255, b: 255, a: 255 });
        }
        const x = p.x + 250;
        const y = p.y;
        const enemy = spawnSystem.enemyFactory.createEnemy(x, y, 'stabber', p);
        window.gameState.enemies.push(enemy);
        enemy.stabPreparing = true;
        enemy.stabPreparingTime = 0;
        return { x, y, size: enemy.size };
      });

      // Let at least one frame render the indicator
      await page.waitForTimeout(100);

      // Capture screenshot while indicator is visible
      await page.screenshot({ path: 'stabber-prep.png' });

      // Sample pixel near the edge of the indicator
      const beforePixel = await page.evaluate(({ x, y, size }) => {
        const ctx = document.querySelector('canvas').getContext('2d');
        const data = ctx.getImageData(Math.round(x + size + 5), Math.round(y), 1, 1).data;
        return Array.from(data);
      }, enemyInfo);

      // Wait for dash to commence
      await page.waitForFunction(
        () => {
          const e = window.gameState.enemies[0];
          return e && e.isStabbing;
        },
        { timeout: 5000 }
      );

      // Allow frame to update and capture post-dash screenshot
      await page.waitForTimeout(100);
      await page.screenshot({ path: 'stabber-dash.png' });

      const afterPixel = await page.evaluate(({ x, y, size }) => {
        const ctx = document.querySelector('canvas').getContext('2d');
        const data = ctx.getImageData(Math.round(x + size + 5), Math.round(y), 1, 1).data;
        return Array.from(data);
      }, enemyInfo);

      const dashPos = await page.evaluate(() => {
        const e = window.gameState.enemies[0];
        return { x: e.x, y: e.y };
      });

      // Indicator should color the sampled pixel before dash
      expect(beforePixel[0] + beforePixel[1] + beforePixel[2]).toBeGreaterThan(0);
      // After dash begins, pixel reverts to background (black)
      expect(afterPixel[0] + afterPixel[1] + afterPixel[2]).toBe(0);
      // Ensure stabber moved from original position
      const dx = dashPos.x - enemyInfo.x;
      const dy = dashPos.y - enemyInfo.y;
      expect(Math.hypot(dx, dy)).toBeGreaterThan(1);
    } catch (err) {
      DebugLogger.log('Playwright test failed: stabber telegraph', err);
      throw err;
    }
  });
});

