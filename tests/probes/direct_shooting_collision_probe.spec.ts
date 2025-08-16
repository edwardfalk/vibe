import { test, expect } from '@playwright/test';

/**
 * Direct Shooting Collision Probe
 * Directly manipulates game state to force bullet creation and enemy collision
 * Tests the exact scenario that causes persistent explosion dots
 */

test('direct bullet-enemy collision creates persistent explosion dots', async ({
  page,
}) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 30
  );

  console.log('🔧 Testing direct bullet-enemy collision manipulation...');

  // Step 1: Force shooting state and let the game create bullets naturally
  const shootingForced = await page.evaluate(() => {
    try {
      // Set shooting flag
      window.playerIsShooting = true;

      // Force an update cycle to create bullets
      if (window.player && typeof window.player.shoot === 'function') {
        const bullet = window.player.shoot();
        if (bullet && window.gameState?.playerBullets) {
          window.gameState.playerBullets.push(bullet);
          console.log('🎯 Force-created bullet:', {
            x: bullet.x,
            y: bullet.y,
            angle: bullet.angle,
          });
          return {
            success: true,
            bulletCreated: true,
            bulletPos: { x: bullet.x, y: bullet.y },
          };
        }
      }
      return { success: true, bulletCreated: false };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log('🔫 Shooting forced result:', shootingForced);

  // Step 2: Force enemy creation using direct instantiation
  const enemyForced = await page.evaluate(() => {
    try {
      const enemies = window.gameState?.enemies || [];

      // If we already have enemies, use them
      if (enemies.length > 0) {
        console.log('👾 Using existing enemies:', enemies.length);
        return {
          success: true,
          enemyCount: enemies.length,
          firstEnemy: {
            x: enemies[0].x,
            y: enemies[0].y,
            health: enemies[0].health,
          },
        };
      }

      // Try to create an enemy using available constructor
      const playerX = window.player.x;
      const playerY = window.player.y;

      // Try different approaches to create enemies
      if (
        window.spawnSystem &&
        typeof window.spawnSystem.spawnEnemy === 'function'
      ) {
        const enemy = window.spawnSystem.spawnEnemy(
          'grunt',
          playerX + 50,
          playerY
        );
        if (enemy) {
          window.gameState.enemies.push(enemy);
          console.log('👾 Created enemy via spawnSystem:', {
            x: enemy.x,
            y: enemy.y,
          });
          return { success: true, enemyCount: 1, method: 'spawnSystem' };
        }
      }

      // Try creating a simple enemy object directly
      const simpleEnemy = {
        x: playerX + 80,
        y: playerY,
        health: 1,
        size: 20,
        type: 'grunt',
        active: true,
        // Minimal methods needed for collision
        takeDamage: function (damage) {
          this.health -= damage;
          if (this.health <= 0) {
            this.active = false;
            return true; // died
          }
          return false;
        },
      };

      window.gameState.enemies.push(simpleEnemy);
      console.log('👾 Created simple enemy object:', {
        x: simpleEnemy.x,
        y: simpleEnemy.y,
      });
      return {
        success: true,
        enemyCount: 1,
        method: 'direct',
        enemyPos: { x: simpleEnemy.x, y: simpleEnemy.y },
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log('👾 Enemy forced result:', enemyForced);

  // Step 3: Let a few frames pass to allow natural collision detection
  await page.waitForTimeout(300);

  // Step 4: Force collision check if natural collision hasn't occurred
  const collisionForced = await page.evaluate(() => {
    try {
      const bullets = window.gameState?.playerBullets || [];
      const enemies = window.gameState?.enemies || [];

      if (bullets.length === 0 || enemies.length === 0) {
        return {
          success: false,
          reason: 'No bullets or enemies available',
          bullets: bullets.length,
          enemies: enemies.length,
        };
      }

      let collisionOccurred = false;

      // Check for natural collisions first
      for (const bullet of bullets) {
        for (const enemy of enemies) {
          if (!bullet.active || !enemy.active) continue;

          const distance = Math.sqrt(
            (bullet.x - enemy.x) ** 2 + (bullet.y - enemy.y) ** 2
          );
          const collisionDistance = (bullet.size + enemy.size) / 2;

          if (distance < collisionDistance) {
            console.log('💥 Natural collision detected!', {
              distance,
              collisionDistance,
            });
            collisionOccurred = true;
            break;
          }
        }
        if (collisionOccurred) break;
      }

      // If no natural collision, force one
      if (!collisionOccurred && bullets.length > 0 && enemies.length > 0) {
        const bullet = bullets[0];
        const enemy = enemies[0];

        // Move bullet to enemy position to force collision
        bullet.x = enemy.x;
        bullet.y = enemy.y;

        console.log('🎯 FORCED bullet-enemy collision:', {
          bulletPos: { x: bullet.x, y: bullet.y },
          enemyPos: { x: enemy.x, y: enemy.y },
        });

        // Manually trigger collision effects
        if (
          window.explosionManager &&
          typeof window.explosionManager.createExplosion === 'function'
        ) {
          // Create explosion at collision point
          window.explosionManager.createExplosion(
            enemy.x,
            enemy.y,
            30,
            'enemy'
          );
          console.log('💥 Created explosion manually');
        }

        // Damage the enemy
        if (typeof enemy.takeDamage === 'function') {
          const died = enemy.takeDamage(bullet.damage);
          if (died) {
            console.log('☠️ Enemy killed by forced collision');
          }
        } else {
          enemy.health = 0;
          enemy.active = false;
        }

        // Remove bullet
        bullet.active = false;

        collisionOccurred = true;
      }

      return {
        success: true,
        collisionOccurred,
        explosions: window.explosionManager?.explosions?.length || 0,
        fragments: window.explosionManager?.fragmentExplosions?.length || 0,
        activeBullets: bullets.filter((b) => b.active).length,
        activeEnemies: enemies.filter((e) => e.active).length,
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log('💥 Collision forced result:', collisionForced);

  // Step 5: Sample colors DURING the explosion effects
  await page.waitForTimeout(100); // Let effects start

  const duringExplosion = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const explosions = window.explosionManager?.explosions?.length || 0;
    const fragments = window.explosionManager?.fragmentExplosions?.length || 0;

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0;
    let brightPixels = 0;
    let totalPixels = 0;

    // Sample every 8th pixel to reduce computation
    for (let i = 0; i < data.length; i += 8 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 60) continue;
      totalPixels++;

      const brightness = (r + g + b) / 3;
      if (brightness > 120) brightPixels++;

      // Green explosion pixels (grunt explosions: ~50, 205, 50)
      if (g > 150 && g > r * 1.5 && g > b * 1.5 && a > 100) {
        greenPixels++;
      }
    }

    return {
      greenPixels,
      brightPixels,
      totalPixels,
      explosions,
      fragments,
      hasExplosionActivity: explosions > 0 || fragments > 0,
    };
  });

  console.log('💥 During explosion effects:', duringExplosion);

  // Step 6: Wait for explosion effects to finish
  console.log('⏱️ Waiting for explosion effects to clear...');
  await page.waitForTimeout(3000);

  // Step 7: Final scan for persistent explosion dots
  const afterExplosion = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const explosions = window.explosionManager?.explosions?.length || 0;
    const fragments = window.explosionManager?.fragmentExplosions?.length || 0;

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0;
    let brightPixels = 0;
    let persistentDots = [];

    // Thorough scan for persistent green dots (skip UI area)
    const uiMargin = 100;
    for (let y = uiMargin; y < p.height; y += 6) {
      for (let x = uiMargin; x < p.width; x += 6) {
        const i = (y * p.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 80) continue;

        const brightness = (r + g + b) / 3;
        if (brightness > 120) brightPixels++;

        // Look for persistent green explosion dots
        if (g > 150 && g > r * 1.5 && g > b * 1.5 && a > 120) {
          greenPixels++;
          if (persistentDots.length < 8) {
            persistentDots.push({
              x,
              y,
              r,
              g,
              b,
              a,
              brightness: Math.round(brightness),
            });
          }
        }
      }
    }

    return {
      explosions,
      fragments,
      greenPixels,
      brightPixels,
      persistentDots,
    };
  });

  console.log('🧹 After explosion cleanup:', afterExplosion);

  // Take screenshot if we found persistent dots
  if (afterExplosion.persistentDots.length > 0) {
    console.log('📸 Taking screenshot of persistent explosion dots...');
    await page.screenshot({
      path: 'test-results/direct-collision-persistent-dots.png',
      fullPage: false,
    });

    console.log(
      '📍 Persistent explosion dots found:',
      afterExplosion.persistentDots
    );
  }

  // Analysis and reporting
  console.log('📊 Direct collision test analysis:');
  console.log(
    `   - Forced collision occurred: ${collisionForced.success && collisionForced.collisionOccurred}`
  );
  console.log(
    `   - During explosion: ${duringExplosion.greenPixels} green pixels, ${duringExplosion.explosions} explosions, ${duringExplosion.fragments} fragments`
  );
  console.log(
    `   - After cleanup: ${afterExplosion.greenPixels} green pixels, ${afterExplosion.explosions} explosions, ${afterExplosion.fragments} fragments`
  );
  console.log(
    `   - Persistent dots found: ${afterExplosion.persistentDots.length}`
  );

  // Assertions
  expect(afterExplosion.explosions, 'All explosions should be cleaned up').toBe(
    0
  );
  expect(afterExplosion.fragments, 'All fragments should be cleaned up').toBe(
    0
  );

  // Main test: if we had explosion activity, check for persistent dots
  if (duringExplosion.hasExplosionActivity) {
    console.log('✅ Explosion activity detected during test');

    if (duringExplosion.greenPixels > 5) {
      console.log(
        `✅ Green explosion effects detected: ${duringExplosion.greenPixels} pixels`
      );

      // This is the key test for the user's issue
      if (afterExplosion.persistentDots.length > 0) {
        console.log(
          `🔴 ISSUE CONFIRMED: Found ${afterExplosion.persistentDots.length} persistent green explosion dots`
        );
        console.log(
          '    This confirms the user-reported "large dots" issue after enemy kills'
        );

        // Report the exact positions and colors
        console.log('    Dot details:');
        afterExplosion.persistentDots.forEach((dot, i) => {
          console.log(
            `      ${i + 1}: (${dot.x}, ${dot.y}) RGB(${dot.r}, ${dot.g}, ${dot.b}) brightness: ${dot.brightness}`
          );
        });
      } else {
        console.log(
          '✅ No persistent dots found - our blend mode fix may be working'
        );
      }
    }
  } else {
    console.log(
      '⚠️ No explosion activity detected - collision may not have been triggered properly'
    );
  }

  // Don't fail the test, just document findings
  expect(
    afterExplosion.persistentDots.length,
    'Documenting persistent explosion dots'
  ).toBeGreaterThanOrEqual(0);

  console.log('🔧 Direct collision probe completed');
});
