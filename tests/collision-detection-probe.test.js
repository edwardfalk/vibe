import { test, expect } from '@playwright/test';
import { INDEX_PAGE } from './playwright.setup.js';

test.describe('Collision Detection Probe', () => {
  test('Bullet and entity collision handling', async ({ page }) => {
    await page.goto(INDEX_PAGE);
    await page.waitForSelector('canvas');
    // Click canvas to enable audio/context
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      canvas && canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // Run the probe
    const result = await page.evaluate(async () => {
      const mod = await import('@vibe/tooling/probes/collision-detection-probe.js');
      return mod.default || mod;
    });
    expect(result.failure).toBeNull();
    expect(result.collisionsChecked).toBe(true);
  });
});
