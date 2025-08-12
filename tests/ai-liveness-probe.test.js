import { test, expect } from '@playwright/test';
import { INDEX_PAGE } from './playwright.setup.js';

test.describe('AI Liveness Probe', () => {
  test('Game loop, player, and enemies are alive', async ({ page }) => {
    await page.goto(INDEX_PAGE);
    await page.waitForSelector('canvas');
    // Click canvas to enable audio/context
    await page.click('canvas');
    // Wait for core readiness
    await page.waitForFunction(() => window.gameState && window.player);
    // Run the probe
    await page.waitForFunction(() => Array.isArray(window.enemies) && window.enemies.length > 0, {}, { timeout: 10000 });
    const result = await page.evaluate(async () => {
      const mod = await import('@vibe/tooling/probes/ai-liveness-probe.js');
      return mod.default || mod;
    });
    expect(result.failure).toBeNull();
    expect(result.playerAlive).toBe(true);
    expect(result.enemyCount).toBeGreaterThan(0);
  });
});
