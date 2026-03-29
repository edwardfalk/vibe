import { test } from '@playwright/test';
import { writeFileSync } from 'fs';

const DURATION_MS = parseInt(process.env.DURATION) || 30000;
const SAMPLE_INTERVAL = 500;
const OUTPUT_PATH = 'tests/playtest-results.json';

/**
 * Boot the game: navigate, unlock audio, wait for core systems.
 */
const bootGame = async (page) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { state: 'attached' });
  await page.keyboard.press(' ');
  await page.waitForFunction(
    () =>
      window.gameState &&
      window.player &&
      window.collisionSystem &&
      Array.isArray(window.enemies) &&
      window.enemies.filter((e) => !e.markedForRemoval).length > 0 &&
      typeof window.frameCount === 'number' &&
      window.frameCount > 0
  );
};

/**
 * Movement patterns to cycle through for realistic gameplay simulation.
 * Each pattern is [keys[], durationMs].
 */
const MOVEMENT_PATTERNS = [
  [['d', ' '], 800],       // Move right, shoot
  [['w', 'd', ' '], 600],  // Move up-right, shoot
  [['w', ' '], 500],       // Move up, shoot
  [['w', 'a', ' '], 600],  // Move up-left, shoot
  [['a', ' '], 800],       // Move left, shoot
  [['s', 'a', ' '], 600],  // Move down-left, shoot
  [['s', ' '], 500],       // Move down, shoot
  [['s', 'd', ' '], 600],  // Move down-right, shoot
  [[' '], 400],            // Stand and shoot
  [['d'], 300],            // Move without shooting
];

/**
 * Sample game state for metrics.
 */
const sampleGameState = async (page) => {
  return page.evaluate(() => ({
    frameCount: window.frameCount ?? 0,
    enemyCount: Array.isArray(window.enemies)
      ? window.enemies.filter((e) => !e.markedForRemoval).length
      : 0,
    playerHealth: window.player?.health ?? 0,
    playerAlive: !!window.player && !window.player.markedForRemoval,
    score: window.gameState?.score ?? 0,
    level: window.gameState?.level ?? 1,
    gameState: window.gameState?.gameState ?? 'unknown',
    timestamp: Date.now(),
  }));
};

/**
 * Compute FPS from frame count samples.
 */
const computeFpsStats = (samples) => {
  const fpsValues = [];
  for (let i = 1; i < samples.length; i++) {
    const frameDelta = samples[i].frameCount - samples[i - 1].frameCount;
    const timeDelta = (samples[i].timestamp - samples[i - 1].timestamp) / 1000;
    if (timeDelta > 0) {
      fpsValues.push(frameDelta / timeDelta);
    }
  }

  if (fpsValues.length === 0) return { min: 0, avg: 0, p95: 0 };

  fpsValues.sort((a, b) => a - b);
  const sum = fpsValues.reduce((a, b) => a + b, 0);
  const p95Index = Math.floor(fpsValues.length * 0.05); // 5th percentile = worst 5%

  return {
    min: Math.round(fpsValues[0]),
    avg: Math.round(sum / fpsValues.length),
    p95: Math.round(fpsValues[p95Index]),
  };
};

test('playtest session', async ({ page }) => {
  // Collect console errors
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await bootGame(page);

  const samples = [];
  const startTime = Date.now();
  let patternIndex = 0;
  let patternEndTime = 0;
  let activeKeys = [];

  // Main loop: sample state and cycle movement patterns
  while (Date.now() - startTime < DURATION_MS) {
    // Check if game ended
    const currentState = await sampleGameState(page);
    samples.push(currentState);

    if (currentState.gameState === 'gameOver') {
      console.log(
        `\n💀 Player died at ${Math.round((Date.now() - startTime) / 1000)}s`
      );
      break;
    }

    // Cycle movement patterns
    if (Date.now() >= patternEndTime) {
      // Release previous keys
      for (const key of activeKeys) {
        await page.keyboard.up(key);
      }

      const [keys, duration] = MOVEMENT_PATTERNS[patternIndex];
      activeKeys = keys;
      patternEndTime = Date.now() + duration;
      patternIndex = (patternIndex + 1) % MOVEMENT_PATTERNS.length;

      // Press new keys
      for (const key of keys) {
        await page.keyboard.down(key);
      }
    }

    await page.waitForTimeout(SAMPLE_INTERVAL);
  }

  // Release all keys
  for (const key of activeKeys) {
    await page.keyboard.up(key);
  }

  // Compute stats
  const fps = computeFpsStats(samples);
  const peakEnemies = Math.max(...samples.map((s) => s.enemyCount));
  const lastSample = samples[samples.length - 1];
  const survived = lastSample.gameState !== 'gameOver';
  const durationActual = Math.round(
    (lastSample.timestamp - samples[0].timestamp) / 1000
  );

  const summary = {
    duration: `${durationActual}s`,
    fps,
    peakEnemies,
    finalScore: lastSample.score,
    finalLevel: lastSample.level,
    survived,
    finalHealth: lastSample.playerHealth,
    consoleErrors: errors.length,
    sampleCount: samples.length,
  };

  // Print summary
  console.log(`\n🎮 Playtest Results (${durationActual}s):`);
  console.log(`   FPS: min=${fps.min} avg=${fps.avg} p95=${fps.p95}`);
  console.log(`   Peak enemies: ${peakEnemies}`);
  console.log(
    `   Final: Level ${lastSample.level} | Score ${lastSample.score} | Health ${lastSample.playerHealth}`
  );
  console.log(`   Survived: ${survived ? 'yes' : 'no'}`);
  if (errors.length > 0) {
    console.log(`   ⚠️ Console errors: ${errors.length}`);
    errors.slice(0, 5).forEach((e) => console.log(`     - ${e}`));
    if (errors.length > 5) {
      console.log(`     ... and ${errors.length - 5} more`);
    }
  }

  // Save detailed results
  const fullResults = { summary, samples, errors };
  writeFileSync(OUTPUT_PATH, JSON.stringify(fullResults, null, 2));
  console.log(`   📄 Full results: ${OUTPUT_PATH}`);
});
