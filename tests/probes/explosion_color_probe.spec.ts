import { test, expect } from '@playwright/test';

// Capture browser console for DEBUG_VFX logs
test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => {
    const txt = msg.text();
    if (txt.includes('💥') || txt.includes('⚔️')) {
      // eslint-disable-next-line no-console
      console.log('🖥 [browser]', txt);
    }
  });
});

// Assumptions:
// * Dev server running at http://localhost:5500 (Five-Server).
// * Vibe engine exposes window.visualEffectsManager & ExplosionManager.
// * Probe waits for canvas readiness, injects a deterministic explosion,
//   advances frames, then analyses pixel data to ensure explosion particles
//   match expected enemy palette (grunt-green) and no magenta/yellow residue.

test.describe('Explosion colour fidelity', () => {
  test('grunt explosion renders green and leaves no magenta/yellow residue', async ({
    page,
  }) => {
    // 1. Navigate to running dev instance
    await page.goto('http://localhost:5500');

    // 2. Wait for p5 canvas & player object
    await page.waitForFunction(
      () => window.player && window.visualEffectsManager
    );

    // Ensure p5 instance exists before instrumentation
    await page.waitForFunction(
      () => window.player && window.player.p && window.player.p.blendMode
    );

    // Inject blend spy now (player.p guaranteed)
    await page.evaluate(() => {
      if (window.__BLEND_SPY__) return;
      const p = window.player.p;
      const orig = p.blendMode.bind(p);
      p._curBlend = p.BLEND;
      p.blendMode = function (m) {
        console.log(`🎨 ${p._curBlend} -> ${m}`);
        p._curBlend = m;
        return orig(m);
      };
      const oldDraw = p._draw;
      p._draw = function () {
        oldDraw.call(p);
        if (p._curBlend !== p.BLEND) {
          console.warn(`⚠️ frame ended in mode ${p._curBlend}`);
          orig(p.BLEND);
          p._curBlend = p.BLEND;
        }
      };
      window.__BLEND_SPY__ = true;
    });

    // 3. Inject deterministic seed & create a grunt explosion at center
    await page.evaluate(() => {
      // Stabilise RNG so pixel positions are deterministic across runs
      if (window.setRandomSeed) window.setRandomSeed(1337);
      // Determine center of canvas
      const p = window.player?.p;
      const cx = p?.width / 2;
      const cy = p?.height / 2;
      // Directly spawn kill-effect via ExplosionManager
      window.explosionManager.addKillEffect(cx, cy, 'grunt', 'bullet');
      // Fast-forward a few frames so particles are visible
      window.frameSkip = 0;
    });

    // 4. Wait ~30 frames (~500 ms) so particles render at full colour
    await page.waitForTimeout(500);

    // 5. Take screenshot of canvas region around explosion (100×100)
    const bbox = await page.evaluate(() => {
      const p = window.player?.p;
      return { x: p.width / 2 - 50, y: p.height / 2 - 50, w: 100, h: 100 };
    });
    const screenshot = await page.screenshot({
      clip: { x: bbox.x, y: bbox.y, width: bbox.w, height: bbox.h },
    });

    // 6. Analyse pixel data; ensure average hue is greenish (G channel > R,B)
    const img = await page.context().newPage();
    await img.setContent(
      `<img id="shot" src="data:image/png;base64,${screenshot.toString('base64')}"/>`
    );
    const stats = await img.evaluate(() => {
      const canvas = document.createElement('canvas');
      const imgElem = document.getElementById('shot') as HTMLImageElement;
      canvas.width = imgElem.width;
      canvas.height = imgElem.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgElem, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let r = 0,
        g = 0,
        b = 0,
        count = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Ignore near-black pixels (background)
        if (data[i + 3] < 20) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      return { r: r / count, g: g / count, b: b / count };
    });
    await img.close();

    // 7. Assert green dominance and low red/blue dominance (no magenta/yellow)
    expect(stats.g).toBeGreaterThan(stats.r + 30);
    expect(stats.g).toBeGreaterThan(stats.b + 30);
  });
});
