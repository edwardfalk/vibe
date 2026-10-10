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
