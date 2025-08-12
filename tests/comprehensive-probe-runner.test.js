import { test, expect } from '@playwright/test';
import { setupConsoleLogInterception, writeConsoleLogs, INDEX_PAGE } from './playwright.setup.js';

test.beforeEach(async ({ page }) => {
  setupConsoleLogInterception(page);
});

test.afterAll(async () => {
  await writeConsoleLogs();
});

test.describe('Comprehensive Probe Runner', () => {
  test('Overall gameplay and system integration', async ({ page }) => {
    await page.goto(INDEX_PAGE);
    await page.waitForSelector('canvas');
    // Click canvas to enable audio/context
    await page.click('canvas');
    // Wait for p5 draw loop start to avoid reload races
    await page.waitForFunction(
      () => {
        const p5fc =
          window.p5 && window.p5.instance && window.p5.instance.frameCount;
        const pInst = window.player && window.player.p;
        const fc = typeof p5fc === 'number' ? p5fc : pInst?.frameCount;
        return typeof fc === 'number' && fc > 0;
      },
      { timeout: 4000 }
    );
    // Seed optional readiness
    await page.waitForFunction(() => window.gameState && window.player);
    // Dynamically import the probe runner and attach to window, then run
    const result = await page.evaluate(async () => {
      // Retry import once on navigation-reload race
      async function getRunner() {
        if (window.probeRunner) return window.probeRunner;
        try {
          const mod = await import('@vibe/tooling/probes/comprehensive-probe-runner.js');
          window.probeRunner = await mod.default;
          return window.probeRunner;
        } catch (e) {
          // brief wait and retry once
          await new Promise((r) => setTimeout(r, 200));
          const mod = await import('@vibe/tooling/probes/comprehensive-probe-runner.js');
          window.probeRunner = await mod.default;
          return window.probeRunner;
        }
      }
      const runner = await getRunner();
      return await runner.runAllProbes();
    });
    expect(result.summary.failed).toBe(0);
    expect(['excellent', 'good'].includes(result.overallHealth)).toBe(true);
  });
});
