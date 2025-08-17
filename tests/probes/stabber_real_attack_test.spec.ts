import { test, expect } from '@playwright/test';

test('Stabber Real Attack Visual Test', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await page.waitForTimeout(3000);

  // Wait for game to initialize
  await page.waitForFunction(
    () => window.frameCount > 0 && window.player && window.gameState?.enemies
  );

  console.log('✅ Game initialized, starting real attack test');

  // Click canvas to unlock audio and start gameplay
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(500);

  // Take initial screenshot
  await page.screenshot({
    path: 'tests/bug-reports/stabber_real_attack_initial.png',
    clip: { x: 0, y: 0, width: 800, height: 600 },
  });

  // Wait for natural Stabber spawning or force spawn if available
  let stabberSpawned = false;
  let attempts = 0;
  const maxAttempts = 20;

  while (!stabberSpawned && attempts < maxAttempts) {
    attempts++;
    await page.waitForTimeout(1000);

    const gameStatus = await page.evaluate(() => {
      const enemies = window.gameState.enemies;
      const stabber = enemies.find((e) => e.type === 'stabber');

      // Try to manually spawn a stabber if none exists and we have the capability
      if (!stabber && attempts % 5 === 0 && window.spawnSystem?.spawnEnemy) {
        try {
          window.spawnSystem.spawnEnemy('stabber');
        } catch (e) {
          // Spawn failed, continue waiting for natural spawn
        }
      }

      return {
        totalEnemies: enemies.length,
        hasStabber: !!stabber,
        stabberState: stabber
          ? {
              x: stabber.x,
              y: stabber.y,
              isAttacking: stabber.isAttacking || false,
              isStabbing: stabber.isStabbing || false,
            }
          : null,
        frameCount: window.frameCount,
      };
    });

    if (gameStatus.hasStabber) {
      stabberSpawned = true;
      console.log(
        `🗡️ Stabber found after ${attempts} attempts:`,
        gameStatus.stabberState
      );

      // Position player near the Stabber to encourage attack
      await page.evaluate((stabberPos) => {
        if (stabberPos && window.player) {
          // Position player close enough to trigger Stabber attack behavior
          window.player.x = stabberPos.x + 100; // Close but not too close
          window.player.y = stabberPos.y + 50;
        }
      }, gameStatus.stabberState);

      break;
    }
  }

  if (!stabberSpawned) {
    console.log('❌ No Stabber spawned after maximum attempts, ending test');
    return;
  }

  // Monitor Stabber behavior for attack animations and visual effects
  let attackObserved = false;
  let monitoringAttempts = 0;
  const maxMonitoring = 15;

  while (!attackObserved && monitoringAttempts < maxMonitoring) {
    monitoringAttempts++;
    await page.waitForTimeout(500);

    const attackStatus = await page.evaluate(() => {
      const stabber = window.gameState.enemies.find(
        (e) => e.type === 'stabber'
      );
      if (!stabber) return { stabberLost: true };

      // Check for various attack state indicators
      const isAttacking =
        stabber.isAttacking ||
        stabber.isStabbing ||
        stabber.stabbing ||
        stabber.stabPreparingTime > 0 ||
        stabber.stabAnimationTime > 0;

      // Also check particle systems for activity
      const particleCount = window.visualEffectsManager?.particles?.length || 0;
      const explosionCount = window.explosionManager?.explosions?.length || 0;

      return {
        stabberPos: { x: stabber.x, y: stabber.y },
        isAttacking,
        particleCount,
        explosionCount,
        stabberProperties: {
          stabPreparingTime: stabber.stabPreparingTime || 0,
          stabAnimationTime: stabber.stabAnimationTime || 0,
          isStabbing: stabber.isStabbing || false,
        },
      };
    });

    if (attackStatus.stabberLost) {
      console.log('❌ Stabber was lost during monitoring');
      break;
    }

    console.log(
      `⚔️ Monitor ${monitoringAttempts}: Attack=${attackStatus.isAttacking}, Particles=${attackStatus.particleCount}, Props=`,
      attackStatus.stabberProperties
    );

    if (attackStatus.isAttacking || attackStatus.particleCount > 0) {
      attackObserved = true;
      console.log('🎯 Attack behavior observed!');

      // Capture the moment
      await page.screenshot({
        path: `tests/bug-reports/stabber_attack_moment_${monitoringAttempts}.png`,
        clip: { x: 0, y: 0, width: 800, height: 600 },
      });

      // Wait a bit more to see the full effect
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `tests/bug-reports/stabber_attack_aftermath_${monitoringAttempts}.png`,
        clip: { x: 0, y: 0, width: 800, height: 600 },
      });
    }
  }

  // Final analysis
  const finalAnalysis = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    let greenPixels = 0;
    let goldPixels = 0;

    // Sample pixels to detect color artifacts
    for (let i = 0; i < pixels.length; i += 160) {
      // Sample every 40th pixel
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      if (a > 50) {
        // Green artifacts (should be minimal for Stabber)
        if (g > r + 40 && g > b + 40 && g > 120) {
          greenPixels++;
        }

        // Gold/orange pixels (expected for Stabber)
        if (r > 200 && g > 150 && b < 100) {
          goldPixels++;
        }
      }
    }

    return {
      attackObserved,
      greenPixels,
      goldPixels,
      totalEnemies: window.gameState.enemies.length,
      frameCount: window.frameCount,
    };
  });

  // Final screenshot
  await page.screenshot({
    path: 'tests/bug-reports/stabber_real_attack_final.png',
    clip: { x: 0, y: 0, width: 800, height: 600 },
  });

  console.log('📊 Final Analysis:', finalAnalysis);

  if (finalAnalysis.attackObserved) {
    if (finalAnalysis.greenPixels < 5) {
      console.log(
        '✅ SUCCESS: Stabber attack observed with minimal green artifacts'
      );
    } else {
      console.log(
        `⚠️ WARNING: Stabber attack observed but with ${finalAnalysis.greenPixels} green artifacts`
      );
    }
  } else {
    console.log('ℹ️ No Stabber attack observed during test period');
  }
});
