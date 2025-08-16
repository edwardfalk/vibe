import { test, expect } from '@playwright/test';

/**
 * Bullet Trail Dots Probe
 * Tests the specific issue where bullet trails leave colored dots
 * Based on user observation that dots match bullet colors (yellow/player, magenta/enemy)
 */

test('bullet trails do not leave persistent dots', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 10
  );

  console.log('🎯 Testing bullet trail dot persistence...');

  // Step 1: Clear all existing bullets and entities
  await page.evaluate(() => {
    if (window.gameState) {
      window.gameState.playerBullets = [];
      window.gameState.enemyBullets = [];
      window.gameState.enemies = [];
    }
  });

  await page.waitForTimeout(200);

  // Step 2: Take baseline sample
  const baseline = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let yellowPixels = 0; // Player bullet color
    let magentaPixels = 0; // Enemy bullet color
    let brightPixels = 0;

    for (let i = 0; i < data.length; i += 8 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 50) continue;

      const brightness = (r + g + b) / 3;
      if (brightness > 120) brightPixels++;

      // Look for yellow pixels (player bullets: 255, 255, 100)
      if (r > 200 && g > 200 && b < 150 && a > 100) {
        yellowPixels++;
      }

      // Look for magenta pixels (enemy bullets: 255, 100, 255)
      if (r > 200 && b > 200 && g < 150 && a > 100) {
        magentaPixels++;
      }
    }

    return { yellowPixels, magentaPixels, brightPixels };
  });

  console.log('📊 Baseline:', baseline);

  // Step 3: Create player bullets and let them move
  await page.evaluate(() => {
    const p = window.player.p;
    const Bullet = window.Bullet;

    if (Bullet && window.gameState) {
      // Create several player bullets moving in different directions
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        const bullet = new Bullet(
          window.player.x + Math.cos(angle) * 30,
          window.player.y + Math.sin(angle) * 30,
          angle,
          200, // speed
          'player'
        );
        window.gameState.playerBullets.push(bullet);
      }
      console.log('🎯 Created 3 player bullets');
    }
  });

  // Let bullets move and create trails
  await page.waitForTimeout(500);

  // Step 4: Sample while bullets are active
  const withBullets = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const bulletCount = window.gameState?.playerBullets?.length || 0;

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let yellowPixels = 0;
    let magentaPixels = 0;
    let brightPixels = 0;

    for (let i = 0; i < data.length; i += 8 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 50) continue;

      const brightness = (r + g + b) / 3;
      if (brightness > 120) brightPixels++;

      // Yellow pixels (player bullets)
      if (r > 200 && g > 200 && b < 150 && a > 100) {
        yellowPixels++;
      }

      // Magenta pixels (enemy bullets)
      if (r > 200 && b > 200 && g < 150 && a > 100) {
        magentaPixels++;
      }
    }

    return { yellowPixels, magentaPixels, brightPixels, bulletCount };
  });

  console.log('🎯 With bullets:', withBullets);
  expect(withBullets.bulletCount, 'Should have active bullets').toBeGreaterThan(
    0
  );
  expect(
    withBullets.yellowPixels,
    'Should have yellow pixels from player bullets'
  ).toBeGreaterThan(baseline.yellowPixels);

  // Step 5: Force remove all bullets instantly (simulating cleanup)
  await page.evaluate(() => {
    if (window.gameState) {
      window.gameState.playerBullets = [];
      window.gameState.enemyBullets = [];
    }
    console.log('💥 All bullets forcibly removed');
  });

  // Step 6: Wait for render cycle and check for persistent dots
  await page.waitForTimeout(200);

  const afterCleanup = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const bulletCount = window.gameState?.playerBullets?.length || 0;

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let yellowPixels = 0;
    let magentaPixels = 0;
    let brightPixels = 0;
    let suspiciousDots = [];

    // More thorough scan for persistent colored dots
    for (let y = 0; y < p.height; y += 4) {
      for (let x = 0; x < p.width; x += 4) {
        const i = (y * p.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 50) continue;

        const brightness = (r + g + b) / 3;
        if (brightness > 120) brightPixels++;

        // Yellow pixels (should be gone)
        if (r > 200 && g > 200 && b < 150 && a > 100) {
          yellowPixels++;
          if (suspiciousDots.length < 5) {
            suspiciousDots.push({ x, y, color: 'yellow', r, g, b, a });
          }
        }

        // Magenta pixels (should be gone)
        if (r > 200 && b > 200 && g < 150 && a > 100) {
          magentaPixels++;
          if (suspiciousDots.length < 5) {
            suspiciousDots.push({ x, y, color: 'magenta', r, g, b, a });
          }
        }
      }
    }

    return {
      yellowPixels,
      magentaPixels,
      brightPixels,
      bulletCount,
      suspiciousDots,
    };
  });

  console.log('🧹 After cleanup:', afterCleanup);
  if (afterCleanup.suspiciousDots.length > 0) {
    console.log(
      '📍 Suspicious colored dots found:',
      afterCleanup.suspiciousDots
    );
  }

  // Main assertions
  expect(afterCleanup.bulletCount, 'All bullets should be removed').toBe(0);
  expect(
    afterCleanup.yellowPixels,
    'Yellow bullet trail dots should be cleaned up'
  ).toBeLessThan(withBullets.yellowPixels * 0.1);
  expect(
    afterCleanup.magentaPixels,
    'Magenta bullet trail dots should be cleaned up'
  ).toBe(0);

  console.log('✅ Bullet trail dots test completed');
});

