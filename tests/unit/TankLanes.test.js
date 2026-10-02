import { describe, it, expect, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { tankWorld } from './helpers/tankWorld.js';

const DEFAULTS = { ...CONFIG.TANK };
afterEach(() => Object.assign(CONFIG.TANK, DEFAULTS));

// Is tank b in a's lane: between a and the hero, within FIRE_LANE_PX of
// the line from a to the hero, where a's shot would hit him?
const inLane = (a, b, hero) => {
  const d = Math.hypot(hero.x - a.x, hero.y - a.y);
  const ux = (hero.x - a.x) / d;
  const uy = (hero.y - a.y) / d;
  const along = (b.x - a.x) * ux + (b.y - a.y) * uy;
  const across = (b.y - a.y) * ux - (b.x - a.x) * uy;
  return along > 0 && along < d && Math.abs(across) < CONFIG.TANK.FIRE_LANE_PX;
};

describe('a tank keeps his line of fire clear of other tanks', () => {
  it('steps sideways, away from a tank in his lane, and only then', () => {
    Object.assign(CONFIG.TANK, { LURCH_PX_S: 0, TURN_STEP_DEG: 0 });
    const w = tankWorld({ hero: { x: 400, y: 0 } });
    const a = w.tank(0, 0);
    w.frame(a, 4250);
    expect(a.velocity.y).toBeCloseTo(0, 9); // a clear lane: straight on
    w.tank(200, 10); // in his lane, a little to his right (+y)
    w.frame(a, 4266);
    expect(a.velocity.y).toBeCloseTo(-CONFIG.TANK.SIDESTEP_PX_S / 60, 9);
    expect(a.velocity.x).toBeCloseTo(CONFIG.TANK.DRIFT_PX_S / 60, 9);
  });

  it('ignores a tank beyond the hero, and keeps stepping close to the hero, where he no longer comes closer', () => {
    Object.assign(CONFIG.TANK, { TURN_STEP_DEG: 0 });
    const w = tankWorld({ hero: { x: 120, y: 0 } }); // within LURCH_MIN_DIST_PX
    const a = w.tank(0, 0);
    w.tank(300, 0); // beyond the hero
    w.frame(a, 4250);
    expect(a.velocity.x).toBe(0);
    expect(a.velocity.y).toBe(0);
    w.tank(60, -20); // between, to his left
    w.frame(a, 4266);
    expect(a.velocity.x).toBeCloseTo(0, 9);
    expect(a.velocity.y).toBeCloseTo(CONFIG.TANK.SIDESTEP_PX_S / 60, 9);
  });

  // His sideways speed after a frame, px/s (+ is his right, facing +x),
  // with nothing else moving him
  const sidestepWith = (others, setup = () => {}) => {
    Object.assign(CONFIG.TANK, {
      LURCH_PX_S: 0,
      TURN_STEP_DEG: 0,
      DRIFT_PX_S: 0,
    });
    const w = tankWorld({ hero: { x: 400, y: 0 } });
    const a = w.tank(0, 0);
    for (const o of others) w.values.enemies.push(o);
    setup(a, w);
    w.frame(a, 4250);
    return a.velocity.y * 60;
  };
  const tankAt = (x, y, o = {}) => ({ type: 'tank', x, y, ...o });

  it('only steps for live tanks ahead of him: not a grunt, a dead tank, or one behind him', () => {
    expect(sidestepWith([tankAt(200, 10)])).toBeLessThan(0); // the control
    expect(sidestepWith([{ type: 'grunt', x: 200, y: 10 }])).toBe(0);
    expect(sidestepWith([tankAt(200, 10, { markedForRemoval: true })])).toBe(0);
    expect(sidestepWith([tankAt(-100, 10)])).toBe(0);
  });

  it('steps away from the nearest tank in his lane', () => {
    const near = tankAt(100, 20); // his right: step left
    const far = tankAt(250, -20); // his left
    expect(sidestepWith([near, far])).toBeCloseTo(
      -CONFIG.TANK.SIDESTEP_PX_S,
      9
    );
  });

  it("doesn't step aside for the tank he is angry with", () => {
    // Rounding puts a target here a hair inside his own distance
    const grudge = tankAt(150, 6);
    const step = sidestepWith([grudge], (a) => {
      Object.assign(a, {
        isAngry: true,
        angerTarget: 'tank',
        angerCooldown: 1e9,
      });
    });
    expect(step).toBe(0);
  });

  it('stays inside the world, however far his sidestep would carry him', () => {
    const w = tankWorld({ hero: { x: 400, y: 0 } });
    const t = w.tank(0, 0);
    t.x = CONFIG.GAME_SETTINGS.WORLD_WIDTH; // pushed far past the right edge
    t.y = -CONFIG.GAME_SETTINGS.WORLD_HEIGHT;
    w.frame(t, 4250);
    expect(t.x).toBeLessThanOrEqual(
      CONFIG.GAME_SETTINGS.WORLD_WIDTH / 2 - t.size / 2
    );
    expect(t.y).toBeGreaterThanOrEqual(
      -CONFIG.GAME_SETTINGS.WORLD_HEIGHT / 2 + t.size / 2
    );
  });

  it('around a passive hero, tanks spread round him, with every lane clear', () => {
    const w = tankWorld({ hero: { x: 0, y: 0 } });
    // Clumped on one side of him
    const tanks = [
      w.tank(400, 0),
      w.tank(430, 60),
      w.tank(460, -50),
      w.tank(520, 10),
    ];
    for (let ms = 2000; ms < 62000; ms += 16) {
      for (const t of tanks) w.frame(t, ms);
    }
    for (const a of tanks) {
      expect(Math.hypot(a.x, a.y)).toBeLessThan(200); // he came in close
      for (const b of tanks) {
        if (a !== b) expect(inLane(a, b, w.player)).toBe(false);
      }
    }
  });
});
