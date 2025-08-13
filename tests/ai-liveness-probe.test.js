import { test, expect } from '@playwright/test';
import { INDEX_PAGE, waitForDrawStart, gotoIndex } from './playwright.setup.js';

test.describe('AI Liveness Probe', () => {
  test('Game loop, player, and enemies are alive', async ({ page }) => {
    await gotoIndex(page);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('canvas', { state: 'attached' });
    // Prefer locator click; fallback to mouse center; dispatchEvent last
    try { await page.locator('canvas').click({ timeout: 2000 }); } catch {
      const vp = page.viewportSize() || { width: 800, height: 600 };
      try { await page.mouse.click(Math.floor(vp.width / 2), Math.floor(vp.height / 2)); }
      catch { await page.evaluate(() => document.querySelector('canvas')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))); }
    }
    await waitForDrawStart(page);
    await page.waitForFunction(() => window.gameState && window.player);
    // Run the probe
    await page.waitForFunction(
      () => Array.isArray(window.enemies) && window.enemies.length > 0,
      {},
      { timeout: 10000 }
    );
    const result = await page.evaluate(async () => {
      const mod = await import('@vibe/tooling/probes/ai-liveness-probe.js');
      return mod.default || mod;
    });
    expect(result.failure).toBeNull();
    expect(result.playerAlive).toBe(true);
    expect(result.enemyCount).toBeGreaterThan(0);
  });
});