test('enemy bullet trails cleanup', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing'
  );

  console.log('👾 Testing enemy bullet trail cleanup...');

  // Clear existing
  await page.evaluate(() => {
    if (window.gameState) {
      window.gameState.playerBullets = [];
      window.gameState.enemyBullets = [];
      window.gameState.enemies = [];
    }
  });

  await page.waitForTimeout(100);

  // Create enemy bullets
  await page.evaluate(() => {
    const p = window.player.p;
    const Bullet = window.Bullet;

    if (Bullet && window.gameState) {
      // Create enemy bullets with different colors
      for (let i = 0; i < 2; i++) {
        const angle = i * Math.PI;
        const bullet = new Bullet(
          window.player.x + Math.cos(angle) * 50,
          window.player.y + Math.sin(angle) * 50,
          angle,
          150,
          'enemy-grunt' // This should create magenta bullets
        );
        window.gameState.enemyBullets.push(bullet);
      }
      console.log('👾 Created 2 enemy bullets');
    }
  });

  // Let them create trails
  await page.waitForTimeout(300);

  const withEnemyBullets = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let magentaPixels = 0;

    for (let i = 0; i < data.length; i += 8 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 50) continue;

      // Magenta pixels (enemy bullets: 255, 100, 255)
      if (r > 200 && b > 200 && g < 150 && a > 100) {
        magentaPixels++;
      }
    }

    return {
      magentaPixels,
      bulletCount: window.gameState?.enemyBullets?.length || 0,
    };
  });

  console.log('👾 With enemy bullets:', withEnemyBullets);
  expect(
    withEnemyBullets.bulletCount,
    'Should have enemy bullets'
  ).toBeGreaterThan(0);

  // Remove enemy bullets
  await page.evaluate(() => {
    if (window.gameState) {
      window.gameState.enemyBullets = [];
    }
  });

  await page.waitForTimeout(200);

  const afterEnemyCleanup = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No player' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let magentaPixels = 0;

    for (let i = 0; i < data.length; i += 8 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 50) continue;

      if (r > 200 && b > 200 && g < 150 && a > 100) {
        magentaPixels++;
      }
    }

    return { magentaPixels };
  });

  console.log('🧹 After enemy cleanup:', afterEnemyCleanup);

  expect(
    afterEnemyCleanup.magentaPixels,
    'Enemy bullet trail dots should be cleaned up'
  ).toBeLessThan(withEnemyBullets.magentaPixels * 0.1);

  console.log('✅ Enemy bullet trail cleanup test completed');
});
