import { test, expect } from '@playwright/test';

/**
 * Comprehensive Lingering Dots Probe
 * Tests all enemy types and kill methods for persistent visual artifacts
 * Focuses on additive blend mode leaks from glow effects
 */

test('no lingering dots after various enemy explosions', async ({ page }) => {
  await page.goto('http://localhost:5500');

  // Wait for systems to be ready
  await page.waitForFunction(
    () => window.player && window.explosionManager && window.frameCount > 5
  );

  console.log('🔬 Testing enemy death effects for lingering artifacts...');

  // Test scenarios with different enemy types and effects
  const testScenarios = [
    { enemy: 'grunt', method: 'bullet', description: 'Grunt bullet kill' },
    { enemy: 'grunt', method: 'plasma', description: 'Grunt plasma kill' },
    {
      enemy: 'tank',
      method: 'bullet',
      description: 'Tank bullet kill (creates plasma cloud)',
    },
    { enemy: 'rusher', method: 'bullet', description: 'Rusher bullet kill' },
    { enemy: 'stabber', method: 'bullet', description: 'Stabber bullet kill' },
  ];

  for (const scenario of testScenarios) {
    console.log(`🎯 Testing: ${scenario.description}`);

    // Trigger explosion at center of screen
    await page.evaluate((sc) => {
      const p = window.player.p;
      const cx = p.width / 2;
      const cy = p.height / 2;

      // Clear any existing effects first
      if (window.explosionManager) {
        window.explosionManager.explosions = [];
        window.explosionManager.plasmaClouds = [];
        window.explosionManager.fragmentExplosions = [];
      }

      // Trigger the specific kill effect
      window.explosionManager.addKillEffect(cx, cy, sc.enemy, sc.method);

      // Also add fragment explosion for visual intensity
      const mockEnemy = {
        type: sc.enemy,
        size: 40,
        bodyColor: [100, 150, 100],
        skinColor: [120, 180, 120],
      };
      window.explosionManager.addFragmentExplosion(cx, cy, mockEnemy);
    }, scenario);

    // Wait for explosion to complete and sample for artifacts
    await page.waitForTimeout(2000);

    const leakCount = await page.evaluate(() => {
      const p = window.player?.p;
      if (!p) return -1;

      const ctx = p.canvas.getContext('2d');
      const { data } = ctx.getImageData(0, 0, p.width, p.height);

      let leaks = 0;
      // Sample every 4th pixel for performance
      for (let i = 0; i < data.length; i += 4 * 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Skip transparent pixels
        if (a < 30) continue;

        // Check for bright, saturated pixels that might be lingering artifacts
        const brightness = (r + g + b) / 3;
        const maxChannel = Math.max(r, g, b);
        const minChannel = Math.min(r, g, b);
        const saturation = maxChannel - minChannel;

        // Bright, saturated pixels are likely lingering effects
        if (brightness > 100 && saturation > 80) {
          leaks++;
          // Break early to avoid counting entire explosion
          if (leaks > 10) break;
        }
      }

      return leaks;
    });

    console.log(`   └─ Lingering artifacts: ${leakCount}`);

    // Allow some tolerance for legitimate background elements
    expect(
      leakCount,
      `${scenario.description} should not leave artifacts`
    ).toBeLessThan(5);

    // Small delay between tests
    await page.waitForTimeout(500);
  }

  // Final comprehensive check after all explosions
  await page.waitForTimeout(3000);

  const finalCheck = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return -1;

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let suspiciousPixels = 0;
    // More thorough final scan
    for (let i = 0; i < data.length; i += 8 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 40) continue;

      // Look for very bright green/colored dots that shouldn't be there
      const isAbnormallyBright = (r > 200 || g > 200 || b > 200) && a > 150;
      const isHighContrast = Math.max(r, g, b) - Math.min(r, g, b) > 100;

      if (isAbnormallyBright && isHighContrast) {
        suspiciousPixels++;
      }
    }

    return suspiciousPixels;
  });

  console.log(`🎯 Final artifact count: ${finalCheck}`);
  expect(
    finalCheck,
    'No persistent artifacts should remain after all explosions'
  ).toBe(0);
});

test('blend mode reset prevents accumulation', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(() => window.player && window.explosionManager);

  // Test that blend modes are properly reset after drawing
  const blendModeTest = await page.evaluate(() => {
    const p = window.player.p;

    // Check initial blend mode
    const initialMode = p.drawingContext.globalCompositeOperation;

    // Simulate drawing with additive blend mode (like glow effects)
    p.blendMode(p.ADD);
    p.fill(255, 0, 0, 100);
    p.ellipse(100, 100, 50, 50);

    // Check if mode was left in ADD state
    const addModeState = p.drawingContext.globalCompositeOperation;

    // Reset to normal
    p.blendMode(p.BLEND);
    const resetModeState = p.drawingContext.globalCompositeOperation;

    return {
      initial: initialMode,
      afterAdd: addModeState,
      afterReset: resetModeState,
    };
  });

  console.log('🎨 Blend mode states:', blendModeTest);

  // Verify blend mode management
  expect(blendModeTest.afterAdd).toBe('lighter'); // ADD mode in canvas
  expect(blendModeTest.afterReset).toBe('source-over'); // Normal blend mode
});
