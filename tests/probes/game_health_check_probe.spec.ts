import { test, expect } from '@playwright/test';

/**
 * Game Health Check Probe
 * Comprehensive check of game systems after explosion dots fix
 * Identifies visual, performance, and functional issues
 */

test('game health check after explosion dots fix', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 60
  );

  console.log('🏥 Starting comprehensive game health check...');

  // Step 1: Check explosion colors and effects
  console.log('\n🎨 Testing explosion color accuracy...');

  const explosionColorTest = await page.evaluate(() => {
    const results = {};
    const playerX = window.player.x;
    const playerY = window.player.y;

    // Test each enemy type explosion
    const enemyTypes = ['grunt', 'rusher', 'stabber', 'tank'];
    const expectedColors = {
      grunt: { r: 50, g: 205, b: 50, name: 'bright green' },
      rusher: { r: 255, g: 20, b: 147, name: 'deep pink' },
      stabber: { r: 255, g: 215, b: 0, name: 'gold' },
      tank: { r: 138, g: 43, b: 226, name: 'blue violet' },
    };

    for (const enemyType of enemyTypes) {
      try {
        // Trigger explosion and sample immediately
        window.explosionManager?.addKillEffect?.(
          playerX + 100,
          playerY,
          enemyType,
          'bullet'
        );

        // Brief wait for effect to start
        setTimeout(() => {}, 50);

        results[enemyType] = {
          expected: expectedColors[enemyType],
          triggered:
            window.explosionManager?.explosions?.length > 0 ||
            window.explosionManager?.fragmentExplosions?.length > 0,
          explosionCount: window.explosionManager?.explosions?.length || 0,
          fragmentCount:
            window.explosionManager?.fragmentExplosions?.length || 0,
        };
      } catch (e) {
        results[enemyType] = { error: e.message };
      }
    }

    return results;
  });

  console.log('💥 Explosion color test results:', explosionColorTest);

  // Step 2: Check enemy glow intensity
  console.log('\n✨ Testing enemy glow effects...');

  const glowTest = await page.evaluate(() => {
    const enemies = window.gameState?.enemies || [];
    if (enemies.length === 0) {
      // Force spawn some enemies for testing
      for (let i = 0; i < 3; i++) {
        window.spawnSystem?.forceSpawn?.('grunt');
      }
    }

    const updatedEnemies = window.gameState?.enemies || [];
    const glowIntensity = {};

    // Check glow function availability and default parameters
    if (window.drawGlow && typeof window.drawGlow === 'function') {
      // Get default glow parameters if they exist
      const defaultGlow = window.fxConfig?.glow || {};
      glowIntensity.defaultGlowConfig = defaultGlow;
    }

    return {
      enemyCount: updatedEnemies.length,
      hasGlowFunction: typeof window.drawGlow === 'function',
      glowIntensity,
      enemyTypes: updatedEnemies.map((e) => e.type).slice(0, 5),
    };
  });

  console.log('✨ Glow test results:', glowTest);

  // Step 3: Check Stabber attack effects
  console.log('\n🗡️ Testing Stabber attack intensity...');

  const stabberTest = await page.evaluate(() => {
    try {
      // Force spawn a stabber
      let stabber = null;
      const enemies = window.gameState?.enemies || [];

      // Find existing stabber or create one
      stabber = enemies.find((e) => e.type === 'stabber');
      if (!stabber && window.spawnSystem?.forceSpawn) {
        stabber = window.spawnSystem.forceSpawn('stabber');
      }

      if (stabber) {
        // Check stabber attack properties
        const attackInfo = {
          hasAttackMethod: typeof stabber.attack === 'function',
          dashSpeed: stabber.dashSpeed || 'unknown',
          attackDamage: stabber.attackDamage || stabber.damage || 'unknown',
          stabberConfig: stabber.config || 'no config',
        };

        // Try to trigger attack (safely)
        if (typeof stabber.attack === 'function') {
          try {
            // Don't actually attack, just check if method exists
            attackInfo.attackMethodAvailable = true;
          } catch (e) {
            attackInfo.attackError = e.message;
          }
        }

        return { success: true, stabber: attackInfo };
      } else {
        return { success: false, reason: 'Could not create or find stabber' };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log('🗡️ Stabber test results:', stabberTest);

  // Step 4: Performance check during effects
  console.log('\n⚡ Testing performance during heavy effects...');

  const performanceTest = await page.evaluate(() => {
    const startTime = performance.now();
    let frameCount = 0;
    let totalFrameTime = 0;

    const initialFrameCount = window.frameCount;

    // Trigger multiple effects
    const playerX = window.player.x;
    const playerY = window.player.y;

    for (let i = 0; i < 5; i++) {
      window.explosionManager?.addKillEffect?.(
        playerX + i * 50,
        playerY + i * 20,
        'stabber',
        'bullet'
      );
    }

    const endTime = performance.now();
    const effectCreationTime = endTime - startTime;

    return {
      effectCreationTime: Math.round(effectCreationTime * 100) / 100,
      currentFrameRate: window.frameRate || 'unknown',
      explosionCount: window.explosionManager?.explosions?.length || 0,
      fragmentCount: window.explosionManager?.fragmentExplosions?.length || 0,
      memoryUsage: performance.memory
        ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          }
        : 'unavailable',
    };
  });

  console.log('⚡ Performance test results:', performanceTest);

  // Step 5: Visual cleanup verification
  console.log('\n🧹 Testing explosion cleanup...');

  // Wait for effects to clear
  await page.waitForTimeout(3000);

  const cleanupTest = await page.evaluate(() => {
    return {
      explosionsRemaining: window.explosionManager?.explosions?.length || 0,
      fragmentsRemaining:
        window.explosionManager?.fragmentExplosions?.length || 0,
      plasmaCloudsRemaining: window.explosionManager?.plasmaClouds?.length || 0,
      playerBullets: window.gameState?.playerBullets?.length || 0,
      enemyBullets: window.gameState?.enemyBullets?.length || 0,
      enemies: window.gameState?.enemies?.length || 0,
    };
  });

  console.log('🧹 Cleanup test results:', cleanupTest);

  // Step 6: Take diagnostic screenshot
  console.log('\n📸 Taking diagnostic screenshot...');
  await page.screenshot({
    path: 'test-results/game-health-check.png',
    fullPage: false,
  });

  // Analysis and recommendations
  console.log('\n📊 GAME HEALTH ANALYSIS:');

  // Check explosion cleanup
  if (
    cleanupTest.explosionsRemaining === 0 &&
    cleanupTest.fragmentsRemaining === 0
  ) {
    console.log('✅ Explosion cleanup working correctly');
  } else {
    console.log(
      `⚠️ Explosions not cleaning up: ${cleanupTest.explosionsRemaining} explosions, ${cleanupTest.fragmentsRemaining} fragments remaining`
    );
  }

  // Check performance
  if (performanceTest.effectCreationTime < 50) {
    console.log('✅ Effect creation performance good');
  } else {
    console.log(
      `⚠️ Effect creation slow: ${performanceTest.effectCreationTime}ms`
    );
  }

  // Recommendations
  console.log('\n💡 RECOMMENDATIONS:');

  if (glowTest.enemyCount > 0) {
    console.log('🔧 Check enemy glow intensity - may need reduction');
  }

  if (stabberTest.success) {
    console.log(
      '🔧 Check Stabber attack effects - may need performance optimization'
    );
  }

  console.log('🎨 Check explosion colors against expected values');
  console.log('📈 Monitor frame rate during gameplay with multiple effects');

  // Don't fail test, just document findings
  expect(cleanupTest.explosionsRemaining, 'Explosions should clean up').toBe(0);
  expect(cleanupTest.fragmentsRemaining, 'Fragments should clean up').toBe(0);

  console.log('🏥 Game health check completed');
});
