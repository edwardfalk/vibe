import { test, expect } from '@playwright/test';

// Basic gameplay probe using Playwright evaluation
const GAME_URL = process.env.GAME_URL || 'http://localhost:5500';

/**
 * Boot the game and wait for core systems to be available.
 */
const bootGame = async (page) => {
  await page.goto(GAME_URL);
  await page.waitForSelector('canvas');
  await page.click('canvas', { position: { x: 400, y: 300 } });
  await page.waitForFunction(
    () =>
      window.gameState &&
      window.player &&
      Array.isArray(window.enemies) &&
      window.enemies.filter((enemy) => !enemy.markedForRemoval).length > 0
  );
};

test.describe('Gameplay Probes', () => {
  test('Liveness probe passes', async ({ page }) => {
    await bootGame(page);
    const probe = await page.evaluate(async () => {
      const mod = await import('/js/ai-liveness-probe.js');
      return mod.runAiLivenessProbe();
    });

    expect(probe.failure).toBeNull();
    expect(probe.playerAlive).toBe(true);
    expect(probe.enemyCount).toBeGreaterThan(0);
  });

  test('Game loop advances with live entities', async ({ page }) => {
    await bootGame(page);

    const before = await page.evaluate(() => ({
      frameCount: window.frameCount ?? 0,
      enemyCount: Array.isArray(window.enemies)
        ? window.enemies.filter((enemy) => !enemy.markedForRemoval).length
        : 0,
      playerAlive: !!window.player && !window.player.markedForRemoval,
    }));

    await page.waitForTimeout(500);

    const after = await page.evaluate(() => ({
      frameCount: window.frameCount ?? 0,
      enemyCount: Array.isArray(window.enemies)
        ? window.enemies.filter((enemy) => !enemy.markedForRemoval).length
        : 0,
      playerAlive: !!window.player && !window.player.markedForRemoval,
    }));

    expect(after.frameCount).toBeGreaterThan(before.frameCount);
    expect(after.enemyCount).toBeGreaterThan(0);
    expect(after.playerAlive).toBe(true);
  });
});
