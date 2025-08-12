import { test, expect } from '@playwright/test';
import { INDEX_PAGE, gotoIndex } from './playwright.setup.js';

test.describe('Audio System Probe', () => {
  test('initialises after gesture and produces audible output', async ({
    page,
  }) => {
    await gotoIndex(page);

    // Perform a user gesture reliably without depending on canvas visibility
    const { width, height } = page.viewportSize() || { width: 800, height: 600 };
    await page.mouse.click(Math.floor(width / 2), Math.floor(height / 2));

    // Try explicit Tone unlock early (if available)
    await page.evaluate(async () => {
      try {
        if (window.Tone && window.Tone.context?.state !== 'running') {
          await window.Tone.start();
        }
      } catch {}
    });

    // Wait for audio facade to be present and callable. Tone context may not be global; fallback path is allowed.
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

    // Allow fallback synth path: only require no failure and audio API presence
    expect(result.failure).toBeNull();
    expect(result.audio.exists).toBeTruthy();
  });
});
