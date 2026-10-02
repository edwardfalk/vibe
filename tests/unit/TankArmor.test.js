import { describe, it, expect, afterEach } from 'vitest';
import { Tank } from '../../js/entities/Tank.js';
import { CONFIG } from '../../js/config.js';
import { createMockAudio } from './helpers/enemyMocks.js';
import { tankWorld } from './helpers/tankWorld.js';

describe('Tank anger at stabbers', () => {
  const FROM_BEHIND = 0; // flying +x into a tank facing +x: no plate there
  function tankAmong(enemies) {
    const values = { audio: createMockAudio(), enemies };
    const context = { get: (key) => values[key] };
    const p = { color: () => ({ levels: [0, 0, 0, 255] }), TWO_PI: 7 };
    return new Tank(0, 0, 'tank', { context }, p, values.audio);
  }

  it('three stabs make it head for the nearest stabber', () => {
    const stabber = { type: 'stabber', x: 0, y: 200 };
    const tank = tankAmong([stabber]);
    for (let i = 0; i < tank.angerThreshold; i++) {
      tank.takeDamage(1, FROM_BEHIND, 'stabber_melee');
    }
    expect(tank.isAngry).toBe(true);
    tank.updateSpecificBehavior(500, 0); // the player is off to the right
    expect(tank.velocity.x).toBeCloseTo(0);
    expect(tank.velocity.y).toBeGreaterThan(0);
  });

  it('once its anger wears off, the next stab does not re-anger it', () => {
    const tank = tankAmong([]);
    for (let i = 0; i < tank.angerThreshold; i++) {
      tank.takeDamage(1, FROM_BEHIND, 'stabber_melee');
    }
    expect(tank.isAngry).toBe(true);
    tank.angerCooldown = 0;
    tank.updateSpecificBehavior(500, 0);
    expect(tank.isAngry).toBe(false);
    tank.takeDamage(1, FROM_BEHIND, 'stabber_melee');
    expect(tank.isAngry).toBe(false);
  });
});

function tankFacing(facing) {
  const w = tankWorld({ hero: { x: 9999, y: 9999 } });
  const tank = w.tank();
  tank.facing = facing;
  tank.aimAngle = facing + 2; // his gun points elsewhere: armour goes by his body
  return { tank, explosionManager: w.values.explosionManager };
}

describe('Tank armour sits where he faces', () => {
  it('a shot from his left breaks his left plate, and its debris flies to his left', () => {
    const { tank, explosionManager } = tankFacing(0);
    // His left is -y (y points down); the shot flies from there toward +y
    tank.takeDamage(CONFIG.TANK_ARMOR.SIDE, Math.PI / 2);
    expect(tank.plates.left.destroyed).toBe(true);
    expect(tank.plates.right.destroyed).toBe(false);
    const [, burstY] = explosionManager.addExplosion.mock.calls[0];
    expect(burstY).toBeLessThan(0);
  });

  it('turned to face down the screen, the same plate takes shots from +x', () => {
    const { tank } = tankFacing(Math.PI / 2);
    tank.takeDamage(CONFIG.TANK_ARMOR.SIDE, Math.PI); // flying -x: from his left
    expect(tank.plates.left.destroyed).toBe(true);
  });

  it('a shot from behind hits his body and flashes his back, and his plates stay whole', () => {
    const { tank } = tankFacing(0);
    tank.poseBeats = 12.5;
    const before = tank.health;
    tank.takeDamage(1, 0); // flying +x into a tank facing +x: from behind
    expect(tank.health).toBe(before - 1);
    expect(tank.backHitAt).toBe(12.5);
    expect(Object.values(tank.plates).every((pl) => pl.hp === pl.max)).toBe(
      true
    );
  });

  it('a plate is durability: damage past what it has left goes to his body', () => {
    const { tank } = tankFacing(0);
    tank.poseBeats = 3;
    const before = tank.health;
    tank.takeDamage(CONFIG.TANK_ARMOR.FRONT + 7, Math.PI); // from the front
    expect(tank.plates.front.destroyed).toBe(true);
    expect(tank.plateBrokeAt.front).toBe(3);
    expect(tank.health).toBe(before - 7);
  });

  it('a plate set to 0 in ?tune starts broken', () => {
    const saved = CONFIG.TANK_ARMOR.SIDE;
    CONFIG.TANK_ARMOR.SIDE = 0;
    try {
      const { tank } = tankFacing(0);
      expect(tank.plates.left.destroyed).toBe(true);
    } finally {
      CONFIG.TANK_ARMOR.SIDE = saved;
    }
  });
});

describe('Tank anger steers him', () => {
  const DEFAULTS = { ...CONFIG.TANK };
  afterEach(() => Object.assign(CONFIG.TANK, DEFAULTS));

  it('turns and fires toward his grudge, and back toward the hero when none of that kind is left', () => {
    Object.assign(CONFIG.TANK, { DRIFT_PX_S: 0, LURCH_PX_S: 0 });
    const stabber = { type: 'stabber', x: 0, y: 300, markedForRemoval: false };
    const w = tankWorld({ hero: { x: 300, y: 0 }, enemies: [stabber] });
    const t = w.tank(); // he faces the hero (0)
    t.lastActedBar = 1;
    t.isAngry = true;
    t.angerTarget = 'stabber';
    t.angerCooldown = 1e9;
    for (let ms = 4000; ms < 6000; ms += 16) w.frame(t, ms);
    expect(t.turn.to).toBeCloseTo(Math.PI / 3, 5); // toward the stabber below
    t.chargingShot = true; // charged long ago: he fires on this beat 1
    t.chargeStartBeat = 0;
    const shot = w.frame(t, 6000);
    expect(shot.angle).toBeCloseTo(Math.PI / 2, 2); // at the stabber
    stabber.markedForRemoval = true;
    for (let ms = 6016; ms < 8000; ms += 16) w.frame(t, ms);
    w.frame(t, 8000);
    expect(t.turn.to).toBeCloseTo(Math.PI / 6, 5); // none left: back toward the hero
  });
});
