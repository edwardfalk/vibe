import { describe, it, expect } from 'vitest';
import {
  tankSide,
  turnStep,
  nextGunRel,
  tankCannon,
  tankMuzzle,
  tankBackPoint,
  CANNON_AT,
  MUZZLE,
  BOMB_AT,
} from '../../js/entities/TankRenderer.js';

const PI = Math.PI;
const STEP = PI / 3;
const DEAD = (3 * PI) / 180;
const ARC = (70 * PI) / 180;

describe("the tank's sides", () => {
  it('sorts an angle from his facing into front, left, right and back', () => {
    expect(tankSide(0)).toBe('front');
    expect(tankSide(PI / 4)).toBe('front'); // the plates' boundaries, as today
    expect(tankSide(PI / 4 + 1e-6)).toBe('right');
    expect(tankSide(-PI / 2)).toBe('left'); // y points down: his left is -y
    expect(tankSide((3 * PI) / 4 - 1e-6)).toBe('right');
    expect(tankSide((3 * PI) / 4)).toBe('back');
    expect(tankSide(PI)).toBe('back');
    expect(tankSide(-PI)).toBe('back');
    expect(tankSide(2 * PI + 0.1)).toBe('front'); // any turn of the circle
  });
});

describe('his turn on the kick', () => {
  it('turns toward the target by at most the step, and not at all inside the dead zone', () => {
    expect(turnStep(0, PI / 6, STEP, DEAD)).toBeCloseTo(PI / 6);
    expect(turnStep(0, PI / 2, STEP, DEAD)).toBeCloseTo(STEP);
    expect(turnStep(0, -PI / 2, STEP, DEAD)).toBeCloseTo(-STEP);
    expect(turnStep(0, DEAD / 2, STEP, DEAD)).toBe(0);
    expect(turnStep(10 * PI, 10 * PI + 0.5, STEP, DEAD)).toBeCloseTo(0.5); // wound-up facings
  });

  it('turns clockwise for a target exactly behind him', () => {
    expect(turnStep(0, PI, STEP, DEAD)).toBeCloseTo(STEP);
    expect(turnStep(0, -PI, STEP, DEAD)).toBeCloseTo(STEP);
  });
});

describe('his gun', () => {
  it('eases toward the target and never leaves its arc', () => {
    expect(nextGunRel(0, 0, 0.6, ARC, 0.25, 0.25)).toBeCloseTo(
      0.6 * (1 - Math.exp(-1))
    );
    // A target outside the arc: it eases toward the arc's edge, not past it
    expect(nextGunRel(0, 0, PI / 2, ARC, 0.25, 0.25)).toBeCloseTo(
      ARC * (1 - Math.exp(-1))
    );
    expect(nextGunRel(0, 0, PI / 2, ARC, 10, 0.25)).toBeCloseTo(ARC);
  });

  it('holds the nearer edge for a hero behind him, and swings across once he crosses', () => {
    const left = nextGunRel(0, 0, -PI + 0.05, ARC, 10, 0.25);
    expect(left).toBeCloseTo(-ARC);
    const after = nextGunRel(left, 0, PI - 0.05, ARC, 0.05, 0.25);
    expect(after).toBeGreaterThan(left); // swinging toward the other edge
    expect(after).toBeLessThan(ARC); // at the aim's rate, not in one jump
  });
});

describe('his cannon, his muzzle and his back', () => {
  it('pivots the cannon in his fists and puts the muzzle along the gun', () => {
    const c = tankCannon(50, 0.4);
    expect(c.pivotX).toBeCloseTo(50 * CANNON_AT);
    expect(c.pivotY).toBe(0);
    expect(c.angle).toBe(0.4);
    expect(c.muzzleX).toBeCloseTo(50 * (CANNON_AT + MUZZLE * Math.cos(0.4)));
    expect(c.muzzleY).toBeCloseTo(50 * MUZZLE * Math.sin(0.4));
  });

  it('places the muzzle in the world from his position and facing', () => {
    const m = tankMuzzle(100, 50, 50, 0, 0);
    expect(m.x).toBeCloseTo(100 + 50 * (CANNON_AT + MUZZLE));
    expect(m.y).toBeCloseTo(50);
    const turned = tankMuzzle(0, 0, 50, PI / 2, -PI / 2); // facing down, gun to his left
    expect(turned.x).toBeCloseTo(50 * MUZZLE);
    expect(turned.y).toBeCloseTo(50 * CANNON_AT);
  });

  it('puts the bomb behind his centre', () => {
    const b = tankBackPoint(100, 50, 50, PI / 2);
    expect(b.x).toBeCloseTo(100);
    expect(b.y).toBeCloseTo(50 - 50 * BOMB_AT);
  });
});
