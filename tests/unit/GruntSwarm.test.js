import { describe, it, expect, afterEach, vi } from 'vitest';
import { CONFIG } from '../../js/config.js';
import {
  GruntSwarm,
  swarmSize,
  cloudRadius,
  STANDOFF_BAND_PX,
} from '../../js/systems/GruntSwarm.js';
import { GRUNT_FIRE_RANGE } from '../../js/entities/Grunt.js';

const SWARM = { ...CONFIG.SWARM };
afterEach(() => {
  Object.assign(CONFIG.SWARM, SWARM);
  vi.restoreAllMocks();
});

const SPEED = 1.2; // a grunt's

// A grunt as the swarm sees him: where he is, his speed, his life
function grunt(swarm, x, y, extra = {}) {
  return {
    type: 'grunt',
    x,
    y,
    speed: SPEED,
    health: 2,
    swarm,
    markedForRemoval: false,
    pendingStabDeath: false,
    velocity: { x: 0, y: 0 },
    ...extra,
  };
}

// n grunts in a ring of radius r round (x, y)
function cloud(swarm, n, x, y, r = 20) {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return grunt(swarm, x + r * Math.cos(a), y + r * Math.sin(a));
  });
}

// `frames` frames of the swarm steering and its grunts moving
function run(swarm, enemies, hero, frames) {
  for (let f = 0; f < frames; f++) {
    swarm.steer(swarm.members(enemies), hero);
    for (const g of swarm.members(enemies)) {
      g.x += g.velocity.x;
      g.y += g.velocity.y;
    }
  }
}

const centroid = (gs) => ({
  x: gs.reduce((s, g) => s + g.x, 0) / gs.length,
  y: gs.reduce((s, g) => s + g.y, 0) / gs.length,
});
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

describe('a swarm’s size', () => {
  it('starts at SIZE_FIRST and grows SIZE_PER_LEVEL a level, up to SIZE_MAX', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(swarmSize)).toEqual([
      5, 7, 9, 11, 12, 12, 12,
    ]);
  });

  it('follows its knobs, and is never less than one grunt', () => {
    Object.assign(CONFIG.SWARM, {
      SIZE_FIRST: 3,
      SIZE_PER_LEVEL: 1,
      SIZE_MAX: 4,
    });
    expect([1, 2, 3].map(swarmSize)).toEqual([3, 4, 4]);
    Object.assign(CONFIG.SWARM, { SIZE_FIRST: 0, SIZE_PER_LEVEL: 0 });
    expect(swarmSize(1)).toBe(1);
  });

  it('a cloud’s radius grows with its numbers, as its spacing packs them', () => {
    expect(cloudRadius(4)).toBeCloseTo(CONFIG.SWARM.SPACING_PX, 9);
    expect(cloudRadius(16)).toBeCloseTo(2 * CONFIG.SWARM.SPACING_PX, 9);
  });
});

describe('a swarm’s grunts', () => {
  it('are found in the enemies array: its own, live, not pending a death', () => {
    const swarm = new GruntSwarm({ size: 5, x: 0, y: 0 });
    const other = new GruntSwarm({ size: 5, x: 0, y: 0 });
    const mine = grunt(swarm, 0, 0);
    const enemies = [
      mine,
      grunt(other, 0, 0),
      grunt(null, 0, 0),
      grunt(swarm, 0, 0, { markedForRemoval: true }),
      grunt(swarm, 0, 0, { pendingStabDeath: true }),
      grunt(swarm, 0, 0, { health: 0 }),
      { type: 'tank', swarm, health: 4, markedForRemoval: false },
    ];
    expect(swarm.members(enemies)).toEqual([mine]);
  });

  it('a grunt removed from the array is gone from it at once; with none left it is cleared', () => {
    const swarm = new GruntSwarm({ size: 2, x: 0, y: 0 });
    const enemies = [grunt(swarm, 0, 0), grunt(swarm, 10, 0)];
    expect(swarm.isCleared(enemies)).toBe(false);
    enemies.splice(0, 1);
    expect(swarm.members(enemies)).toHaveLength(1);
    expect(swarm.isCleared(enemies)).toBe(false);
    enemies[0].markedForRemoval = true;
    expect(swarm.isCleared(enemies)).toBe(true);
    expect(swarm.isCleared([])).toBe(true);
  });
});

