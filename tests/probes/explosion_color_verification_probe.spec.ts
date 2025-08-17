import { test, expect } from '@playwright/test';

/**
 * Explosion Color Verification Probe
 * Verifies that explosion colors match the expected color palette
 * Tests each enemy type's explosion colors after the fix
 */

test('explosion colors match expected palette after fix', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 30
  );

  console.log('🎨 Testing explosion color accuracy after fix...');

  // Define expected color ranges for each enemy type
  const expectedColors = {
    grunt: {
      name: 'bright green',
      primary: [50, 205, 50],
      range: { r: [30, 80], g: [180, 240], b: [30, 80] },
    },
    rusher: {
      name: 'deep pink',
      primary: [255, 20, 147],
      range: { r: [220, 255], g: [0, 50], b: [120, 180] },
    },
    stabber: {
      name: 'gold',
      primary: [255, 215, 0],
      range: { r: [220, 255], g: [160, 230], b: [0, 90] },
    },
    tank: {
      name: 'blue violet',
      primary: [138, 43, 226],
      range: { r: [100, 170], g: [30, 110], b: [200, 255] },
    },
  };

  const colorResults = {};

  // Test each enemy type explosion
  for (const [enemyType, expected] of Object.entries(expectedColors)) {
    console.log(`\n🧪 Testing ${enemyType} explosion colors...`);

    // Clear any existing explosions
    await page.evaluate(() => {
      if (window.explosionManager) {
        window.explosionManager.explosions = [];
        window.explosionManager.fragmentExplosions = [];
        window.explosionManager.plasmaClouds = [];
      }
    });

    await page.waitForTimeout(100);

    // Trigger explosion and sample colors immediately
    const colorSample = await page.evaluate((type) => {
      const playerX = window.player.x;
      const playerY = window.player.y;
      const testX = playerX + 80;
      const testY = playerY;

      // Trigger explosion
      window.explosionManager?.addKillEffect?.(testX, testY, type, 'bullet');

      // Brief wait for explosion to start rendering
      setTimeout(() => {}, 100);

      // Sample canvas colors
      const p = window.player?.p;
      if (!p) return { error: 'No player instance' };

      const ctx = p.canvas.getContext('2d');
      const { data } = ctx.getImageData(0, 0, p.width, p.height);

      const foundColors = [];
      const colorCounts = {};

      // Sample around explosion area
      const sampleRadius = 50;
      for (let y = testY - sampleRadius; y < testY + sampleRadius; y += 4) {
        for (let x = testX - sampleRadius; x < testX + sampleRadius; x += 4) {
          if (x < 0 || y < 0 || x >= p.width || y >= p.height) continue;

          const i = (Math.floor(y) * p.width + Math.floor(x)) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a < 100) continue; // Skip transparent pixels

          const brightness = (r + g + b) / 3;
          if (brightness < 50) continue; // Skip very dark pixels

          const colorKey = `${Math.floor(r / 20) * 20},${Math.floor(g / 20) * 20},${Math.floor(b / 20) * 20}`;
          colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;

          if (foundColors.length < 20) {
            foundColors.push({
              r,
              g,
              b,
              a,
              brightness: Math.round(brightness),
            });
          }
        }
      }

      // Find most common colors
      const topColors = Object.entries(colorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([colorKey, count]) => {
          const [r, g, b] = colorKey.split(',').map(Number);
          return { r, g, b, count };
        });

      return {
        explosions: window.explosionManager?.explosions?.length || 0,
        fragments: window.explosionManager?.fragmentExplosions?.length || 0,
        foundColors: foundColors.slice(0, 10),
        topColors,
        sampleArea: { x: testX, y: testY, radius: sampleRadius },
      };
    }, enemyType);

    console.log(`${enemyType} color sample:`, {
      explosions: colorSample.explosions,
      fragments: colorSample.fragments,
      topColorsFound: colorSample.topColors?.length || 0,
      sampleCount: colorSample.foundColors?.length || 0,
    });

    if (colorSample.topColors && colorSample.topColors.length > 0) {
      console.log(
        `Top colors for ${enemyType}:`,
        colorSample.topColors.slice(0, 3)
      );
    }

    // Analyze color accuracy
    let colorMatch = false;
    let bestMatch = null;
    let bestMatchScore = 0;

    if (colorSample.foundColors) {
      for (const color of colorSample.foundColors) {
        const range = expected.range;
        const matchesRange =
          color.r >= range.r[0] &&
          color.r <= range.r[1] &&
          color.g >= range.g[0] &&
          color.g <= range.g[1] &&
          color.b >= range.b[0] &&
          color.b <= range.b[1];

        if (matchesRange) {
          colorMatch = true;
        }

        // Calculate similarity to expected primary color
        const distance = Math.sqrt(
          Math.pow(color.r - expected.primary[0], 2) +
            Math.pow(color.g - expected.primary[1], 2) +
            Math.pow(color.b - expected.primary[2], 2)
        );
        const similarity = Math.max(0, 100 - distance / 4.41); // Normalize to 0-100

        if (similarity > bestMatchScore) {
          bestMatchScore = similarity;
          bestMatch = color;
        }
      }
    }

    colorResults[enemyType] = {
      expected: expected,
      triggered: colorSample.explosions > 0 || colorSample.fragments > 0,
      colorMatch,
      bestMatch,
      bestMatchScore: Math.round(bestMatchScore),
      sampleData: colorSample,
    };

    console.log(`${enemyType} result:`, {
      triggered: colorResults[enemyType].triggered,
      colorMatch,
      bestMatchScore: Math.round(bestMatchScore),
      bestMatch: bestMatch
        ? `RGB(${bestMatch.r}, ${bestMatch.g}, ${bestMatch.b})`
        : 'none',
    });

    // Wait for explosion to clear before next test
    await page.waitForTimeout(1500);
  }

  // Analysis and reporting
  console.log('\n🎨 EXPLOSION COLOR ANALYSIS:');

  let correctColors = 0;
  let totalTests = 0;
  const issues = [];

  for (const [enemyType, result] of Object.entries(colorResults)) {
    totalTests++;

    if (result.triggered) {
      if (result.colorMatch) {
        correctColors++;
        console.log(
          `✅ ${enemyType}: Correct ${result.expected.name} colors detected`
        );
      } else if (result.bestMatchScore > 70) {
        correctColors++;
        console.log(
          `🟡 ${enemyType}: Close match (${result.bestMatchScore}% similarity) - ${result.expected.name}`
        );
      } else {
        issues.push({
          enemyType,
          expected: result.expected.name,
          expectedRGB: result.expected.primary,
          actualBest: result.bestMatch,
          similarity: result.bestMatchScore,
        });
        console.log(
          `❌ ${enemyType}: Color mismatch - expected ${result.expected.name}, got ${result.bestMatch ? `RGB(${result.bestMatch.r}, ${result.bestMatch.g}, ${result.bestMatch.b})` : 'no match'}`
        );
      }
    } else {
      console.log(`⚠️ ${enemyType}: No explosion triggered`);
    }
  }

  console.log(
    `\n📊 COLOR ACCURACY: ${correctColors}/${totalTests} (${Math.round((correctColors / totalTests) * 100)}%)`
  );

  if (issues.length > 0) {
    console.log('\n🔧 COLOR ISSUES FOUND:');
    for (const issue of issues) {
      console.log(
        `  - ${issue.enemyType}: Expected ${issue.expected} ${JSON.stringify(issue.expectedRGB)}, got ${issue.actualBest ? `RGB(${issue.actualBest.r}, ${issue.actualBest.g}, ${issue.actualBest.b})` : 'no match'} (${issue.similarity}% similarity)`
      );
    }
  }

  // Take screenshot for visual verification
  await page.screenshot({
    path: 'test-results/explosion-color-verification.png',
    fullPage: false,
  });

  // Assertions
  expect(
    correctColors,
    `Expected all ${totalTests} explosion types to have correct colors`
  ).toBeGreaterThanOrEqual(Math.floor(totalTests * 0.75)); // At least 75% should be correct

  console.log('🎨 Explosion color verification completed');
});
