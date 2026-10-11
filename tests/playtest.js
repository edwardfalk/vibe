import { test } from '@playwright/test';
import { writeFileSync } from 'fs';
import { bootGame, jumpToLevel } from './helpers/boot.js';

const DURATION_MS = parseInt(process.env.DURATION) || 30000;
const SAMPLE_INTERVAL = 500;
// The bot re-aims at the nearest enemy this often, holding the mouse to fire
const AIM_INTERVAL = 50;
const OUTPUT_PATH = 'tests/playtest-results.json';

/**
 * Movement patterns to cycle through so the bot isn't a sitting duck.
 * Each pattern is [keys[], durationMs]. Firing is the held mouse button.
 */
const MOVEMENT_PATTERNS = [
  [['d'], 800],
  [['w', 'd'], 600],
  [['w'], 500],
  [['w', 'a'], 600],
  [['a'], 800],
  [['s', 'a'], 600],
  [['s'], 500],
  [['s', 'd'], 600],
  [[], 400], // stand still
];

/**
 * Point the mouse at the nearest live enemy (the canvas is CSS-scaled, so
 * canvas pixels are converted to page pixels).
 */
const aimAtNearestEnemy = async (page, box) => {
  const target = await page.evaluate(() => {
    const p = window.player;
    let best = null;
    let bestDist = Infinity;
    for (const e of window.enemies ?? []) {
      if (e.markedForRemoval) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best ? window.cameraSystem.worldToScreen(best.x, best.y) : null;
  });
  if (!target) return;
  const scale = box.width / 800;
  await page.mouse.move(box.x + target.x * scale, box.y + target.y * scale);
};

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
  // Collect console errors and uncaught page errors
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await bootGame(page);
  // LEVEL=8 pnpm run playtest measures a later level's sky and band
  const startLevel = parseInt(process.env.LEVEL) || 1;
  if (startLevel > 1) await jumpToLevel(page, startLevel);

  // Time each animation frame's work: fps is capped at 60, so it can't show
  // whether a change made frames cheaper. Work between frames (speech is
  // rendered and levelled there) shows in the gaps between frames and as
  // long tasks.
  await page.evaluate(() => {
    window.__frameMs = [];
    window.__frameGapMs = [];
    window.__longTaskMs = [];
    new PerformanceObserver((list) => {
      for (const task of list.getEntries()) {
        window.__longTaskMs.push(task.duration);
      }
    }).observe({ type: 'longtask' });
    let last = null;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      raf((t) => {
        if (last !== null) window.__frameGapMs.push(t - last);
        last = t;
        const start = performance.now();
        cb(t);
        window.__frameMs.push(performance.now() - start);
      });
  });

  // Record when each level arrives and when each enemy type first shows up
  await page.evaluate(() => {
    const t0 = performance.now();
    const secs = () => Math.round((performance.now() - t0) / 1000);
    window.__pacing = { levelUps: [], firstSeen: {} };
    let lastLevel = window.gameState.level;
    setInterval(() => {
      const { level } = window.gameState;
      if (level !== lastLevel) {
        lastLevel = level;
        window.__pacing.levelUps.push([level, secs()]);
      }
      for (const e of window.enemies) {
        if (!(e.type in window.__pacing.firstSeen)) {
          window.__pacing.firstSeen[e.type] = secs();
        }
      }
    }, 100);
  });
  // The grunts' swarms (GruntSwarm.js): which 2s and 4s had a grunt shot
  // while a swarm had a grunt in range, the beats from each clear to the
  // next swarm's first volley, each swarm's size, the others' arrivals by
  // type, and how the grunts died
  await page.evaluate(async () => {
    const { Grunt } = await import('/js/entities/Grunt.js');
    const { CONFIG } = await import('/js/config.js');
    const clock = window.beatClock;
    const s = (window.__swarms = {
      inRange: new Set(),
      shot: new Set(),
      sizes: [],
      gaps: [],
      arrivals: {},
      deaths: {},
    });
    // The beat the snare's silence began: the first clear since a grunt shot
    // (a swarm killed before it fired doesn't restart it)
    let cleared = null;
    let swarm = null;
    const createBullet = Grunt.prototype.createBullet;
    Grunt.prototype.createBullet = function (...args) {
      const beat = clock.getTotalBeats();
      s.shot.add(beat);
      if (cleared !== null) {
        s.gaps.push(beat - cleared);
        cleared = null;
      }
      return createBullet.apply(this, args);
    };
    // Every grunt death, whatever the route (a stab's deferred death and a
    // tank's ball never return through takeDamage's kill), counted once at
    // the death handler, by the last hit's source. A tank's ball kills
    // without takeDamage, so it marks its own
    const takeDamage = Grunt.prototype.takeDamage;
    Grunt.prototype.takeDamage = function (amount, angle, source) {
      this.lastHitBy = source ?? 'shot';
      return takeDamage.call(this, amount, angle, source);
    };
    const collisions = window.collisionSystem;
    const ballHit = collisions.handleTankEnergyBallHit.bind(collisions);
    collisions.handleTankEnergyBallHit = (bullet, enemy) => {
      enemy.lastHitBy = "a tank's ball";
      return ballHit(bullet, enemy);
    };
    const handler = window.enemyDeathHandler;
    const handleEnemyDeath = handler.handleEnemyDeath.bind(handler);
    const dead = new WeakSet();
    handler.handleEnemyDeath = (e, ...rest) => {
      if (e.type === 'grunt' && !dead.has(e)) {
        dead.add(e);
        const cause = e.lastHitBy ?? 'unknown';
        s.deaths[cause] = (s.deaths[cause] ?? 0) + 1;
      }
      return handleEnemyDeath(e, ...rest);
    };
    const seen = new Set();
    setInterval(() => {
      const system = window.spawnSystem;
      if (system.swarm !== swarm) {
        if (swarm && cleared === null) cleared = clock.getTotalBeats();
        swarm = system.swarm;
        if (swarm) s.sizes.push(swarm.size);
      }
      const hero = window.player;
      const beat = clock.getTotalBeats();
      // A 2 or 4 the swarm could fire on: a grunt of it in range and done
      // materialising
      if (swarm && clock.getCurrentBeat() % 2 === 1) {
        const near = window.enemies.some(
          (e) =>
            e.swarm === swarm &&
            !e.markedForRemoval &&
            !e.isSpawning &&
            Math.hypot(e.x - hero.x, e.y - hero.y) < CONFIG.SWARM.FIRE_RANGE_PX
        );
        if (near) s.inRange.add(beat);
      }
      for (const e of window.enemies) {
        if (e.type === 'grunt' || seen.has(e)) continue;
        seen.add(e);
        s.arrivals[e.type] = (s.arrivals[e.type] ?? 0) + 1;
      }
    }, 50);
  });

  const box = await page.locator('canvas').first().boundingBox();
  await page.mouse.down();

  const samples = [];
  const startTime = Date.now();
  let patternIndex = 0;
  let patternEndTime = 0;
  let activeKeys = [];

  let nextSampleTime = 0;

  // Main loop: aim, sample state and cycle movement patterns
  while (Date.now() - startTime < DURATION_MS) {
    await aimAtNearestEnemy(page, box);
    if (Date.now() < nextSampleTime) {
      await page.waitForTimeout(AIM_INTERVAL);
      continue;
    }
    nextSampleTime = Date.now() + SAMPLE_INTERVAL;

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

    await page.waitForTimeout(AIM_INTERVAL);
  }

  await page.mouse.up();
  const sky = await page.evaluate(() => ({
    mode: window.backgroundRenderer?.sky?.mode,
    renderer: window.backgroundRenderer?.sky?.renderer,
  }));
  const pacing = await page.evaluate(() => window.__pacing);
  const swarms = await page.evaluate(() => {
    const s = window.__swarms;
    const covered = [...s.inRange].filter((b) => s.shot.has(b)).length;
    return {
      snareShare: s.inRange.size
        ? +(covered / s.inRange.size).toFixed(2)
        : null,
      beatsInRange: s.inRange.size,
      gapsBeats: s.gaps,
      sizes: s.sizes,
      arrivals: s.arrivals,
      gruntDeaths: s.deaths,
    };
  });
  const { frameMs, frameGapMs, longTasks } = await page.evaluate(() => {
    const stats = (list) => {
      const ms = list.toSorted((a, b) => a - b);
      const at = (q) => +ms[Math.floor(ms.length * q)].toFixed(2);
      const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
      return { avg: +avg.toFixed(2), p50: at(0.5), p95: at(0.95) };
    };
    const tasks = window.__longTaskMs;
    return {
      frameMs: stats(window.__frameMs),
      frameGapMs: stats(window.__frameGapMs),
      longTasks: { count: tasks.length, worstMs: Math.max(0, ...tasks) },
    };
  });

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
    frameMs,
    frameGapMs,
    longTasks,
    sky,
    peakEnemies,
    finalScore: lastSample.score,
    finalLevel: lastSample.level,
    survived,
    finalHealth: lastSample.playerHealth,
    consoleErrors: errors.length,
    sampleCount: samples.length,
    levelUps: pacing.levelUps,
    firstSeen: pacing.firstSeen,
    swarms,
  };

  // Print summary
  console.log(`\n🎮 Playtest Results (${durationActual}s):`);
  console.log(`   FPS: min=${fps.min} avg=${fps.avg} p95=${fps.p95}`);
  console.log(
    `   Frame work (ms): avg=${frameMs.avg} p50=${frameMs.p50} p95=${frameMs.p95}`
  );
  console.log(
    `   Frame gaps (ms): p50=${frameGapMs.p50} p95=${frameGapMs.p95} | long tasks: ${longTasks.count}, worst ${longTasks.worstMs} ms`
  );
  console.log(`   Sky: ${sky.mode} on ${sky.renderer}`);
  if (sky.mode !== 'full') {
    console.log(
      "   ⚠️ The sky isn't drawing its shader: these ms aren't the GPU's."
    );
  }
  console.log(`   Peak enemies: ${peakEnemies}`);
  console.log(
    `   Final: Level ${lastSample.level} | Score ${lastSample.score} | Health ${lastSample.playerHealth}`
  );
  console.log(`   Survived: ${survived ? 'yes' : 'no'}`);
  console.log(
    `   Level-ups [level, s]: ${JSON.stringify(pacing.levelUps)} | first seen (s): ${JSON.stringify(pacing.firstSeen)}`
  );
  console.log(
    `   Swarms: sizes ${JSON.stringify(swarms.sizes)} | snare on ${swarms.snareShare} of ${swarms.beatsInRange} 2s and 4s in range | gaps (beats) ${JSON.stringify(swarms.gapsBeats)}`
  );
  console.log(
    `   Others' arrivals: ${JSON.stringify(swarms.arrivals)} | grunt deaths by cause: ${JSON.stringify(swarms.gruntDeaths)}`
  );
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
