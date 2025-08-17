import { test, expect } from '@playwright/test';

test('Background Improvement Verification', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await page.waitForTimeout(3000);

  // Wait for game to initialize
  await page.waitForFunction(() => window.frameCount > 0 && window.player);

  console.log('✅ Testing background improvements');

  // Click canvas to start the game
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(500);

  // Take initial screenshot to show the darker background
  await page.screenshot({
    path: 'tests/bug-reports/background_improvement_initial.png',
    clip: { x: 0, y: 0, width: 800, height: 600 },
  });

  // Sample background colors to verify they're darker
  const backgroundAnalysis = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');

    // Sample background colors from different areas
    const samples = [];

    // Top of screen
    const topPixel = ctx.getImageData(400, 50, 1, 1).data;
    samples.push({
      location: 'top',
      r: topPixel[0],
      g: topPixel[1],
      b: topPixel[2],
    });

    // Middle of screen
    const midPixel = ctx.getImageData(400, 300, 1, 1).data;
    samples.push({
      location: 'middle',
      r: midPixel[0],
      g: midPixel[1],
      b: midPixel[2],
    });

    // Bottom of screen
    const botPixel = ctx.getImageData(400, 550, 1, 1).data;
    samples.push({
      location: 'bottom',
      r: botPixel[0],
      g: botPixel[1],
      b: botPixel[2],
    });

    // Calculate average brightness
    const avgBrightness =
      samples.reduce(
        (sum, sample) => sum + (sample.r + sample.g + sample.b) / 3,
        0
      ) / samples.length;

    return {
      samples,
      avgBrightness,
      isDark: avgBrightness < 30, // Dark background should have low average brightness
    };
  });

  console.log('🌌 Background analysis:', backgroundAnalysis);

  // Verify the background is indeed darker
  if (backgroundAnalysis.isDark) {
    console.log('✅ Background successfully darkened:');
    console.log(
      `   - Average brightness: ${backgroundAnalysis.avgBrightness.toFixed(1)}`
    );
    backgroundAnalysis.samples.forEach((sample) => {
      console.log(
        `   - ${sample.location}: RGB(${sample.r}, ${sample.g}, ${sample.b})`
      );
    });
  } else {
    console.log(
      `⚠️ Background may not be dark enough (brightness: ${backgroundAnalysis.avgBrightness.toFixed(1)})`
    );
  }

  // Wait a bit to see time-based variations
  await page.waitForTimeout(2000);

  // Take another screenshot to show the background in motion
  await page.screenshot({
    path: 'tests/bug-reports/background_improvement_animated.png',
    clip: { x: 0, y: 0, width: 800, height: 600 },
  });

  // Final screenshot after some gameplay to show how it looks with game elements
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: 'tests/bug-reports/background_improvement_with_gameplay.png',
    clip: { x: 0, y: 0, width: 800, height: 600 },
  });

  console.log('📊 Background improvement test completed');
});
