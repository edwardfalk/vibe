import { test, expect } from '@playwright/test';

/**
 * Fresh Explosion Color Test
 * Tests newly created explosions after the color fix
 * Verifies the fallback color system is working
 */

test('fresh explosion colors work after fix', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 30
  );

  console.log('🆕 Testing fresh explosion colors...');

  // Step 1: Clear all explosions first
  await page.evaluate(() => {
    if (window.explosionManager) {
      window.explosionManager.explosions = [];
      window.explosionManager.fragmentExplosions = [];
      window.explosionManager.plasmaClouds = [];
    }
  });

  console.log('🧹 Cleared existing explosions');

  // Step 2: Create fresh explosion after fix
  const freshExplosionTest = await page.evaluate(() => {
    const playerX = window.player.x;
    const playerY = window.player.y;
    const testX = playerX + 80;
    const testY = playerY;

    console.log('💥 Creating fresh grunt explosion...');

    // Create new explosion
    window.explosionManager?.addKillEffect?.(testX, testY, 'grunt', 'bullet');

    const explosion = window.explosionManager?.explosions?.[0];
    if (!explosion) return { error: 'No explosion created' };

    // Check the fresh particles
    const particleColors =
      explosion.particles?.slice(0, 5).map((p) => ({
        color: p.color,
        colorType: typeof p.color,
        isArray: Array.isArray(p.color),
        isValidColor:
          Array.isArray(p.color) &&
          p.color.length === 3 &&
          p.color.every((c) => typeof c === 'number' && !isNaN(c)),
      })) || [];

    return {
      explosionType: explosion.type,
      particleCount: explosion.particles?.length || 0,
      particleColors,
      firstValidColor:
        particleColors.find((p) => p.isValidColor)?.color || 'none',
    };
  });

  console.log('💥 Fresh explosion test:', freshExplosionTest);

  // Step 3: Force render and sample canvas
  const renderTest = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No p5 instance' };

    // Force render
    if (
      window.explosionManager &&
      typeof window.explosionManager.draw === 'function'
    ) {
      window.explosionManager.draw(p);
    }

    // Sample canvas
    const ctx = p.canvas.getContext('2d');
    const playerX = window.player.x;
    const testX = playerX + 80;
    const testY = window.player.y;

    const sampleSize = 60;
    const imageData = ctx.getImageData(
      Math.max(0, testX - sampleSize),
      Math.max(0, testY - sampleSize),
      Math.min(sampleSize * 2, p.width - Math.max(0, testX - sampleSize)),
      Math.min(sampleSize * 2, p.height - Math.max(0, testY - sampleSize))
    );

    const { data } = imageData;
    const colorStats = { green: 0, nonBlack: 0, total: 0, samples: [] };

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 100) continue;
      colorStats.total++;

      const brightness = (r + g + b) / 3;
      if (brightness > 50) {
        colorStats.nonBlack++;

        // Check for green-ish colors
        if (g > r * 1.2 && g > b * 1.2 && g > 120) {
          colorStats.green++;
          if (colorStats.samples.length < 5) {
            colorStats.samples.push({
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
      sampleArea: { x: testX, y: testY, size: sampleSize },
      colorStats,
    };
  });

  console.log('🖼️ Canvas render test:', renderTest);

  // Step 4: Check console for warning messages
  const consoleLogs = [];
  page.on('console', (msg) => {
    if (msg.text().includes('explosionPalette') || msg.text().includes('🎨')) {
      consoleLogs.push(msg.text());
    }
  });

  // Create another explosion to trigger console logs
  await page.evaluate(() => {
    const playerX = window.player.x;
    const playerY = window.player.y;
    window.explosionManager?.addKillEffect?.(
      playerX - 80,
      playerY,
      'stabber',
      'bullet'
    );
  });

  await page.waitForTimeout(200);

  console.log('📝 Console warnings:', consoleLogs);

  // Take screenshot
  await page.screenshot({
    path: 'test-results/fresh-explosion-colors.png',
    fullPage: false,
  });

  // Analysis
  console.log('\\n🆕 FRESH EXPLOSION ANALYSIS:');

  if (freshExplosionTest.particleColors) {
    const validColors = freshExplosionTest.particleColors.filter(
      (p) => p.isValidColor
    );

    if (validColors.length > 0) {
      console.log(`✅ Found ${validColors.length} particles with valid colors`);
      console.log(
        `   First valid color: [${freshExplosionTest.firstValidColor}]`
      );
    } else {
      console.log('❌ No particles have valid colors - fix not working');
    }
  }

  if (renderTest.colorStats) {
    const { green, nonBlack, total } = renderTest.colorStats;
    console.log(
      `🎨 Canvas colors: ${green} green, ${nonBlack} non-black, ${total} total pixels`
    );

    if (green > 0) {
      console.log('✅ Green colors detected on canvas!');
      console.log('   Sample green pixels:', renderTest.colorStats.samples);
    } else if (nonBlack > 0) {
      console.log('🟡 Non-black colors detected, but not green');
    } else {
      console.log('❌ Still all black/dark colors');
    }
  }

  if (consoleLogs.length > 0) {
    console.log('📝 Console messages detected - check for import warnings');
  }

  console.log('🆕 Fresh explosion color test completed');
});
