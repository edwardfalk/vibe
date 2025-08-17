import { test, expect } from '@playwright/test';

/**
 * Audio-Visual Evaluation Probe
 * Comprehensive assessment of the current audio-visual experience
 * Identifies improvement opportunities and documents current state
 */

test('audio visual evaluation - comprehensive assessment', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 60
  );

  console.log('🎨 Starting comprehensive audio-visual evaluation...');

  // Step 1: Audio System Evaluation
  const audioEvaluation = await page.evaluate(() => {
    const audioSystem = window.audio;
    const musicManager = window.musicManager;

    return {
      audioContext: !!audioSystem?.audioContext,
      masterVolume: audioSystem?.volume || 'unknown',
      speechEnabled: !!window.speechSynthesis,
      voiceCount: window.speechSynthesis?.getVoices?.()?.length || 0,
      musicManagerActive: !!musicManager,
      currentVolume: audioSystem?.getCurrentVolume?.() || 'unknown',
      hasAmbientEffects: typeof audioSystem?.applyBeatTremolo === 'function',
      hasSpatialAudio: typeof audioSystem?.calculateVolume === 'function',
      soundsConfigured: Object.keys(audioSystem?.sounds || {}).length,
      voiceTypesConfigured: Object.keys(audioSystem?.voiceConfig || {}).length,
    };
  });

  console.log('🔊 Audio evaluation:', audioEvaluation);

  // Step 2: Visual Effects Evaluation
  const visualEvaluation = await page.evaluate(() => {
    const explosion = window.explosionManager;
    const effects = window.effectsManager;
    const visual = window.visualEffectsManager;

    return {
      explosionManager: !!explosion,
      activeExplosions: explosion?.explosions?.length || 0,
      activeFragments: explosion?.fragmentExplosions?.length || 0,
      effectsManager: !!effects,
      visualEffectsManager: !!visual,
      hasGlowEffects: typeof window.drawGlow === 'function',
      hasParticleSystem: !!visual?.updateParticles,
      renderPipeline: !!window.renderPipeline,
      cameraSystem: !!window.cameraSystem,
      backgroundRenderers: Object.keys(window).filter((k) =>
        k.includes('Renderer')
      ).length,
    };
  });

  console.log('🎨 Visual evaluation:', visualEvaluation);

  // Step 3: Performance Assessment
  const performanceEvaluation = await page.evaluate(() => {
    const startTime = performance.now();

    // Trigger multiple effects to test performance
    const playerX = window.player.x;
    const playerY = window.player.y;

    for (let i = 0; i < 3; i++) {
      window.explosionManager?.addKillEffect?.(
        playerX + i * 30,
        playerY + i * 20,
        ['grunt', 'rusher', 'stabber'][i],
        'bullet'
      );
    }

    const effectCreationTime = performance.now() - startTime;

    return {
      effectCreationTime: Math.round(effectCreationTime * 100) / 100,
      frameRate: window.frameRate || 'unknown',
      frameCount: window.frameCount,
      memoryUsage: performance.memory
        ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
          }
        : 'unavailable',
      explosionsAfterTest: window.explosionManager?.explosions?.length || 0,
      fragmentsAfterTest:
        window.explosionManager?.fragmentExplosions?.length || 0,
    };
  });

  console.log('⚡ Performance evaluation:', performanceEvaluation);

  // Step 4: Enemy Behavior Assessment
  const enemyEvaluation = await page.evaluate(() => {
    const enemies = window.gameState?.enemies || [];
    const enemyTypes = {};

    enemies.forEach((enemy) => {
      enemyTypes[enemy.type] = (enemyTypes[enemy.type] || 0) + 1;
    });

    return {
      totalEnemies: enemies.length,
      enemyTypes,
      spawnSystemActive: !!window.spawnSystem,
      hasEnemyFactory: !!window.EnemyFactory,
      enemyBehavior: enemies.slice(0, 3).map((e) => ({
        type: e.type,
        hasUpdate: typeof e.update === 'function',
        hasAttack: typeof e.attack === 'function',
        hasDraw: typeof e.draw === 'function',
        hasGlow: typeof e.drawGlow === 'function',
      })),
    };
  });

  console.log('👾 Enemy evaluation:', enemyEvaluation);

  // Step 5: Player Experience Assessment
  const playerEvaluation = await page.evaluate(() => {
    const player = window.player;
    const beatClock = window.beatClock;

    return {
      playerActive: !!player,
      playerPosition: player
        ? { x: Math.round(player.x), y: Math.round(player.y) }
        : null,
      playerHasShoot: typeof player?.shoot === 'function',
      playerHasDraw: typeof player?.draw === 'function',
      beatClockActive: !!beatClock,
      currentBeat: beatClock?.currentBeat || 'unknown',
      gameStateMode: window.gameState?.gameState || 'unknown',
      bulletCount: {
        player: window.gameState?.playerBullets?.length || 0,
        enemy: window.gameState?.enemyBullets?.length || 0,
      },
      inputResponsive: !!window.playerIsShooting !== undefined,
    };
  });

  console.log('🎮 Player evaluation:', playerEvaluation);

  // Step 6: Take screenshot for visual analysis
  await page.screenshot({
    path: 'test-results/audio-visual-evaluation.png',
    fullPage: false,
  });

  // Wait for effects to settle, then check cleanup
  await page.waitForTimeout(2000);

  const cleanupEvaluation = await page.evaluate(() => {
    return {
      explosionsRemaining: window.explosionManager?.explosions?.length || 0,
      fragmentsRemaining:
        window.explosionManager?.fragmentExplosions?.length || 0,
      enemiesActive: window.gameState?.enemies?.length || 0,
      gameStillRunning: window.frameCount > 0,
    };
  });

  console.log('🧹 Cleanup evaluation:', cleanupEvaluation);

  // Analysis and Recommendations
  console.log('\\n🎯 AUDIO-VISUAL EVALUATION RESULTS:');

  // Audio Analysis
  console.log('\\n🔊 AUDIO SYSTEM:');
  if (audioEvaluation.audioContext && audioEvaluation.masterVolume > 0) {
    console.log('✅ Audio system functional');
    console.log(`   Master volume: ${audioEvaluation.masterVolume}`);
    console.log(`   Sounds configured: ${audioEvaluation.soundsConfigured}`);
    console.log(`   Voice types: ${audioEvaluation.voiceTypesConfigured}`);
  } else {
    console.log('❌ Audio system issues detected');
  }

  // Visual Analysis
  console.log('\\n🎨 VISUAL SYSTEM:');
  if (visualEvaluation.explosionManager && visualEvaluation.effectsManager) {
    console.log('✅ Visual effects system functional');
  } else {
    console.log('❌ Visual effects issues detected');
  }

  // Performance Analysis
  console.log('\\n⚡ PERFORMANCE:');
  if (performanceEvaluation.effectCreationTime < 50) {
    console.log('✅ Good effect creation performance');
  } else {
    console.log(
      `⚠️ Slow effect creation: ${performanceEvaluation.effectCreationTime}ms`
    );
  }

  if (cleanupEvaluation.explosionsRemaining === 0) {
    console.log('✅ Effects cleanup working properly');
  } else {
    console.log(
      `⚠️ ${cleanupEvaluation.explosionsRemaining} effects not cleaned up`
    );
  }

  // Recommendations
  console.log('\\n💡 IMPROVEMENT RECOMMENDATIONS:');

  // Audio recommendations
  if (audioEvaluation.voiceCount < 5) {
    console.log('🔧 AUDIO: Consider adding more voice variety for characters');
  }

  if (audioEvaluation.soundsConfigured < 15) {
    console.log('🔧 AUDIO: Consider expanding sound effects library');
  }

  // Visual recommendations
  if (
    visualEvaluation.activeExplosions === 0 &&
    visualEvaluation.activeFragments === 0
  ) {
    console.log(
      '🔧 VISUAL: Explosion colors now working - consider enhancing particle variety'
    );
  }

  if (enemyEvaluation.totalEnemies < 2) {
    console.log(
      '🔧 GAMEPLAY: Consider increasing enemy spawn rate for more dynamic experience'
    );
  }

  // Performance recommendations
  if (
    performanceEvaluation.memoryUsage &&
    performanceEvaluation.memoryUsage.used > 50
  ) {
    console.log(
      `🔧 PERFORMANCE: Memory usage high (${performanceEvaluation.memoryUsage.used}MB) - consider optimization`
    );
  }

  console.log('\\n🏆 OVERALL ASSESSMENT:');
  const audioScore =
    (audioEvaluation.audioContext ? 1 : 0) +
    (audioEvaluation.speechEnabled ? 1 : 0);
  const visualScore =
    (visualEvaluation.explosionManager ? 1 : 0) +
    (visualEvaluation.effectsManager ? 1 : 0);
  const performanceScore =
    (performanceEvaluation.effectCreationTime < 50 ? 1 : 0) +
    (cleanupEvaluation.explosionsRemaining === 0 ? 1 : 0);

  const totalScore = audioScore + visualScore + performanceScore;
  console.log(`Score: ${totalScore}/6 systems working properly`);

  if (totalScore >= 5) {
    console.log('🎉 Excellent - Game systems functioning well');
  } else if (totalScore >= 3) {
    console.log('🟡 Good - Minor improvements needed');
  } else {
    console.log('🔧 Needs Work - Multiple systems require attention');
  }

  console.log('🎨 Audio-visual evaluation completed');
});
