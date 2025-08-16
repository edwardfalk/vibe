import { test, expect } from '@playwright/test';

/**
 * Simple Enemy Kill Probe
 * Uses natural game mechanics to trigger enemy deaths and test for persistent dots
 * Simulates player shooting to kill enemies that naturally spawn
 */

test('enemy kills during natural gameplay show persistent dots', async ({
  page,
}) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 60 // Wait for enemies to spawn naturally
  );

  console.log('🎮 Testing natural enemy kills for persistent dots...');

  // Step 1: Check what's available in the game environment
  const gameEnvironment = await page.evaluate(() => {
    return {
      hasPlayer: !!window.player,
      hasGameState: !!window.gameState,
      hasExplosionManager: !!window.explosionManager,
      hasSpawnSystem: !!window.spawnSystem,
      hasEnemyFactory: typeof EnemyFactory !== 'undefined',
      hasGrunt: typeof Grunt !== 'undefined',
      hasBullet: typeof Bullet !== 'undefined',
      frameCount: window.frameCount,
      enemyCount: window.gameState?.enemies?.length || 0,
      bulletCount: window.gameState?.playerBullets?.length || 0,
    };
  });

  console.log('🔍 Game environment:', gameEnvironment);

  // Step 2: Take baseline measurement
  const baseline = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0;
    let yellowPixels = 0;
    let magentaPixels = 0;
    let brightPixels = 0;

    const uiMargin = 150; // Skip UI area
    for (let y = uiMargin; y < p.height; y += 10) {
      for (let x = uiMargin; x < p.width; x += 10) {
        const i = (y * p.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 80) continue;

        const brightness = (r + g + b) / 3;
        if (brightness > 120) brightPixels++;

        // Green (grunt explosions: ~50, 205, 50)
        if (g > 150 && g > r * 1.8 && g > b * 1.8 && a > 100) {
          greenPixels++;
        }

        // Yellow (player bullets/explosions: ~255, 255, 100)
        if (r > 180 && g > 180 && b < 120 && a > 100) {
          yellowPixels++;
        }

        // Magenta (enemy bullets: ~255, 100, 255)
        if (r > 180 && b > 180 && g < 120 && a > 100) {
          magentaPixels++;
        }
      }
    }

    return { greenPixels, yellowPixels, magentaPixels, brightPixels };
  });

  console.log('📊 Baseline colors:', baseline);

  // Step 3: Encourage active combat by moving and shooting
  console.log('🔫 Starting active combat...');

  // Move around and shoot for extended period to trigger enemy spawns and kills
  for (let i = 0; i < 20; i++) {
    // Move in different directions
    if (i % 4 === 0) await page.keyboard.press('ArrowLeft');
    if (i % 4 === 1) await page.keyboard.press('ArrowRight');
    if (i % 4 === 2) await page.keyboard.press('ArrowUp');
    if (i % 4 === 3) await page.keyboard.press('ArrowDown');

    // Shoot rapidly
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);

    // Check for enemy activity every few iterations
    if (i % 5 === 0) {
      const activity = await page.evaluate(() => ({
        enemies: window.gameState?.enemies?.length || 0,
        bullets: window.gameState?.playerBullets?.length || 0,
        explosions: window.explosionManager?.explosions?.length || 0,
        fragments: window.explosionManager?.fragmentExplosions?.length || 0,
      }));
      console.log(`Combat activity ${i}:`, activity);
    }
  }

  // Step 4: Sample colors during active combat
  const duringCombat = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const explosions = window.explosionManager?.explosions?.length || 0;
    const fragments = window.explosionManager?.fragmentExplosions?.length || 0;
    const enemies = window.gameState?.enemies?.length || 0;
    const bullets = window.gameState?.playerBullets?.length || 0;

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0;
    let yellowPixels = 0;
    let magentaPixels = 0;
    let brightPixels = 0;

    const uiMargin = 150;
    for (let y = uiMargin; y < p.height; y += 10) {
      for (let x = uiMargin; x < p.width; x += 10) {
        const i = (y * p.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 80) continue;

        const brightness = (r + g + b) / 3;
        if (brightness > 120) brightPixels++;

        // Green (grunt explosions)
        if (g > 150 && g > r * 1.8 && g > b * 1.8 && a > 100) {
          greenPixels++;
        }

        // Yellow (player bullets/explosions)
        if (r > 180 && g > 180 && b < 120 && a > 100) {
          yellowPixels++;
        }

        // Magenta (enemy bullets)
        if (r > 180 && b > 180 && g < 120 && a > 100) {
          magentaPixels++;
        }
      }
    }

    return {
      greenPixels,
      yellowPixels,
      magentaPixels,
      brightPixels,
      explosions,
      fragments,
      enemies,
      bullets,
    };
  });

  console.log('💥 During combat:', duringCombat);

  // Step 5: Wait for effects to settle
  console.log('⏱️ Waiting for effects to settle...');
  await page.waitForTimeout(2000);

  // Step 6: Final scan for persistent dots
  const afterCombat = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const explosions = window.explosionManager?.explosions?.length || 0;
    const fragments = window.explosionManager?.fragmentExplosions?.length || 0;
    const enemies = window.gameState?.enemies?.length || 0;

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let greenPixels = 0;
    let yellowPixels = 0;
    let magentaPixels = 0;
    let brightPixels = 0;
    let suspiciousGreenDots = [];
    let suspiciousYellowDots = [];
    let suspiciousMagentaDots = [];

    const uiMargin = 150;
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

        // Look for persistent green dots (grunt explosions)
        if (g > 150 && g > r * 1.8 && g > b * 1.8 && a > 100) {
          greenPixels++;
          if (suspiciousGreenDots.length < 5) {
            suspiciousGreenDots.push({ x, y, r, g, b, a });
          }
        }

        // Look for persistent yellow dots (player bullets)
        if (r > 180 && g > 180 && b < 120 && a > 100) {
          yellowPixels++;
          if (suspiciousYellowDots.length < 5) {
            suspiciousYellowDots.push({ x, y, r, g, b, a });
          }
        }

        // Look for persistent magenta dots (enemy bullets)
        if (r > 180 && b > 180 && g < 120 && a > 100) {
          magentaPixels++;
          if (suspiciousMagentaDots.length < 5) {
            suspiciousMagentaDots.push({ x, y, r, g, b, a });
          }
        }
      }
    }

    return {
      explosions,
      fragments,
      enemies,
      greenPixels,
      yellowPixels,
      magentaPixels,
      brightPixels,
      suspiciousGreenDots,
      suspiciousYellowDots,
      suspiciousMagentaDots,
    };
  });

  console.log('🧹 After combat cleanup:', afterCombat);

  // Take screenshot if we find suspicious dots
  const totalSuspiciousDots =
    afterCombat.suspiciousGreenDots.length +
    afterCombat.suspiciousYellowDots.length +
    afterCombat.suspiciousMagentaDots.length;

  if (totalSuspiciousDots > 0) {
    console.log('📸 Taking screenshot of persistent colored dots...');
    await page.screenshot({
      path: 'test-results/simple-enemy-kill-persistent-dots.png',
      fullPage: false,
    });

    if (afterCombat.suspiciousGreenDots.length > 0) {
      console.log(
        '🟢 Persistent GREEN dots found:',
        afterCombat.suspiciousGreenDots
      );
    }
    if (afterCombat.suspiciousYellowDots.length > 0) {
      console.log(
        '🟡 Persistent YELLOW dots found:',
        afterCombat.suspiciousYellowDots
      );
    }
    if (afterCombat.suspiciousMagentaDots.length > 0) {
      console.log(
        '🟣 Persistent MAGENTA dots found:',
        afterCombat.suspiciousMagentaDots
      );
    }
  }

  // Analysis and reporting
  console.log('📊 Simple enemy kill test analysis:');
  console.log(
    `   - Baseline: ${baseline.greenPixels}g, ${baseline.yellowPixels}y, ${baseline.magentaPixels}m`
  );
  console.log(
    `   - During: ${duringCombat.greenPixels}g, ${duringCombat.yellowPixels}y, ${duringCombat.magentaPixels}m`
  );
  console.log(
    `   - After: ${afterCombat.greenPixels}g, ${afterCombat.yellowPixels}y, ${afterCombat.magentaPixels}m`
  );
  console.log(
    `   - Persistent dots: ${totalSuspiciousDots} total (${afterCombat.suspiciousGreenDots.length}g, ${afterCombat.suspiciousYellowDots.length}y, ${afterCombat.suspiciousMagentaDots.length}m)`
  );
  console.log(
    `   - Final effects: ${afterCombat.explosions} explosions, ${afterCombat.fragments} fragments`
  );

  // Main assertions
  expect(afterCombat.explosions, 'All explosions should be cleaned up').toBe(0);
  expect(afterCombat.fragments, 'All fragments should be cleaned up').toBe(0);

  // Report findings - don't fail test, just document what we found
  if (totalSuspiciousDots > 0) {
    console.log(
      `⚠️  ISSUE CONFIRMED: Found ${totalSuspiciousDots} persistent colored dots after combat`
    );
    console.log(
      '    This confirms the user-reported issue of lingering dots after enemy kills'
    );

    // Specifically flag green dots (grunt explosions) as most problematic
    if (afterCombat.suspiciousGreenDots.length > 2) {
      console.log(
        `🔴 CRITICAL: ${afterCombat.suspiciousGreenDots.length} persistent GREEN dots (grunt explosion artifacts)`
      );
    }
  } else {
    console.log(
      '✅ No persistent colored dots found - issue may be intermittent'
    );
  }

  console.log('📋 Simple enemy kill probe completed');
});
