import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  Stabber,
  sweepEntry,
  LATE_BEATS,
  WINDUP_AT,
  LOCK_AT,
  LUNGE_AT,
} from '../../js/entities/Stabber.js';
import { RING_GOLD, RING_R_PX } from '../../js/entities/StabberRenderer.js';
import { HEALTH_BAR_HEIGHT_PX } from '../../js/entities/BaseEnemyHelpers.js';
import { CONFIG } from '../../js/config.js';
import { DAMAGE_RESULT } from '../../js/shared/DamageResult.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { beatWorld } from './helpers/beatWorld.js';
import { strokeLog } from './helpers/strokeLog.js';
import { transformP5 } from './helpers/transformP5.js';
import { EnemyDeathHandler } from '../../js/systems/combat/EnemyDeathHandler.js';

const S = CONFIG.STABBER;
const DEFAULTS = { ...CONFIG.STABBER };
const LOOK_DEFAULTS = { ...CONFIG.STABBER_LOOK };
const FRAME_MS = 16;
const MS_PER_BEAT = 500;
// Bar 0's steps, ms: the wind-up on beat 2, the lock on 3, the lunge on the
// "and" of 3, the next bar's beat 1. Bar n's are BAR_MS·n later
const WINDUP_MS = WINDUP_AT * MS_PER_BEAT;
const LOCK_MS = LOCK_AT * MS_PER_BEAT;
const LUNGE_MS = LUNGE_AT * MS_PER_BEAT;
const BAR_MS = 4 * MS_PER_BEAT;
const LATE_MS = LATE_BEATS * MS_PER_BEAT;

afterEach(() => {
  Object.assign(CONFIG.STABBER, DEFAULTS);
  Object.assign(CONFIG.STABBER_LOOK, LOOK_DEFAULTS);
  vi.restoreAllMocks();
});

// A spawned stabber at (x, y), made at ms0 in a world whose clock at(ms)
// sets. step(ms) is one update at ms with the hero at `hero` (the hero
// stays put unless a test moves him); run(from, to) steps a frame at a time
// and lists each update's state and result
function shiv({ x = 0, y = 0, ms0 = 0, hero = { x: 300, y: 0 }, values } = {}) {
  const w = beatWorld(values);
  w.at(ms0);
  const s = new Stabber(
    x,
    y,
    'stabber',
    { context: w.context },
    createMockP5(),
    w.audio
  );
  s.isSpawning = false;
  s.spawnTimer = s.spawnDuration;
  const step = (ms) => {
    w.at(ms);
    return s.update(hero.x, hero.y, FRAME_MS);
  };
  const run = (from, to, every = FRAME_MS) => {
    const log = [];
    for (let ms = from; ms <= to; ms += every) {
      log.push({ ms, result: step(ms), state: s.state });
    }
    return log;
  };
  const strings = (part) =>
    w.audio.playStabberStrings.mock.calls.filter(([p]) => p === part);
  return { ...w, s, hero, step, run, strings };
}
// When each state began, from a run's log
const starts = (log, state) =>
  log
    .filter((e, i) => e.state === state && log[i - 1]?.state !== state)
    .map((e) => e.ms);

describe('sweepEntry', () => {
  it('finds where a sweep first enters a circle, or none', () => {
    expect(sweepEntry(0, 0, 100, 0, 50, 0, 18)).toBeCloseTo(0.32, 9);
    expect(sweepEntry(0, 0, 100, 0, 50, 20, 18)).toBeNull(); // passes beside
    expect(sweepEntry(0, 0, 100, 0, -50, 0, 18)).toBeNull(); // behind it
    expect(sweepEntry(0, 0, 100, 0, 150, 0, 18)).toBeNull(); // beyond its end
    expect(sweepEntry(0, 0, 100, 0, 10, 0, 18)).toBe(0); // starts inside
  });

  it('a sweep of zero length checks its point', () => {
    expect(sweepEntry(5, 0, 5, 0, 10, 0, 18)).toBe(0);
    expect(sweepEntry(5, 0, 5, 0, 50, 0, 18)).toBeNull();
  });
});

