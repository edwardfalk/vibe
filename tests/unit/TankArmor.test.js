import { describe, it, expect, vi } from 'vitest';
import { Tank } from '../../js/entities/Tank.js';
import { CONFIG } from '../../js/config.js';
import { createMockAudio } from './helpers/enemyMocks.js';

const BROKEN_FILL = [50, 50, 50, 150];

// A tank facing +x (aim 0) whose drawing is recorded: each rect with the fill
// it was drawn in
function recordingTank() {
  const rects = [];
  let fill = null;
  const p = {
    color: () => ({ levels: [0, 0, 0, 255] }),
    TWO_PI: Math.PI * 2,
    push: vi.fn(),
    pop: vi.fn(),
    stroke: vi.fn(),
    noStroke: vi.fn(),
    strokeWeight: vi.fn(),
    fill: (...c) => (fill = c),
    rect: (x, y, w, h) => rects.push({ x, y, w, h, fill }),
  };
  const explosionManager = { addExplosion: vi.fn() };
  const values = { audio: createMockAudio(), explosionManager };
  const context = { get: (key) => values[key] };
  const tank = new Tank(0, 0, 'tank', { context }, p, values.audio);
  return { tank, rects, explosionManager };
}

describe('Tank armour', () => {
  it('a hit from its local left breaks the plate drawn on its left', () => {
    const { tank, rects, explosionManager } = recordingTank();
    // Local left is -y (y points down); the bullet flies from there toward +y
    tank.takeDamage(CONFIG.TANK_ARMOR.SIDE, Math.PI / 2);

    tank.drawArmorPlates(tank.size);
    const broken = rects.filter((r) => r.fill.join() === BROKEN_FILL.join());
    expect(broken).toHaveLength(1);
    expect(broken[0].y + broken[0].h).toBeLessThanOrEqual(0);

    const [, burstY] = explosionManager.addExplosion.mock.calls[0];
    expect(burstY).toBeLessThan(0);
  });

  it('a hit from its local right breaks the plate drawn on its right', () => {
    const { tank, rects } = recordingTank();
    tank.takeDamage(CONFIG.TANK_ARMOR.SIDE, -Math.PI / 2);

    tank.drawArmorPlates(tank.size);
    const broken = rects.filter((r) => r.fill.join() === BROKEN_FILL.join());
    expect(broken).toHaveLength(1);
    expect(broken[0].y).toBeGreaterThanOrEqual(0);
  });
});

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
