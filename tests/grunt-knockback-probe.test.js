import { test, expect } from '@playwright/test';
import { INDEX_PAGE } from './playwright.setup.js';

test.describe('Grunt Knock-back VFX Probe', () => {
  test('Grunt moves after bullet hit (knock-back)', async ({ page }) => {
    await page.goto(INDEX_PAGE);
    await page.waitForSelector('canvas');
    // Click canvas to enable audio/context
    await page.click('canvas');
    // Deterministic seed + ensure a grunt exists
    await page.evaluate(() => {
      return import('/packages/core/src/index.js').then(({ setRandomSeed }) =>
        setRandomSeed(1337)
      );
    });
    await page.evaluate(() => {
      if (!(window.enemies || []).some((e) => e.type === 'grunt')) {
        if (window.spawnSystem) {
          const px = window.player?.x || 400,
            py = window.player?.y || 300;
          window.spawnSystem.forceSpawn?.('grunt', px + 120, py);
        }
      }
    });
    await page.waitForFunction(() =>
      (window.enemies || []).some(
        (e) => e.type === 'grunt' && !e.markedForRemoval
      )
    );
    // Run the probe
    const result = await page.evaluate(async () => {
      const mod = await import('@vibe/tooling/probes/grunt-knockback-probe.js');
      return mod.default || mod;
    });
    expect(result.foundGrunt).toBe(true);
    expect(result.knockbackDelta).toBeGreaterThan(0.5);
    expect(result.failure).toBeNull();
  });
});
