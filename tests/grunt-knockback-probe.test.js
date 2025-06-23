import { test, expect } from './playwright.setup.js';

test.describe('Grunt Knock-back VFX Probe', () => {
  test('Grunt moves after bullet hit (knock-back)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas');
    // Click canvas to enable audio/context
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      canvas && canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // Wait for grunt to spawn
    await page.waitForFunction(() => (window.enemies || []).some(e => e.type === 'grunt'));
    // Run the probe
    const result = await page.evaluate(async () => {
      const mod = await import('/js/grunt-knockback-probe.js');
      return mod.default || mod;
    });
    expect(result.foundGrunt).toBe(true);
    expect(result.knockbackDelta).toBeGreaterThan(0.5);
    expect(result.failure).toBeNull();
  });
}); 