describe("the stabber's phrase", () => {
  it('winds up on beat 2 when in range and rested: one stab every REST_BARS + 1 bars', () => {
    const { run } = shiv();
    const log = run(0, 4 * BAR_MS);
    const windups = starts(log, 'windup');
    expect(windups).toHaveLength(2);
    expect(windups[0] - WINDUP_MS).toBeLessThan(FRAME_MS);
    expect(windups[1] - (2 * BAR_MS + WINDUP_MS)).toBeLessThan(FRAME_MS);
    CONFIG.STABBER.REST_BARS = 0;
    const every = shiv();
    expect(starts(every.run(0, 4 * BAR_MS), 'windup')).toHaveLength(4);
  });

  it('does not wind up out of range', () => {
    const { run } = shiv({ hero: { x: 1000, y: 0 } });
    expect(starts(run(0, BAR_MS - FRAME_MS), 'windup')).toHaveLength(0);
  });

  it('winds up if he finishes spawning inside the beat-2 window, never while spawning or after it', () => {
    const spawned = (ms0) => {
      const w = shiv({ ms0 });
      Object.assign(w.s, { isSpawning: true, spawnTimer: 0 }); // 25 frames, about 417 ms
      return starts(w.run(ms0, WINDUP_MS + LATE_MS + 100), 'windup');
    };
    expect(spawned(150)).toHaveLength(1); // spawned about 566 ms: inside the window
    expect(spawned(300)).toHaveLength(0); // spawning through the window
  });

  it('locks on beat 3: his lunge is the distance to the hero plus OVERSHOOT_PX, within its limits', () => {
    const { s, run } = shiv();
    run(0, LOCK_MS + 20);
    expect(s.locked).toBe(true);
    expect(s.lockLen).toBeCloseTo(s.distance + S.OVERSHOOT_PX, 6);
    CONFIG.STABBER.LUNGE_MAX_PX = 200;
    const short = shiv();
    short.run(0, LOCK_MS + 20);
    expect(short.s.lockLen).toBe(200);
    // Crossed sliders: read as min and max of the pair
    Object.assign(CONFIG.STABBER, { LUNGE_MIN_PX: 600, LUNGE_MAX_PX: 500 });
    const crossed = shiv();
    crossed.run(0, LOCK_MS + 20);
    expect(crossed.s.lockLen).toBe(500);
  });

  it('lunges on the "and" of 3, timed from the grid: a late frame catches up', () => {
    const { s, hero, run, step } = shiv();
    run(0, LOCK_MS + 20);
    Object.assign(hero, { x: 0, y: 300 }); // out of the lane: no hit to end it
    step(LUNGE_MS + 100); // the lunge's first update, 100 ms late
    expect(s.state).toBe('lunge');
    const L = s.lunge;
    const k = 100 / 1000 / S.LUNGE_SEC;
    expect(Math.hypot(s.x - L.x, s.y - L.y)).toBeCloseTo(
      L.len * (1 - (1 - k) ** 3),
      6
    );
  });

  it('on an unobstructed miss his centre ends the lunge length along the locked aim', () => {
    const { s, hero, run, step } = shiv();
    run(0, LOCK_MS + 20);
    hero.y = 300; // the hero steps out of the lane after the lock
    hero.x = 0;
    // Bounded, so a broken phrase fails here instead of hanging
    const until = (ms, end, done) => {
      for (; ms <= end && !done(); ms += FRAME_MS) step(ms);
      return ms;
    };
    const ms = until(LOCK_MS + 36, BAR_MS, () => s.state === 'lunge');
    expect(s.state).toBe('lunge');
    const L = { ...s.lunge };
    until(ms, BAR_MS, () => s.state !== 'lunge');
    expect(s.state).toBe('recover');
    expect(s.struck).toBeNull();
    expect(s.x - L.x).toBeCloseTo(Math.cos(L.dir) * L.len, 6);
    expect(s.y - L.y).toBeCloseTo(Math.sin(L.dir) * L.len, 6);
  });

  it("his tip's sweep hits the hero even when one frame carries it past him", () => {
    const { s, hero, run, step } = shiv();
    run(0, LUNGE_MS - 10);
    let hit = null;
    let tipBefore = null;
    for (let ms = LUNGE_MS; ms < LUNGE_MS + 400 && !hit; ms += 40) {
      const was = s.state === 'lunge' ? { ...s.lastTip } : null;
      hit = step(ms);
      tipBefore = was;
    }
    expect(hit?.playerHit).toBe(true);
    expect(hit.damage).toBe(CONFIG.PLAYER.DAMAGE_STAB);
    // The frame started with his tip short of the hero's reach: the sweep,
    // not a check at the frame's end, found him
    expect(tipBefore.x).toBeLessThan(hero.x - S.TIP_HIT_PX);
    // On the hit his tip sits where it met him, and he is behind it
    expect(Math.hypot(s.lastTip.x - hero.x, s.lastTip.y - hero.y)).toBeCloseTo(
      S.TIP_HIT_PX,
      6
    );
    const L = s.lunge;
    expect(s.x + Math.cos(L.dir) * L.reach).toBeCloseTo(s.lastTip.x, 6);
    expect(s.y + Math.sin(L.dir) * L.reach).toBeCloseTo(s.lastTip.y, 6);
    // The hero is knocked away from his centre, along the lane
    expect(hit.x).toBe(s.x);
    expect(hit.x).toBeLessThan(hero.x);
  });

  it('a grunt in the lane in front of the hero takes the stab, even when one sweep reaches both', () => {
    const grunt = {
      type: 'grunt',
      x: 200,
      y: 0,
      hitRadius: 22,
      markedForRemoval: false,
    };
    const { s, run, step } = shiv({ values: { enemies: [grunt] } });
    run(0, LUNGE_MS - 10);
    step(LUNGE_MS);
    expect(s.state).toBe('lunge');
    const result = step(LUNGE_MS + 120); // one update sweeps past both
    expect(result.playerHit).toBe(false);
    expect(result.enemiesHit).toEqual([
      { enemy: grunt, damage: S.ALIEN_STAB_DAMAGE, angle: s.lockAim },
    ]);
    expect(s.struck).toBe('alien');
  });

  it("a grunt waiting out its stab death doesn't stop him, and a tie goes to the hero", () => {
    const dying = {
      x: 200,
      y: 0,
      hitRadius: 22,
      markedForRemoval: false,
      pendingStabDeath: true,
    };
    const one = shiv({ values: { enemies: [dying] } });
    one.run(0, LUNGE_MS - 10);
    one.step(LUNGE_MS);
    expect(one.step(LUNGE_MS + 120)?.playerHit).toBe(true);
    // An alien exactly where the hero is, as big as his target
    const twin = {
      x: 300,
      y: 0,
      hitRadius: S.TIP_HIT_PX,
      markedForRemoval: false,
    };
    const two = shiv({ values: { enemies: [twin] } });
    two.run(0, LUNGE_MS - 10);
    two.step(LUNGE_MS);
    two.s.x = 0; // where a stalk would leave him doesn't matter: the tie does
    expect(two.step(LUNGE_MS + 120)?.playerHit).toBe(true);
  });

  it('after a hit he recoils, after a miss he coasts, and he stalks from the next beat 1', () => {
    const hit = shiv();
    hit.run(0, LUNGE_MS + 200);
    expect(hit.s.struck).toBe('hero');
    const dir = { x: Math.cos(hit.s.lockAim), y: Math.sin(hit.s.lockAim) };
    expect(hit.s.push.x * dir.x + hit.s.push.y * dir.y).toBeLessThan(0);
    const miss = shiv();
    miss.run(0, LOCK_MS + 20);
    miss.hero.y = 300;
    miss.hero.x = 0;
    miss.run(LOCK_MS + 36, LUNGE_MS + 400);
    const mdir = { x: Math.cos(miss.s.lockAim), y: Math.sin(miss.s.lockAim) };
    expect(miss.s.push.x * mdir.x + miss.s.push.y * mdir.y).toBeGreaterThan(0);
    hit.run(LUNGE_MS + 216, BAR_MS + 10);
    expect(hit.s.state).toBe('stalk');
  });

  it('a lunge that ends at or after the next beat 1 skips the recovery: no push, he stalks; a hit still counts', () => {
    const miss = shiv();
    miss.run(0, LOCK_MS + 20);
    Object.assign(miss.hero, { x: 0, y: 300 }); // out of the lane
    miss.step(LUNGE_MS + 10);
    expect(miss.s.state).toBe('lunge');
    miss.step(BAR_MS + 50); // a stall past the next beat 1
    expect(miss.s.state).toBe('stalk');
    expect(miss.s.push).toEqual({ x: 0, y: 0 });
    const hit = shiv(); // the hero in the lane
    hit.run(0, LOCK_MS + 20);
    hit.step(LUNGE_MS + 10);
    expect(hit.step(BAR_MS + 50)?.playerHit).toBe(true);
    expect(hit.s.state).toBe('stalk');
    expect(hit.s.push).toEqual({ x: 0, y: 0 });
    expect(hit.strings('pluck')).toHaveLength(1);
  });

  it('a lunge keeps the size it started at: his drawn tip stays where it hits', () => {
    const { s, hero, run, step } = shiv();
    const { p, graphics } = transformP5();
    run(0, LOCK_MS + 20);
    Object.assign(hero, { x: 0, y: 300 });
    step(LUNGE_MS + 10);
    s.draw(p); // his sprites at ART_SCALE 1
    CONFIG.STABBER_LOOK.ART_SCALE = 1.6; // turned mid-lunge
    s.draw(p);
    expect(graphics).toHaveLength(6); // still drawn at the lunge's size
    expect(s.pose().reach).toBe(s.lunge.reach);
    run(LUNGE_MS + 26, LUNGE_MS + 400);
    expect(s.state).toBe('recover');
    s.draw(p);
    expect(graphics).toHaveLength(12); // the new size, once the lunge is over
  });

  it.each([0.85, 0.9, 1.55])(
    'at ART_SCALE %s, a lunging stabber and a stalking one build their sprites once',
    (scale) => {
      CONFIG.STABBER_LOOK.ART_SCALE = scale;
      const { p, graphics } = transformP5();
      const lunging = shiv();
      lunging.run(0, LOCK_MS + 20);
      Object.assign(lunging.hero, { x: 0, y: 300 });
      lunging.step(LUNGE_MS + 10);
      expect(lunging.s.state).toBe('lunge');
      const stalking = shiv({ hero: { x: 1000, y: 0 } }).s;
      for (let i = 0; i < 3; i++) {
        lunging.s.draw(p);
        stalking.draw(p);
      }
      expect(graphics).toHaveLength(6);
    }
  );

  it('a lunge into a wall: his tip is tested from where the wall stops him', () => {
    // The hero beyond the wall, where only an unstopped lunge would reach
    const { s, run } = shiv({ x: 450, hero: { x: 700, y: 0 } });
    run(0, LUNGE_MS + 400);
    expect(s.lunge).not.toBeNull();
    expect(s.struck).toBeNull();
  });

  it('reads crossed stalk sliders as min and max, and an empty band without dividing by zero', () => {
    // 250 px off is inside the 200-350 band: he circles, he doesn't close in
    Object.assign(CONFIG.STABBER, { STALK_MIN_PX: 350, STALK_MAX_PX: 200 });
    const crossed = shiv({ hero: { x: 250, y: 0 } });
    crossed.run(0, 300);
    expect(Math.abs(crossed.s.walk.y)).toBeGreaterThan(
      Math.abs(crossed.s.walk.x)
    );
    Object.assign(CONFIG.STABBER, { STALK_MIN_PX: 300, STALK_MAX_PX: 300 });
    const empty = shiv();
    empty.run(0, 300);
    expect(Number.isFinite(empty.s.x)).toBe(true);
    expect(Number.isFinite(empty.s.walk.x)).toBe(true);
  });

  it('stays inside the world, mid-lunge too', () => {
    const halfW = CONFIG.GAME_SETTINGS.WORLD_WIDTH / 2 - 14;
    const { s, step } = shiv({ x: 450, hero: { x: 700, y: 0 } });
    for (let ms = 0; ms <= LUNGE_MS + 500; ms += FRAME_MS) {
      step(ms);
      expect(s.x).toBeLessThanOrEqual(halfW + 1e-9);
    }
  });
});

