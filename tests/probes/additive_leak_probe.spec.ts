import { test, expect } from '@playwright/test';

// Detects lingering additive-blend artefacts after an explosion has fully faded.
// Passes when no highly saturated single-channel pixels remain.

test('no residual additive tint after explosion', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await page.waitForFunction(
    () => window.player && window.visualEffectsManager
  );

  // Spawn deterministic grunt explosion at centre
  await page.evaluate(() => {
    if (window.setRandomSeed) window.setRandomSeed(424242);
    const p = window.player.p;
    window.explosionManager.addKillEffect(
      p.width / 2,
      p.height / 2,
      'grunt',
      'bullet'
    );
  });

  // Wait 2 s so particles have faded
  await page.waitForTimeout(2000);

  // Screenshot entire canvas
  const full = await page.screenshot();

  // Analyse pixels
  const helper = await page.context().newPage();
  await helper.setContent(
    `<img id="ss" src="data:image/png;base64,${full.toString('base64')}"/>`
  );
  const viol = await helper.evaluate(() => {
    const img = document.getElementById('ss');
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let leaks = 0;
    for (let i = 0; i < data.length; i += 40 * 4) {
      // sample every 40 px
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 30) continue; // ignore background black
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min > 80) {
        leaks += 1;
        if (leaks > 10) break;
      }
    }
    return leaks;
  });
  await helper.close();

  expect(viol).toBe(0);
});
