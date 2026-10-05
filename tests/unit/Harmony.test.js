import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ROOTS, DEGREES, driftCents, hz } from '../../js/audio/Harmony.js';
import { CONFIG } from '../../js/config.js';

const original = structuredClone(CONFIG.HUM);

describe('Harmony, the pitch grid', () => {
  beforeEach(() => {
    CONFIG.HUM = structuredClone(original);
    CONFIG.HUM.DRIFT_CENTS = 0;
  });
  afterEach(() => {
    CONFIG.HUM = structuredClone(original);
  });

  it('ships a root it knows', () => {
    // A typo pasted from ?tune's JSON fails here, not as a silent hum
    expect(Object.keys(ROOTS)).toContain(original.ROOT);
  });

  it('plays every degree in pure ratios, at two octaves, on two roots', () => {
    // Octave 1 on A (55 Hz); other roots scale it
    const onA = {
      1: 55,
      2: 61.875,
      b3: 66,
      4: 73.3333,
      5: 82.5,
      b6: 88,
      b7: 99,
      b5: 77.34375,
    };
    expect(Object.keys(DEGREES).sort()).toEqual(Object.keys(onA).sort());
    for (const root of ['A', 'F#']) {
      CONFIG.HUM.ROOT = root;
      const scale = ROOTS[root] / 55;
      for (const [degree, hzOnA] of Object.entries(onA)) {
        expect(hz([degree, 1])).toBeCloseTo(hzOnA * scale, 3);
        expect(hz([degree, 3])).toBeCloseTo(hzOnA * scale * 4, 3);
      }
    }
  });

  it('counts the octave from the root: on F#, b3 in octave 5 is the A above F#5', () => {
    CONFIG.HUM.ROOT = 'F#';
    expect(hz(['b3', 5])).toBeCloseTo(887.98, 2);
    expect(hz(['1', 1])).toBeCloseTo(46.249, 3);
  });

  it('drifts every note by driftCents at audio time t', () => {
    CONFIG.HUM.DRIFT_CENTS = 9;
    expect(driftCents(0)).toBe(0);
    // 9 × (0.6 sin(2π·0.031·5) + 0.4 sin(2π·0.077·5))
    expect(driftCents(5)).toBeCloseTo(6.847, 3);
    for (const t of [5, 37.3, 120]) {
      const drifted = hz(['5', 2], t) / hz(['5', 2], 0);
      expect(drifted).toBeCloseTo(2 ** (driftCents(t) / 1200), 9);
      expect(Math.abs(driftCents(t))).toBeLessThanOrEqual(9);
    }
  });

  it('throws on an unknown degree or root', () => {
    expect(() => hz(['3', 1])).toThrow(/degree/);
    expect(() => hz(['toString', 1])).toThrow(/degree/);
    CONFIG.HUM.ROOT = 'H';
    expect(() => hz(['1', 1])).toThrow(/root/);
  });
});
