import { test, expect } from '@playwright/test';

/**
 * Palette Import Debug Probe
 * Investigates why explosionPalette is not accessible in the game environment
 * Tests the import chain and global exposure
 */

test('palette import debug - check explosionPalette availability', async ({
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

  console.log('🎨 Debugging explosionPalette import...');

  // Step 1: Check if explosionPalette is exposed globally
  const globalCheck = await page.evaluate(() => {
    return {
      explosionPalette: window.explosionPalette ? 'found' : 'not found',
      explosionFX: window.explosionFX ? 'found' : 'not found',
      fxConfig: window.fxConfig ? 'found' : 'not found',
      mathUtils: window.randomRange ? 'found' : 'not found',
      globalKeys: Object.keys(window)
        .filter((k) => k.includes('explosion'))
        .slice(0, 10),
    };
  });

  console.log('🌍 Global scope check:', globalCheck);

  // Step 2: Check import through core module
  const moduleCheck = await page.evaluate(() => {
    try {
      // Try to access through the explosions objects directly
      const explosions = window.explosionManager?.explosions || [];
      let paletteFromExplosion = null;

      if (explosions.length > 0) {
        const explosion = explosions[0];

        // Check if explosion has access to palette
        const hasGetParticleColor =
          typeof explosion.getParticleColor === 'function';

        if (hasGetParticleColor) {
          try {
            // Test with a known type
            paletteFromExplosion = explosion.getParticleColor('grunt-death');
          } catch (e) {
            paletteFromExplosion = 'error: ' + e.message;
          }
        }

        return {
          hasGetParticleColor,
          paletteFromExplosion,
          explosionConstructor: explosion.constructor.name,
          explosionMethods: Object.getOwnPropertyNames(
            Object.getPrototypeOf(explosion)
          ).slice(0, 10),
        };
      } else {
        return { error: 'No explosions available to test' };
      }
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log('🏗️ Module check:', moduleCheck);

  // Step 3: Force create explosion and test color generation
  const forceExplosionTest = await page.evaluate(() => {
    const playerX = window.player.x;
    const playerY = window.player.y;

    // Clear and create fresh explosion
    if (window.explosionManager) {
      window.explosionManager.explosions = [];
    }

    // Create explosion
    window.explosionManager?.addKillEffect?.(
      playerX + 50,
      playerY,
      'grunt',
      'bullet'
    );

    const explosion = window.explosionManager?.explosions?.[0];
    if (!explosion) return { error: 'Failed to create explosion' };

    const results = {
      explosionType: explosion.type,
      particleCount: explosion.particles?.length || 0,
      hasColorMethod: typeof explosion.getParticleColor === 'function',
    };

    // Check first few particles for color values
    if (explosion.particles && explosion.particles.length > 0) {
      results.firstThreeParticles = explosion.particles
        .slice(0, 3)
        .map((p) => ({
          color: p.color,
          colorType: typeof p.color,
          isArray: Array.isArray(p.color),
          colorLength: Array.isArray(p.color) ? p.color.length : 'not array',
        }));
    }

    // Test color generation directly
    if (typeof explosion.getParticleColor === 'function') {
      try {
        results.directColorTest = {
          gruntDeath: explosion.getParticleColor('grunt-death'),
          gruntBulletKill: explosion.getParticleColor('grunt-bullet-kill'),
          defaultType: explosion.getParticleColor('default'),
        };
      } catch (e) {
        results.directColorError = e.message;
      }
    }

    return results;
  });

  console.log('💥 Force explosion test:', forceExplosionTest);

  // Step 4: Check if we can manually create a working color
  const manualColorTest = await page.evaluate(() => {
    // Define the grunt-death palette manually
    const testPalette = [
      [50, 205, 50],
      [60, 220, 60],
      [40, 180, 40],
      [30, 150, 30],
      [80, 240, 80],
    ];

    const randomIndex = Math.floor(Math.random() * testPalette.length);
    const selectedColor = testPalette[randomIndex];

    return {
      testPalette: testPalette,
      selectedColor: selectedColor,
      manualSelection: 'working',
    };
  });

  console.log('🔧 Manual color test:', manualColorTest);

  // Analysis
  console.log('\\n🎨 PALETTE IMPORT ANALYSIS:');

  if (globalCheck.explosionPalette === 'not found') {
    console.log('❌ explosionPalette is not exposed globally');
    console.log(
      '   This means the palette import is failing in the Explosion class'
    );
  }

  if (forceExplosionTest.firstThreeParticles) {
    const colors = forceExplosionTest.firstThreeParticles;
    const allNaN = colors.every(
      (p) =>
        (typeof p.color === 'number' && isNaN(p.color)) || p.color === 'NaN'
    );

    if (allNaN) {
      console.log(
        '❌ All particle colors are NaN - import/palette access is broken'
      );
    } else {
      console.log('✅ Particle colors appear to be working');
    }
  }

  console.log('🎨 Palette import debug completed');
});
