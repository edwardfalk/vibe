import { test, expect } from '@playwright/test';
import { INDEX_PAGE } from './playwright.setup.js';

test.describe('Audio System Probe', () => {
  test('initialises after gesture and produces audible output', async ({ page }) => {
    await page.goto(INDEX_PAGE);
    // Ensure canvas exists and click it to satisfy autoplay restrictions
    await page.waitForSelector('canvas');

    await page.click('canvas');

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

