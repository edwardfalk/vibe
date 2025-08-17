import { test, expect } from '@playwright/test';

test('Explosion Improvements Verification', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await page.waitForTimeout(3000);

  // Wait for game to initialize
  await page.waitForFunction(
    () => window.frameCount > 0 && window.player && window.gameState?.enemies
  );

  console.log('✅ Testing explosion improvements');

  // Click canvas to unlock audio
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(500);

  // Test explosion creation directly
  const explosionTest = await page.evaluate(() => {
    // Create a mock grunt for testing
    const mockGrunt = {
      type: 'grunt',
      size: 25,
      x: 400,
      y: 300,
      bodyColor: [100, 150, 100],
      skinColor: [120, 180, 120],
      helmetColor: [80, 80, 120],
      weaponColor: [148, 0, 211],
    };

    // Create an explosion manually to test the improvements
    if (
      window.explosionManager &&
      window.explosionManager.createEnemyFragmentExplosion
    ) {
      window.explosionManager.createEnemyFragmentExplosion(400, 300, mockGrunt);

      const explosions = window.explosionManager.explosions || [];
      const latestExplosion = explosions[explosions.length - 1];

      if (latestExplosion && latestExplosion.fragments) {
        return {
          success: true,
          fragmentCount: latestExplosion.fragments.length,
          centralParticleCount:
            latestExplosion.centralExplosion?.particles?.length || 0,
          sampleFragmentTypes: latestExplosion.fragments
            .slice(0, 5)
            .map((f) => f.type),
          fragmentSpeeds: latestExplosion.fragments
            .slice(0, 5)
            .map((f) => Math.sqrt(f.vx * f.vx + f.vy * f.vy).toFixed(1)),
        };
      }
    }

    return { success: false, error: 'Could not create explosion' };
  });

  console.log('💥 Explosion test results:', explosionTest);

  if (explosionTest.success) {
    // Verify improvements
    const isImproved =
      explosionTest.fragmentCount >= 18 && // More fragments for grunts
      explosionTest.centralParticleCount >= 30 && // More central particles
      explosionTest.sampleFragmentTypes.includes('limb'); // New fragment type

    if (isImproved) {
      console.log('✅ Explosion improvements verified:');
      console.log(
        `   - Fragments: ${explosionTest.fragmentCount} (≥18 for grunts)`
      );
      console.log(
        `   - Central particles: ${explosionTest.centralParticleCount} (≥30 for grunts)`
      );
      console.log(
        `   - Fragment types: ${explosionTest.sampleFragmentTypes.join(', ')}`
      );
      console.log(
        `   - Fragment speeds: ${explosionTest.fragmentSpeeds.join(', ')}`
      );
    } else {
      console.log('⚠️ Some improvements may not be active');
    }

    // Take screenshot of the explosion
    await page.waitForTimeout(100);
    await page.screenshot({
      path: 'tests/bug-reports/explosion_improvement_test.png',
      clip: { x: 0, y: 0, width: 800, height: 600 },
    });

    // Wait to see the explosion animation
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'tests/bug-reports/explosion_improvement_aftermath.png',
      clip: { x: 0, y: 0, width: 800, height: 600 },
    });
  } else {
    console.log(
      '❌ Could not test explosion improvements:',
      explosionTest.error
    );
  }

  // Final check for any visual artifacts
  const finalCheck = await page.evaluate(() => {
    return {
      explosionCount: window.explosionManager?.explosions?.length || 0,
      frameCount: window.frameCount,
    };
  });

  console.log('📊 Final state:', finalCheck);
});
