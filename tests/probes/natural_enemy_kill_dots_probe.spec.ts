import { test, expect } from '@playwright/test';

/**
 * Natural Enemy Kill Dots Probe
 * Tests enemy explosion dots using natural gameplay mechanics
 * Lets the player shoot at enemies that spawn naturally
 */

test('natural enemy kills do not leave persistent explosion dots', async ({
  page,
}) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 60 // Wait longer for enemies to spawn
  );

  console.log('🎮 Testing natural enemy kill explosion dots...');

  // Step 1: Let the game run to get some enemies
  await page.waitForTimeout(2000);

  // Step 2: Check current game state
  const initialState = await page.evaluate(() => {
    const enemies = window.gameState?.enemies || [];
    const explosions = window.explosionManager?.explosions?.length || 0;
    const fragments = window.explosionManager?.fragmentExplosions?.length || 0;

    return {
      enemyCount: enemies.length,
      explosionCount: explosions,
      fragmentCount: fragments,
      enemyTypes: enemies.map((e) => e.type).slice(0, 3), // First 3 enemy types
    };
  });

  console.log('👾 Initial game state:', initialState);

  if (initialState.enemyCount === 0) {
    console.log('⚠️ No enemies found, ending test early');
    return;
  }

  // Step 3: Take baseline measurement
  const baseline = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0; // Grunt explosions
    let coloredPixels = 0; // Any bright colored pixels
    let brightPixels = 0;

    for (let i = 0; i < data.length; i += 20 * 4) {
      // Sample every 20th pixel
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 80) continue;

      const brightness = (r + g + b) / 3;
      if (brightness > 120) brightPixels++;

      // Green explosion particles (grunt)
      if (g > 150 && g > r * 1.5 && g > b * 1.5 && a > 100) {
        greenPixels++;
      }

      // Any bright colored pixels (explosions)
      if (brightness > 150 && (r > 150 || g > 150 || b > 150) && a > 120) {
        coloredPixels++;
      }
    }

    return { greenPixels, coloredPixels, brightPixels };
  });

  console.log('📊 Baseline measurement:', baseline);

  // Step 4: Start shooting to trigger enemy deaths
  console.log('🔫 Starting continuous shooting...');
  await page.keyboard.down('Space');

  // Let shooting continue for a while to hit enemies
  await page.waitForTimeout(3000);

  // Step 5: Sample during active combat
  const duringCombat = await page.evaluate(() => {
    const enemies = window.gameState?.enemies || [];
    const bullets = window.gameState?.playerBullets || [];
    const explosions = window.explosionManager?.explosions?.length || 0;
    const fragments = window.explosionManager?.fragmentExplosions?.length || 0;

    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0;
    let coloredPixels = 0;
    let brightPixels = 0;

    for (let i = 0; i < data.length; i += 20 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 80) continue;

      const brightness = (r + g + b) / 3;
      if (brightness > 120) brightPixels++;

      // Green explosion particles
      if (g > 150 && g > r * 1.5 && g > b * 1.5 && a > 100) {
        greenPixels++;
      }

      // Any bright colored pixels
      if (brightness > 150 && (r > 150 || g > 150 || b > 150) && a > 120) {
        coloredPixels++;
      }
    }

    return {
      enemyCount: enemies.length,
      bulletCount: bullets.length,
      explosionCount: explosions,
      fragmentCount: fragments,
      greenPixels,
      coloredPixels,
      brightPixels,
    };
  });

  console.log('💥 During combat:', duringCombat);

  // Step 6: Stop shooting and wait for effects to clear
  await page.keyboard.up('Space');
  await page.waitForTimeout(4000); // Wait longer for all effects to finish

  // Step 7: Final measurement after combat
  const afterCombat = await page.evaluate(() => {
    const enemies = window.gameState?.enemies || [];
    const explosions = window.explosionManager?.explosions?.length || 0;
    const fragments = window.explosionManager?.fragmentExplosions?.length || 0;
    const plasmaClouds = window.explosionManager?.plasmaClouds?.length || 0;

    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0;
    let coloredPixels = 0;
    let brightPixels = 0;
    let suspiciousDots = [];

    // Detailed scan for persistent explosion artifacts
    // Skip UI area (top-left corner) to avoid false positives from text
    const uiMargin = 300; // Skip first 300px horizontally and vertically

    for (let y = uiMargin; y < p.height; y += 8) {
      for (let x = uiMargin; x < p.width; x += 8) {
        const i = (y * p.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 80) continue;

        const brightness = (r + g + b) / 3;
        if (brightness > 120) brightPixels++;

        // Look for persistent green explosion dots (grunt explosions)
        if (g > 150 && g > r * 1.5 && g > b * 1.5 && a > 120) {
          greenPixels++;
          if (suspiciousDots.length < 5) {
            suspiciousDots.push({ x, y, color: 'green', r, g, b, a });
          }
        }

        // Look for yellow explosion dots (stabber explosions: ~255, 215, 0)
        if (r > 180 && g > 150 && b < 100 && a > 120) {
          coloredPixels++;
          if (suspiciousDots.length < 5) {
            suspiciousDots.push({ x, y, color: 'yellow', r, g, b, a });
          }
        }

        // Look for pink explosion dots (rusher explosions: ~255, 20, 147)
        if (r > 180 && b > 100 && g < 100 && a > 120) {
          coloredPixels++;
          if (suspiciousDots.length < 5) {
            suspiciousDots.push({ x, y, color: 'pink', r, g, b, a });
          }
        }

        // Look for purple explosion dots (tank explosions: ~138, 43, 226)
        if (b > 150 && r > 100 && g < 100 && a > 120) {
          coloredPixels++;
          if (suspiciousDots.length < 5) {
            suspiciousDots.push({ x, y, color: 'purple', r, g, b, a });
          }
        }
      }
    }

    return {
      enemyCount: enemies.length,
      explosionCount: explosions,
      fragmentCount: fragments,
      plasmaClouds,
      greenPixels,
      coloredPixels,
      brightPixels,
      suspiciousDots,
    };
  });

  console.log('🧹 After combat cleanup:', afterCombat);

  if (afterCombat.suspiciousDots.length > 0) {
    console.log(
      '📍 Suspicious explosion dots found:',
      afterCombat.suspiciousDots
    );

    // Take screenshot to capture the issue
    await page.screenshot({
      path: 'test-results/natural-enemy-kill-artifacts.png',
      fullPage: false,
    });
  }

  // Analysis
  console.log('📊 Natural enemy kill test analysis:');
  console.log(
    `   - Baseline: ${baseline.greenPixels} green, ${baseline.coloredPixels} colored`
  );
  console.log(
    `   - During combat: ${duringCombat.greenPixels} green, ${duringCombat.coloredPixels} colored`
  );
  console.log(
    `   - After combat: ${afterCombat.greenPixels} green, ${afterCombat.coloredPixels} colored`
  );
  console.log(
    `   - Enemy change: ${initialState.enemyCount} → ${afterCombat.enemyCount}`
  );
  console.log(
    `   - Explosions/fragments: ${afterCombat.explosionCount}/${afterCombat.fragmentCount}`
  );

  // Main assertions
  expect(
    afterCombat.explosionCount,
    'All explosions should be cleaned up'
  ).toBe(0);
  expect(
    afterCombat.fragmentCount,
    'All fragment explosions should be cleaned up'
  ).toBe(0);

  // If we had explosion activity during combat, check cleanup
  if (duringCombat.greenPixels > baseline.greenPixels + 10) {
    console.log('✅ Green explosion activity detected during combat');
    expect(
      afterCombat.greenPixels,
      'Green explosion dots should be mostly cleaned up'
    ).toBeLessThan(duringCombat.greenPixels * 0.3);
  }

  if (duringCombat.coloredPixels > baseline.coloredPixels + 10) {
    console.log('✅ Colored explosion activity detected during combat');
    expect(
      afterCombat.coloredPixels,
      'Colored explosion dots should be mostly cleaned up'
    ).toBeLessThan(duringCombat.coloredPixels * 0.3);
  }

  // Should not have many persistent artifacts
  expect(
    afterCombat.suspiciousDots.length,
    'Should not have persistent explosion dots'
  ).toBeLessThan(5);

  console.log('✅ Natural enemy kill dots test completed');
});
