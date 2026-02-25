import { describe, it, expect } from 'vitest';
import {
  random,
  lerp,
  mapRange,
  constrain,
  dist,
  normalizeAngle,
  randomRange,
  PI,
  TWO_PI,
} from '../../js/mathUtils.js';

describe('random()', () => {
  it('returns 0..1 with no args', () => {
    for (let i = 0; i < 50; i++) {
      const v = random();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('returns 0..max with one arg', () => {
    for (let i = 0; i < 50; i++) {
      const v = random(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it('returns min..max with two args', () => {
    for (let i = 0; i < 50; i++) {
      const v = random(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('picks random element from array', () => {
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) {
      expect(arr).toContain(random(arr));
    }
  });

  it('throws on empty array', () => {
    expect(() => random([])).toThrow();
  });
});

describe('lerp()', () => {
  it('returns a at t=0', () => expect(lerp(10, 20, 0)).toBe(10));
  it('returns b at t=1', () => expect(lerp(10, 20, 1)).toBe(20));
  it('returns midpoint at t=0.5', () => expect(lerp(0, 100, 0.5)).toBe(50));
  it('extrapolates beyond 1', () => expect(lerp(0, 10, 2)).toBe(20));
});

describe('mapRange()', () => {
  it('maps value linearly', () => {
    expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
  });

  it('handles degenerate range (inMin === inMax)', () => {
    expect(mapRange(5, 5, 5, 0, 100)).toBe(0);
  });

  it('extrapolates by default', () => {
    expect(mapRange(20, 0, 10, 0, 100)).toBe(200);
  });

  it('clamps when requested', () => {
    expect(mapRange(20, 0, 10, 0, 100, true)).toBe(100);
    expect(mapRange(-5, 0, 10, 0, 100, true)).toBe(0);
  });
});

describe('constrain()', () => {
  it('clamps below minimum', () => expect(constrain(-5, 0, 10)).toBe(0));
  it('clamps above maximum', () => expect(constrain(15, 0, 10)).toBe(10));
  it('passes through values in range', () =>
    expect(constrain(5, 0, 10)).toBe(5));
});

describe('dist()', () => {
  it('calculates distance between two points', () => {
    expect(dist(0, 0, 3, 4)).toBe(5);
  });

  it('returns 0 for same point', () => {
    expect(dist(7, 7, 7, 7)).toBe(0);
  });
});

describe('normalizeAngle()', () => {
  it('keeps angles in [-PI, PI]', () => {
    expect(normalizeAngle(0)).toBe(0);
  });

  it('wraps angles > PI', () => {
    const result = normalizeAngle(PI + 0.5);
    expect(result).toBeCloseTo(-PI + 0.5, 10);
  });

  it('wraps angles < -PI', () => {
    const result = normalizeAngle(-PI - 0.5);
    expect(result).toBeCloseTo(PI - 0.5, 10);
  });

  it('wraps large positive angles', () => {
    const result = normalizeAngle(TWO_PI + 1);
    expect(result).toBeCloseTo(1, 10);
  });
});

describe('randomRange()', () => {
  it('returns values in specified range', () => {
    for (let i = 0; i < 50; i++) {
      const v = randomRange(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it('treats single arg as max (min=0)', () => {
    for (let i = 0; i < 50; i++) {
      const v = randomRange(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });
});