describe('the stabber hit', () => {
  it('before his lock step, any damage cancels the stab and dazes him to the next beat 1, cutting the tremolo', () => {
    const { s, run, strings } = shiv();
    run(0, 700);
    expect(s.state).toBe('windup');
    const handle = s.tremolo;
    s.takeDamage(1, null, 'rusher-blast'); // a hit with no direction cancels too
    expect(s.state).toBe('stunned');
    expect(handle.stop).toHaveBeenCalledTimes(1);
    const log = run(716, BAR_MS + 20);
    expect(starts(log, 'lunge')).toHaveLength(0);
    expect(strings('stab')).toHaveLength(0);
    expect(s.state).toBe('stalk');
    // He rests: no wind-up in the next bar
    expect(starts(run(BAR_MS + 36, 2 * BAR_MS - 10), 'windup')).toHaveLength(0);
  });

  it('muted, his wind-up has no tremolo, and a cancel is still safe', () => {
    const { s, run, audio } = shiv();
    audio.playStabberStrings.mockReturnValue(null);
    run(0, 700);
    expect(s.state).toBe('windup');
    expect(s.tremolo).toBeNull();
    expect(() => s.takeDamage(1, 0, 'player_bullet')).not.toThrow();
    expect(s.state).toBe('stunned');
  });

  it('a hit in the frame of beat 3 but before his update still cancels; from his lock step he is committed', () => {
    const early = shiv();
    early.run(0, LOCK_MS - 10);
    early.at(LOCK_MS + 5); // beat 3 has come, but his update hasn't
    early.s.takeDamage(1, 0, 'player_bullet');
    expect(early.s.state).toBe('stunned');
    const late = shiv();
    late.run(0, LOCK_MS + 20);
    const aim = late.s.lockAim;
    late.s.takeDamage(1, Math.PI / 2, 'player_bullet');
    expect(late.s.state).toBe('windup');
    expect(late.s.push.y).toBeGreaterThan(0); // he flinches
    late.run(LOCK_MS + 36, LUNGE_MS + 20);
    expect(late.s.state).toBe('lunge');
    expect(late.s.lunge.dir).toBe(aim);
  });

  it("mid-lunge a hit doesn't push him; a hit with no direction never does", () => {
    const { s, run } = shiv();
    run(0, LUNGE_MS + 20);
    expect(s.state).toBe('lunge');
    s.takeDamage(1, Math.PI / 2, 'player_bullet');
    expect(s.push).toEqual({ x: 0, y: 0 });
    const calm = shiv();
    calm.s.takeDamage(1, null, 'rusher-blast');
    expect(calm.s.push).toEqual({ x: 0, y: 0 });
  });

  it.each([
    ['stalking', 300],
    ['winding up', 700],
    ['locked', LOCK_MS + 20],
    ['lunging', LUNGE_MS + 20],
    ['recovering', LUNGE_MS + 300],
  ])('lethal damage kills him while %s', (_, ms) => {
    const { s, run } = shiv();
    run(0, ms);
    s.health = 1;
    expect(s.takeDamage(5, 0, 'player_bullet')).toBe(DAMAGE_RESULT.DIED);
  });

  it('lethal damage kills him while dazed', () => {
    const { s, run } = shiv();
    run(0, 700);
    s.takeDamage(1, 0, 'player_bullet');
    expect(s.state).toBe('stunned');
    s.health = 1;
    expect(s.takeDamage(5, 0, 'player_bullet')).toBe(DAMAGE_RESULT.DIED);
  });

  it('armour takes ARMOR off each hit, at least 1 gets through: ten shots kill him', () => {
    const { s } = shiv();
    for (let i = 1; i < 10; i++) {
      expect(s.takeDamage(1, 0, 'player_bullet')).toBe(DAMAGE_RESULT.DAMAGED);
    }
    expect(s.takeDamage(1, 0, 'player_bullet')).toBe(DAMAGE_RESULT.DIED);
    // A hit stronger than his armour loses ARMOR of it
    const tough = shiv().s;
    tough.takeDamage(5, null, 'rusher-blast');
    expect(tough.health).toBe(S.HEALTH - (5 - S.ARMOR));
  });

  it('shot while spawning, he slides about as far as a spawned stabber', () => {
    const slide = (spawning) => {
      const { s, step } = shiv({ hero: { x: 0, y: 1000 } }); // far: no wind-up
      if (spawning) Object.assign(s, { isSpawning: true, spawnTimer: 0 });
      const x0 = s.x;
      s.takeDamage(1, 0, 'player_bullet'); // along +x; he closes in along +y
      for (let ms = 20; ms < 1600; ms += FRAME_MS) step(ms);
      return s.x - x0;
    };
    const spawned = slide(false);
    expect(spawned).toBeGreaterThan(30);
    expect(slide(true)).toBeLessThan(spawned * 1.5);
  });

  it('a hit pushes him along it at KNOCK_PX_S, capped at KNOCK_MAX_PX_S, fading', () => {
    const { s, step } = shiv({ hero: { x: 0, y: 1000 } });
    s.takeDamage(1, 0, 'player_bullet');
    expect(s.push.x).toBeCloseTo(S.KNOCK_PX_S, 6);
    for (let i = 0; i < 5; i++) s.takeDamage(1, 0, 'player_bullet');
    expect(Math.hypot(s.push.x, s.push.y)).toBeCloseTo(S.KNOCK_MAX_PX_S, 6);
    const x0 = s.x;
    for (let ms = 20; ms < 1200; ms += FRAME_MS) step(ms);
    expect(s.x - x0).toBeGreaterThan(30);
    expect(Math.hypot(s.push.x, s.push.y)).toBeLessThan(1);
  });
});

