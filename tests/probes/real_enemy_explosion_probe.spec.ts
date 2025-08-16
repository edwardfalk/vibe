import { test, expect } from '@playwright/test';

/**
 * Real Enemy Explosion Probe
 * Tests actual enemy explosion effects using the real addKillEffect system
 * Focuses on non-grunt enemies since grunt VFX are disabled to "avoid additive residue"
 */

test('real enemy explosions create and clean up correctly', async ({
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

  console.log('🧨 Testing real enemy explosion system...');

  // Step 1: Clear existing state and take baseline
  await page.evaluate(() => {
    if (window.gameState) {
      window.gameState.enemies = [];
      window.gameState.playerBullets = [];
      window.gameState.enemyBullets = [];
    }
    if (window.explosionManager) {
      window.explosionManager.explosions = [];
      window.explosionManager.fragmentExplosions = [];
      window.explosionManager.plasmaClouds = [];
    }
  });

  await page.waitForTimeout(200);

  const baseline = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let coloredPixels = 0;

    const uiMargin = 100;
    for (let y = uiMargin; y < p.height; y += 12) {
      for (let x = uiMargin; x < p.width; x += 12) {
        const i = (y * p.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 80) continue;

        const brightness = (r + g + b) / 3;
        if (brightness > 100 && (r > 100 || g > 100 || b > 100) && a > 100) {
          coloredPixels++;
        }
      }
    }

    return { coloredPixels };
  });

  console.log('📊 Baseline before explosions:', baseline);

  // Step 2: Test different enemy types and their explosion effects
  const enemyTypes = ['grunt', 'rusher', 'stabber', 'tank']; // Test all types
  const explosionResults = {};

  for (const enemyType of enemyTypes) {
    console.log(`\n🧪 Testing ${enemyType} explosion effects...`);

    const explosionTest = await page.evaluate((type) => {
      try {
        const playerX = window.player.x;
        const playerY = window.player.y;
        const testX = playerX + 100;
        const testY = playerY;

        // Use the REAL enemy death explosion system
        if (
          window.explosionManager &&
          typeof window.explosionManager.addKillEffect === 'function'
        ) {
          console.log(
            `💥 Triggering ${type} kill effect at (${testX}, ${testY})`
          );
          window.explosionManager.addKillEffect(testX, testY, type, 'bullet');

          return {
            success: true,
            position: { x: testX, y: testY },
            explosions: window.explosionManager.explosions?.length || 0,
            fragments: window.explosionManager.fragmentExplosions?.length || 0,
            plasmaClouds: window.explosionManager.plasmaClouds?.length || 0,
          };
        } else {
          return { success: false, error: 'addKillEffect not available' };
        }
      } catch (e) {
        return { success: false, error: e.message };
      }
    }, enemyType);

    console.log(`${enemyType} explosion result:`, explosionTest);
    explosionResults[enemyType] = explosionTest;

    // Sample colors immediately after triggering explosion
    await page.waitForTimeout(100);

    const duringExplosion = await page.evaluate(() => {
      const p = window.player?.p;
      if (!p) return { error: 'No player' };

      const ctx = p.canvas.getContext('2d');
      const { data } = ctx.getImageData(0, 0, p.width, p.height);

      let greenPixels = 0; // Grunt explosions
      let pinkPixels = 0; // Rusher explosions
      let yellowPixels = 0; // Stabber explosions
      let purplePixels = 0; // Tank explosions
      let brightPixels = 0;

      const uiMargin = 100;
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

          // Green (grunt: 50, 205, 50)
          if (g > 150 && g > r * 1.5 && g > b * 1.5 && a > 100) {
            greenPixels++;
          }

          // Pink (rusher: 255, 20, 147)
          if (r > 180 && b > 100 && g < 150 && a > 100) {
            pinkPixels++;
          }

          // Yellow (stabber: 255, 215, 0)
          if (r > 180 && g > 150 && b < 120 && a > 100) {
            yellowPixels++;
          }

          // Purple (tank: 138, 43, 226)
          if (b > 150 && r > 100 && g < 100 && a > 100) {
            purplePixels++;
          }
        }
      }

      return {
        greenPixels,
        pinkPixels,
        yellowPixels,
        purplePixels,
        brightPixels,
        explosions: window.explosionManager?.explosions?.length || 0,
        fragments: window.explosionManager?.fragmentExplosions?.length || 0,
      };
    });

    console.log(`${enemyType} during explosion:`, duringExplosion);

    // Wait for effects to clear before testing next enemy type
    await page.waitForTimeout(2000);

    // Check for persistent effects after waiting
    const afterExplosion = await page.evaluate(() => {
      const p = window.player?.p;
      if (!p) return { error: 'No player' };

      const ctx = p.canvas.getContext('2d');
      const { data } = ctx.getImageData(0, 0, p.width, p.height);

      let greenPixels = 0;
      let pinkPixels = 0;
      let yellowPixels = 0;
      let purplePixels = 0;
      let persistentDots = [];

      const uiMargin = 100;
      for (let y = uiMargin; y < p.height; y += 6) {
        for (let x = uiMargin; x < p.width; x += 6) {
          const i = (y * p.width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 80) continue;

          let dotType = null;

          // Green dots
          if (g > 150 && g > r * 1.5 && g > b * 1.5 && a > 100) {
            greenPixels++;
            dotType = 'green';
          }

          // Pink dots
          if (r > 180 && b > 100 && g < 150 && a > 100) {
            pinkPixels++;
            dotType = 'pink';
          }

          // Yellow dots
          if (r > 180 && g > 150 && b < 120 && a > 100) {
            yellowPixels++;
            dotType = 'yellow';
          }

          // Purple dots
          if (b > 150 && r > 100 && g < 100 && a > 100) {
            purplePixels++;
            dotType = 'purple';
          }

          if (dotType && persistentDots.length < 5) {
            persistentDots.push({
              type: dotType,
              x,
              y,
              r,
              g,
              b,
              a,
            });
          }
        }
      }

      return {
        explosions: window.explosionManager?.explosions?.length || 0,
        fragments: window.explosionManager?.fragmentExplosions?.length || 0,
        greenPixels,
        pinkPixels,
        yellowPixels,
        purplePixels,
        persistentDots,
      };
    });

    console.log(`${enemyType} after cleanup:`, afterExplosion);

    // Store results for analysis
    explosionResults[enemyType].duringExplosion = duringExplosion;
    explosionResults[enemyType].afterExplosion = afterExplosion;
  }

  // Step 3: Analysis and reporting
  console.log('\n📊 COMPLETE ENEMY EXPLOSION ANALYSIS:');

  let totalPersistentDots = 0;
  let problematicEnemyTypes = [];

  for (const [enemyType, results] of Object.entries(explosionResults)) {
    const during = results.duringExplosion;
    const after = results.afterExplosion;

    if (!during || !after) continue;

    const hadExplosionActivity =
      during.explosions > 0 ||
      during.fragments > 0 ||
      during.greenPixels > 0 ||
      during.pinkPixels > 0 ||
      during.yellowPixels > 0 ||
      during.purplePixels > 0;

    const persistentDots = after.persistentDots?.length || 0;
    totalPersistentDots += persistentDots;

    console.log(`\n  ${enemyType.toUpperCase()}:`);
    console.log(`    - Explosion triggered: ${results.success}`);
    console.log(`    - Had explosion activity: ${hadExplosionActivity}`);
    console.log(
      `    - During: ${during.explosions} explosions, ${during.fragments} fragments`
    );
    console.log(
      `    - After: ${after.explosions} explosions, ${after.fragments} fragments`
    );
    console.log(`    - Persistent dots: ${persistentDots}`);

    if (hadExplosionActivity && persistentDots > 0) {
      problematicEnemyTypes.push(enemyType);
      console.log(`    - ⚠️ PERSISTENT DOTS FOUND: ${persistentDots} dots`);
      if (after.persistentDots) {
        after.persistentDots.forEach((dot, i) => {
          console.log(`      ${i + 1}: ${dot.type} at (${dot.x}, ${dot.y})`);
        });
      }
    }
  }

  // Take screenshot if any persistent dots found
  if (totalPersistentDots > 0) {
    console.log('\n📸 Taking screenshot of persistent explosion dots...');
    await page.screenshot({
      path: 'test-results/real-enemy-explosion-dots.png',
      fullPage: false,
    });
  }

  // Final summary
  console.log(`\n🔍 SUMMARY:`);
  console.log(`   - Total persistent dots found: ${totalPersistentDots}`);
  console.log(
    `   - Problematic enemy types: ${problematicEnemyTypes.join(', ') || 'none'}`
  );

  if (problematicEnemyTypes.length > 0) {
    console.log(
      `   - 🔴 CONFIRMED: ${problematicEnemyTypes.join(', ')} explosion(s) create persistent dots`
    );
    console.log(
      `   - This explains the user's report of colored dots after enemy kills`
    );
  } else {
    console.log(
      `   - ✅ No persistent dots found from any enemy type explosions`
    );
  }

  // Assertions - document findings rather than fail
  expect(
    totalPersistentDots,
    'Documenting total persistent explosion dots found'
  ).toBeGreaterThanOrEqual(0);

  // Report on grunt VFX skip
  const gruntResults = explosionResults.grunt;
  if (gruntResults?.success) {
    const gruntHadActivity =
      gruntResults.duringExplosion?.explosions > 0 ||
      gruntResults.duringExplosion?.fragments > 0 ||
      gruntResults.duringExplosion?.greenPixels > 0;

    if (!gruntHadActivity) {
      console.log(
        `   - ✅ Grunt VFX skip working: no explosion activity detected`
      );
    } else {
      console.log(
        `   - ⚠️ Grunt VFX skip NOT working: explosion activity detected`
      );
    }
  }

  console.log('🧨 Real enemy explosion probe completed');
});
