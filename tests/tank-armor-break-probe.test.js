import { test, expect } from '@playwright/test';
import { INDEX_PAGE, gotoIndex } from './playwright.setup.js';

test.describe('Tank Armor Break VFX Probe', () => {
  test('Cracks and debris appear when tank armor breaks', async ({ page }) => {
    try {
      await gotoIndex(page);
      console.log('Page URL after goto:', page.url());
      console.log('Page content:', await page.content());
    } catch (e) {
      console.error('Navigation failed:', e);
    }
    await page.waitForSelector('canvas');
    // Click canvas to enable audio/context
    await page.click('canvas');

    // Deterministic seed + manually spawn a tank for the test
    await page.evaluate(() => {
      return import('/packages/core/src/index.js').then(({ setRandomSeed }) =>
        setRandomSeed(1337)
      );
    });
    await page.evaluate(() => {
      if (window.spawnSystem && window.player) {
        const player = window.player;
        window.spawnSystem.forceSpawn('tank', player.x + 150, player.y);
      } else {
        console.error('window.spawnSystem or player not available.');
      }
    });

    // Wait for tank to be in the enemies array
    await page.waitForFunction(() =>
      (window.enemies || []).some((e) => e.type === 'tank')
    );

    // Run the probe
    const result = await page.evaluate(async () => {
      const mod = await import(
        '@vibe/tooling/probes/tank-armor-break-probe.js'
      );
      return mod.default || mod;
    });
    expect(result.foundTank).toBe(true);
    expect(result.cracksVisible).toBe(true);
    expect(result.debrisSpawned).toBe(true);
    expect(result.failure).toBeNull();
  });
});