describe('his steps come on time or not at all', () => {
  it('a lock a quarter beat late drops the phrase and he stalks; just under that, he locks', () => {
    const late = shiv();
    late.run(0, 900);
    late.step(LOCK_MS + LATE_MS);
    expect(late.s.state).toBe('stalk');
    expect(late.strings('stab')).toHaveLength(0);
    const close = shiv();
    close.run(0, 900);
    close.step(LOCK_MS + LATE_MS - 5);
    expect(close.s.locked).toBe(true);
  });

  it('a lunge a quarter beat late drops the phrase; just under that, he lunges', () => {
    const late = shiv();
    late.run(0, LOCK_MS + 100);
    late.step(LUNGE_MS + LATE_MS);
    expect(late.s.state).toBe('stalk');
    expect(late.strings('screech')).toHaveLength(0);
    const close = shiv();
    close.run(0, LOCK_MS + 100);
    close.step(LUNGE_MS + LATE_MS - 5);
    expect(close.strings('screech')).toHaveLength(1);
  });

  it('a wind-up a quarter beat late never starts', () => {
    const { s, step } = shiv();
    step(WINDUP_MS - 100);
    step(WINDUP_MS + LATE_MS);
    expect(s.state).toBe('stalk');
  });
});

describe('his strings', () => {
  it('a kill by any path stops his tremolo: the tank ball kills through the death handler, not takeDamage', () => {
    const { s, run } = shiv();
    run(0, 700);
    expect(s.state).toBe('windup');
    const handle = s.tremolo;
    const values = {
      audio: { playSound: vi.fn() },
      explosionManager: { addFragmentExplosion: vi.fn() },
      enemies: [],
    };
    new EnemyDeathHandler({ get: (k) => values[k] }).handleEnemyDeath(
      s,
      'stabber',
      s.x,
      s.y,
      { dir: 0 }
    );
    expect(handle.stop).toHaveBeenCalledTimes(1);
  });

  it('the tremolo starts at the wind-up and ends at the lock; the stab at the lock, the screech at the lunge, the pizzicato at the contact', () => {
    const { s, run, strings } = shiv();
    run(0, WINDUP_MS + 20);
    const [[, , , trem]] = strings('tremolo');
    const windupMs = s.stateAt * MS_PER_BEAT;
    expect(trem.untilSec).toBeCloseTo((LOCK_MS - windupMs) / 1000, 6);
    run(WINDUP_MS + 36, LUNGE_MS + 300);
    expect(strings('stab')).toHaveLength(1);
    expect(strings('screech')).toHaveLength(1);
    expect(strings('screech')[0][3].beatSec).toBe(0.5);
    const [[, px, py]] = strings('pluck');
    expect(px).toBeCloseTo(s.lastTip.x, 6);
    expect(py).toBeCloseTo(s.lastTip.y, 6);
  });
});

