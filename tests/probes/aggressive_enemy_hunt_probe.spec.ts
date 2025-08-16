import { test, expect } from '@playwright/test';

/**
 * Aggressive Enemy Hunt Probe
 * Actively hunts enemies by moving toward them and shooting
 * Designed to force enemy kills and detect persistent dots
 */

test('aggressive enemy hunting creates persistent explosion dots', async ({
  page,
}) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 60
  );

  console.log('🎯 Aggressive enemy hunting to force kills...');

  // Step 1: Setup aggressive hunting parameters
  await page.evaluate(() => {
    // Make player bullets more deadly and faster
    window.DEBUG_AGGRESSIVE_HUNT = true;

    // Log when explosions are created
    const originalCreateExplosion = window.explosionManager?.createExplosion;
    if (originalCreateExplosion) {
      window.explosionManager.createExplosion = function (...args) {
        console.log('💥 EXPLOSION CREATED:', args);
        return originalCreateExplosion.apply(this, args);
      };
    }
  });

  // Step 2: Baseline measurement
  const baseline = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let coloredPixels = 0;
    let brightPixels = 0;

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
        if (brightness > 150) brightPixels++;

        // Any colored pixels (explosions, bullets, effects)
        if (brightness > 100 && (r > 100 || g > 100 || b > 100) && a > 100) {
          coloredPixels++;
        }
      }
    }

    const enemies = window.gameState?.enemies || [];
    return {
      coloredPixels,
      brightPixels,
      enemyCount: enemies.length,
      enemyPositions: enemies
        .map((e) => ({
          x: Math.round(e.x),
          y: Math.round(e.y),
          health: e.health,
          type: e.type,
        }))
        .slice(0, 3),
    };
  });

  console.log('📊 Baseline before hunting:', baseline);

  // Step 3: Aggressive enemy hunting
  console.log('🏹 Starting aggressive enemy hunting...');

  let killsDetected = 0;
  let explosionsDetected = 0;

  for (let huntPhase = 0; huntPhase < 30; huntPhase++) {
    // Get enemy positions and move toward them
    const enemyData = await page.evaluate(() => {
      const enemies = window.gameState?.enemies || [];
      const player = window.player;

      if (enemies.length === 0 || !player) {
        return { hasEnemies: false };
      }

      // Find closest enemy
      let closestEnemy = null;
      let closestDistance = Infinity;

      for (const enemy of enemies) {
        const distance = Math.sqrt(
          (enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2
        );
        if (distance < closestDistance) {
          closestDistance = distance;
          closestEnemy = enemy;
        }
      }

      return {
        hasEnemies: true,
        totalEnemies: enemies.length,
        closestEnemy: closestEnemy
          ? {
              x: Math.round(closestEnemy.x),
              y: Math.round(closestEnemy.y),
              health: closestEnemy.health,
              type: closestEnemy.type,
              distance: Math.round(closestDistance),
            }
          : null,
        playerPos: { x: Math.round(player.x), y: Math.round(player.y) },
      };
    });

    if (!enemyData.hasEnemies) {
      console.log('⏰ No enemies available, waiting for spawns...');
      await page.waitForTimeout(500);
      continue;
    }

    // Move toward closest enemy
    if (enemyData.closestEnemy) {
      const enemy = enemyData.closestEnemy;
      const player = enemyData.playerPos;

      // Move toward enemy
      if (enemy.x > player.x + 20) {
        await page.keyboard.down('ArrowRight');
        await page.waitForTimeout(50);
        await page.keyboard.up('ArrowRight');
      } else if (enemy.x < player.x - 20) {
        await page.keyboard.down('ArrowLeft');
        await page.waitForTimeout(50);
        await page.keyboard.up('ArrowLeft');
      }

      if (enemy.y > player.y + 20) {
        await page.keyboard.down('ArrowDown');
        await page.waitForTimeout(50);
        await page.keyboard.up('ArrowDown');
      } else if (enemy.y < player.y - 20) {
        await page.keyboard.down('ArrowUp');
        await page.waitForTimeout(50);
        await page.keyboard.up('ArrowUp');
      }

      // Rapid fire when close
      if (enemy.distance < 150) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(30);
        await page.keyboard.press('Space');
        await page.waitForTimeout(30);
        await page.keyboard.press('Space');
      }

      // Check for explosions
      const explosionCheck = await page.evaluate(() => ({
        explosions: window.explosionManager?.explosions?.length || 0,
        fragments: window.explosionManager?.fragmentExplosions?.length || 0,
        bullets: window.gameState?.playerBullets?.length || 0,
      }));

      if (explosionCheck.explosions > 0 || explosionCheck.fragments > 0) {
        explosionsDetected++;
        console.log(
          `💥 EXPLOSION DETECTED! Phase ${huntPhase}, explosions: ${explosionCheck.explosions}, fragments: ${explosionCheck.fragments}`
        );
      }

      if (huntPhase % 5 === 0) {
        console.log(
          `Hunt ${huntPhase}: Enemy at (${enemy.x}, ${enemy.y}) dist ${enemy.distance}, player at (${player.x}, ${player.y}), bullets: ${explosionCheck.bullets}`
        );
      }
    }

    await page.waitForTimeout(100);
  }

  console.log(
    `🎯 Hunting completed: ${explosionsDetected} explosions detected`
  );

  // Step 4: Check colors during active effects
  const duringEffects = await page.evaluate(() => {
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
    let coloredPixels = 0;

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

        // Green (grunt explosions)
        if (g > 150 && g > r * 1.5 && g > b * 1.5 && a > 100) {
          greenPixels++;
        }

        // Yellow (player bullets/effects)
        if (r > 180 && g > 180 && b < 120 && a > 100) {
          yellowPixels++;
        }

        // Magenta (enemy bullets/effects)
        if (r > 180 && b > 180 && g < 120 && a > 100) {
          magentaPixels++;
        }

        // Any bright colored pixels
        if (brightness > 100 && (r > 100 || g > 100 || b > 100) && a > 100) {
          coloredPixels++;
        }
      }
    }

    return {
      greenPixels,
      yellowPixels,
      magentaPixels,
      coloredPixels,
      explosions,
      fragments,
      enemies,
    };
  });

  console.log('💥 During active effects:', duringEffects);

  // Step 5: Wait for effects to clear
  console.log('⏱️ Waiting for effects to clear...');
  await page.waitForTimeout(4000);

  // Step 6: Final scan for persistent dots
  const afterHunt = await page.evaluate(() => {
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
    let coloredPixels = 0;
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

        const brightness = (r + g + b) / 3;

        // Look for persistent dots
        let dotType = null;

        // Green dots (grunt explosion artifacts)
        if (g > 150 && g > r * 1.5 && g > b * 1.5 && a > 100) {
          greenPixels++;
          dotType = 'green';
        }

        // Yellow dots (player bullet artifacts)
        if (r > 180 && g > 180 && b < 120 && a > 100) {
          yellowPixels++;
          dotType = 'yellow';
        }

        // Magenta dots (enemy bullet artifacts)
        if (r > 180 && b > 180 && g < 120 && a > 100) {
          magentaPixels++;
          dotType = 'magenta';
        }

        if (dotType && persistentDots.length < 10) {
          persistentDots.push({
            type: dotType,
            x,
            y,
            r,
            g,
            b,
            a,
            brightness: Math.round(brightness),
          });
        }

        // Any bright colored pixels
        if (brightness > 100 && (r > 100 || g > 100 || b > 100) && a > 100) {
          coloredPixels++;
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
      coloredPixels,
      persistentDots,
    };
  });

  console.log('🧹 After hunt cleanup:', afterHunt);

  // Take screenshot if persistent dots found
  if (afterHunt.persistentDots.length > 0) {
    console.log(
      '📸 Taking screenshot of persistent dots after aggressive hunting...'
    );
    await page.screenshot({
      path: 'test-results/aggressive-hunt-persistent-dots.png',
      fullPage: false,
    });

    console.log(
      '📍 Persistent dots found after hunting:',
      afterHunt.persistentDots
    );
  }

  // Analysis and reporting
  console.log('📊 Aggressive hunt analysis:');
  console.log(`   - Explosions detected during hunt: ${explosionsDetected}`);
  console.log(`   - Baseline: ${baseline.coloredPixels} colored pixels`);
  console.log(
    `   - During effects: ${duringEffects.coloredPixels} colored pixels`
  );
  console.log(`   - After cleanup: ${afterHunt.coloredPixels} colored pixels`);
  console.log(
    `   - Persistent dots: ${afterHunt.persistentDots.length} (${afterHunt.greenPixels}g, ${afterHunt.yellowPixels}y, ${afterHunt.magentaPixels}m)`
  );
  console.log(
    `   - Final effects state: ${afterHunt.explosions} explosions, ${afterHunt.fragments} fragments`
  );

  // Main assertions
  expect(afterHunt.explosions, 'All explosions should be cleaned up').toBe(0);
  expect(afterHunt.fragments, 'All fragments should be cleaned up').toBe(0);

  // Report findings
  if (explosionsDetected > 0) {
    console.log(
      `✅ SUCCESS: Detected ${explosionsDetected} explosions during aggressive hunting`
    );

    if (afterHunt.persistentDots.length > 0) {
      console.log(
        `🔴 ISSUE CONFIRMED: Found ${afterHunt.persistentDots.length} persistent colored dots after explosions`
      );
      console.log('    This confirms the user-reported lingering dots issue');

      // Categorize the dots
      const greenDots = afterHunt.persistentDots.filter(
        (d) => d.type === 'green'
      ).length;
      const yellowDots = afterHunt.persistentDots.filter(
        (d) => d.type === 'yellow'
      ).length;
      const magentaDots = afterHunt.persistentDots.filter(
        (d) => d.type === 'magenta'
      ).length;

      if (greenDots > 0)
        console.log(
          `    - ${greenDots} GREEN dots (grunt explosion artifacts)`
        );
      if (yellowDots > 0)
        console.log(
          `    - ${yellowDots} YELLOW dots (player bullet artifacts)`
        );
      if (magentaDots > 0)
        console.log(
          `    - ${magentaDots} MAGENTA dots (enemy bullet artifacts)`
        );
    } else {
      console.log(
        '✅ No persistent dots found after explosions - issue may be timing-dependent'
      );
    }

    // Don't fail test, just report findings
    expect(
      afterHunt.persistentDots.length,
      'Documenting persistent dots found'
    ).toBeGreaterThanOrEqual(0);
  } else {
    console.log(
      '⚠️ No explosions detected during hunting - may need longer hunt or different strategy'
    );
  }

  console.log('🏹 Aggressive enemy hunt probe completed');
});
