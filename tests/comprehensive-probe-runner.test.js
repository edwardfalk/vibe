import { test, expect } from '@playwright/test';
import {
  setupConsoleLogInterception,
  writeConsoleLogs,
  INDEX_PAGE,
  waitForDrawStart,
  gotoIndex,
} from './playwright.setup.js';

test.beforeEach(async ({ page }) => {
  setupConsoleLogInterception(page);
});

test.afterAll(async () => {
  await writeConsoleLogs();
});

test.describe('Comprehensive Probe Runner', () => {
  test('Overall gameplay and system integration', async ({ page }) => {
    await gotoIndex(page);
    await page.waitForSelector('canvas');
    // Click canvas to enable audio/context
    await page.click('canvas');
    await waitForDrawStart(page, 4000);
    // Seed optional readiness
    await page.waitForFunction(() => window.gameState && window.player);
    // Dynamically import the probe runner and attach to window, then run
    // Evaluate with one retry on navigation-reload race
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await page.evaluate(async () => {
          async function getRunner() {
            if (window.probeRunner) return window.probeRunner;
            try {
              const mod = await import(
                '@vibe/tooling/probes/comprehensive-probe-runner.js'
              );
              window.probeRunner = await mod.default;
              return window.probeRunner;
            } catch (e) {
              await new Promise((r) => setTimeout(r, 200));
              const mod = await import(
                '@vibe/tooling/probes/comprehensive-probe-runner.js'
              );
              window.probeRunner = await mod.default;
              return window.probeRunner;
            }
          }
          const runner = await getRunner();
          return await runner.runAllProbes();
        });
        break;
      } catch (e) {
        const msg = String(e || '');
        if (msg.includes('Execution context was destroyed') && attempt === 0) {
          await page.waitForTimeout(300);
          await waitForDrawStart(page, 4000);
          continue;
        }
        throw e;
      }
    }
    expect(result.summary.failed).toBe(0);
    expect(['excellent', 'good'].includes(result.overallHealth)).toBe(true);
  });
});
