import { test, expect } from '@playwright/test';
import { INDEX_PAGE } from './playwright.setup.js';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';

process.on('uncaughtException', (err) =>
  DebugLogger.log('Uncaught Exception (perf probe)', err)
);
process.on('unhandledRejection', (err) =>
  DebugLogger.log('Unhandled Rejection (perf probe)', err)
);

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

test.describe('Performance Probe', () => {
  test('Average FPS ≥ 55 under stress', async ({ page }) => {
    try {
      await page.goto(INDEX_PAGE);
      await page.waitForSelector('canvas');
      // Unlock audio / interactions
      await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        canvas && canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      // Ensure core systems exist
      await page.waitForFunction(() =>
        window.EffectsProfiler && window.spawnSystem && window.beatClock
      );
      // Spawn 20 of each enemy type for stress
      await page.evaluate(() => {
        // Reset my custom render profiler before the test
        window.renderProfiler?.reset();

        const types = ['grunt', 'rusher', 'tank', 'stabber'];
        if (window.spawnSystem && typeof window.spawnSystem.spawnEnemy === 'function') {
          types.forEach((t) => {
            for (let i = 0; i < 20; i++) {
              window.spawnSystem.spawnEnemy(t);
            }
          });
        } else if (window.spawnSystem && window.spawnSystem.spawnEnemies) {
          // fallback: bulk spawn
          window.spawnSystem.spawnEnemies(80);
        }
        // Show profiler overlay (press P via key event)
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'P' }));
      });

      // Wait 5 seconds of gameplay
      await wait(5000);

      const stats = await page.evaluate(() => {
        return window.EffectsProfiler ? window.EffectsProfiler.getStats() : null;
      });

      expect(stats).not.toBeNull();
      const fps = parseFloat(stats.fps);
      DebugLogger.log('Perf probe FPS', fps);
      expect(fps).toBeGreaterThanOrEqual(55);
    } catch (err) {
      DebugLogger.log('Performance probe failed', err);
      throw err;
    }
  });
}); 