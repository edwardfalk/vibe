import { test, expect } from '@playwright/test';

/**
 * Enemy Glow Persistence Probe
 * Tests the specific issue where enemy glow effects persist after enemy death
 * Focuses on the proper cleanup of enemies from the render loop
 */

test('enemy glow effects disappear after death', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 10
  );

  console.log('🔍 Testing enemy glow persistence after death...');

  // Step 1: Create a clean baseline
  await page.evaluate(() => {
    // Clear all game entities
    if (window.gameState) {
      window.gameState.enemies = [];
      window.gameState.playerBullets = [];
      window.gameState.enemyBullets = [];
      window.gameState.activeBombs = [];
    }
    if (window.explosionManager) {
      window.explosionManager.explosions = [];
      window.explosionManager.plasmaClouds = [];
      window.explosionManager.fragmentExplosions = [];
    }
  });

  await page.waitForTimeout(100); // Let one frame pass

  // Step 2: Manually create a glowing enemy using the proper factory
  const enemyCreated = await page.evaluate(() => {
    try {
      const p = window.player.p;
      const centerX = p.width / 2;
      const centerY = p.height / 2;

      // Use the proper enemy factory
      if (typeof EnemyFactory !== 'undefined' && window.gameState) {
        const enemy = EnemyFactory.createEnemy(
          centerX + 100, // Offset from player so it's visible
          centerY,
          'grunt',
          p,
          window.audio
        );

        window.gameState.enemies.push(enemy);
        console.log('👾 Created grunt enemy at', centerX + 100, centerY);
        return { success: true, enemyCount: window.gameState.enemies.length };
      }
      return { success: false, error: 'EnemyFactory not available' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log('👾 Enemy creation result:', enemyCreated);
  expect(enemyCreated.success, 'Should successfully create enemy').toBe(true);
  expect(enemyCreated.enemyCount, 'Should have one enemy').toBe(1);

  // Step 3: Let the enemy render for a few frames to establish glow
  await page.waitForTimeout(300);

  // Step 4: Verify the enemy is visible and has glow
  const withEnemyState = await page.evaluate(() => {
    const enemies = window.gameState?.enemies || [];
    const enemy = enemies[0];

    if (!enemy) {
      return { error: 'No enemy found' };
    }

    // Sample canvas for green glow (grunt enemies are green)
    const p = window.player.p;
    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0;
    let brightPixels = 0;

    // Look around the enemy position for glow
    const enemyScreenX = enemy.x;
    const enemyScreenY = enemy.y;
    const searchRadius = 50; // Look in area around enemy

    for (let dy = -searchRadius; dy <= searchRadius; dy += 4) {
      for (let dx = -searchRadius; dx <= searchRadius; dx += 4) {
        const x = Math.round(enemyScreenX + dx);
        const y = Math.round(enemyScreenY + dy);

        if (x >= 0 && x < p.width && y >= 0 && y < p.height) {
          const i = (y * p.width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a > 50) {
            const brightness = (r + g + b) / 3;
            if (brightness > 100) brightPixels++;

            // Look for green-dominant pixels (grunt glow)
            if (g > 100 && g > r && g > b) {
              greenPixels++;
            }
          }
        }
      }
    }

    return {
      enemyHealth: enemy.health,
      enemyPosition: { x: enemy.x, y: enemy.y },
      greenPixels,
      brightPixels,
      enemyCount: enemies.length,
    };
  });

  console.log('👾 Enemy state with glow:', withEnemyState);
  expect(
    withEnemyState.greenPixels,
    'Enemy should have visible green glow'
  ).toBeGreaterThan(5);
  expect(withEnemyState.enemyCount, 'Should still have one enemy').toBe(1);

  // Step 5: Kill the enemy properly using the game's damage system
  await page.evaluate(() => {
    const enemies = window.gameState?.enemies || [];
    const enemy = enemies[0];

    if (enemy && typeof enemy.takeDamage === 'function') {
      // Use the proper damage system
      const result = enemy.takeDamage(999, 0, 'bullet');
      console.log('💥 Enemy takeDamage result:', result);

      // Manually trigger death handling if needed
      if (result === true && window.collisionSystem) {
        window.collisionSystem.handleEnemyDeath(
          enemy,
          enemy.type,
          enemy.x,
          enemy.y
        );
        enemy.markedForRemoval = true;
        console.log('💀 Enemy marked for removal');
      }
    }
  });

  // Step 6: Wait for the game update cycle to remove the enemy
  await page.waitForTimeout(100); // One or two frames should be enough

  // Step 7: Check that the enemy is actually removed from the game state
  const afterDamageState = await page.evaluate(() => {
    const enemies = window.gameState?.enemies || [];
    return {
      enemyCount: enemies.length,
      enemiesData: enemies.map((e) => ({
        health: e.health,
        markedForRemoval: e.markedForRemoval,
        type: e.type,
      })),
    };
  });

  console.log('💀 After damage state:', afterDamageState);

  // Step 8: Wait longer for enemy cleanup and effects to finish
  await page.waitForTimeout(1000);

  // Step 9: Check final state - enemy should be gone and glow should be cleared
  const finalState = await page.evaluate(() => {
    const enemies = window.gameState?.enemies || [];

    // Sample canvas again for lingering glow
    const p = window.player.p;
    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0;
    let brightPixels = 0;
    let suspiciousPixels = 0;

    // Check the area where the enemy was
    const centerX = p.width / 2 + 100;
    const centerY = p.height / 2;
    const searchRadius = 60;

    for (let dy = -searchRadius; dy <= searchRadius; dy += 2) {
      for (let dx = -searchRadius; dx <= searchRadius; dx += 2) {
        const x = Math.round(centerX + dx);
        const y = Math.round(centerY + dy);

        if (x >= 0 && x < p.width && y >= 0 && y < p.height) {
          const i = (y * p.width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a > 50) {
            const brightness = (r + g + b) / 3;
            if (brightness > 100) brightPixels++;

            // Look for lingering green glow
            if (g > 120 && g > r && g > b && a > 100) {
              greenPixels++;
            }

            // Look for very bright persistent artifacts
            if (brightness > 180 && a > 200) {
              suspiciousPixels++;
            }
          }
        }
      }
    }

    return {
      enemyCount: enemies.length,
      greenPixels,
      brightPixels,
      suspiciousPixels,
      explosions: window.explosionManager?.explosions?.length || 0,
      fragments: window.explosionManager?.fragmentExplosions?.length || 0,
    };
  });

  console.log('🧹 Final cleanup state:', finalState);

  // Main assertions
  expect(
    finalState.enemyCount,
    'Enemy should be completely removed from game state'
  ).toBe(0);
  expect(
    finalState.greenPixels,
    'Green glow should be mostly gone'
  ).toBeLessThan(withEnemyState.greenPixels * 0.2);
  expect(
    finalState.suspiciousPixels,
    'Should not have persistent bright artifacts'
  ).toBeLessThan(5);
  expect(finalState.explosions, 'All explosions should be cleaned up').toBe(0);

  console.log('✅ Enemy glow persistence test passed');
});

test('multiple enemies glow cleanup', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing'
  );

  console.log('🔍 Testing multiple enemy glow cleanup...');

  // Create multiple enemies of different types
  const creationResult = await page.evaluate(() => {
    const p = window.player.p;
    const centerX = p.width / 2;
    const centerY = p.height / 2;

    // Clear existing
    if (window.gameState) {
      window.gameState.enemies = [];
    }

    if (typeof EnemyFactory !== 'undefined') {
      try {
        // Create enemies in a circle around player
        const enemyTypes = ['grunt', 'rusher', 'tank'];
        const angles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
        const radius = 80;

        for (let i = 0; i < 3; i++) {
          const x = centerX + Math.cos(angles[i]) * radius;
          const y = centerY + Math.sin(angles[i]) * radius;
          const enemy = EnemyFactory.createEnemy(
            x,
            y,
            enemyTypes[i],
            p,
            window.audio
          );
          window.gameState.enemies.push(enemy);
        }

        return { success: true, count: window.gameState.enemies.length };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
    return { success: false, error: 'EnemyFactory not available' };
  });

  expect(creationResult.success, 'Should create multiple enemies').toBe(true);
  expect(creationResult.count, 'Should have 3 enemies').toBe(3);

  // Let them render
  await page.waitForTimeout(500);

  // Kill all enemies
  await page.evaluate(() => {
    const enemies = window.gameState?.enemies || [];
    enemies.forEach((enemy) => {
      if (typeof enemy.takeDamage === 'function') {
        const result = enemy.takeDamage(999, 0, 'bullet');
        if (result === true && window.collisionSystem) {
          window.collisionSystem.handleEnemyDeath(
            enemy,
            enemy.type,
            enemy.x,
            enemy.y
          );
          enemy.markedForRemoval = true;
        }
      }
    });
    console.log('💀 Killed all enemies');
  });

  // Wait for cleanup
  await page.waitForTimeout(2000);

  const finalCheck = await page.evaluate(() => {
    return {
      enemyCount: window.gameState?.enemies?.length || 0,
      explosions: window.explosionManager?.explosions?.length || 0,
      fragments: window.explosionManager?.fragmentExplosions?.length || 0,
      plasma: window.explosionManager?.plasmaClouds?.length || 0,
    };
  });

  console.log('🧹 Multiple enemy cleanup result:', finalCheck);

  expect(finalCheck.enemyCount, 'All enemies should be removed').toBe(0);
  expect(
    finalCheck.explosions + finalCheck.fragments + finalCheck.plasma,
    'All effects should be cleaned up'
  ).toBeLessThan(2);

  console.log('✅ Multiple enemy glow cleanup test passed');
});
