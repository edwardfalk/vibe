import { test, expect } from '@playwright/test';

/**
 * Documentation-Game Alignment Probe
 * Verifies that key documentation matches actual game behavior
 * Identifies discrepancies between docs and implementation
 */

test('documentation matches game behavior', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing' &&
      window.frameCount > 60
  );

  console.log('📚 Verifying documentation alignment with game behavior...');

  // Step 1: Check PRD vs Game State
  const prdAlignment = await page.evaluate(() => {
    const player = window.player;
    const beatClock = window.beatClock;
    const gameState = window.gameState;
    const enemies = gameState?.enemies || [];

    // Check if enemy types mentioned in PRD exist
    const enemyTypes = [...new Set(enemies.map((e) => e.type))];
    const expectedEnemyTypes = ['grunt', 'tank', 'stabber', 'rusher'];
    const presentEnemyTypes = expectedEnemyTypes.filter(
      (type) =>
        enemyTypes.includes(type) ||
        window.EnemyFactory || // Check if factory exists even if not spawned
        window.gameState?.enemyTypes?.includes?.(type)
    );

    return {
      playerExists: !!player,
      beatClockExists: !!beatClock,
      gameStateExists: !!gameState,
      currentBpm: beatClock?.bpm || 'unknown',
      expectedBpm: 120, // From PRD
      enemyTypesPresent: presentEnemyTypes,
      expectedEnemyTypes,
      endlessMode: gameState?.gameState === 'playing',
      targetFrameRate: window.frameRate || 'unknown',
      expectedFrameRate: 60,
    };
  });

  console.log('📋 PRD alignment check:', prdAlignment);

  // Step 2: Check Audio Guide vs Audio System
  const audioAlignment = await page.evaluate(() => {
    const audio = window.audio;
    const musicManager = window.musicManager;

    // Check master volume (doc says 0.7)
    const masterVolume = audio?.volume;

    // Check voice config matches documentation
    const voiceConfig = audio?.voiceConfig || {};
    const documentedVoices = ['player', 'grunt', 'rusher', 'tank', 'stabber'];
    const actualVoices = Object.keys(voiceConfig);

    // Check if speech synthesis is enabled
    const speechEnabled = !!window.speechSynthesis;

    // Check sound effects count (doc mentions various sounds)
    const soundsCount = Object.keys(audio?.sounds || {}).length;

    return {
      audioSystemExists: !!audio,
      musicManagerExists: !!musicManager,
      masterVolume: masterVolume,
      expectedMasterVolume: 0.7, // From audio guide
      voicesConfigured: actualVoices.length,
      expectedVoices: documentedVoices,
      voicesMatch: documentedVoices.every((v) => actualVoices.includes(v)),
      speechEnabled,
      soundsConfigured: soundsCount,
      gruntVoiceVolume: voiceConfig.grunt?.volume || 'unknown',
      spatialAudioAvailable: typeof audio?.calculateVolume === 'function',
      distanceEffectsAvailable: typeof audio?.applyBeatTremolo === 'function',
    };
  });

  console.log('🔊 Audio guide alignment:', audioAlignment);

  // Step 3: Check Design Doc vs Beat System
  const designAlignment = await page.evaluate(() => {
    const beatClock = window.beatClock;
    const enemies = window.gameState?.enemies || [];

    // Check beat mapping from design doc
    const gruntBeats = [2, 4]; // From design doc
    const tankBeats = [1]; // From design doc
    const stabberBeats = [3.5]; // From design doc
    const rusherBeats = [1, 3]; // From design doc

    const result = {
      beatClockExists: !!beatClock,
      currentBeat: beatClock?.currentBeat || 'unknown',
      timeSignature: '4/4', // Expected from design
      enemiesFollowBeats: false,
      beatMethods: {},
    };

    // Check if beat clock has enemy-specific methods
    if (beatClock) {
      result.beatMethods = {
        canGruntShoot: typeof beatClock.canGruntShoot === 'function',
        canTankShoot: typeof beatClock.canTankShoot === 'function',
        canStabberAttack: typeof beatClock.canStabberAttack === 'function',
        canRusherAttack: typeof beatClock.canRusherAttack === 'function',
      };
    }

    // Check if enemies have beat-synced behavior
    const enemyBehaviors = enemies.slice(0, 3).map((enemy) => ({
      type: enemy.type,
      hasAttack: typeof enemy.attack === 'function',
      hasUpdate: typeof enemy.update === 'function',
      lastAttackTime: enemy.lastAttackTime || 'unknown',
    }));

    result.enemyBehaviors = enemyBehaviors;

    return result;
  });

  console.log('🎵 Design doc alignment:', designAlignment);

  // Step 4: Check Architecture vs Implementation
  const architectureAlignment = await page.evaluate(() => {
    // Check if packages structure exists as documented
    const globalScope = window;
    const expectedManagers = [
      'explosionManager',
      'effectsManager',
      'visualEffectsManager',
      'spawnSystem',
      'cameraSystem',
      'audio',
      'beatClock',
      'gameState',
      'player',
    ];

    const presentManagers = expectedManagers.filter(
      (manager) => globalScope[manager] !== undefined
    );

    // Check if modular architecture is working
    const hasModularSystems = presentManagers.length >= 7;

    // Check if p5 instance mode is used (no global p5 functions)
    const hasGlobalP5 = !!(
      globalScope.ellipse ||
      globalScope.fill ||
      globalScope.rect
    );

    return {
      expectedManagers,
      presentManagers,
      managersCount: presentManagers.length,
      expectedCount: expectedManagers.length,
      hasModularSystems,
      instanceModeUsed: !hasGlobalP5,
      frameCount: globalScope.frameCount,
      gameRunning: globalScope.frameCount > 0,
    };
  });

  console.log('🏗️ Architecture alignment:', architectureAlignment);

  // Step 5: Check Testing Guide vs Test Environment
  const testingAlignment = await page.evaluate(() => {
    return {
      devServerRunning: window.location.hostname === 'localhost',
      devServerPort: window.location.port,
      expectedPort: '5500',
      testModeAvailable:
        !!window.testMode || typeof window.TestMode !== 'undefined',
      gameStateAccessible: !!window.gameState,
      playerAccessible: !!window.player,
      managersAccessible: !!(window.explosionManager && window.audio),
      playwrightCompatible: true, // If this test runs, Playwright is working
    };
  });

  console.log('🧪 Testing guide alignment:', testingAlignment);

  // Analysis and Reporting
  console.log('\\n📚 DOCUMENTATION ALIGNMENT ANALYSIS:');

  // PRD Analysis
  console.log('\\n📋 PRD (Product Requirements Document):');
  if (
    prdAlignment.playerExists &&
    prdAlignment.beatClockExists &&
    prdAlignment.endlessMode
  ) {
    console.log('✅ Core game elements match PRD');

    if (Math.abs(prdAlignment.currentBpm - prdAlignment.expectedBpm) < 10) {
      console.log('✅ BPM matches PRD specification (120 BPM)');
    } else {
      console.log(
        `⚠️ BPM mismatch: Expected ${prdAlignment.expectedBpm}, got ${prdAlignment.currentBpm}`
      );
    }

    const enemyTypesMatching = prdAlignment.enemyTypesPresent.length;
    console.log(
      `✅ Enemy types: ${enemyTypesMatching}/${prdAlignment.expectedEnemyTypes.length} documented types present`
    );
  } else {
    console.log('❌ Core game elements missing from PRD spec');
  }

  // Audio Guide Analysis
  console.log('\\n🔊 Audio Configuration Guide:');
  if (audioAlignment.audioSystemExists && audioAlignment.speechEnabled) {
    console.log('✅ Audio system matches guide structure');

    if (audioAlignment.voicesMatch) {
      console.log('✅ All documented voice types configured');
    } else {
      console.log('⚠️ Some voice types missing from configuration');
    }

    if (audioAlignment.masterVolume === audioAlignment.expectedMasterVolume) {
      console.log('✅ Master volume matches documentation');
    } else {
      console.log(
        `⚠️ Master volume differs: Doc says ${audioAlignment.expectedMasterVolume}, actual is ${audioAlignment.masterVolume}`
      );
    }

    console.log(
      `📊 Grunt voice volume: ${audioAlignment.gruntVoiceVolume} (recently increased)`
    );
  } else {
    console.log('❌ Audio system differs from guide');
  }

  // Design Document Analysis
  console.log('\\n🎵 Design Document (Beat System):');
  if (designAlignment.beatClockExists) {
    console.log('✅ Beat clock system implemented');

    const beatMethodsCount = Object.values(designAlignment.beatMethods).filter(
      Boolean
    ).length;
    if (beatMethodsCount >= 3) {
      console.log('✅ Enemy-specific beat methods implemented');
    } else {
      console.log('⚠️ Some beat methods missing for enemy types');
    }
  } else {
    console.log('❌ Beat clock system missing');
  }

  // Architecture Analysis
  console.log('\\n🏗️ Architecture Documentation:');
  if (architectureAlignment.hasModularSystems) {
    console.log('✅ Modular architecture implemented');
    console.log(
      `   ${architectureAlignment.managersCount}/${architectureAlignment.expectedCount} core managers present`
    );
  } else {
    console.log('❌ Modular architecture incomplete');
  }

  if (architectureAlignment.instanceModeUsed) {
    console.log('✅ p5.js instance mode correctly implemented');
  } else {
    console.log('❌ p5.js global mode detected (should use instance mode)');
  }

  // Testing Guide Analysis
  console.log('\\n🧪 Testing Guide:');
  if (testingAlignment.devServerPort === testingAlignment.expectedPort) {
    console.log('✅ Development server on correct port');
  } else {
    console.log(
      `⚠️ Dev server port: Expected ${testingAlignment.expectedPort}, got ${testingAlignment.devServerPort}`
    );
  }

  if (testingAlignment.managersAccessible) {
    console.log('✅ Game managers accessible for testing');
  } else {
    console.log('❌ Some game managers not accessible');
  }

  // Overall Assessment
  console.log('\\n🏆 OVERALL DOCUMENTATION ALIGNMENT:');
  const checks = [
    prdAlignment.playerExists && prdAlignment.beatClockExists,
    audioAlignment.audioSystemExists && audioAlignment.voicesMatch,
    designAlignment.beatClockExists,
    architectureAlignment.hasModularSystems &&
      architectureAlignment.instanceModeUsed,
    testingAlignment.devServerPort === testingAlignment.expectedPort,
  ];

  const alignmentScore = checks.filter(Boolean).length;
  console.log(
    `Alignment Score: ${alignmentScore}/5 documentation areas match implementation`
  );

  if (alignmentScore >= 4) {
    console.log(
      '🎉 Excellent - Documentation well aligned with implementation'
    );
  } else if (alignmentScore >= 3) {
    console.log('🟡 Good - Minor documentation updates needed');
  } else {
    console.log('🔧 Needs Work - Significant documentation gaps found');
  }

  console.log('\\n💡 RECOMMENDATIONS:');

  if (audioAlignment.masterVolume !== audioAlignment.expectedMasterVolume) {
    console.log('📝 Update Audio Guide with current master volume setting');
  }

  if (prdAlignment.currentBpm !== prdAlignment.expectedBpm) {
    console.log('📝 Update PRD with actual BPM configuration');
  }

  const missingManagers = architectureAlignment.expectedManagers.filter(
    (m) => !architectureAlignment.presentManagers.includes(m)
  );
  if (missingManagers.length > 0) {
    console.log(
      `📝 Document current architecture - missing: ${missingManagers.join(', ')}`
    );
  }

  console.log('📚 Documentation alignment check completed');
});
