const { test, expect } = require('@playwright/test');

// Basic gameplay probe using Playwright evaluation

test.describe('Gameplay Probes', () => {
  test('Liveness probe passes', async ({ page }) => {
    await page.goto('/');
    await page.click('canvas');
    await page.waitForFunction(() => window.gameState && window.player && window.audio);
    const probe = await page.evaluate(async () => {
      const mod = await import('../js/ai-liveness-probe.js');
      return mod.default;
    });
    expect(probe.failure).toBeNull();
    expect(probe.playerAlive).toBe(true);
  });

  test('Game mechanics respond', async ({ page }) => {
    await page.goto('/');
    await page.click('canvas');
    await page.waitForFunction(() => window.testRunner && window.player);
    const result = await page.evaluate(async () => {
      return await window.testRunner.testGameMechanics();
    });
    expect(result.movement).toBeTruthy();
    expect(result.shooting).toBeTruthy();
    expect(result.enemies).toBeTruthy();
  });
});
