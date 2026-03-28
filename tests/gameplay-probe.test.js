import { test, expect } from '@playwright/test';

/**
 * Boot the game and wait for core systems to be available.
 * Canvas is hidden (data-hidden) until first user interaction (autoplay policy).
 * Wait for canvas to be attached, then trigger unlock via keydown.
 */
const bootGame = async (page) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { state: 'attached' });
  // Trigger unlockAudioAndShowCanvas (keydown also registered)
  await page.keyboard.press(' ');
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
      const mod = await import('/js/testing/ai-liveness-probe.js');
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

    const { marked, targetId, countBefore } = await page.evaluate(() => {
      const enemies = Array.isArray(window.enemies) ? window.enemies : [];
      const countBefore = enemies.filter((e) => !e.markedForRemoval).length;
      const enemy = enemies.find((c) => !c.markedForRemoval);
      if (enemy) {
        enemy.markedForRemoval = true;
        return { marked: true, targetId: enemy.id, countBefore };
      }
      return { marked: false, targetId: null, countBefore };
    });

    expect(marked).toBe(true);
    expect(countBefore).toBeGreaterThan(0);

    await page.waitForFunction(
      (id) => {
        if (!Array.isArray(window.enemies)) return false;
        return !window.enemies.some((e) => e.id === id);
      },
      targetId,
      { timeout: 3000 }
    );
  });

  test('Rusher explosion damage can drive game over state', async ({
    page,
  }) => {
    await bootGame(page);

    const ok = await page.evaluate(() => {
      if (!window.player || !window.collisionSystem || !window.gameState) {
        return false;
      }
      window.player.health = 1;
      window.collisionSystem.handleRusherExplosion(
        {
          x: window.player.x,
          y: window.player.y,
          radius: 999,
          damage: 50,
        },
        null // rusherEnemy sentinel: no owner enemy reference
      );
      return true;
    });
    expect(ok).toBe(true);

    await page.waitForFunction(
      () =>
        window.gameState?.gameState === 'gameOver' &&
        window.player?.health <= 0,
      { timeout: 2000 }
    );
  });

  test('All enemy types can be spawned, damaged, and killed', async ({
    page,
  }) => {
    await bootGame(page);

    const results = await page.evaluate(() => {
      const p = window.player.p;
      const factory = window.spawnSystem.enemyFactory;
      const out = {};

      for (const type of ['grunt', 'rusher', 'tank', 'stabber']) {
        try {
          const enemy = factory.createEnemy(
            window.player.x + 150,
            window.player.y + 150,
            type,
            p
          );
          if (!enemy) {
            out[type] = { error: 'null enemy' };
            continue;
          }
          window.enemies.push(enemy);

          enemy.health = 1;
          const dmgResult = enemy.takeDamage(10, 0);
          out[type] = { ok: true, dmgResult: String(dmgResult) };
        } catch (e) {
          out[type] = { error: e.message };
        }
      }
      return out;
    });

    for (const type of ['grunt', 'rusher', 'tank', 'stabber']) {
      expect(results[type].error).toBeUndefined();
      expect(results[type].ok).toBe(true);
    }

    // Verify draw loop still running after enemy deaths
    const fc1 = await page.evaluate(() => window.frameCount);
    await page.waitForTimeout(500);
    const fc2 = await page.evaluate(() => window.frameCount);
    expect(fc2).toBeGreaterThan(fc1);
  });

  test('Bullet collision kills enemy and awards score', async ({ page }) => {
    await bootGame(page);

    const result = await page.evaluate(() => {
      const p = window.player.p;
      const factory = window.spawnSystem.enemyFactory;
      const gs = window.gameState;

      const scoreBefore = gs.score;
      const killsBefore = gs.totalKills;

      const grunt = factory.createEnemy(
        window.player.x + 30,
        window.player.y,
        'grunt',
        p
      );
      grunt.health = 1;
      window.enemies.push(grunt);

      window.collisionSystem.resolveBulletEnemyHit(
        {
          x: grunt.x,
          y: grunt.y,
          damage: 10,
          angle: 0,
          owner: 'player',
          checkCollision: () => true,
        },
        0,
        grunt
      );

      return {
        scoreIncreased: gs.score > scoreBefore,
        killsIncreased: gs.totalKills > killsBefore,
        markedForRemoval: grunt.markedForRemoval,
      };
    });

    expect(result.scoreIncreased).toBe(true);
    expect(result.killsIncreased).toBe(true);
    expect(result.markedForRemoval).toBe(true);
  });

  test('Stabber attack handler runs without error', async ({ page }) => {
    await bootGame(page);

    const result = await page.evaluate(() => {
      const p = window.player.p;
      const factory = window.spawnSystem.enemyFactory;

      const stabber = factory.createEnemy(
        window.player.x + 250,
        window.player.y,
        'stabber',
        p
      );
      window.enemies.push(stabber);

      // Run several update cycles
      for (let i = 0; i < 30; i++) {
        stabber.update(window.player.x, window.player.y, 16.67);
      }

      return {
        ok: true,
        x: stabber.x,
        y: stabber.y,
        health: stabber.health,
      };
    });

    expect(result.ok).toBe(true);
    expect(result.health).toBeGreaterThan(0);
  });

  test('Score and kill streak transitions stay consistent', async ({
    page,
  }) => {
    await bootGame(page);

    const snapshot = await page.evaluate(() => {
      if (!window.gameState) return null;
      const gs = window.gameState;
      gs.score = 0;
      gs.killStreak = 0;
      gs.totalKills = 0;

      gs.addKill();
      gs.addScore(10);
      gs.addKill();
      gs.addScore(5);
      gs.resetKillStreak();

      return {
        score: gs.score,
        totalKills: gs.totalKills,
        killStreak: gs.killStreak,
      };
    });

    expect(snapshot).not.toBeNull();
    expect(snapshot.score).toBe(15);
    expect(snapshot.totalKills).toBe(2);
    expect(snapshot.killStreak).toBe(0);
  });
});
