import { test, expect } from '@playwright/test';
import { INDEX_PAGE, gotoIndexWithParams, waitForDrawStart } from './playwright.setup.js';

test.describe('Audio System Probe', () => {
  test('initialises after gesture and produces measurable signal', async ({ page }) => {
    // echo browser logs to runner
    page.on('console', (msg) => console.log(`[browser][${msg.type()}] ${msg.text()}`));

    await gotoIndexWithParams(page, { testMode: '1', testScenario: 'audio-basic' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('canvas', { state: 'attached' });
    await waitForDrawStart(page, 8000);

    // Robust audio unlock with retries
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await page.locator('canvas').click({ timeout: 2000 });
        break;
      } catch (e) {
        try {
          const vp = page.viewportSize() || { width: 800, height: 600 };
          await page.mouse.click(Math.floor(vp.width / 2), Math.floor(vp.height / 2));
          break;
        } catch (e2) {
          // If page closed or context destroyed, re-open once
          const msg = String(e2 || e);
          if (attempt === 0 && (msg.includes('context') || msg.includes('closed'))) {
            await gotoIndexWithParams(page, { testMode: '1', testScenario: 'audio-basic' });
            await page.waitForSelector('canvas', { state: 'attached' });
            await waitForDrawStart(page, 4000);
            continue;
          }
          throw e2;
        }
      }
    }

    // Try explicit Tone unlock early (if available)
    await page.evaluate(async () => {
      try {
        if (window.Tone && window.Tone.context?.state !== 'running') {
          await window.Tone.start();
        }
      } catch {}
    });

    // Wait for audio facade to be present (skip draw gating)
    await page.waitForFunction(
      () => !!window.audio && typeof window.audio.playSound === 'function',
      {},
      { timeout: 10000 }
    );

    // Prefer deterministic test-mode runner when available
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const hasRunner = await page.evaluate(() => !!window.testAudio?.run);
        result = hasRunner
          ? await page.evaluate(() => window.testAudio.run())
          : await page.evaluate(async () => {
              const mod = await import('@vibe/tooling/probes/audio-system-probe.js');
              return mod.default || mod;
            });
        break;
      } catch (e) {
        const msg = String(e || '');
        if (attempt === 0 && msg.includes('Execution context was destroyed')) {
          await waitForDrawStart(page, 4000);
          continue;
        }
        throw e;
      }
    }

    // Assert on real signal detection
    expect(result.failure).toBeNull();
    expect(result.audio.exists).toBeTruthy();
    expect(result.signalDetected).toBeTruthy();
    expect(typeof result.dbPeak).toBe('number');
  });
});