describe('a swarm’s movement', () => {
  const hero = { x: 0, y: 0 };

  it('comes in at a grunt’s full speed until one of its grunts is in range, then drifts', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // no jitter
    const swarm = new GruntSwarm({ size: 1, x: 900, y: 0 });
    const enemies = [grunt(swarm, 900, 0)];
    swarm.steer(swarm.members(enemies), hero);
    expect(swarm.entering).toBe(true);
    expect(enemies[0].velocity.x).toBeCloseTo(-SPEED, 9);
    // in range: from now on it drifts
    enemies[0].x = GRUNT_FIRE_RANGE - 1;
    swarm.steer(swarm.members(enemies), hero);
    expect(swarm.entering).toBe(false);
    enemies[0].x = 900;
    swarm.steer(swarm.members(enemies), hero);
    expect(enemies[0].velocity.x).toBeCloseTo(
      -SPEED * CONFIG.SWARM.DRIFT_SHARE,
      9
    );
  });

  it('its centre settles at the stand-off plus its radius from the hero, its grunts spread and none piled up', () => {
    const swarm = new GruntSwarm({ size: 12, x: 700, y: 300 });
    const enemies = cloud(swarm, 12, 700, 300, 5);
    run(swarm, enemies, hero, 3000);
    const gs = swarm.members(enemies);
    const c = centroid(gs);
    const want = CONFIG.SWARM.STANDOFF_PX + cloudRadius(12);
    expect(Math.abs(dist(c, hero) - want)).toBeLessThanOrEqual(
      STANDOFF_BAND_PX + 1
    );
    let closest = Infinity;
    for (const a of gs) {
      for (const b of gs) if (a !== b) closest = Math.min(closest, dist(a, b));
      // all within the cloud, about its radius from the centre
      expect(dist(a, c)).toBeLessThan(2.5 * cloudRadius(12));
    }
    expect(closest).toBeGreaterThan(CONFIG.SWARM.SPACING_PX / 3);
  });

  it('backs off when the hero comes too close, and holds still inside its band', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // no jitter
    const swarm = new GruntSwarm({ size: 1, x: 50, y: 0 });
    swarm.entering = false;
    const g = grunt(swarm, 50, 0);
    swarm.steer([g], hero);
    expect(g.velocity.x).toBeGreaterThan(0); // away from the hero at 0
    expect(swarm.heading).toBe('retreat');
    const D = CONFIG.SWARM.STANDOFF_PX + cloudRadius(1);
    // anywhere in the band round the stand-off plus its radius: still
    for (const x of [D - STANDOFF_BAND_PX + 1, D, D + STANDOFF_BAND_PX - 1]) {
      g.x = x;
      swarm.steer([g], hero);
      expect(g.velocity.x).toBeCloseTo(0, 9);
      expect(g.velocity.y).toBeCloseTo(0, 9);
      expect(swarm.heading).toBe(null);
    }
    // and just past it, back in
    g.x = D + STANDOFF_BAND_PX + 1;
    swarm.steer([g], hero);
    expect(swarm.heading).toBe('advance');
  });

  it('no grunt moves faster than a grunt can', () => {
    const swarm = new GruntSwarm({ size: 12, x: 900, y: 0 });
    // all piled on one spot, the pull and the push at their largest
    const enemies = Array.from({ length: 12 }, () => grunt(swarm, 900, 0));
    swarm.steer(swarm.members(enemies), hero);
    for (const g of enemies) {
      expect(Math.hypot(g.velocity.x, g.velocity.y)).toBeLessThanOrEqual(
        SPEED + 1e-9
      );
    }
    // and grunts on one spot are pushed apart, not left there
    run(swarm, enemies, hero, 60);
    expect(dist(enemies[0], enemies[1])).toBeGreaterThan(1);
  });
});

