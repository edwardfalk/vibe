import { test, expect } from '@playwright/test';

test.describe('Tank Armor Break VFX Probe', () => {
  test('Cracks and debris appear when tank armor breaks', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas');
    // Click canvas to enable audio/context
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      canvas && canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // Wait for tank to spawn
    await page.waitForFunction(() => (window.enemies || []).some(e => e.type === 'tank'));
    // Run the probe
    const result = await page.evaluate(async () => {
      const mod = await import('/js/tank-armor-break-probe.js');
      return mod.default || mod;
    });
    expect(result.foundTank).toBe(true);
    expect(result.cracksVisible).toBe(true);
    expect(result.debrisSpawned).toBe(true);
    expect(result.failure).toBeNull();
  });
}); 