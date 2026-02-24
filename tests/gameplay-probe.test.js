import { test, expect } from '@playwright/test';

// Basic gameplay probe using Playwright evaluation
const GAME_URL = process.env.GAME_URL || 'http://localhost:5500';

/**
 * Boot the game and wait for core systems to be available.
 */
const bootGame = async (page) => {
  await page.goto(GAME_URL);
  const canvas = await page.waitForSelector('canvas');
  const box = await canvas.boundingBox();
  const centerX = box ? box.width / 2 : 400;
  const centerY = box ? box.height / 2 : 300;
  await page.click('canvas', { position: { x: centerX, y: centerY } });
  await page.waitForFunction(
    () =>
      window.gameState &&
      window.player &&
      window.collisionSystem &&
      Array.isArray(window.enemies) &&
      window.enemies.filter((enemy) => !enemy.markedForRemoval).length > 0 &&
      typeof window.frameCount === 'number' &&
      window.frameCount > 0
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

  test('Collision diagnostics API available', async ({ page }) => {
    await bootGame(page);

    const snapshot = await page.evaluate(() => {
      if (!window.collisionSystem?.getPerformanceSnapshot) return null;
      return window.collisionSystem.getPerformanceSnapshot();
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot).toHaveProperty('frameSampleSize');
    expect(snapshot).toHaveProperty('latestFrame');
    expect(snapshot).toHaveProperty('averages');
  });

  test('Score and health UI elements present', async ({ page }) => {
    await bootGame(page);

    const scoreEl = await page.locator('#score').textContent();
    const healthEl = await page.locator('#health').textContent();

    expect(scoreEl).toMatch(/Score:\s*\d+/);
    expect(healthEl).toMatch(/Health:\s*\d+/);
  });

  test('Game state is playing after boot', async ({ page }) => {
    await bootGame(page);

    const state = await page.evaluate(
      () => window.gameState?.gameState ?? null
    );
    expect(state).toBe('playing');
  });

  test('Player input affects position', async ({ page }) => {
    await bootGame(page);

    const before = await page.evaluate(() =>
      window.player && typeof window.frameCount === 'number'
        ? { x: window.player.x, y: window.player.y, frame: window.frameCount }
        : null
    );
    expect(before).not.toBeNull();

    await page.keyboard.down('w');
    // Wait for player movement; y decreases when moving up (canvas coords)
    await page.waitForFunction(
      ([startY, startFrame]) => {
        if (!window.player) return false;
        const moved = window.player.y < startY - 5;
        if (moved) return true;
        const framesAdvanced =
          typeof window.frameCount === 'number' &&
          window.frameCount >= startFrame + 60;
        if (framesAdvanced) {
          throw new Error(
            `Player did not move after 60 frames (startY=${startY}, currentY=${window.player.y})`
          );
        }
        return false;
      },
      [before.y, before.frame],
      { timeout: 3000 }
    );
    await page.keyboard.up('w');

    const after = await page.evaluate(() =>
      window.player ? { x: window.player.x, y: window.player.y } : null
    );
    expect(after).not.toBeNull();
    expect(after.y).toBeLessThan(before.y);
  });

  test('Enemy lifecycle cleanup removes marked enemies', async ({ page }) => {
    await bootGame(page);

    const before = await page.evaluate(() =>
      Array.isArray(window.enemies)
        ? window.enemies.filter((enemy) => !enemy.markedForRemoval).length
        : 0
    );
    expect(before).toBeGreaterThan(0);

    await page.evaluate(() => {
      const enemy = window.enemies.find(
        (candidate) => !candidate.markedForRemoval
      );
      if (enemy) {
        enemy.markedForRemoval = true;
      }
    });

    await page.waitForFunction(
      (countBefore) => {
        if (!Array.isArray(window.enemies)) return false;
        const alive = window.enemies.filter(
          (enemy) => !enemy.markedForRemoval
        ).length;
        return alive < countBefore;
      },
      before,
      { timeout: 3000 }
    );
  });

  test('Rusher explosion damage can drive game over state', async ({
    page,
  }) => {
    await bootGame(page);

    const result = await page.evaluate(() => {
      if (!window.player || !window.collisionSystem || !window.gameState) {
        return { ok: false, reason: 'missing-runtime' };
      }

      window.player.health = 1;
      window.collisionSystem.handleRusherExplosion(
        {
          x: window.player.x,
          y: window.player.y,
          radius: 999,
          damage: 50,
        },
        -1
      );

      return {
        ok: true,
        gameState: window.gameState.gameState,
        playerHealth: window.player.health,
      };
    });

    expect(result.ok).toBe(true);
    expect(result.playerHealth).toBeLessThanOrEqual(0);
    expect(result.gameState).toBe('gameOver');
  });

  test('Score and kill streak transitions stay consistent', async ({
    page,
  }) => {
    await bootGame(page);

    const snapshot = await page.evaluate(() => {
      if (!window.gameState) return null;
      window.gameState.score = 0;
      window.gameState.killStreak = 0;
      window.gameState.totalKills = 0;

      window.gameState.addKill();
      window.gameState.addScore(10);
      window.gameState.addKill();
      window.gameState.addScore(5);
      window.gameState.resetKillStreak();

      return {
        score: window.gameState.score,
        totalKills: window.gameState.totalKills,
        killStreak: window.gameState.killStreak,
      };
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot.score).toBe(15);
    expect(snapshot.totalKills).toBe(2);
    expect(snapshot.killStreak).toBe(0);
  });
});