describe('a swarm’s snare', () => {
  // A beat clock at total beat `total`, its beat in the bar `inBar` (0-3),
  // inside the 2-or-4 window or not
  const clockAt = (total, inBar, window = false) => ({
    getTotalBeats: () => total,
    getCurrentBeat: () => inBar,
    canGruntShoot: () => window,
  });
  const hero = { x: 0, y: 0 };
  // A grunt that can be picked: settled in, a clear line unless told
  const shooter = (swarm, x, extra = {}) =>
    grunt(swarm, x, 0, {
      isSpawning: false,
      lineBlocked: () => false,
      ...extra,
    });

  it('fires a third of its grunts on a 2 or 4, up to SHOOTERS_MAX', () => {
    const swarm = new GruntSwarm({ size: 5, x: 0, y: 0 });
    expect(
      [1, 2, 3, 5, 7, 9, 11, 12].map((n) => swarm.shooterQuota(n))
    ).toEqual([1, 1, 1, 2, 3, 3, 4, 4]);
    Object.assign(CONFIG.SWARM, { SHOOTERS_MAX: 2, GRUNTS_PER_SHOOTER: 1 });
    expect(swarm.shooterQuota(12)).toBe(2);
  });

  it('picks a third of its size at spawn, however few are left', () => {
    const big = new GruntSwarm({ size: 12, x: 0, y: 0 });
    const left = [100, 110, 120].map((x) => shooter(big, x));
    big.beat(big.members(left), hero, clockAt(8, 0));
    expect(left.map((g) => g.warnedOnBeat)).toEqual([8, 8, 8]);
  });

  it('picks on its first update in beat 1 or 3: in range, nearest the hero first, a clear line, not still materialising', () => {
    const swarm = new GruntSwarm({ size: 6, x: 0, y: 0 });
    const enemies = [
      shooter(swarm, 250),
      shooter(swarm, 120),
      shooter(swarm, 150, { lineBlocked: () => true }),
      shooter(swarm, 100, { isSpawning: true }),
      shooter(swarm, GRUNT_FIRE_RANGE + 10),
      shooter(swarm, 180),
    ];
    swarm.beat(swarm.members(enemies), hero, clockAt(8, 0));
    // quota 2 of 6: the nearest two that can fire
    expect(enemies.map((g) => g.warnedOnBeat ?? null)).toEqual([
      null,
      8,
      null,
      null,
      null,
      8,
    ]);
    // once a beat: a later update in it picks no more
    enemies[0].x = 50;
    swarm.beat(swarm.members(enemies), hero, clockAt(8, 0));
    expect(enemies[0].warnedOnBeat ?? null).toBe(null);
    // and not on beats 2 or 4
    swarm.beat(swarm.members(enemies), hero, clockAt(9, 1));
    expect(enemies[0].warnedOnBeat ?? null).toBe(null);
    // never one out of range, even with the quota to spare
    const few = new GruntSwarm({ size: 4, x: 0, y: 0 });
    const gs = [100, 10, 20, 30].map((d, i) =>
      shooter(few, i === 0 ? d : GRUNT_FIRE_RANGE + d)
    );
    few.beat(few.members(gs), hero, clockAt(8, 0));
    expect(gs.map((g) => g.warnedOnBeat ?? null)).toEqual([
      8,
      null,
      null,
      null,
    ]);
  });

  it('picks no one for a volley before its quiet ends (GAP_BEATS after the last swarm)', () => {
    const swarm = new GruntSwarm({ size: 1, x: 0, y: 0 });
    swarm.quietUntil = 11;
    const g = shooter(swarm, 100);
    swarm.beat([g], hero, clockAt(8, 0)); // for beat 9: too soon
    expect(g.warnedOnBeat ?? null).toBe(null);
    swarm.beat([g], hero, clockAt(10, 2)); // for beat 11: allowed
    expect(g.warnedOnBeat).toBe(10);
  });

  it('settles its volley in the 2-or-4 window: a pick still in it, warned the beat before, with a clear line fires; the rest hold', () => {
    const swarm = new GruntSwarm({ size: 4, x: 0, y: 0 });
    const fires = shooter(swarm, 100, { warnedOnBeat: 8 });
    const blocked = shooter(swarm, 110, {
      warnedOnBeat: 8,
      lineBlocked: () => true,
    });
    const stale = shooter(swarm, 120, { warnedOnBeat: 4 }); // a bar ago
    const dead = shooter(swarm, 130, { warnedOnBeat: 8, health: 0 });
    const enemies = [fires, blocked, stale, dead];
    swarm.beat(swarm.members(enemies), hero, clockAt(9, 1, true));
    expect(fires.fireOnBeat).toBe(9);
    for (const g of [blocked, stale, dead])
      expect(g.fireOnBeat ?? null).toBe(null);
    // a volley of one is a lone shot
    expect(swarm.volleyGain).toBe(1);
  });

  it('a window it never saw is never replayed', () => {
    const swarm = new GruntSwarm({ size: 1, x: 0, y: 0 });
    const g = shooter(swarm, 100, { warnedOnBeat: 8 });
    // beat 9's window passed unseen; the next update is later in beat 9
    swarm.beat([g], hero, clockAt(9, 1, false));
    swarm.beat([g], hero, clockAt(10, 2, false));
    expect(g.fireOnBeat ?? null).toBe(null);
  });

  it('each shot of a volley plays at 1/√n of the n that fire', () => {
    for (const n of [2, 3, 4]) {
      const swarm = new GruntSwarm({ size: 12, x: 0, y: 0 });
      const enemies = Array.from({ length: n }, (_, i) =>
        shooter(swarm, 100 + i, { warnedOnBeat: 8 })
      );
      // one more pick, held: it doesn't count
      enemies.push(
        shooter(swarm, 99, { warnedOnBeat: 8, lineBlocked: () => true })
      );
      swarm.beat(swarm.members(enemies), hero, clockAt(9, 1, true));
      // -3 dB a doubling: 1/sqrt(n) to within the knob's rounding of 3.01
      expect(swarm.volleyGain).toBeCloseTo(1 / Math.sqrt(n), 2);
    }
  });
});
