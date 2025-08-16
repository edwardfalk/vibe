import { test, expect } from '@playwright/test';

/**
 * Bullet Hits Enemy Dots Probe
 * Tests the specific scenario where player bullets hit and kill enemies
 * Verifies that explosion particles don't leave persistent colored dots
 * Based on user report: dots are mostly green and change color when bullets hit enemies
 */

test('bullet hits and kills enemy without leaving dots', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 30
  );

  console.log('💥 Testing bullet hits enemy explosion dots...');

  // Step 1: Clear existing entities and take baseline
  await page.evaluate(() => {
    if (window.gameState) {
      window.gameState.enemies = [];
      window.gameState.playerBullets = [];
      window.gameState.enemyBullets = [];
    }
    if (window.explosionManager) {
      window.explosionManager.explosions = [];
      window.explosionManager.fragmentExplosions = [];
      window.explosionManager.plasmaClouds = [];
    }
  });

  await page.waitForTimeout(200);

  const baseline = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0; // Grunt explosion color
    let yellowPixels = 0; // Stabber explosion color
    let pinkPixels = 0; // Rusher explosion color
    let brightPixels = 0;

    for (let i = 0; i < data.length; i += 16 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 60) continue;

      const brightness = (r + g + b) / 3;
      if (brightness > 120) brightPixels++;

      // Green pixels (grunt explosions: 50, 205, 50)
      if (g > 150 && g > r * 2 && g > b * 2 && a > 100) {
        greenPixels++;
      }

      // Yellow pixels (stabber explosions: 255, 215, 0)
      if (r > 180 && g > 180 && b < 100 && a > 100) {
        yellowPixels++;
      }

      // Pink pixels (rusher explosions: 255, 20, 147)
      if (r > 180 && b > 100 && g < 100 && a > 100) {
        pinkPixels++;
      }
    }

    return { greenPixels, yellowPixels, pinkPixels, brightPixels };
  });

  console.log('📊 Baseline before enemy creation:', baseline);

  // Step 2: Create a grunt enemy near the player
  const enemyCreated = await page.evaluate(() => {
    try {
      const p = window.player.p;
      const playerX = window.player.x;
      const playerY = window.player.y;

      if (typeof EnemyFactory !== 'undefined' && window.gameState) {
        // Create a grunt enemy positioned where a bullet can hit it
        const grunt = EnemyFactory.createEnemy(
          playerX + 60, // Close enough for easy hit
          playerY,
          'grunt',
          p,
          window.audio
        );

        window.gameState.enemies.push(grunt);
        console.log('👾 Created grunt enemy for bullet test');
        return {
          success: true,
          enemyCount: window.gameState.enemies.length,
          enemyPosition: { x: grunt.x, y: grunt.y },
          playerPosition: { x: playerX, y: playerY },
        };
      }
      return { success: false, error: 'EnemyFactory not available' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log('👾 Enemy creation result:', enemyCreated);
  expect(enemyCreated.success, 'Should successfully create enemy').toBe(true);

  // Step 3: Create player bullet aimed at the enemy
  await page.evaluate((enemyPos) => {
    const playerX = window.player.x;
    const playerY = window.player.y;

    // Calculate angle to enemy
    const dx = enemyPos.x - playerX;
    const dy = enemyPos.y - playerY;
    const angle = Math.atan2(dy, dx);

    if (typeof Bullet !== 'undefined' && window.gameState) {
      const bullet = new Bullet(
        playerX,
        playerY,
        angle,
        300, // Fast bullet to ensure hit
        'player'
      );

      window.gameState.playerBullets.push(bullet);
      console.log('🎯 Created bullet aimed at enemy');
    }
  }, enemyCreated.enemyPosition);

  // Step 4: Let the bullet travel and hit the enemy
  await page.waitForTimeout(500);

  // Step 5: Check if collision occurred and enemy died
  const collisionResult = await page.evaluate(() => {
    const enemies = window.gameState?.enemies || [];
    const bullets = window.gameState?.playerBullets || [];
    const explosions = window.explosionManager?.explosions?.length || 0;
    const fragments = window.explosionManager?.fragmentExplosions?.length || 0;

    return {
      enemyCount: enemies.length,
      bulletCount: bullets.length,
      explosionCount: explosions,
      fragmentCount: fragments,
      enemyStates: enemies.map((e) => ({ health: e.health, active: e.active })),
    };
  });

  console.log('💥 Collision result:', collisionResult);

  // Step 6: Sample canvas during explosion effects
  const duringExplosion = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0;
    let yellowPixels = 0;
    let pinkPixels = 0;
    let brightPixels = 0;

    for (let i = 0; i < data.length; i += 16 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 60) continue;

      const brightness = (r + g + b) / 3;
      if (brightness > 120) brightPixels++;

      // Green (grunt explosions)
      if (g > 150 && g > r * 2 && g > b * 2 && a > 100) {
        greenPixels++;
      }

      // Yellow (stabber explosions)
      if (r > 180 && g > 180 && b < 100 && a > 100) {
        yellowPixels++;
      }

      // Pink (rusher explosions)
      if (r > 180 && b > 100 && g < 100 && a > 100) {
        pinkPixels++;
      }
    }

    return { greenPixels, yellowPixels, pinkPixels, brightPixels };
  });

  console.log('💥 During explosion:', duringExplosion);

  // Step 7: Wait for explosion effects to finish
  await page.waitForTimeout(3000);

  // Step 8: Final check for persistent dots
  const afterExplosion = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const enemies = window.gameState?.enemies || [];
    const explosions = window.explosionManager?.explosions?.length || 0;
    const fragments = window.explosionManager?.fragmentExplosions?.length || 0;

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0;
    let yellowPixels = 0;
    let pinkPixels = 0;
    let suspiciousDots = [];

    // Thorough scan for persistent colored dots
    for (let y = 0; y < p.height; y += 6) {
      for (let x = 0; x < p.width; x += 6) {
        const i = (y * p.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 60) continue;

        // Look for persistent green dots (grunt explosion artifacts)
        if (g > 150 && g > r * 2 && g > b * 2 && a > 120) {
          greenPixels++;
          if (suspiciousDots.length < 5) {
            suspiciousDots.push({ x, y, color: 'green', r, g, b, a });
          }
        }

        // Look for persistent yellow dots (stabber explosion artifacts)
        if (r > 180 && g > 180 && b < 100 && a > 120) {
          yellowPixels++;
          if (suspiciousDots.length < 5) {
            suspiciousDots.push({ x, y, color: 'yellow', r, g, b, a });
          }
        }

        // Look for persistent pink dots (rusher explosion artifacts)
        if (r > 180 && b > 100 && g < 100 && a > 120) {
          pinkPixels++;
          if (suspiciousDots.length < 5) {
            suspiciousDots.push({ x, y, color: 'pink', r, g, b, a });
          }
        }
      }
    }

    return {
      enemyCount: enemies.length,
      explosionCount: explosions,
      fragmentCount: fragments,
      greenPixels,
      yellowPixels,
      pinkPixels,
      suspiciousDots,
    };
  });

  console.log('🧹 After explosion cleanup:', afterExplosion);

  if (afterExplosion.suspiciousDots.length > 0) {
    console.log(
      '📍 Suspicious explosion dots found:',
      afterExplosion.suspiciousDots
    );
  }

  // Analysis and assertions
  console.log('📊 Bullet hits enemy test analysis:');
  console.log(
    `   - Baseline: ${baseline.greenPixels} green, ${baseline.yellowPixels} yellow, ${baseline.pinkPixels} pink`
  );
  console.log(
    `   - During explosion: ${duringExplosion.greenPixels} green, ${duringExplosion.yellowPixels} yellow, ${duringExplosion.pinkPixels} pink`
  );
  console.log(
    `   - After explosion: ${afterExplosion.greenPixels} green, ${afterExplosion.yellowPixels} yellow, ${afterExplosion.pinkPixels} pink`
  );
  console.log(
    `   - Final state: ${afterExplosion.enemyCount} enemies, ${afterExplosion.explosionCount} explosions, ${afterExplosion.fragmentCount} fragments`
  );

  // Main assertions
  expect(
    afterExplosion.explosionCount,
    'All explosions should be cleaned up'
  ).toBe(0);
  expect(
    afterExplosion.fragmentCount,
    'All fragment explosions should be cleaned up'
  ).toBe(0);

  // The key test: explosion colored dots should be cleaned up
  if (duringExplosion.greenPixels > baseline.greenPixels) {
    expect(
      afterExplosion.greenPixels,
      'Green explosion dots should be cleaned up'
    ).toBeLessThan(duringExplosion.greenPixels * 0.2);
  }

  if (duringExplosion.yellowPixels > baseline.yellowPixels) {
    expect(
      afterExplosion.yellowPixels,
      'Yellow explosion dots should be cleaned up'
    ).toBeLessThan(duringExplosion.yellowPixels * 0.2);
  }

  if (duringExplosion.pinkPixels > baseline.pinkPixels) {
    expect(
      afterExplosion.pinkPixels,
      'Pink explosion dots should be cleaned up'
    ).toBeLessThan(duringExplosion.pinkPixels * 0.2);
  }

  expect(
    afterExplosion.suspiciousDots.length,
    'Should not have persistent explosion dots'
  ).toBeLessThan(3);

  console.log('✅ Bullet hits enemy dots test completed');
});
