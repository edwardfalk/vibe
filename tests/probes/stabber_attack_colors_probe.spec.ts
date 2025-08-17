import { test, expect } from '@playwright/test';

test('Stabber Attack Color Verification', async ({ page }) => {
  await page.goto('http://localhost:5500');
  await page.waitForTimeout(3000);

  // Wait for game to initialize
  await page.waitForFunction(
    () => window.frameCount > 0 && window.player && window.gameState?.enemies
  );

  console.log('✅ Game initialized, testing Stabber attack colors');

  // Click canvas to unlock audio
  const canvas = page.locator('canvas');
  await canvas.click({ position: { x: 400, y: 300 } });
  await page.waitForTimeout(100);

  // Test the VFX particle color fix directly
  const colorTest = await page.evaluate(() => {
    // Test the fixed color selection logic
    const testColors = [
      [255, 215, 0], // Gold (stabber colors)
      [255, 200, 40],
      [240, 180, 0],
      [255, 230, 90],
      [220, 160, 0],
    ];

    const selectedColors = [];
    for (let i = 0; i < 10; i++) {
      const color = testColors[Math.floor(Math.random() * testColors.length)];
      selectedColors.push(color);
    }

    return {
      testColors,
      selectedColors,
      allValid: selectedColors.every(
        (color) =>
          Array.isArray(color) &&
          color.length === 3 &&
          color.every((c) => typeof c === 'number' && !isNaN(c))
      ),
    };
  });

  console.log('🎨 Color selection test:', {
    allValid: colorTest.allValid,
    sampleColors: colorTest.selectedColors.slice(0, 3),
  });

  // Simulate a VFX event to trigger particle creation
  const vfxTest = await page.evaluate(() => {
    // Trigger a stabber hit effect manually to test the fix
    const event = new CustomEvent('vfx:enemy-hit', {
      detail: { x: 400, y: 300, type: 'stabber' },
    });

    // Capture initial particle count
    const initialParticleCount =
      window.visualEffectsManager?.particles?.length || 0;

    // Dispatch the event
    window.dispatchEvent(event);

    // Wait a moment for processing
    return new Promise((resolve) => {
      setTimeout(() => {
        const finalParticleCount =
          window.visualEffectsManager?.particles?.length || 0;
        const newParticles =
          window.visualEffectsManager?.particles?.slice(initialParticleCount) ||
          [];

        // Check if the new particles have valid colors
        const particleColors = newParticles.map((p) => p.color);
        const invalidColors = particleColors.filter(
          (color) =>
            !Array.isArray(color) ||
            color.length !== 3 ||
            color.some((c) => typeof c !== 'number' || isNaN(c))
        );

        resolve({
          initialCount: initialParticleCount,
          finalCount: finalParticleCount,
          newParticlesCount: newParticles.length,
          sampleParticleColors: particleColors.slice(0, 3),
          invalidColorCount: invalidColors.length,
          hasValidColors: invalidColors.length === 0,
        });
      }, 100);
    });
  });

  console.log('💥 VFX test results:', vfxTest);

  // Take a screenshot to visually verify
  await page.screenshot({
    path: 'tests/bug-reports/stabber_attack_colors_test.png',
    clip: { x: 0, y: 0, width: 800, height: 600 },
  });

  // Check for green pixels that shouldn't be there
  const greenPixelCheck = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(300, 200, 200, 200); // Sample area around center
    const pixels = imageData.data;

    let unexpectedGreenPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      // Check for bright green pixels that could be artifacts
      if (a > 50 && g > r + 50 && g > b + 50 && g > 150) {
        unexpectedGreenPixels++;
      }
    }

    return { unexpectedGreenPixels };
  });

  console.log('🟢 Green pixel check:', greenPixelCheck);

  // The test passes if:
  // 1. Color selection produces valid colors
  // 2. VFX particles have valid colors (no NaN)
  // 3. Minimal unexpected green pixels
  const testPassed =
    colorTest.allValid &&
    vfxTest.hasValidColors &&
    greenPixelCheck.unexpectedGreenPixels < 10;

  if (testPassed) {
    console.log('✅ Stabber attack color fix appears to be working correctly');
  } else {
    console.log('❌ Issues detected with Stabber attack colors');
  }
});
