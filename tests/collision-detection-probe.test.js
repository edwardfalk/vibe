import { test, expect } from '@playwright/test';
import { INDEX_PAGE, waitForDrawStart, gotoIndex } from './playwright.setup.js';

test.describe('Collision Detection Probe', () => {
  test('Bullet and entity collision handling', async ({ page }) => {
    await gotoIndex(page);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('canvas', { state: 'attached' });
    try { await page.locator('canvas').click({ timeout: 2000 }); } catch {
      const vp = page.viewportSize() || { width: 800, height: 600 };
      try { await page.mouse.click(Math.floor(vp.width / 2), Math.floor(vp.height / 2)); }
      catch { await page.evaluate(() => document.querySelector('canvas')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))); }
    }
    await waitForDrawStart(page);
    await page.waitForFunction(() => Array.isArray(window.enemies));
    // Run the probe (after draw start)
    const result = await page.evaluate(async () => {
      const mod = await import(
        '@vibe/tooling/probes/collision-detection-probe.js'
      );
      return mod.default || mod;
    });
    expect(result.failure).toBeNull();
    expect(result.collisionsChecked).toBe(true);
  });
});
