import { describe, it, expect, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { Player } from '../../js/entities/player.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { tankWorld } from './helpers/tankWorld.js';

const DEFAULTS = { ...CONFIG.TANK };
const PLAYER = { ...CONFIG.PLAYER };
afterEach(() => {
  Object.assign(CONFIG.TANK, DEFAULTS);
  Object.assign(CONFIG.PLAYER, PLAYER);
});

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

  it('waits for the next beat when the hero steps into reach mid-beat', () => {
    const w = tankWorld({ hero: { x: 300, y: 0 } }); // in front, out of reach
    const t = w.tank();
    w.frame(t, 4250);
    w.frame(t, 4500);
    w.player.x = 60; // he steps in
    w.frame(t, 4600);
    expect(w.player.hurt).not.toHaveBeenCalled();
    w.frame(t, 5000); // the next beat
    expect(w.player.hurt).toHaveBeenCalledTimes(1);
  });

  it('has a sound of its own', () => {
    const w = tankWorld({ hero: { x: 60, y: 0 } });
    const t = w.tank();
    w.frame(t, 4250);
    w.frame(t, 4500);
    expect(w.audio.playSound).toHaveBeenCalledWith('tankShove', 60, 0);
  });

  it('a fatal shove pushes no corpse', () => {
    const w = tankWorld({ hero: { x: 60, y: 0 } });
    w.player.hurt.mockReturnValue(true);
    const t = w.tank();
    w.frame(t, 4250);
    w.frame(t, 4500);
    expect(w.player.knockBack).not.toHaveBeenCalled();
  });

  it('does nothing to a hero behind him', () => {
    CONFIG.TANK.TURN_STEP_DEG = 0; // held facing +x, wherever the hero is
    const w = tankWorld({ hero: { x: -60, y: 0 } });
    const t = w.tank();
    t.facing = 0;
    t.turn = { from: 0, to: 0, at: null };
    for (let ms = 4250; ms <= 5750; ms += 250) w.frame(t, ms);
    expect(w.player.hurt).not.toHaveBeenCalled();
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

// A tank held facing +x, wherever the hero is
const heldTank = (w, x = 0, y = 0) => {
  const t = w.tank(x, y);
  t.facing = 0;
  t.turn = { from: 0, to: 0, at: null };
  return t;
};

describe('the side elbow', () => {
  it('lands on a new beat on a hero at his left or his right: damage, a knock away from him, its own sound', () => {
    CONFIG.TANK.TURN_STEP_DEG = 0;
    // Apart from the shove's, so the elbow's own are the ones read
    Object.assign(CONFIG.PLAYER, {
      DAMAGE_TANK_ELBOW: 7,
      KNOCKBACK_TANK_ELBOW: 9.5,
    });
    for (const hero of [
      { x: 0, y: 60 }, // his right
      { x: 0, y: -60 }, // his left
    ]) {
      const w = tankWorld({ hero });
      const t = heldTank(w);
      w.frame(t, 4250); // his first update only notes the beat
      expect(w.player.hurt).not.toHaveBeenCalled();
      w.frame(t, 4500); // a new beat
      expect(w.player.hurt).toHaveBeenCalledWith(
        CONFIG.PLAYER.DAMAGE_TANK_ELBOW,
        'tank-elbow'
      );
      expect(w.player.knockBack).toHaveBeenCalledWith(
        t.x,
        t.y,
        CONFIG.PLAYER.KNOCKBACK_TANK_ELBOW
      );
      expect(w.audio.playSound).toHaveBeenCalledWith(
        'tankElbow',
        hero.x,
        hero.y
      );
    }
  });

  it('shares his cooldown with the shove: after either blow, neither for 2 beats', () => {
    CONFIG.TANK.TURN_STEP_DEG = 0;
    const w = tankWorld({ hero: { x: 60, y: 0 } }); // in front
    const t = heldTank(w);
    w.frame(t, 4250);
    w.frame(t, 4500); // the shove
    Object.assign(w.player, { x: 0, y: 60 }); // he slips to the side
    w.frame(t, 5000); // the next beat: still cooling down
    expect(w.player.hurt).toHaveBeenCalledTimes(1);
    w.frame(t, 5500); // two beats on: the elbow
    expect(w.player.hurt).toHaveBeenLastCalledWith(
      CONFIG.PLAYER.DAMAGE_TANK_ELBOW,
      'tank-elbow'
    );
    Object.assign(w.player, { x: 60, y: 0 }); // and back in front
    w.frame(t, 6000); // the next beat: the elbow's cooldown holds the shove
    expect(w.player.hurt).toHaveBeenCalledTimes(2);
    w.frame(t, 6500);
    expect(w.player.hurt).toHaveBeenCalledTimes(3);
  });

  it('two tanks, one in front of the hero and one at his side, land one blow a beat between them', () => {
    CONFIG.TANK.TURN_STEP_DEG = 0;
    const w = tankWorld({ hero: { x: 60, y: 0 } });
    const a = heldTank(w, 0, 0); // the hero in front of him
    const b = heldTank(w, 60, 60); // the hero at his left
    for (const t of [a, b]) w.frame(t, 4250);
    for (const t of [b, a]) w.frame(t, 4500);
    expect(w.player.hurt).toHaveBeenCalledTimes(1);
    expect(w.player.hurt).toHaveBeenCalledWith(
      CONFIG.PLAYER.DAMAGE_TANK_ELBOW,
      'tank-elbow'
    );
  });

  it('a fatal elbow knocks no corpse', () => {
    CONFIG.TANK.TURN_STEP_DEG = 0;
    const w = tankWorld({ hero: { x: 0, y: 60 } });
    w.player.hurt.mockReturnValue(true);
    const t = heldTank(w);
    w.frame(t, 4250);
    w.frame(t, 4500);
    expect(w.player.hurt).toHaveBeenCalledTimes(1);
    expect(w.player.knockBack).not.toHaveBeenCalled();
  });
});
