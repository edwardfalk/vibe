import { test, expect } from '@playwright/test';

/**
 * Active Shooting Trail Test
 * Tests bullet trail behavior by actively shooting
 * Simulates player input to create bullets and observe trail effects
 */

test('bullet trails during active shooting', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 30
  );

  console.log('🔫 Testing bullet trails during active shooting...');

  // Baseline measurement
  const baseline = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let yellowPixels = 0;
    let magentaPixels = 0;

    for (let i = 0; i < data.length; i += 16 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 80) continue;

      // Player bullet yellow
      if (r > 180 && g > 180 && b < 150 && r + g > 2 * b) {
        yellowPixels++;
      }

      // Enemy bullet magenta
      if (r > 180 && b > 180 && g < 150 && r + b > 2 * g) {
        magentaPixels++;
      }
    }

    return { yellowPixels, magentaPixels };
  });

  console.log('📊 Baseline:', baseline);

  // Simulate player shooting by holding space bar
  await page.keyboard.down('Space');

  // Let the player shoot for a while
  await page.waitForTimeout(1000);

  // Check bullet activity during shooting
  const duringShooting = await page.evaluate(() => {
    const playerBulletCount = window.gameState?.playerBullets?.length || 0;
    const enemyBulletCount = window.gameState?.enemyBullets?.length || 0;

    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let yellowPixels = 0;
    let magentaPixels = 0;
    let brightPixels = 0;

    for (let i = 0; i < data.length; i += 16 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 80) continue;

      const brightness = (r + g + b) / 3;
      if (brightness > 120) brightPixels++;

      // Player bullet yellow (255, 255, 100)
      if (r > 180 && g > 180 && b < 150 && r + g > 2 * b) {
        yellowPixels++;
      }

      // Enemy bullet magenta (255, 100, 255)
      if (r > 180 && b > 180 && g < 150 && r + b > 2 * g) {
        magentaPixels++;
      }
    }

    return {
      playerBulletCount,
      enemyBulletCount,
      yellowPixels,
      magentaPixels,
      brightPixels,
    };
  });

  console.log('🔫 During shooting:', duringShooting);

  // Stop shooting
  await page.keyboard.up('Space');

  // Wait for bullets to expire
  await page.waitForTimeout(2000);

  // Final measurement
  const afterShooting = await page.evaluate(() => {
    const playerBulletCount = window.gameState?.playerBullets?.length || 0;
    const enemyBulletCount = window.gameState?.enemyBullets?.length || 0;

    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let yellowPixels = 0;
    let magentaPixels = 0;
    let suspiciousYellowDots = [];
    let suspiciousMagentaDots = [];

    // Thorough scan for persistent trail artifacts
    for (let y = 0; y < p.height; y += 6) {
      for (let x = 0; x < p.width; x += 6) {
        const i = (y * p.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 80) continue;

        // Look for persistent yellow dots (player bullet trail artifacts)
        if (r > 180 && g > 180 && b < 150 && r + g > 2 * b && a > 120) {
          yellowPixels++;
          if (suspiciousYellowDots.length < 3) {
            suspiciousYellowDots.push({ x, y, r, g, b, a });
          }
        }

        // Look for persistent magenta dots (enemy bullet trail artifacts)
        if (r > 180 && b > 180 && g < 150 && r + b > 2 * g && a > 120) {
          magentaPixels++;
          if (suspiciousMagentaDots.length < 3) {
            suspiciousMagentaDots.push({ x, y, r, g, b, a });
          }
        }
      }
    }

    return {
      playerBulletCount,
      enemyBulletCount,
      yellowPixels,
      magentaPixels,
      suspiciousYellowDots,
      suspiciousMagentaDots,
    };
  });

  console.log('🧹 After shooting stopped:', afterShooting);

  if (afterShooting.suspiciousYellowDots.length > 0) {
    console.log(
      '⚠️ Suspicious yellow dots (player bullet trails):',
      afterShooting.suspiciousYellowDots
    );
  }

  if (afterShooting.suspiciousMagentaDots.length > 0) {
    console.log(
      '⚠️ Suspicious magenta dots (enemy bullet trails):',
      afterShooting.suspiciousMagentaDots
    );
  }

  // Analysis
  console.log('📊 Shooting test analysis:');
  console.log(
    `   - Baseline: ${baseline.yellowPixels} yellow, ${baseline.magentaPixels} magenta`
  );
  console.log(
    `   - During shooting: ${duringShooting.yellowPixels} yellow, ${duringShooting.magentaPixels} magenta`
  );
  console.log(
    `   - After shooting: ${afterShooting.yellowPixels} yellow, ${afterShooting.magentaPixels} magenta`
  );
  console.log(
    `   - Player bullets during: ${duringShooting.playerBulletCount}, after: ${afterShooting.playerBulletCount}`
  );

  // Test expectations
  if (duringShooting.playerBulletCount > 0) {
    console.log('✅ Player was actively shooting bullets');

    // If we had bullets during shooting, check cleanup
    if (duringShooting.yellowPixels > baseline.yellowPixels) {
      const yellowReduction =
        duringShooting.yellowPixels - afterShooting.yellowPixels;
      console.log(
        `   - Yellow pixel cleanup: ${yellowReduction} pixels removed`
      );

      expect(
        afterShooting.yellowPixels,
        'Yellow trail artifacts should be cleaned up'
      ).toBeLessThan(duringShooting.yellowPixels * 0.3);
    }

    expect(
      afterShooting.suspiciousYellowDots.length,
      'Should not have persistent yellow dots'
    ).toBeLessThan(3);
  } else {
    console.log('⚠️ No player bullets detected - shooting may not have worked');
  }

  expect(
    afterShooting.suspiciousMagentaDots.length,
    'Should not have persistent magenta dots'
  ).toBeLessThan(3);

  console.log('✅ Active shooting trail test completed');
});
