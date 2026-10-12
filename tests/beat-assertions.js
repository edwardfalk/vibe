import { test, expect } from '@playwright/test';
import { bootGame, jumpToLevel } from './helpers/boot.js';

const NUM_BEATS = parseInt(process.env.BEATS) || 8;

/**
 * Inject a recorder of each enemy's beat actions, with the beat position.
 * A grunt is recorded by his shot, at the beat it is fired on (his swarm
 * decides who fires). The tank has no gate: he acts on his first
 * update in each bar (Tank.onKick), so that is what is recorded for him.
 * The rusher is recorded by his blast, at its nearest beat, and the stabber
 * by his lunge, at the beat position of the update that started it.
 */
const injectRecorder = async (page) => {
  await page.evaluate(async () => {
    window.__beatEvents = [];
    const bc = window.beatClock;
    if (!bc) throw new Error('beatClock not found on window');

    // Each grunt shot, at the beat it is fired on, which must be 2 or 4
    const { Grunt } = await import('/js/entities/Grunt.js');
    const createBullet = Grunt.prototype.createBullet;
    Grunt.prototype.createBullet = function (...args) {
      window.__beatEvents.push({
        type: 'shot',
        enemyType: 'grunt',
        beat: bc.getCurrentBeat(), // 0-indexed
        totalBeats: bc.getTotalBeats(),
        timestamp: Date.now(),
      });
      return createBullet.apply(this, args);
    };

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

  // The swarms in range, above and ahead of the hero, settled in and held
  // there: they fire on their next 2 and 4. Its line of fire is kept clear: the
  // planted stabber below the hero is in it once he walks under them, and
  // this check is of the beat a shot lands on, not of the line rule
  // (TelegraphRings.test.js) or the stand-off (a far one backs it out of
  // range: GruntSwarm.test.js)
  await page.evaluate(() => {
    const hero = window.player;
    const grunts = window.enemies.filter((e) => e.type === 'grunt');
    if (grunts.length === 0) throw new Error('no swarm to plant');
    grunts.forEach((g, i) => {
      g.x = hero.x + 120 + (i % 4) * 30;
      g.y = hero.y - 120 - Math.floor(i / 4) * 30;
      g.isSpawning = false;
      g.lineBlocked = () => false;
      g.velocity = { x: 0, y: 0 };
    });
    for (const swarm of window.spawnSystem.swarms) {
      swarm.entering = false;
      swarm.steer = () => {};
    }
  });

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

  // A tank below and behind the hero, out of his line of fire and the lit
  // rusher's blast: he acts on every bar's first update, so he acts within
  // NUM_BEATS whatever the spawn odds left about
  await page.evaluate(() => {
    const hero = window.player;
    const t = window.spawnSystem.createEnemy(
      hero.x - 250,
      hero.y + 250,
      'tank',
      hero.p
    );
    t.isSpawning = false;
    window.enemies.push(t);
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
  // Grunt: his shots, beats 1, 3 (2 and 4)
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

  // The planted swarm must have fired, or the grunts' check proved nothing
  expect(
    byType.grunt?.length ?? 0,
    'no grunt shot was recorded'
  ).toBeGreaterThan(0);

  // The planted tank must have acted, or the tank's check proved nothing
  expect(byType.tank?.length ?? 0, 'no tank kick was recorded').toBeGreaterThan(
    0
  );

  // The planted stabber must have lunged, or the stabber's check proved nothing
  expect(
    byType.stabber?.length ?? 0,
    'no stabber lunge was recorded'
  ).toBeGreaterThan(0);

  // Assert: we should have recorded at least some events
  expect(events.length, 'No beat events recorded at all').toBeGreaterThan(0);
});
