import { test, expect } from '@playwright/test';

test('Stabber Green Dot Investigation', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await page.waitForTimeout(2000);

  // Wait for game to initialize
  await page.waitForFunction(
    () => window.frameCount > 0 && window.player && window.enemies
  );

  // Set deterministic seed for consistent behavior
  await page.evaluate(() => {
    window.setRandomSeed(1337);
  });

  // Click canvas to unlock audio
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(100);

  // Clear any existing enemies and spawn a Stabber
  await page.evaluate(() => {
    window.enemies.length = 0;

    // Spawn a Stabber at a specific location for observation
    const stabber = window.enemyFactory.createEnemy(400, 200, 'stabber');
    window.enemies.push(stabber);

    // Position player nearby to trigger attack behavior
    window.player.x = 300;
    window.player.y = 300;
  });

  await page.waitForTimeout(500);

  // Capture initial state
  await page.screenshot({
    path: 'tests/bug-reports/stabber_initial.png',
    clip: { x: 0, y: 0, width: 800, height: 600 },
  });

  // Wait and observe Stabber behavior during multiple attack cycles
  let attackCount = 0;
  const maxAttacks = 3;

  while (attackCount < maxAttacks) {
    // Wait for Stabber to potentially attack
    await page.waitForTimeout(1000);

    const stabberState = await page.evaluate(() => {
      const stabber = window.enemies.find((e) => e.type === 'stabber');
      if (!stabber) return null;

      return {
        x: stabber.x,
        y: stabber.y,
        isAttacking: stabber.isAttacking || false,
        health: stabber.health,
        lastAttackTime: stabber.lastAttackTime || 0,
        currentTime: Date.now(),
      };
    });

    if (stabberState?.isAttacking) {
      attackCount++;
      console.log(`🗡️ Stabber attack detected (${attackCount}/${maxAttacks})`);

      // Capture screenshot during attack
      await page.screenshot({
        path: `tests/bug-reports/stabber_attack_${attackCount}.png`,
        clip: { x: 0, y: 0, width: 800, height: 600 },
      });

      // Sample pixels around the Stabber to detect green artifacts
      const pixelAnalysis = await page.evaluate((stabberPos) => {
        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const radius = 50;

        // Sample a grid around the stabber position
        const samples = [];
        for (let dx = -radius; dx <= radius; dx += 10) {
          for (let dy = -radius; dy <= radius; dy += 10) {
            const x = Math.round(stabberPos.x + dx);
            const y = Math.round(stabberPos.y + dy);

            if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
              const imageData = ctx.getImageData(x, y, 1, 1);
              const [r, g, b, a] = imageData.data;
              samples.push({ x, y, r, g, b, a });
            }
          }
        }

        return samples;
      }, stabberState);

      // Check for unexpected green pixels (similar to the original dots problem)
      const greenPixels = pixelAnalysis.filter(
        (pixel) =>
          pixel.g > pixel.r + 30 &&
          pixel.g > pixel.b + 30 &&
          pixel.g > 100 &&
          pixel.a > 50
      );

      if (greenPixels.length > 0) {
        console.log(`⚠️ Green pixels detected during Stabber attack:`, {
          count: greenPixels.length,
          samples: greenPixels
            .slice(0, 3)
            .map((p) => `RGB(${p.r},${p.g},${p.b}) at (${p.x},${p.y})`),
        });
      }

      // Wait for attack to complete
      await page.waitForTimeout(500);
    }
  }

  // Capture final state
  await page.screenshot({
    path: 'tests/bug-reports/stabber_final.png',
    clip: { x: 0, y: 0, width: 800, height: 600 },
  });

  // Check for lingering visual artifacts after attacks
  const finalPixelScan = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    let greenArtifacts = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      // Check for green pixels that might be artifacts
      if (a > 50 && g > r + 30 && g > b + 30 && g > 100) {
        greenArtifacts++;
      }
    }

    return { greenArtifacts };
  });

  console.log(
    `🔍 Final artifact scan: ${finalPixelScan.greenArtifacts} green pixels found`
  );

  // Log final game state
  const finalState = await page.evaluate(() => {
    return {
      stabberCount: window.enemies.filter((e) => e.type === 'stabber').length,
      totalEnemies: window.enemies.length,
      activeExplosions: window.explosionManager?.explosions?.length || 0,
      activeParticles: window.visualEffectsManager?.particles?.length || 0,
    };
  });

  console.log('📊 Final game state:', finalState);
});
