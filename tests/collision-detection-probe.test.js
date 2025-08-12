import { test, expect } from '@playwright/test';
import { INDEX_PAGE, waitForDrawStart, gotoIndex } from './playwright.setup.js';

test.describe('Collision Detection Probe', () => {
  test('Bullet and entity collision handling', async ({ page }) => {
    await gotoIndex(page);
    await page.waitForSelector('canvas');
    await page.click('canvas');
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
