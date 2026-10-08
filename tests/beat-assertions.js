import { test, expect } from '@playwright/test';
import { bootGame, jumpToLevel } from './helpers/boot.js';

const NUM_BEATS = parseInt(process.env.BEATS) || 8;

/**
 * Inject beat event recorder that wraps BeatClock gate methods.
 * When a gate method (canGruntShoot, etc.) returns true, we log the event
 * with the current beat position. We record the *gate opening*, not the
 * enemy deciding to fire (which has random skips). This tells us whether
 * the timing system is correct. The tank has no gate: he acts on his first
 * update in each bar (Tank.onKick), so that is what is recorded for him.
 * The rusher is recorded by his blast, at its nearest beat, and the stabber
 * by his lunge, at the beat position of the update that started it.
 */
const injectRecorder = async (page) => {
  await page.evaluate(async () => {
    window.__beatEvents = [];
    const bc = window.beatClock;
    if (!bc) throw new Error('beatClock not found on window');

    const wrap = (methodName, enemyType) => {
      const original = bc[methodName].bind(bc);
      bc[methodName] = (...args) => {
        const result = original(...args);
        if (result) {
          window.__beatEvents.push({
            type: methodName,
            enemyType,
            beat: bc.getCurrentBeat(), // 0-indexed
            totalBeats: bc.getTotalBeats(),
            timestamp: Date.now(),
          });
        }
        return result;
      };
    };

    wrap('canGruntShoot', 'grunt');

    // The same module instance the game loaded, so its tanks use the patch
    const { Tank } = await import('/js/entities/Tank.js');
    const onKick = Tank.prototype.onKick;
    Tank.prototype.onKick = function (...args) {
      window.__beatEvents.push({
        type: 'onKick',
        enemyType: 'tank',
        beat: bc.getCurrentBeat(), // 0-indexed
        totalBeats: bc.getTotalBeats(),
        timestamp: Date.now(),
      });
      return onKick.apply(this, args);
    };

    // The rusher counts beat positions too: record each blast at its
    // nearest beat (0-indexed), which must be 1 or 3
    const { Rusher } = await import('/js/entities/Rusher.js');
    const update = Rusher.prototype.updateSpecificBehavior;
    Rusher.prototype.updateSpecificBehavior = function (...args) {
      const result = update.apply(this, args);
      if (result?.type === 'rusher-explosion') {
        window.__beatEvents.push({
          type: 'blast',
          enemyType: 'rusher',
          beat: Math.round(this.poseBeats) % 4, // the reading he blew on [review-added 2026-10-02]
          totalBeats: bc.getTotalBeats(),
          timestamp: Date.now(),
        });
      }
      return result;
    };

    // The stabber counts beat positions too: record each lunge at the
    // nearest eighth of the update that started it (0-indexed), which must
    // be the "and" of 3
    const { Stabber } = await import('/js/entities/Stabber.js');
    const startLunge = Stabber.prototype.startLunge;
    Stabber.prototype.startLunge = function (...args) {
      window.__beatEvents.push({
        type: 'lunge',
        enemyType: 'stabber',
        beat: (Math.round(this.poseBeats * 2) / 2) % 4,
        totalBeats: bc.getTotalBeats(),
        timestamp: Date.now(),
      });
      return startLunge.apply(this, args);
    };
  });
};

/**
 * Wait for N beats to elapse by polling beatClock.getTotalBeats().
 */
const waitForBeats = async (page, numBeats) => {
  const startBeat = await page.evaluate(() => window.beatClock.getTotalBeats());
  const targetBeat = startBeat + numBeats;

  await page.waitForFunction(
    (target) => window.beatClock.getTotalBeats() >= target,
    targetBeat,
    { timeout: numBeats * 600 + 5000 } // 600ms/beat + buffer
  );
};

