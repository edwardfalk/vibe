import { test, expect } from '@playwright/test';

/**
 * Explosion Visual Debug Probe
 * Investigates why explosions aren't rendering visible colors
 * Tests the complete explosion lifecycle: creation → rendering → cleanup
 */

test('explosion visual debug - investigate rendering issue', async ({
  page,
}) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 30
  );

  console.log('🔍 Debugging explosion visual rendering...');

  // Step 1: Test explosion creation and immediate state
  const explosionCreationTest = await page.evaluate(() => {
    const playerX = window.player.x;
    const playerY = window.player.y;
    const testX = playerX + 50;
    const testY = playerY;

    console.log('💥 Creating grunt explosion at:', { x: testX, y: testY });

    // Clear first
    if (window.explosionManager) {
      window.explosionManager.explosions = [];
      window.explosionManager.fragmentExplosions = [];
      window.explosionManager.plasmaClouds = [];
    }

    // Create explosion
    window.explosionManager?.addKillEffect?.(testX, testY, 'grunt', 'bullet');

    const state = {
      explosions: window.explosionManager?.explosions?.length || 0,
      fragments: window.explosionManager?.fragmentExplosions?.length || 0,
      plasmaClouds: window.explosionManager?.plasmaClouds?.length || 0,
      explosionManager: !!window.explosionManager,
      addKillEffectExists:
        typeof window.explosionManager?.addKillEffect === 'function',
    };

    // Check explosion details if they exist
    if (window.explosionManager?.explosions?.length > 0) {
      const explosion = window.explosionManager.explosions[0];
      state.explosionDetails = {
        active: explosion.active,
        timer: explosion.timer,
        maxTimer: explosion.maxTimer,
        type: explosion.type || 'unknown',
        hasParticles: explosion.particles?.length || 0,
        hasDraw: typeof explosion.draw === 'function',
      };
    }

    if (window.explosionManager?.fragmentExplosions?.length > 0) {
      const fragment = window.explosionManager.fragmentExplosions[0];
      state.fragmentDetails = {
        active: fragment.active,
        timer: fragment.timer,
        maxTimer: fragment.maxTimer,
        fragmentCount: fragment.fragments?.length || 0,
        centralParticles: fragment.centralExplosion?.particles?.length || 0,
        hasDraw: typeof fragment.draw === 'function',
      };
    }

    return state;
  });

  console.log('💥 Explosion creation result:', explosionCreationTest);

  // Step 2: Let one frame pass and check if explosion is still active
  await page.waitForTimeout(100);

  const explosionLifecycleTest = await page.evaluate(() => {
    return {
      explosions: window.explosionManager?.explosions?.length || 0,
      fragments: window.explosionManager?.fragmentExplosions?.length || 0,
      plasmaClouds: window.explosionManager?.plasmaClouds?.length || 0,
      frameCount: window.frameCount,
      updateMethodExists: typeof window.explosionManager?.update === 'function',
      drawMethodExists: typeof window.explosionManager?.draw === 'function',
    };
  });

  console.log('⏰ After 100ms:', explosionLifecycleTest);

  // Step 3: Force explosion rendering and check draw calls
  const renderingTest = await page.evaluate(() => {
    const results = {
      renderAttempted: false,
      renderError: null,
      canvasExists: !!window.player?.p?.canvas,
      p5InstanceExists: !!window.player?.p,
    };

    try {
      if (
        window.explosionManager &&
        typeof window.explosionManager.draw === 'function'
      ) {
        // Manually call draw to see if it renders
        const p = window.player?.p;
        if (p) {
          console.log('🎨 Manually calling explosion draw...');
          window.explosionManager.draw(p);
          results.renderAttempted = true;
        }
      }
    } catch (e) {
      results.renderError = e.message;
    }

    return results;
  });

  console.log('🎨 Rendering test:', renderingTest);

  // Step 4: Sample canvas for any color changes after forced render
  const canvasSample = await page.evaluate(() => {
    const p = window.player?.p;
    if (!p) return { error: 'No p5 instance' };

    const ctx = p.canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, p.width, p.height);

    let totalPixels = 0;
    let coloredPixels = 0;
    let brightPixels = 0;
    const colors = [];

    // Sample every 10th pixel for performance
    for (let i = 0; i < data.length; i += 10 * 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 50) continue;
      totalPixels++;

      const brightness = (r + g + b) / 3;
      if (brightness > 100) {
        brightPixels++;
        if (brightness > 150) {
          coloredPixels++;
          if (colors.length < 10) {
            colors.push({ r, g, b, a, brightness: Math.round(brightness) });
          }
        }
      }
    }

    return {
      totalPixels,
      coloredPixels,
      brightPixels,
      colors,
      canvasSize: { width: p.width, height: p.height },
    };
  });

  console.log('🖼️ Canvas sample:', canvasSample);

  // Step 5: Check if explosion is being cleaned up too quickly
  const cleanupTest = await page.evaluate(() => {
    // Force another explosion and immediately check its state
    const playerX = window.player.x;
    const playerY = window.player.y;

    window.explosionManager?.addKillEffect?.(
      playerX + 100,
      playerY,
      'rusher',
      'bullet'
    );

    const beforeUpdate = {
      explosions: window.explosionManager?.explosions?.length || 0,
      fragments: window.explosionManager?.fragmentExplosions?.length || 0,
    };

    // Manually call update to see what happens
    if (typeof window.explosionManager?.update === 'function') {
      window.explosionManager.update(16); // Simulate 16ms frame
    }

    const afterUpdate = {
      explosions: window.explosionManager?.explosions?.length || 0,
      fragments: window.explosionManager?.fragmentExplosions?.length || 0,
    };

    return { beforeUpdate, afterUpdate };
  });

  console.log('🧹 Cleanup test:', cleanupTest);

  // Step 6: Check explosion configuration and skip logic
  const configTest = await page.evaluate(() => {
    // Check the grunt skip logic that was mentioned in earlier investigation
    const results = {};

    try {
      if (window.explosionManager?.addKillEffect) {
        // Look at the function source to see skip logic
        const funcString = window.explosionManager.addKillEffect.toString();
        results.hasSkipLogic =
          funcString.includes('grunt') || funcString.includes('skip');
        results.funcLength = funcString.length;
      }

      // Check if there's config affecting explosions
      results.explosionConfig = window.fxConfig || 'not found';
      results.globalConfig = window.CONFIG?.EXPLOSION_SETTINGS || 'not found';
    } catch (e) {
      results.error = e.message;
    }

    return results;
  });

  console.log('⚙️ Config test:', configTest);

  // Take screenshot for visual inspection
  await page.screenshot({
    path: 'test-results/explosion-visual-debug.png',
    fullPage: false,
  });

  // Analysis
  console.log('\n🔍 EXPLOSION VISUAL DEBUG ANALYSIS:');

  if (
    explosionCreationTest.explosions > 0 ||
    explosionCreationTest.fragments > 0
  ) {
    console.log('✅ Explosions are being created');

    if (
      explosionLifecycleTest.explosions === 0 &&
      explosionLifecycleTest.fragments === 0
    ) {
      console.log(
        '⚠️ Explosions are being cleaned up immediately (within 100ms)'
      );
      console.log('   This suggests either:');
      console.log('   1. Update() is being called too frequently');
      console.log('   2. Explosion timers are set too low');
      console.log('   3. Explosions are marked inactive immediately');
    } else {
      console.log('✅ Explosions persist after creation');
    }
  } else {
    console.log('❌ Explosions are not being created at all');
  }

  if (renderingTest.renderAttempted && !renderingTest.renderError) {
    console.log('✅ Explosion rendering method executes without error');
  } else if (renderingTest.renderError) {
    console.log(`❌ Explosion rendering error: ${renderingTest.renderError}`);
  }

  if (canvasSample.coloredPixels === 0) {
    console.log('❌ No colored pixels detected on canvas');
    console.log('   This suggests:');
    console.log('   1. Explosions are not rendering visible content');
    console.log('   2. Colors are too dark/transparent');
    console.log('   3. Blend modes are causing issues');
  } else {
    console.log(`✅ Found ${canvasSample.coloredPixels} colored pixels`);
  }

  // Don't fail test, just document findings
  expect(
    explosionCreationTest.explosions + explosionCreationTest.fragments,
    'Explosions should be created'
  ).toBeGreaterThan(0);

  console.log('🔍 Explosion visual debug completed');
});
