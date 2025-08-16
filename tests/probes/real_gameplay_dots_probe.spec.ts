import { test, expect } from '@playwright/test';

/**
 * Real Gameplay Dots Probe
 * Tests the actual gameplay scenario where user reports seeing lingering dots
 * Uses real enemy spawning and killing mechanics
 */

test('no lingering dots during real enemy combat', async ({ page }) => {
  await page.goto('http://localhost:5500');

  // Wait for game to be fully loaded and playing
  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 30
  );

  console.log('🎮 Starting real gameplay dots probe...');

  // Enable debug mode to get more info
  await page.evaluate(() => {
    window.DEBUG_DOTS = true;
    console.log('🟡 Debug mode enabled for dots detection');
  });

  // Force spawn some enemies and let the game run naturally
  await page.evaluate(() => {
    // Spawn some enemies using the actual spawn system
    if (window.spawnSystem && window.gameState) {
      // Clear existing enemies first
      window.gameState.enemies = [];

      // Spawn a few different enemy types around the player
      const playerX = window.player.x;
      const playerY = window.player.y;

      const spawnPositions = [
        { x: playerX + 100, y: playerY, type: 'grunt' },
        { x: playerX - 100, y: playerY, type: 'grunt' },
        { x: playerX, y: playerY + 100, type: 'tank' },
        { x: playerX, y: playerY - 100, type: 'rusher' },
      ];

      spawnPositions.forEach((pos) => {
        try {
          window.spawnSystem.spawnEnemyAt(pos.x, pos.y, pos.type);
        } catch (e) {
          console.log('Spawn error:', e);
        }
      });

      console.log('👾 Spawned enemies around player');
    }
  });

  // Wait for enemies to spawn and be visible
  await page.waitForTimeout(1000);

  // Check that enemies are actually in the game
  const enemyCount = await page.evaluate(() => {
    return window.gameState?.enemies?.length || 0;
  });

  console.log('👾 Enemy count:', enemyCount);

  if (enemyCount === 0) {
    console.log('⚠️ No enemies spawned, trying manual creation...');

    // Try manual enemy creation if spawn system didn't work
    await page.evaluate(() => {
      if (window.gameState && typeof EnemyFactory !== 'undefined') {
        try {
          const grunt = EnemyFactory.createEnemy(
            window.player.x + 50,
            window.player.y,
            'grunt',
            window.player.p,
            window.audio
          );
          window.gameState.enemies.push(grunt);
          console.log('👾 Manually created grunt enemy');
        } catch (e) {
          console.log('Manual enemy creation error:', e);
        }
      }
    });

    await page.waitForTimeout(500);
  }

  // Sample background before combat
  const preCombatSample = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let brightPixels = 0;
    let saturatedPixels = 0;

    // Sample every 8th pixel for performance
    for (let i = 0; i < data.length; i += 8 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 50) continue;

      const brightness = (r + g + b) / 3;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);

      if (brightness > 120) brightPixels++;
      if (saturation > 100 && brightness > 100) saturatedPixels++;
    }

    return { brightPixels, saturatedPixels };
  });

  console.log('📊 Pre-combat sample:', preCombatSample);

  // Kill all enemies by setting their health to 0 (simulates shooting them)
  await page.evaluate(() => {
    const enemies = window.gameState?.enemies || [];
    enemies.forEach((enemy) => {
      if (enemy && typeof enemy.takeDamage === 'function') {
        // Deal massive damage to ensure death
        enemy.takeDamage(999, 0, 'bullet');
      } else if (enemy) {
        // Direct health modification if takeDamage doesn't work
        enemy.health = 0;
        enemy.markedForRemoval = true;
      }
    });
    console.log(`💀 Killed ${enemies.length} enemies`);
  });

  // Let the death effects play out
  await page.waitForTimeout(1000);

  // Sample during explosion effects
  const duringExplosionSample = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let brightPixels = 0;
    let explosionPixels = 0;

    for (let i = 0; i < data.length; i += 8 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 50) continue;

      const brightness = (r + g + b) / 3;

      if (brightness > 120) brightPixels++;
      if (brightness > 180) explosionPixels++;
    }

    // Also check explosion manager state
    const explosionCount = window.explosionManager?.explosions?.length || 0;
    const fragmentCount =
      window.explosionManager?.fragmentExplosions?.length || 0;

    return {
      brightPixels,
      explosionPixels,
      activeExplosions: explosionCount,
      activeFragments: fragmentCount,
    };
  });

  console.log('💥 During explosions:', duringExplosionSample);

  // Wait for all explosion effects to finish
  await page.waitForTimeout(5000);

  // Final sample after everything should be cleaned up
  const postCombatSample = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let brightPixels = 0;
    let saturatedPixels = 0;
    let suspiciousDots = 0;
    const dotLocations = [];

    // More thorough scan for lingering artifacts
    for (let y = 0; y < p.height; y += 4) {
      for (let x = 0; x < p.width; x += 4) {
        const i = (y * p.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 50) continue;

        const brightness = (r + g + b) / 3;
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);

        if (brightness > 120) brightPixels++;
        if (saturation > 100 && brightness > 100) saturatedPixels++;

        // Look for suspicious bright dots (potential artifacts)
        if (brightness > 160 && saturation > 120 && a > 150) {
          suspiciousDots++;
          if (dotLocations.length < 5) {
            dotLocations.push({ x, y, r, g, b, brightness, saturation });
          }
        }
      }
    }

    // Check explosion manager state
    const explosionCount = window.explosionManager?.explosions?.length || 0;
    const fragmentCount =
      window.explosionManager?.fragmentExplosions?.length || 0;
    const plasmaCount = window.explosionManager?.plasmaClouds?.length || 0;

    return {
      brightPixels,
      saturatedPixels,
      suspiciousDots,
      dotLocations,
      activeExplosions: explosionCount,
      activeFragments: fragmentCount,
      activePlasma: plasmaCount,
    };
  });

  console.log('🧹 Post-combat cleanup:', postCombatSample);

  if (
    postCombatSample.dotLocations &&
    postCombatSample.dotLocations.length > 0
  ) {
    console.log('📍 Suspicious dot locations:', postCombatSample.dotLocations);
  }

  // Analysis and assertions
  console.log('📈 Analysis:');
  console.log(`   - Pre-combat bright pixels: ${preCombatSample.brightPixels}`);
  console.log(`   - During explosions: ${duringExplosionSample.brightPixels}`);
  console.log(
    `   - Post-combat bright pixels: ${postCombatSample.brightPixels}`
  );
  console.log(`   - Suspicious dots found: ${postCombatSample.suspiciousDots}`);
  console.log(`   - Active explosions: ${postCombatSample.activeExplosions}`);
  console.log(`   - Active fragments: ${postCombatSample.activeFragments}`);

  // Main assertions
  expect(
    postCombatSample.activeExplosions,
    'All explosions should be cleaned up'
  ).toBe(0);
  expect(
    postCombatSample.activeFragments,
    'All fragment explosions should be cleaned up'
  ).toBe(0);
  expect(
    postCombatSample.activePlasma,
    'All plasma effects should be cleaned up'
  ).toBe(0);

  // Allow some tolerance but not too many lingering artifacts
  expect(
    postCombatSample.suspiciousDots,
    'Should not have many persistent bright dots'
  ).toBeLessThan(10);

  // The background should return close to pre-combat state
  const brightPixelDifference = Math.abs(
    postCombatSample.brightPixels - preCombatSample.brightPixels
  );
  expect(
    brightPixelDifference,
    'Brightness should return close to pre-combat levels'
  ).toBeLessThan(100);

  console.log('✅ Real gameplay dots probe completed');
});
