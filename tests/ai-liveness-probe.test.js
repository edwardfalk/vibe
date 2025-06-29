import { test, expect } from '@playwright/test';
import { INDEX_PAGE } from './playwright.setup.js';

test.describe('AI Liveness Probe', () => {
  test('Game loop, player, and enemies are alive', async ({ page }) => {
    await page.goto(INDEX_PAGE);
    await page.waitForSelector('canvas');
    // Click canvas to enable audio/context
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      canvas && canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // Run the probe
    const result = await page.evaluate(async () => {
      const mod = await import('@vibe/tooling/src/probes/ai-liveness-probe.js');
      return mod.default || mod;
    });
    expect(result.failure).toBeNull();
    expect(result.playerAlive).toBe(true);
    expect(result.enemyCount).toBeGreaterThan(0);
  });
});
