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
    // Seed optional readiness
    await page.waitForFunction(() => window.gameState && window.player);
    // Dynamically import the probe runner and attach to window, then run
    const result = await page.evaluate(async () => {
      if (!window.probeRunner) {
        const mod = await import('@vibe/tooling/probes/comprehensive-probe-runner.js');
        window.probeRunner = await mod.default;
      }
      return await window.probeRunner.runAllProbes();
    });
    expect(result.summary.failed).toBe(0);
    expect(['excellent', 'good'].includes(result.overallHealth)).toBe(true);
  });
});
