import { test, expect } from '@playwright/test';

/**
 * Lingering Dots Probe – detects big dot artefacts that remain on screen after enemy death.
 * Fails when >0 saturated pixels are found in full-canvas sample after ~3 seconds.
 * Thresholds may be tightened once the root cause is fixed.
 */

test('no lingering dots after grunt explosion', async ({ page }) => {
  await page.goto('http://localhost:5500');
  // wait for player & managers
  await page.waitForFunction(() => window.player && window.explosionManager);

  // kill a grunt at centre via ExplosionManager helper
  await page.evaluate(() => {
    const p = window.player.p;
    const cx = p.width / 2;
    const cy = p.height / 2;
    window.explosionManager.addKillEffect(cx, cy, 'grunt', 'bullet');
  });

  // sample canvas every 500 ms for 3 s to observe residual dots
  const samples: number[] = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    const count = await page.evaluate(() => {
      const p: any = (window as any).player?.p;
      if (!p) return -1;
      const ctx = (p.canvas as HTMLCanvasElement).getContext('2d');
      const { data } = ctx.getImageData(0, 0, p.width, p.height);
      let leaks = 0;
      for (let i = 0; i < data.length; i += 8 * 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 40) continue;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max - min > 60) {
          leaks++;
          if (leaks > 50) break;
        }
      }
      return leaks;
    });
    console.log(`🟡 lingering-dot-sample[${i}] = ${count}`);
    samples.push(count);
  }
  console.log('🟢 lingering-dot-samples:', samples.join(','));
  const final = samples[samples.length - 1];
  expect(final).toBe(0);
});
