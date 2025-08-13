import { test, expect } from '@playwright/test';
import { INDEX_PAGE, gotoIndex, waitForDrawStart } from './playwright.setup.js';

test.describe('Audio System Probe', () => {
  test('initialises after gesture and produces measurable signal', async ({ page }) => {
    await gotoIndex(page);

    // Prefer locator click; fallback to mouse center
    const canvas = page.locator('canvas');
    try {
      await canvas.click({ timeout: 2000 });
    } catch {
      const { width, height } = page.viewportSize() || { width: 800, height: 600 };
      await page.mouse.click(Math.floor(width / 2), Math.floor(height / 2));
    }

    // Try explicit Tone unlock early (if available)
    await page.evaluate(async () => {
      try {
        if (window.Tone && window.Tone.context?.state !== 'running') {
          await window.Tone.start();
        }
      } catch {}
    });

    // Wait for draw start and audio facade to be present
    await waitForDrawStart(page, 4000);
    await page.waitForFunction(
      () => !!window.audio && typeof window.audio.playSound === 'function',
      {},
      { timeout: 10000 }
    );

    // Run the probe inside the browser context
    const result = await page.evaluate(async () => {
      const mod = await import('@vibe/tooling/probes/audio-system-probe.js');
      return mod.default || mod;
    });

    // Assert on real signal detection
    expect(result.failure).toBeNull();
    expect(result.audio.exists).toBeTruthy();
    expect(result.signalDetected).toBeTruthy();
    expect(typeof result.dbPeak).toBe('number');
  });
});