test('beat-synced enemy actions fire on correct beats', async ({ page }) => {
  await bootGame(page);

  // Fast-forward to level 5 so all enemy types are present
  await jumpToLevel(page, 5);

  // Wait for enemies to spawn at the new level
  await page.waitForTimeout(2000);

  // Inject recorder after level is set
  await injectRecorder(page);

  // Light one rusher behind the hero: he blows within four beats
  await page.evaluate(() => {
    const hero = window.player;
    const r = window.spawnSystem.createEnemy(
      hero.x - 250,
      hero.y,
      'rusher',
      hero.p
    );
    r.isSpawning = false;
    window.enemies.push(r);
    r.takeDamage(1, null, 'hit');
    if (r.lit?.blastBeat == null)
      throw new Error('lit rusher has no blast beat');
  });

  // A stabber within reach, below and ahead of the hero: he walks right
  // ('d') and fires at the mouse, parked top-left, so his shots never cancel
  // the stabber's wind-up
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    // A phrase every bar: a hitstop that drops one must not fail the test
    const { CONFIG } = await import('/js/config.js');
    CONFIG.STABBER.REST_BARS = 0;
    const hero = window.player;
    const s = window.spawnSystem.createEnemy(
      hero.x + 200,
      hero.y + 250,
      'stabber',
      hero.p
    );
    s.isSpawning = false;
    window.enemies.push(s);
  });

  // Simulate some gameplay so enemies engage
  await page.keyboard.down('d');
  await page.keyboard.down(' ');

  // Wait for beats to elapse
  await waitForBeats(page, NUM_BEATS);

  await page.keyboard.up('d');
  await page.keyboard.up(' ');

  // Pull recorded events
  const events = await page.evaluate(() => window.__beatEvents);

  console.log(
    `\nRecorded ${events.length} beat events over ${NUM_BEATS} beats:`
  );

  // Group by enemy type
  const byType = {};
  for (const e of events) {
    if (!byType[e.enemyType]) byType[e.enemyType] = [];
    byType[e.enemyType].push(e);
  }

  // Expected beats (0-indexed):
  // Grunt: beats 1, 3 (canGruntShoot checks currentBeat === 1 || === 3)
  // Tank: beat 0 (he acts on his first update in each bar)
  // Stabber: his lunge's nearest eighth, the "and" of 3 (2.5)
  // Rusher: his blast's nearest beat, 0 or 2 (beats 1 and 3)

  const expectedBeats = {
    grunt: [1, 3],
    tank: [0],
    stabber: [2.5],
    rusher: [0, 2],
  };

  const results = {};

  for (const [enemyType, expected] of Object.entries(expectedBeats)) {
    const typeEvents = byType[enemyType] || [];
    const wrongBeatEvents = typeEvents.filter(
      (e) => !expected.includes(e.beat)
    );

    results[enemyType] = {
      total: typeEvents.length,
      correctBeats: typeEvents.length - wrongBeatEvents.length,
      wrongBeats: wrongBeatEvents.map((e) => e.beat),
    };

    if (typeEvents.length > 0) {
      const beatList = typeEvents.map((e) => e.beat).join(', ');
      console.log(
        `  ${enemyType}: ${typeEvents.length} events on beats [${beatList}] (expected: [${expected.join(', ')}])`
      );
    } else {
      console.log(
        `  ${enemyType}: no events recorded (enemies may not have been present)`
      );
    }

    if (wrongBeatEvents.length > 0) {
      console.log(
        `  ⚠️ ${enemyType}: ${wrongBeatEvents.length} events on WRONG beats: [${wrongBeatEvents.map((e) => e.beat).join(', ')}]`
      );
    }
  }

  // Assert: any enemy type that fired should have fired on correct beats only
  for (const [enemyType, result] of Object.entries(results)) {
    if (result.total > 0) {
      expect(
        result.wrongBeats,
        `${enemyType} fired on wrong beats: [${result.wrongBeats.join(', ')}]`
      ).toHaveLength(0);
    }
  }

  // The lit rusher must have blown, or the rusher's check proved nothing
  expect(
    byType.rusher?.length ?? 0,
    'no rusher blast was recorded'
  ).toBeGreaterThan(0);

  // The planted stabber must have lunged, or the stabber's check proved nothing
  expect(
    byType.stabber?.length ?? 0,
    'no stabber lunge was recorded'
  ).toBeGreaterThan(0);

  // Assert: we should have recorded at least some events
  expect(events.length, 'No beat events recorded at all').toBeGreaterThan(0);
});