describe('his pose', () => {
  it("the count ring's arcs match the eighths left, and it turns white-hot at his lock step, not at beat 3", () => {
    const { s, step, run, at } = shiv();
    const ring = () => {
      const log = strokeLog();
      s.drawSpecificIndicators(log.p);
      return log.colours();
    };
    run(0, 600);
    expect(s.pose().windup.left).toBe(3);
    expect(ring().has(RING_GOLD)).toBe(true);
    run(616, 800);
    expect(s.pose().windup.left).toBe(2);
    const amber = ring();
    expect(amber.has(RING_GOLD)).toBe(false);
    run(816, LOCK_MS - 10);
    at(LOCK_MS + 20); // beat 3 has come; his update hasn't
    expect(ring()).toEqual(amber);
    step(LOCK_MS + 20);
    expect(ring()).not.toEqual(amber);
    expect(s.pose().windup.left).toBe(1);
  });

  // The ring's strokes, measured: the widest, and the radius they sit on
  function ringExtent(s) {
    let r = 0;
    let reach = 0;
    const state = { globalAlpha: 1 };
    const ctx = new Proxy(state, {
      get: (t, k) => {
        if (k === 'arc') return (x, y, radius) => (r = radius);
        if (k === 'stroke')
          return () => (reach = Math.max(reach, r + t.lineWidth / 2));
        if (k in t) return t[k];
        return () => {};
      },
    });
    s.drawSpecificIndicators({ drawingContext: ctx });
    return reach;
  }

  it.each([0.6, 1, 1.6])(
    'at ART_SCALE %s his health bar clears his count ring, its flash and its white-hot',
    (scale) => {
      CONFIG.STABBER_LOOK.ART_SCALE = scale;
      const { s, run, step } = shiv();
      const bar = () => s.healthBarRise - HEALTH_BAR_HEIGHT_PX; // its bottom, px above him
      run(0, 740);
      step(750); // an arc has just gone out: its flash at its widest
      expect(ringExtent(s)).toBeGreaterThan(RING_R_PX * scale);
      expect(bar()).toBeGreaterThan(ringExtent(s));
      run(766, LOCK_MS + 20); // white-hot
      expect(bar()).toBeGreaterThan(ringExtent(s));
    }
  );

  it('with KNOCK_PX_S at 0 his pose stays finite, unpushed and recoiling', () => {
    CONFIG.STABBER.KNOCK_PX_S = 0;
    const { s, run } = shiv();
    run(0, 300); // stalking, no push at all: 0 / 0
    expect(Number.isFinite(s.pose().push)).toBe(true);
    run(316, LUNGE_MS + 300); // he stabs the hero and recoils
    expect(s.state).toBe('recover');
    const { push, vx, vy, reach } = s.pose();
    for (const v of [push, vx, vy, reach])
      expect(Number.isFinite(v)).toBe(true);
  });

  it('BaseEnemy moves him by his locomotion plus his push, and not at all mid-lunge', () => {
    const { s, run } = shiv();
    run(0, 300);
    expect(s.velocity.x).toBeCloseTo((s.walk.x + s.push.x) / 60, 9);
    run(316, LUNGE_MS + 50);
    expect(s.state).toBe('lunge');
    expect(s.velocity).toEqual({ x: 0, y: 0 });
  });

  it('his aim is his own: BaseEnemy does not snap it to the hero', () => {
    const { s, hero, run } = shiv();
    run(0, 200);
    hero.x = -300; // the hero jumps behind him
    run(216, 216);
    expect(s.aimAngle).toBe(s.aim);
    expect(Math.abs(s.aim)).toBeLessThan(Math.PI / 2); // still turning
  });
});
