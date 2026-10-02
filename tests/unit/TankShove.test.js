import { describe, it, expect, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { Player } from '../../js/entities/player.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { tankWorld } from './helpers/tankWorld.js';

const DEFAULTS = { ...CONFIG.TANK };
afterEach(() => Object.assign(CONFIG.TANK, DEFAULTS));

describe('the front shove', () => {
  it('lands on a new beat on a hero in front of him: damage, knockback, then a cooldown', () => {
    const w = tankWorld({ hero: { x: 60, y: 0 } }); // within reach, in front
    const t = w.tank();
    w.frame(t, 4250); // his first update only notes the beat
    expect(w.player.hurt).not.toHaveBeenCalled();
    w.frame(t, 4500); // a new beat
    expect(w.player.hurt).toHaveBeenCalledWith(
      CONFIG.PLAYER.DAMAGE_TANK_SHOVE,
      'tank-shove'
    );
    expect(w.player.knockBack).toHaveBeenCalledWith(
      t.x,
      t.y,
      CONFIG.PLAYER.KNOCKBACK_TANK_SHOVE
    );
    w.frame(t, 5000); // the next beat: still cooling down
    expect(w.player.hurt).toHaveBeenCalledTimes(1);
    w.frame(t, 5500); // two beats on
    expect(w.player.hurt).toHaveBeenCalledTimes(2);
  });

  it("a raised shield takes the first shove whole, and he's knocked back anyway", () => {
    const hero = new Player(createMockP5(), 60, 0, null, null);
    expect(hero.shieldUp).toBe(true);
    const w = tankWorld({ hero: {} });
    w.values.player = hero;
    const t = w.tank();
    w.at(4250);
    t.update(hero.x, hero.y, 16);
    w.at(4500);
    t.update(hero.x, hero.y, 16);
    expect(hero.health).toBe(hero.maxHealth);
    expect(hero.shieldUp).toBe(false);
    expect(hero.knockback.x).toBeGreaterThan(0); // pushed away from his front
  });

  it('a fatal shove pushes no corpse', () => {
    const w = tankWorld({ hero: { x: 60, y: 0 } });
    w.player.hurt.mockReturnValue(true);
    const t = w.tank();
    w.frame(t, 4250);
    w.frame(t, 4500);
    expect(w.player.knockBack).not.toHaveBeenCalled();
  });

  it('does nothing to a hero at his side or behind him', () => {
    CONFIG.TANK.TURN_STEP_DEG = 0; // held facing +x, wherever the hero is
    for (const hero of [
      { x: 0, y: 60 },
      { x: -60, y: 0 },
    ]) {
      const w = tankWorld({ hero });
      const t = w.tank();
      t.facing = 0;
      t.turn = { from: 0, to: 0, at: null };
      for (let ms = 4250; ms <= 5750; ms += 250) w.frame(t, ms);
      expect(
        w.player.hurt,
        `hero at ${hero.x},${hero.y}`
      ).not.toHaveBeenCalled();
    }
  });

  it('two tanks with the hero in front of both shove him once', () => {
    const w = tankWorld({ hero: { x: 60, y: 0 } });
    const a = w.tank(0, 0); // faces him (+x)
    const b = w.tank(120, 0); // faces him (-x)
    w.frame(a, 4250);
    w.frame(b, 4250);
    w.frame(a, 4500);
    w.frame(b, 4500);
    expect(w.player.hurt).toHaveBeenCalledTimes(1);
  });
});
