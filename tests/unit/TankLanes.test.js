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
