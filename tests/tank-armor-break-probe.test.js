import { test, expect } from './playwright.setup.js';

test.describe('Tank Armor Break VFX Probe', () => {
  test('Cracks and debris appear when tank armor breaks', async ({ page }) => {
    try {
      await page.goto('/');
      await page.goto('/index.html');
      console.log('Page URL after goto:', page.url());
      console.log('Page content:', await page.content());
    } catch (e) {
      console.error('Navigation failed:', e);
    }
    await page.waitForSelector('canvas');
    // Click canvas to enable audio/context
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      canvas && canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Manually spawn a tank for the test
    await page.evaluate(() => {
      if (window.spawnSystem) {
        const player = window.player;
        // Spawn the tank near the player but not directly on top
        window.spawnSystem.forceSpawn('tank', player.x + 150, player.y);
      } else {
        console.error("window.spawnSystem is not available to the test.");
      }
    });

    // Wait for tank to be in the enemies array
    await page.waitForFunction(() => (window.enemies || []).some(e => e.type === 'tank'));
    
    // Run the probe
    const result = await page.evaluate(async () => {
      const mod = await import('@vibe/tooling/src/probes/tank-armor-break-probe.js');
      return mod.default || mod;
    });
    expect(result.foundTank).toBe(true);
    expect(result.cracksVisible).toBe(true);
    expect(result.debrisSpawned).toBe(true);
    expect(result.failure).toBeNull();
  });
}); 