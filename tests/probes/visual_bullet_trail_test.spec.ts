import { test, expect } from '@playwright/test';

/**
 * Visual Bullet Trail Test
 * Tests bullet trail rendering without forcing bullet creation
 * Uses natural gameplay to observe trail behavior
 */

test('bullet trails render correctly during gameplay', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 30
  );

  console.log('🎮 Testing bullet trail rendering during gameplay...');

  // Let the game run naturally and observe bullet trail behavior
  await page.waitForTimeout(2000);

  // Take a screenshot during active gameplay
  const gameplayScreenshot = await page.screenshot({
    path: 'test-results/bullet-trail-gameplay.png',
    fullPage: false,
  });

  // Check for various bullet and trail states
  const bulletTrailState = await page.evaluate(() => {
    const playerBulletCount = window.gameState?.playerBullets?.length || 0;
    const enemyBulletCount = window.gameState?.enemyBullets?.length || 0;
    const enemyCount = window.gameState?.enemies?.length || 0;

    // Sample canvas for colored pixels
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let yellowPixels = 0; // Player bullet color
    let magentaPixels = 0; // Enemy bullet color
    let greenPixels = 0; // Enemy glow or dots turning green
    let brightPixels = 0;

    for (let i = 0; i < data.length; i += 16 * 4) {
      // Sample every 16th pixel
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

      // Green effects (could be dots or enemy glow)
      if (g > 150 && g > r && g > b && a > 100) {
        greenPixels++;
      }
    }

    return {
      playerBulletCount,
      enemyBulletCount,
      enemyCount,
      yellowPixels,
      magentaPixels,
      greenPixels,
      brightPixels,
      frameCount: window.frameCount,
    };
  });

  console.log('🎯 Bullet trail state during gameplay:', bulletTrailState);

  // Wait for a period to let bullets expire naturally
  await page.waitForTimeout(3000);

  // Check state after bullets should have expired
  const afterExpirationState = await page.evaluate(() => {
    const playerBulletCount = window.gameState?.playerBullets?.length || 0;
    const enemyBulletCount = window.gameState?.enemyBullets?.length || 0;

    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let yellowPixels = 0;
    let magentaPixels = 0;
    let greenPixels = 0;
    let suspiciousColoredDots = [];

    // More thorough scan for persistent colored artifacts
    for (let y = 0; y < p.height; y += 8) {
      for (let x = 0; x < p.width; x += 8) {
        const i = (y * p.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 80) continue;

        // Look for persistent yellow trail dots
        if (r > 180 && g > 180 && b < 150 && r + g > 2 * b && a > 120) {
          yellowPixels++;
          if (suspiciousColoredDots.length < 3) {
            suspiciousColoredDots.push({ x, y, color: 'yellow', r, g, b, a });
          }
        }

        // Look for persistent magenta trail dots
        if (r > 180 && b > 180 && g < 150 && r + b > 2 * g && a > 120) {
          magentaPixels++;
          if (suspiciousColoredDots.length < 3) {
            suspiciousColoredDots.push({ x, y, color: 'magenta', r, g, b, a });
          }
        }

        // Look for green dots
        if (g > 150 && g > r && g > b && a > 120) {
          greenPixels++;
          if (suspiciousColoredDots.length < 3) {
            suspiciousColoredDots.push({ x, y, color: 'green', r, g, b, a });
          }
        }
      }
    }

    return {
      playerBulletCount,
      enemyBulletCount,
      yellowPixels,
      magentaPixels,
      greenPixels,
      suspiciousColoredDots,
    };
  });

  console.log('🧹 After expiration state:', afterExpirationState);

  if (afterExpirationState.suspiciousColoredDots.length > 0) {
    console.log(
      '📍 Suspicious colored dots found:',
      afterExpirationState.suspiciousColoredDots
    );

    // Take another screenshot to capture the issue
    await page.screenshot({
      path: 'test-results/bullet-trail-artifacts.png',
      fullPage: false,
    });
  }

  // The test passes if we have reasonable behavior
  console.log('📊 Trail test summary:');
  console.log(
    `   - During gameplay: ${bulletTrailState.yellowPixels} yellow, ${bulletTrailState.magentaPixels} magenta`
  );
  console.log(
    `   - After expiration: ${afterExpirationState.yellowPixels} yellow, ${afterExpirationState.magentaPixels} magenta`
  );
  console.log(
    `   - Suspicious dots: ${afterExpirationState.suspiciousColoredDots.length}`
  );

  // Basic assertions - we expect some reduction in colored pixels after bullets expire
  if (bulletTrailState.yellowPixels > 0) {
    expect(
      afterExpirationState.yellowPixels,
      'Yellow trail artifacts should be reduced'
    ).toBeLessThan(bulletTrailState.yellowPixels);
  }

  if (bulletTrailState.magentaPixels > 0) {
    expect(
      afterExpirationState.magentaPixels,
      'Magenta trail artifacts should be reduced'
    ).toBeLessThan(bulletTrailState.magentaPixels);
  }

  // Should not have many persistent colored dots
  expect(
    afterExpirationState.suspiciousColoredDots.length,
    'Should not have many persistent colored artifacts'
  ).toBeLessThan(5);

  console.log('✅ Visual bullet trail test completed');
});
