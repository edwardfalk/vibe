import { test, expect } from '@playwright/test';

test('Stabber Green Artifact Observation', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await page.waitForTimeout(3000);

  // Wait for game to initialize
  await page.waitForFunction(
    () => window.frameCount > 0 && window.player && window.gameState?.enemies
  );

  console.log('✅ Game initialized, starting observation');

  // Click canvas to unlock audio
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(100);

  // Take initial screenshot
  await page.screenshot({
    path: 'tests/bug-reports/stabber_obs_initial.png',
    clip: { x: 0, y: 0, width: 800, height: 600 },
  });

  let stabberFoundCount = 0;
  let greenArtifactCount = 0;
  const maxObservationTime = 30000; // 30 seconds
  const startTime = Date.now();

  // Observe game for potential Stabber spawns and green artifacts
  while (Date.now() - startTime < maxObservationTime && stabberFoundCount < 3) {
    await page.waitForTimeout(500);

    const gameAnalysis = await page.evaluate(() => {
      const enemies = window.gameState.enemies;
      const stabbers = enemies.filter((e) => e.type === 'stabber');

      // Sample canvas for green artifacts
      const canvas = document.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      let greenPixelCount = 0;
      let greenPixelSamples = [];

      // Sample every 10th pixel to avoid performance issues
      for (let i = 0; i < pixels.length; i += 40) {
        // Every 10th pixel (4 bytes per pixel)
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        // Check for green pixels that might be artifacts
        if (a > 50 && g > r + 40 && g > b + 40 && g > 120) {
          greenPixelCount++;
          if (greenPixelSamples.length < 3) {
            const pixelIndex = i / 4;
            const x = pixelIndex % canvas.width;
            const y = Math.floor(pixelIndex / canvas.width);
            greenPixelSamples.push({ x, y, r, g, b });
          }
        }
      }

      return {
        totalEnemies: enemies.length,
        stabberCount: stabbers.length,
        stabbers: stabbers.map((s) => ({
          x: s.x,
          y: s.y,
          isAttacking: s.isAttacking || false,
          type: s.type,
        })),
        greenPixelCount,
        greenPixelSamples,
        frameCount: window.frameCount,
      };
    });

    // If we found a Stabber, capture it
    if (gameAnalysis.stabberCount > 0) {
      stabberFoundCount++;
      console.log(`🗡️ Stabber detected (#${stabberFoundCount}):`, {
        position: gameAnalysis.stabbers[0],
        greenPixels: gameAnalysis.greenPixelCount,
      });

      await page.screenshot({
        path: `tests/bug-reports/stabber_obs_${stabberFoundCount}.png`,
        clip: { x: 0, y: 0, width: 800, height: 600 },
      });

      // Check if any Stabber is attacking
      const attackingStabber = gameAnalysis.stabbers.find((s) => s.isAttacking);
      if (attackingStabber) {
        console.log(
          `⚔️ Stabber attacking! Position: (${attackingStabber.x}, ${attackingStabber.y})`
        );
        await page.screenshot({
          path: `tests/bug-reports/stabber_attack_obs_${stabberFoundCount}.png`,
          clip: { x: 0, y: 0, width: 800, height: 600 },
        });
      }

      // If we found green artifacts, record them
      if (gameAnalysis.greenPixelCount > 50) {
        // Threshold for significant green artifacts
        greenArtifactCount++;
        console.log(
          `⚠️ Significant green artifacts detected: ${gameAnalysis.greenPixelCount} pixels`
        );
        console.log('Sample green pixels:', gameAnalysis.greenPixelSamples);
      }
    }
  }

  // Final screenshot
  await page.screenshot({
    path: 'tests/bug-reports/stabber_obs_final.png',
    clip: { x: 0, y: 0, width: 800, height: 600 },
  });

  // Final analysis
  const finalAnalysis = await page.evaluate(() => {
    return {
      totalEnemies: window.gameState.enemies.length,
      stabberCount: window.gameState.enemies.filter((e) => e.type === 'stabber')
        .length,
      frameCount: window.frameCount,
    };
  });

  console.log('📊 Observation Summary:', {
    stabbersFound: stabberFoundCount,
    greenArtifactInstances: greenArtifactCount,
    finalState: finalAnalysis,
    observationDuration: Date.now() - startTime,
  });

  // Test should pass but warn if artifacts found
  if (greenArtifactCount > 0) {
    console.log(
      `⚠️ WARNING: Found ${greenArtifactCount} instances with significant green artifacts`
    );
  } else {
    console.log('✅ No significant green artifacts detected');
  }
});
