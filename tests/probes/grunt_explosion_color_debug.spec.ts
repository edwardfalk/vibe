import { test, expect } from '@playwright/test';

/**
 * Grunt Explosion Color Debug Probe
 * Specifically investigates why grunt explosions appear black instead of green
 * Tests grunt explosion creation, rendering, and color sampling
 */

test('grunt explosion color debug - investigate black vs green issue', async ({
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

  console.log('🐸 Debugging grunt explosion colors...');

  // Step 1: Check explosion palette configuration
  const paletteCheck = await page.evaluate(() => {
    const palette = window.explosionPalette || {};
    return {
      hasGruntDeath: !!palette['grunt-death'],
      gruntDeathColors: palette['grunt-death'] || 'not found',
      hasDefault: !!palette.default,
      defaultColors: palette.default || 'not found',
      paletteKeys: Object.keys(palette),
    };
  });

  console.log('🎨 Palette check:', paletteCheck);

  // Step 2: Create grunt explosion and trace particle creation
  const explosionCreation = await page.evaluate(() => {
    const playerX = window.player.x;
    const playerY = window.player.y;
    const testX = playerX + 60;
    const testY = playerY;

    // Clear existing explosions
    if (window.explosionManager) {
      window.explosionManager.explosions = [];
      window.explosionManager.fragmentExplosions = [];
    }

    console.log('💥 Creating grunt-bullet-kill explosion...');

    // Create grunt explosion directly
    if (window.explosionManager?.addKillEffect) {
      window.explosionManager.addKillEffect(testX, testY, 'grunt', 'bullet');
    }

    const explosions = window.explosionManager?.explosions || [];
    const fragments = window.explosionManager?.fragmentExplosions || [];

    const result = {
      explosionCount: explosions.length,
      fragmentCount: fragments.length,
      explosionDetails: [],
      fragmentDetails: [],
    };

    // Check explosion details
    if (explosions.length > 0) {
      const explosion = explosions[0];
      result.explosionDetails.push({
        type: explosion.type,
        particleCount: explosion.particles?.length || 0,
        active: explosion.active,
        timer: explosion.timer,
        maxTimer: explosion.maxTimer,
        sampleParticleColors:
          explosion.particles?.slice(0, 3).map((p) => ({
            color: p.color,
            life: p.life,
            maxLife: p.maxLife,
            size: p.size,
          })) || [],
      });
    }

    // Check fragment details
    if (fragments.length > 0) {
      const fragment = fragments[0];
      result.fragmentDetails.push({
        type: fragment.type || 'unknown',
        fragmentCount: fragment.fragments?.length || 0,
        centralParticles: fragment.centralExplosion?.particles?.length || 0,
        active: fragment.active,
        sampleColors:
          fragment.centralExplosion?.particles?.slice(0, 3).map((p) => ({
            color: p.color,
            life: p.life,
            size: p.size,
          })) || [],
      });
    }

    return result;
  });

  console.log('💥 Explosion creation result:', explosionCreation);

  // Step 3: Force rendering and sample canvas immediately
  const renderingTest = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No p5 instance' };

    // Force draw explosion
    if (
      window.explosionManager &&
      typeof window.explosionManager.draw === 'function'
    ) {
      window.explosionManager.draw(p);
    }

    // Sample canvas immediately after draw
    const ctx = p.canvas.getContext('2d');
    const playerX = window.player.x;
    const playerY = window.player.y;
    const testX = playerX + 60;
    const testY = playerY;

    // Sample in a 100x100 area around explosion
    const sampleSize = 50;
    const imageData = ctx.getImageData(
      Math.max(0, testX - sampleSize),
      Math.max(0, testY - sampleSize),
      Math.min(sampleSize * 2, p.width - Math.max(0, testX - sampleSize)),
      Math.min(sampleSize * 2, p.height - Math.max(0, testY - sampleSize))
    );

    const { data } = imageData;
    const foundColors = [];
    const colorDistribution = { black: 0, green: 0, white: 0, other: 0 };

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 100) continue; // Skip transparent pixels

      const brightness = (r + g + b) / 3;

      // Classify colors
      if (brightness < 50) {
        colorDistribution.black++;
      } else if (g > r * 1.5 && g > b * 1.5 && g > 100) {
        colorDistribution.green++;
        if (foundColors.length < 10) {
          foundColors.push({
            r,
            g,
            b,
            a,
            type: 'green',
            brightness: Math.round(brightness),
          });
        }
      } else if (r > 200 && g > 200 && b > 200) {
        colorDistribution.white++;
      } else {
        colorDistribution.other++;
        if (foundColors.length < 20) {
          foundColors.push({
            r,
            g,
            b,
            a,
            type: 'other',
            brightness: Math.round(brightness),
          });
        }
      }
    }

    return {
      sampleArea: { x: testX, y: testY, size: sampleSize },
      colorDistribution,
      foundColors,
      totalPixelsSampled: Math.floor(data.length / 4),
      canvasSize: { width: p.width, height: p.height },
    };
  });

  console.log('🖼️ Canvas sampling result:', renderingTest);

  // Step 4: Check particle color generation directly
  const colorGenerationTest = await page.evaluate(() => {
    const results = {};

    // Test getParticleColor method directly if available
    const explosions = window.explosionManager?.explosions || [];
    if (
      explosions.length > 0 &&
      typeof explosions[0].getParticleColor === 'function'
    ) {
      const explosion = explosions[0];
      try {
        results.gruntBulletKillColor =
          explosion.getParticleColor('grunt-bullet-kill');
        results.gruntDeathColor = explosion.getParticleColor('grunt-death');
        results.defaultColor = explosion.getParticleColor('unknown-type');
      } catch (e) {
        results.colorGenerationError = e.message;
      }
    }

    // Check if explosionPalette is accessible
    const palette = window.explosionPalette || {};
    results.paletteAccessible = Object.keys(palette).length > 0;
    results.gruntDeathPalette = palette['grunt-death'];

    return results;
  });

  console.log('🎨 Color generation test:', colorGenerationTest);

  // Step 5: Wait a moment and check if colors change over time
  await page.waitForTimeout(500);

  const persistenceTest = await page.evaluate(() => {
    const explosions = window.explosionManager?.explosions || [];
    const fragments = window.explosionManager?.fragmentExplosions || [];

    return {
      explosionsStillActive: explosions.length,
      fragmentsStillActive: fragments.length,
      firstExplosionTimer: explosions[0]?.timer || 'no explosion',
      firstExplosionActive: explosions[0]?.active || false,
    };
  });

  console.log('⏰ Persistence test (after 500ms):', persistenceTest);

  // Take screenshot for visual analysis
  await page.screenshot({
    path: 'test-results/grunt-explosion-color-debug.png',
    fullPage: false,
  });

  // Analysis
  console.log('\\n🐸 GRUNT EXPLOSION COLOR ANALYSIS:');

  if (
    explosionCreation.explosionCount === 0 &&
    explosionCreation.fragmentCount === 0
  ) {
    console.log('❌ No grunt explosions were created at all');
  } else {
    console.log(
      `✅ Created ${explosionCreation.explosionCount} explosions, ${explosionCreation.fragmentCount} fragments`
    );

    if (explosionCreation.explosionDetails.length > 0) {
      const details = explosionCreation.explosionDetails[0];
      console.log(`   Explosion type: ${details.type}`);
      console.log(`   Particles: ${details.particleCount}`);
      console.log(`   Sample colors:`, details.sampleParticleColors);
    }
  }

  if (renderingTest.colorDistribution) {
    const { green, black, white, other } = renderingTest.colorDistribution;
    const total = green + black + white + other;
    console.log(
      `\\n🎨 Color distribution in explosion area (${total} pixels):`
    );
    console.log(`   Green: ${green} (${Math.round((green / total) * 100)}%)`);
    console.log(`   Black: ${black} (${Math.round((black / total) * 100)}%)`);
    console.log(`   White: ${white} (${Math.round((white / total) * 100)}%)`);
    console.log(`   Other: ${other} (${Math.round((other / total) * 100)}%)`);

    if (black > green && green < 10) {
      console.log(
        '\\n❌ ISSUE CONFIRMED: Grunt explosions are rendering as black/dark'
      );
      console.log('   Expected: Bright green colors from grunt-death palette');
      console.log('   Actual: Predominantly black/dark colors');
    } else if (green > black) {
      console.log(
        '\\n✅ Colors appear to be working correctly - green detected'
      );
    }
  }

  if (colorGenerationTest.gruntDeathColor) {
    console.log(`\\n🎨 Direct color generation test:`);
    console.log(
      `   grunt-death color: [${colorGenerationTest.gruntDeathColor}]`
    );
    console.log(
      `   grunt-bullet-kill color: [${colorGenerationTest.gruntBulletKillColor || 'failed'}]`
    );
  }

  // Test conclusion
  expect(
    explosionCreation.explosionCount + explosionCreation.fragmentCount,
    'Grunt explosions should be created'
  ).toBeGreaterThan(0);

  console.log('🐸 Grunt explosion color debug completed');
});
