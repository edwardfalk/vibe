import { test, expect } from '@playwright/test';
import { INDEX_PAGE } from './playwright.setup.js';

test.describe('Audio System Probe', () => {
  test('initialises after gesture and produces audible output', async ({ page }) => {
    await page.goto(INDEX_PAGE);
    // Ensure canvas exists and click it to satisfy autoplay restrictions
    await page.waitForSelector('canvas');

    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      canvas?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Wait for audio initialisation flag
    await page.waitForFunction(() => window.audio && window.audio._initialized === true, {}, { timeout: 5000 });

    // Run the probe inside the browser context
    const result = await page.evaluate(async () => {
      const mod = await import('@vibe/tooling/src/probes/audio-system-probe.js');
      return mod.default || mod;
    });

    expect(result.failure).toBeNull();
    expect(result.audio.masterLevel).toBeGreaterThan(0.01);
  });
});

