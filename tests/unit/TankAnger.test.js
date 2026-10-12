import { describe, it, expect, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { UH } from '../../js/entities/TankFlinch.js';
import { tankWorld } from './helpers/tankWorld.js';

const DEFAULTS = { ...CONFIG.TANK };
afterEach(() => Object.assign(CONFIG.TANK, DEFAULTS));

const FROM_BEHIND = 0; // a shot flying +x into a tank facing +x: dead behind him
const LIMIT = Math.abs(UH.LOOK); // as far as his head turns

// A tank pinned in place facing +x, who last acted in bar 2, among a grunt
// (a stand-in alien) and the hero
const angerWorld = (grunt, hero = { x: 300, y: 300 }) => {
  Object.assign(CONFIG.TANK, { DRIFT_PX_S: 0, LURCH_PX_S: 0 });
  const g = { type: 'grunt', ...grunt };
  const w = tankWorld({ hero, enemies: [g] });
  const t = w.tank();
  t.facing = 0;
  t.turn = { from: 0, to: 0, at: null };
  t.lastActedBar = 2;
  return { w, t, g };
};
const tip = (t) => {
  for (let i = 0; i < t.angerThreshold; i++) {
    t.takeDamage(1, FROM_BEHIND, 'grunt');
  }
};

describe('his glances at hits 1 and 2', () => {
  it('flick his head toward where a hit came from and back; a shot a plate stops makes none', () => {
    const { w, t } = angerWorld({ x: 0, y: -300 });
    w.frame(t, 5000); // beat 10
    t.takeDamage(1, Math.PI, 'grunt'); // into his front plate, which holds
    w.frame(t, 5100);
    expect(t.pose().glance).toBeNull();
    t.plates.left = { hp: 0, max: 30, destroyed: true };
    t.takeDamage(1, Math.PI / 2, 'grunt'); // flying +y: from his left, through the broken plate
    w.frame(t, 5125);
    expect(t.pose().glance.rel).toBeCloseTo(-Math.PI / 2, 9);
    expect(t.pose().glance.k).toBeCloseTo(0.5, 9); // halfway in
    w.frame(t, 5200);
    expect(t.pose().glance.k).toBe(1);
    w.frame(t, 5500); // past its hold: on its way back
    expect(t.pose().glance.k).toBeLessThan(1);
    w.frame(t, 5700);
    expect(t.pose().glance).toBeNull();
  });

  it('a new hit restarts the glance toward it, over its own shoulder', () => {
    const { w, t } = angerWorld({ x: 0, y: -300 });
    w.frame(t, 5000);
    t.takeDamage(1, 0.3, 'grunt'); // from behind, on his left
    w.frame(t, 5300);
    expect(t.pose().glance.rel).toBeCloseTo(-LIMIT, 9);
    t.takeDamage(1, -0.3, 'grunt'); // from behind, on his right
    w.frame(t, 5400);
    expect(t.pose().glance.rel).toBeCloseTo(LIMIT, 9);
    expect(t.pose().glance.k).toBe(1);
  });
});

describe('the third hit tips him', () => {
  it('holds his head on it, forces his line, and his next bar action whips him all the way round to the alien', () => {
    const { w, t, g } = angerWorld({ x: 0, y: 300 }); // a grunt at his right
    w.frame(t, 5000);
    tip(t);
    expect(t.isAngry).toBe(true);
    expect(w.audio.speak).toHaveBeenCalledWith(
      t,
      expect.any(String),
      'tank',
      true
    );
    w.frame(t, 5900);
    // Dead behind, so over his left shoulder, as his "uh oh" looks
    expect(t.pose().glance.rel).toBeCloseTo(-LIMIT, 9);
    expect(t.pose().glance.k).toBe(1); // held: no whip yet
    w.frame(t, 6000); // bar 3: the whip, the whole 90°
    expect(t.turn.to - t.turn.from).toBeCloseTo(Math.PI / 2, 9);
    expect(t.whipAt).toBe(12);
    w.frame(t, 6300); // into the turn: still held
    expect(t.pose().glance.k).toBe(1);
    w.frame(t, 6700); // past TURN_SEC and the ease back
    expect(t.pose().glance).toBeNull();
    // The next bar action turns him a step, as ever
    Object.assign(g, { x: 0, y: -300 }); // the grunt goes round behind him
    for (let ms = 7000; ms <= 8000; ms += 500) w.frame(t, ms);
    expect(t.turn.to - t.turn.from).toBeCloseTo(Math.PI / 3, 9);
    // And hits while he's angry make no glance (one through his back)
    t.takeDamage(1, t.facing, 'grunt');
    expect(t.backHitAt).toBe(t.poseBeats);
    w.frame(t, 8100);
    expect(t.pose().glance).toBeNull();
  });

  it('with no alien of that kind left, the whip is an ordinary turn, toward the hero', () => {
    const { w, t, g } = angerWorld({ x: 0, y: 300 }, { x: 0, y: 300 });
    w.frame(t, 5000);
    tip(t);
    g.markedForRemoval = true;
    w.frame(t, 5900);
    w.frame(t, 6000);
    expect(t.turn.to - t.turn.from).toBeCloseTo(Math.PI / 3, 9);
    expect(t.whipAt).toBe(12);
    w.frame(t, 6700);
    expect(t.pose().glance).toBeNull(); // his head still comes back
  });

  it('an alien dead ahead makes no turn, and his head still comes back', () => {
    const { w, t } = angerWorld({ x: 300, y: 0 });
    w.frame(t, 5000);
    tip(t);
    w.frame(t, 5900);
    w.frame(t, 6000);
    expect(t.turn.at).toBeNull(); // no turn
    expect(t.whipAt).toBe(12);
    w.frame(t, 6300);
    expect(t.pose().glance.k).toBe(1);
    w.frame(t, 6700);
    expect(t.pose().glance).toBeNull();
  });

  it('calming down before his bar action drops the whip and lets his head go', () => {
    const { w, t } = angerWorld({ x: 0, y: 300 }, { x: 0, y: 300 });
    w.frame(t, 5000);
    tip(t);
    t.angerCooldown = 0;
    w.frame(t, 5016); // he calms
    expect(t.isAngry).toBe(false);
    w.frame(t, 5900);
    expect(t.pose().glance).toBeNull();
    w.frame(t, 6000);
    expect(t.turn.to - t.turn.from).toBeCloseTo(Math.PI / 3, 9);
  });
});
