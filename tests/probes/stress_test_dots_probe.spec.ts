import { test, expect } from '@playwright/test';

/**
 * Stress Test for Lingering Dots
 * Creates intense explosions and effects to trigger potential dot artifacts
 * This test is designed to reproduce the issue described by the user
 */

test('stress test - multiple simultaneous explosions', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () => window.player && window.explosionManager && window.frameCount > 5
  );

  console.log('💥 Stress testing with multiple simultaneous explosions...');

  // Create a burst of explosions all at once
  await page.evaluate(() => {
    const p = window.player.p;
    const centerX = p.width / 2;
    const centerY = p.height / 2;

    // Clear existing effects
    if (window.explosionManager) {
      window.explosionManager.explosions = [];
      window.explosionManager.plasmaClouds = [];
      window.explosionManager.fragmentExplosions = [];
    }

    // Create intense burst of various enemy deaths
    const enemies = ['grunt', 'tank', 'rusher', 'stabber'];
    const methods = ['bullet', 'plasma'];

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = 60;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      const enemy = enemies[i % enemies.length];
      const method = methods[i % methods.length];

      // Add explosion
      window.explosionManager.addKillEffect(x, y, enemy, method);

      // Add fragment explosion for more intensity
      const mockEnemy = {
        type: enemy,
        size: 35 + Math.random() * 20,
        bodyColor: [100 + Math.random() * 100, 150, 100],
        skinColor: [120, 180 + Math.random() * 50, 120],
      };
      window.explosionManager.addFragmentExplosion(x, y, mockEnemy);
    }

    // Also trigger some player glow effects for additive blend testing
    if (window.player && typeof window.player.takeDamage === 'function') {
      // Trigger player hit flash without killing
      window.player.hitFlash = 8;
    }

    console.log('💥 Created stress burst with 8 simultaneous explosions');
  });

  // Sample frequently during the intense explosion phase
  const samples = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(300); // Sample every 300ms for 3 seconds

    const artifactCount = await page.evaluate(() => {
      const p = window.player?.p;
      if (!p) return -1;

      const ctx = p.canvas.getContext('2d');
      const { data } = ctx.getImageData(0, 0, p.width, p.height);

      let artifacts = 0;
      let totalBrightPixels = 0;

      // More aggressive scanning for artifacts
      for (let i = 0; i < data.length; i += 4 * 2) {
        // Sample every 2nd pixel
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 20) continue;

        const brightness = (r + g + b) / 3;
        const maxChannel = Math.max(r, g, b);

        // Count bright pixels
        if (brightness > 120) {
          totalBrightPixels++;
        }

        // Look for extremely bright/saturated dots that persist
        if (brightness > 180 && maxChannel > 220 && a > 200) {
          artifacts++;
        }
      }

      return { artifacts, totalBrightPixels };
    });

    console.log(
      `🔍 Sample ${i}: artifacts=${artifactCount.artifacts}, bright=${artifactCount.totalBrightPixels}`
    );
    samples.push(artifactCount);
  }

  // Wait for explosions to completely finish
  await page.waitForTimeout(5000);

  // Final comprehensive scan for persistent artifacts
  const finalScan = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { artifacts: -1, details: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let persistentDots = 0;
    let brightPixels = 0;
    let maxBrightness = 0;
    const artifactLocations = [];

    // Thorough pixel-by-pixel scan
    for (let y = 0; y < p.height; y += 2) {
      for (let x = 0; x < p.width; x += 2) {
        const i = (y * p.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 30) continue;

        const brightness = (r + g + b) / 3;
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);

        if (brightness > 100) brightPixels++;
        if (brightness > maxBrightness) maxBrightness = brightness;

        // Detect likely artifact dots: very bright, saturated, and isolated
        if (brightness > 150 && saturation > 100 && a > 180) {
          persistentDots++;
          if (artifactLocations.length < 10) {
            artifactLocations.push({ x, y, r, g, b, brightness });
          }
        }
      }
    }

    return {
      artifacts: persistentDots,
      brightPixels,
      maxBrightness,
      locations: artifactLocations,
      details: `Found ${persistentDots} potential artifacts, ${brightPixels} bright pixels, max brightness ${maxBrightness}`,
    };
  });

  console.log('🎯 Final scan results:', finalScan.details);
  if (finalScan.locations.length > 0) {
    console.log('📍 Artifact locations:', finalScan.locations);
  }

  // Report findings
  console.log('📊 Stress test complete:');
  console.log('   - Simultaneous explosions: 8');
  console.log('   - Sampling duration: 3 seconds');
  console.log('   - Wait time after: 5 seconds');
  console.log(`   - Final artifacts found: ${finalScan.artifacts}`);

  // Allow small number of artifacts due to legitimate background elements
  expect(
    finalScan.artifacts,
    'Should not have persistent bright artifacts after stress test'
  ).toBeLessThan(3);
});

test('blend mode leak detection', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(() => window.player);

  // Test for blend mode persistence issues
  const blendTest = await page.evaluate(() => {
    const p = window.player.p;
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    // Simulate the additive blend issue
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 200, 200);

    // Draw with additive blend (simulating glow effects)
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(0, 255, 0, 0.5)'; // Green glow
    ctx.beginPath();
    ctx.arc(100, 100, 30, 0, Math.PI * 2);
    ctx.fill();

    // Forgot to reset blend mode - this is the bug pattern
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'; // Should be subtle red
    ctx.beginPath();
    ctx.arc(120, 120, 20, 0, Math.PI * 2);
    ctx.fill();

    // Check pixel data
    const imageData = ctx.getImageData(0, 0, 200, 200);
    const data = imageData.data;

    let additiveBrightPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Look for abnormally bright pixels due to additive blending
      if (r + g + b > 400) {
        // Impossibly bright for normal blending
        additiveBrightPixels++;
      }
    }

    return {
      brightPixels: additiveBrightPixels,
      testPassed: additiveBrightPixels > 0, // We expect to find bright pixels in this test
    };
  });

  console.log('🧪 Blend mode leak test:', blendTest);
  expect(
    blendTest.testPassed,
    'Should detect additive blend artifacts in test'
  ).toBe(true);
});
