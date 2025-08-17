import { test, expect } from '@playwright/test';

test('Stabber Green Dot Simple Investigation', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await page.waitForTimeout(3000);

  // Check what's available in the window object
  const gameState = await page.evaluate(() => {
    return {
      frameCount: window.frameCount || 'undefined',
      player: typeof window.player,
      gameState: typeof window.gameState,
      enemies: window.gameState?.enemies ? 'array' : 'undefined',
      enemyFactory: typeof window.enemyFactory,
      hasP5Instance: typeof window.p !== 'undefined',
      windowKeys: Object.keys(window).filter(
        (k) => k.includes('enemy') || k.includes('player') || k.includes('game')
      ),
    };
  });

  console.log('🎮 Game state on load:', gameState);

  // Wait for basic game elements with extended timeout
  try {
    await page.waitForFunction(
      () => {
        return window.frameCount && window.frameCount > 10;
      },
      { timeout: 10000 }
    );

    await page.waitForFunction(
      () => {
        return window.player && typeof window.player === 'object';
      },
      { timeout: 5000 }
    );

    await page.waitForFunction(
      () => {
        return (
          window.gameState &&
          window.gameState.enemies &&
          Array.isArray(window.gameState.enemies)
        );
      },
      { timeout: 5000 }
    );
  } catch (error) {
    console.log('⚠️ Game initialization issue:', error.message);

    // Get debug info
    const debugInfo = await page.evaluate(() => {
      return {
        frameCount: window.frameCount,
        player: window.player,
        enemies: window.enemies,
        gameState: window.gameState,
        errors:
          window.console && window.console.errors
            ? window.console.errors
            : 'no errors captured',
      };
    });

    console.log('🔍 Debug info:', debugInfo);

    // Take screenshot for analysis
    await page.screenshot({ path: 'tests/bug-reports/stabber_init_issue.png' });
    return; // Exit test early
  }

  console.log('✅ Game initialized successfully');

  // Click canvas to unlock audio
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(100);

  // Note: setRandomSeed not available globally, skipping seed setting

  // Clear existing enemies and spawn a Stabber
  const spawnResult = await page.evaluate(() => {
    try {
      window.gameState.enemies.length = 0;

      // Try to spawn a Stabber
      if (typeof window.enemyFactory?.createEnemy === 'function') {
        const stabber = window.enemyFactory.createEnemy(400, 200, 'stabber');
        window.gameState.enemies.push(stabber);
        return {
          success: true,
          stabberType: stabber.type,
          stabberPos: { x: stabber.x, y: stabber.y },
        };
      } else {
        return {
          success: false,
          error: 'enemyFactory.createEnemy not available',
        };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  console.log('🗡️ Stabber spawn result:', spawnResult);

  if (!spawnResult.success) {
    console.log('❌ Failed to spawn Stabber, exiting test');
    return;
  }

  // Position player nearby
  await page.evaluate(() => {
    window.player.x = 300;
    window.player.y = 300;
  });

  // Take initial screenshot
  await page.screenshot({
    path: 'tests/bug-reports/stabber_investigation_initial.png',
    clip: { x: 0, y: 0, width: 800, height: 600 },
  });

  // Monitor for a few seconds and capture any attacks
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(1000);

    const attackState = await page.evaluate(() => {
      const stabber = window.gameState.enemies.find(
        (e) => e.type === 'stabber'
      );
      if (!stabber) return null;

      return {
        isAttacking: stabber.isAttacking || false,
        x: stabber.x,
        y: stabber.y,
        health: stabber.health,
      };
    });

    if (attackState?.isAttacking) {
      console.log(`⚔️ Attack detected in round ${i + 1}!`);
      await page.screenshot({
        path: `tests/bug-reports/stabber_attack_${i + 1}.png`,
        clip: { x: 0, y: 0, width: 800, height: 600 },
      });
    }
  }

  // Final screenshot
  await page.screenshot({
    path: 'tests/bug-reports/stabber_investigation_final.png',
    clip: { x: 0, y: 0, width: 800, height: 600 },
  });

  console.log('✅ Stabber investigation completed');
});
