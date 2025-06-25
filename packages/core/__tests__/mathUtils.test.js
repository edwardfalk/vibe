import { describe, it, expect } from 'vitest';
import { random } from '../src/mathUtils.js';

// Basic deterministic sample size; obviously random so use statistical guarantee
describe('mathUtils.random – array input', () => {
  it('returns an element from the provided array', () => {
    const palette = [1, 2, 3, 4, 5];

    // Run a bunch of times and ensure every result is inside the palette
    for (let i = 0; i < 100; i++) {
      const value = random(palette);
      expect(palette).toContain(value);
    }
  });

  it('can handle single-element arrays', () => {
    const single = [42];
    expect(random(single)).toBe(42);
  });
});
