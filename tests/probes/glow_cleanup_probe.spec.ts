import { test, expect } from '@playwright/test';

/**
 * Glow Effects Cleanup Probe
 * Specifically tests that enemy glow effects don't persist after enemy death
 * Focuses on the additive blend mode artifacts from drawGlow function
 */

test('enemy glow effects are cleaned up after death', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () => window.player && window.explosionManager && window.frameCount > 5
  );

  console.log('🌟 Testing glow effect cleanup after enemy death...');

  // First, take a baseline screenshot with no enemies
  await page.evaluate(() => {
    // Ensure clean state
    if (window.gameState) {
      window.gameState.enemies = [];
      window.gameState.playerBullets = [];
      window.gameState.enemyBullets = [];
    }
    if (window.explosionManager) {
      window.explosionManager.explosions = [];
      window.explosionManager.plasmaClouds = [];
      window.explosionManager.fragmentExplosions = [];
    }
  });

  await page.waitForTimeout(500);

  const baselinePixels = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { brightPixels: -1 };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let brightPixels = 0;
    for (let i = 0; i < data.length; i += 4 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a > 100 && r + g + b > 300) {
        brightPixels++;
      }
    }

    return { brightPixels };
  });

  console.log('📊 Baseline bright pixels:', baselinePixels.brightPixels);

  // Create a glowing enemy at a specific position
  await page.evaluate(() => {
    const p = window.player.p;
    const centerX = p.width / 2;
    const centerY = p.height / 2;

    // Import enemy classes dynamically
    const enemies = window.gameState?.enemies || [];

    // Create a glowing grunt enemy directly
    const mockEnemy = {
      x: centerX,
      y: centerY,
      type: 'grunt',
      size: 40,
      health: 100,
      maxHealth: 100,
      active: true,
      markedForRemoval: false,
      p: p,
      speechTimer: 0,
      audio: window.audio,
      drawGlow: function (p) {
        // Use the global drawGlow function directly
        if (typeof drawGlow === 'function') {
          try {
            const glowColor = p.color(50, 255, 50); // Bright green
            drawGlow(p, this.x, this.y, this.size * 2, glowColor, 1.0);
          } catch (e) {
            console.log('Glow error:', e);
          }
        }
      },
      draw: function (p) {
        this.drawGlow(p);
        // Draw a simple enemy body
        p.fill(50, 150, 50);
        p.ellipse(this.x, this.y, this.size, this.size);
      },
    };

    // Add to game state
    if (window.gameState) {
      window.gameState.enemies = [mockEnemy];
    }

    console.log('👾 Created glowing enemy at center');
  });

  // Let the enemy render for a few frames to establish glow
  await page.waitForTimeout(200);

  const withEnemyPixels = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { brightPixels: -1 };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let brightPixels = 0;
    let greenGlowPixels = 0;

    for (let i = 0; i < data.length; i += 4 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a > 100 && r + g + b > 300) {
        brightPixels++;
      }

      // Look specifically for green glow (high green, lower red/blue)
      if (a > 50 && g > 150 && g > r && g > b) {
        greenGlowPixels++;
      }
    }

    return { brightPixels, greenGlowPixels };
  });

  console.log(
    '👾 With enemy - bright pixels:',
    withEnemyPixels.brightPixels,
    'green glow:',
    withEnemyPixels.greenGlowPixels
  );

  // Verify the enemy is visible and glowing
  expect(
    withEnemyPixels.greenGlowPixels,
    'Enemy should create visible green glow'
  ).toBeGreaterThan(5);

  // Now remove the enemy instantly (simulate death)
  await page.evaluate(() => {
    if (window.gameState) {
      window.gameState.enemies = [];
    }
    console.log('💀 Enemy removed from game state');
  });

  // Wait a few frames for cleanup
  await page.waitForTimeout(100);

  const afterRemovalPixels = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { brightPixels: -1 };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let brightPixels = 0;
    let greenGlowPixels = 0;
    let persistentGlowPixels = 0;

    for (let i = 0; i < data.length; i += 4 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a > 100 && r + g + b > 300) {
        brightPixels++;
      }

      // Look for green glow that should be gone
      if (a > 50 && g > 150 && g > r && g > b) {
        greenGlowPixels++;
      }

      // Look for very bright persistent pixels (potential artifacts)
      if (a > 200 && r + g + b > 600) {
        persistentGlowPixels++;
      }
    }

    return { brightPixels, greenGlowPixels, persistentGlowPixels };
  });

  console.log(
    '🧹 After removal - bright pixels:',
    afterRemovalPixels.brightPixels,
    'green glow:',
    afterRemovalPixels.greenGlowPixels,
    'persistent:',
    afterRemovalPixels.persistentGlowPixels
  );

  // The green glow should be mostly gone
  expect(
    afterRemovalPixels.greenGlowPixels,
    'Green glow should be cleaned up after enemy removal'
  ).toBeLessThan(withEnemyPixels.greenGlowPixels * 0.1);

  // No persistent bright artifacts
  expect(
    afterRemovalPixels.persistentGlowPixels,
    'No persistent glow artifacts should remain'
  ).toBe(0);

  // Final test: ensure we return close to baseline
  const pixelDifference = Math.abs(
    afterRemovalPixels.brightPixels - baselinePixels.brightPixels
  );
  expect(
    pixelDifference,
    'Should return close to baseline brightness'
  ).toBeLessThan(50);

  console.log('✅ Glow cleanup test completed successfully');
});

test('blend mode state is properly managed', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(() => window.player);

  // Test the blend mode management in the game
  const blendModeStates = await page.evaluate(() => {
    const p = window.player.p;
    const states = [];

    // Record initial state
    states.push({
      step: 'initial',
      mode: p.drawingContext.globalCompositeOperation,
    });

    // Simulate drawing glow effects like the game does
    if (typeof drawGlow === 'function') {
      drawGlow(p, 100, 100, 30, p.color(255, 0, 0), 0.5);
      states.push({
        step: 'after_drawGlow',
        mode: p.drawingContext.globalCompositeOperation,
      });
    }

    // Check if background clear resets state
    p.background(0);
    states.push({
      step: 'after_background',
      mode: p.drawingContext.globalCompositeOperation,
    });

    // Manual blend mode test
    p.blendMode(p.ADD);
    states.push({
      step: 'manual_ADD',
      mode: p.drawingContext.globalCompositeOperation,
    });

    p.blendMode(p.BLEND);
    states.push({
      step: 'reset_BLEND',
      mode: p.drawingContext.globalCompositeOperation,
    });

    return states;
  });

  console.log('🎨 Blend mode state transitions:', blendModeStates);

  // Verify proper state management
  expect(blendModeStates[0].mode).toBe('source-over'); // Initial
  expect(blendModeStates[1].mode).toBe('source-over'); // Should be reset after drawGlow
  expect(blendModeStates[4].mode).toBe('source-over'); // Should be reset to normal
});
