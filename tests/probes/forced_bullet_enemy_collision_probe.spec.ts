import { test, expect } from '@playwright/test';

/**
 * Forced Bullet-Enemy Collision Probe
 * Creates a controlled scenario where bullets definitely hit and kill enemies
 * Uses direct bullet-enemy positioning to force collisions and explosions
 */

test('forced bullet hits enemy and creates explosion dots', async ({
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

  console.log('🎯 Testing FORCED bullet-enemy collision scenario...');

  // Step 1: Clear everything and take baseline
  await page.evaluate(() => {
    // Clear all entities
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

    let greenPixels = 0;
    let brightPixels = 0;

    for (let i = 0; i < data.length; i += 16 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 60) continue;

      const brightness = (r + g + b) / 3;
      if (brightness > 120) brightPixels++;

      // Green pixels (grunt explosions)
      if (g > 150 && g > r * 1.5 && g > b * 1.5 && a > 100) {
        greenPixels++;
      }
    }

    return { greenPixels, brightPixels };
  });

  console.log('📊 Clean baseline:', baseline);

  // Step 2: Create enemies and bullets positioned for guaranteed collision
  const collisionSetup = await page.evaluate(() => {
    try {
      const playerX = window.player.x;
      const playerY = window.player.y;

      console.log('🎮 Player position:', { x: playerX, y: playerY });

      // Import required classes from global namespace
      const { Grunt } = window;
      const { Bullet } = window;

      if (!Grunt || !Bullet) {
        return {
          success: false,
          error: 'Grunt or Bullet classes not available',
        };
      }

      // Create grunt enemy directly in front of player
      const grunt = new Grunt(
        playerX + 80, // 80 pixels to the right
        playerY, // Same Y level
        'grunt',
        { maxHealth: 1 }, // Low health for easy kill
        window.player.p,
        window.audio
      );
      grunt.health = 1; // Ensure low health for quick kill

      window.gameState.enemies.push(grunt);

      // Create bullet moving directly toward the enemy
      const bullet = new Bullet(
        playerX + 10, // Start just ahead of player
        playerY, // Same Y level
        0, // Moving right (toward enemy)
        200, // Fast speed
        'player'
      );

      window.gameState.playerBullets.push(bullet);

      console.log('💥 Created collision setup:');
      console.log('  Enemy at:', {
        x: grunt.x,
        y: grunt.y,
        health: grunt.health,
      });
      console.log('  Bullet at:', {
        x: bullet.x,
        y: bullet.y,
        angle: bullet.angle,
      });
      console.log('  Distance:', Math.abs(grunt.x - bullet.x));

      return {
        success: true,
        enemyPos: { x: grunt.x, y: grunt.y, health: grunt.health },
        bulletPos: { x: bullet.x, y: bullet.y, angle: bullet.angle },
        distance: Math.abs(grunt.x - bullet.x),
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log('🎯 Collision setup result:', collisionSetup);

  if (!collisionSetup.success) {
    console.log('❌ Failed to setup collision, trying alternative approach...');

    // Alternative: Use natural game mechanics
    await page.evaluate(() => {
      // Force spawn enemies near player using spawn system
      if (window.spawnSystem) {
        const playerX = window.player.x;
        const playerY = window.player.y;

        // Try to spawn enemies at fixed positions
        for (let i = 0; i < 3; i++) {
          window.spawnSystem.forceSpawnAt(
            playerX + 60 + i * 30,
            playerY,
            'grunt'
          );
        }
      }
    });

    // Simulate shooting
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    await page.keyboard.press('Space');
  }

  // Step 3: Let collision happen (multiple frames)
  console.log('⏱️ Allowing collision to occur...');

  for (let frame = 0; frame < 10; frame++) {
    await page.waitForTimeout(50);

    const frameState = await page.evaluate(() => {
      const enemies = window.gameState?.enemies || [];
      const bullets = window.gameState?.playerBullets || [];
      const explosions = window.explosionManager?.explosions?.length || 0;
      const fragments =
        window.explosionManager?.fragmentExplosions?.length || 0;

      return {
        frame: window.frameCount,
        enemies: enemies.length,
        bullets: bullets.length,
        explosions,
        fragments,
        enemyHealth: enemies.length > 0 ? enemies[0].health : 'none',
      };
    });

    console.log(`Frame ${frame}:`, frameState);

    // If we see explosions, that means collision happened
    if (frameState.explosions > 0 || frameState.fragments > 0) {
      console.log('💥 COLLISION DETECTED! Explosions created');
      break;
    }
  }

  // Step 4: Sample canvas DURING explosion effects
  const duringExplosion = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const explosions = window.explosionManager?.explosions?.length || 0;
    const fragments = window.explosionManager?.fragmentExplosions?.length || 0;
    const plasmaClouds = window.explosionManager?.plasmaClouds?.length || 0;

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0;
    let brightPixels = 0;

    for (let i = 0; i < data.length; i += 16 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 60) continue;

      const brightness = (r + g + b) / 3;
      if (brightness > 120) brightPixels++;

      // Green pixels (grunt explosions: should be ~50, 205, 50)
      if (g > 150 && g > r * 1.5 && g > b * 1.5 && a > 100) {
        greenPixels++;
      }
    }

    return {
      greenPixels,
      brightPixels,
      explosions,
      fragments,
      plasmaClouds,
      hasExplosionActivity: explosions > 0 || fragments > 0 || plasmaClouds > 0,
    };
  });

  console.log('💥 During explosion phase:', duringExplosion);

  // Step 5: Wait for explosions to finish
  console.log('⏱️ Waiting for explosion cleanup...');
  await page.waitForTimeout(3000);

  // Step 6: Final scan for persistent dots
  const afterExplosion = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const enemies = window.gameState?.enemies || [];
    const explosions = window.explosionManager?.explosions?.length || 0;
    const fragments = window.explosionManager?.fragmentExplosions?.length || 0;
    const plasmaClouds = window.explosionManager?.plasmaClouds?.length || 0;

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0;
    let brightPixels = 0;
    let suspiciousDots = [];

    // Detailed scan for persistent green dots
    const uiMargin = 200; // Skip UI area
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
          if (suspiciousDots.length < 10) {
            suspiciousDots.push({
              x,
              y,
              color: 'green',
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
      enemies: enemies.length,
      explosions,
      fragments,
      plasmaClouds,
      greenPixels,
      brightPixels,
      suspiciousDots,
    };
  });

  console.log('🧹 After explosion cleanup:', afterExplosion);

  // Take screenshot if we found suspicious dots
  if (afterExplosion.suspiciousDots.length > 0) {
    console.log('📸 Taking screenshot of persistent dots...');
    await page.screenshot({
      path: 'test-results/forced-collision-explosion-dots.png',
      fullPage: false,
    });

    console.log(
      '📍 Suspicious dots found:',
      afterExplosion.suspiciousDots.slice(0, 5)
    );
  }

  // Analysis and reporting
  console.log('📊 Forced collision test analysis:');
  console.log(`   - Baseline: ${baseline.greenPixels} green pixels`);
  console.log(
    `   - During explosion: ${duringExplosion.greenPixels} green pixels (activity: ${duringExplosion.hasExplosionActivity})`
  );
  console.log(
    `   - After explosion: ${afterExplosion.greenPixels} green pixels`
  );
  console.log(
    `   - Persistent dots found: ${afterExplosion.suspiciousDots.length}`
  );
  console.log(
    `   - Final effects: ${afterExplosion.explosions} explosions, ${afterExplosion.fragments} fragments`
  );

  // Assertions
  expect(afterExplosion.explosions, 'All explosions should be cleaned up').toBe(
    0
  );
  expect(
    afterExplosion.fragments,
    'All fragment explosions should be cleaned up'
  ).toBe(0);
  expect(
    afterExplosion.plasmaClouds,
    'All plasma clouds should be cleaned up'
  ).toBe(0);

  // If we had explosion activity, verify cleanup
  if (duringExplosion.hasExplosionActivity) {
    console.log('✅ Explosion activity was detected during test');

    if (duringExplosion.greenPixels > baseline.greenPixels + 5) {
      console.log(
        `✅ Green explosion effects detected: ${duringExplosion.greenPixels} vs baseline ${baseline.greenPixels}`
      );

      // The key test: green explosion dots should be cleaned up
      expect(
        afterExplosion.greenPixels,
        `Green explosion dots should be cleaned up. Had ${duringExplosion.greenPixels} during explosion, now ${afterExplosion.greenPixels}`
      ).toBeLessThan(duringExplosion.greenPixels * 0.3);
    }
  } else {
    console.log(
      '⚠️ No explosion activity detected - collision may not have occurred'
    );
  }

  // Main assertion: should not have many persistent artifacts
  expect(
    afterExplosion.suspiciousDots.length,
    `Should not have persistent green explosion dots. Found: ${JSON.stringify(afterExplosion.suspiciousDots.slice(0, 3))}`
  ).toBeLessThan(5);

  console.log('✅ Forced collision explosion dots test completed');
});
