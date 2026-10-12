import { describe, it, expect } from 'vitest';
import { KNOBS } from '../../js/dev/TunePanel.js';
import { CONFIG } from '../../js/config.js';

const resolve = (path) => path.split('.').reduce((obj, k) => obj[k], CONFIG);

describe("?tune's sliders", () => {
  it("each can sit on its setting's value: in its range, on its step", () => {
    const off = [];
    for (const [path, key, options] of KNOBS) {
      const value = resolve(path)[key];
      // A slider, as TunePanel draws one: a number with [min, max, step]
      if (typeof value !== 'number' || typeof options?.[0] !== 'number') {
        continue;
      }
      const [min, max, step] = options;
      const steps = (value - min) / step;
      const onStep = Math.abs(steps - Math.round(steps)) < 1e-6;
      if (value < min || value > max || !onStep) off.push(`${path}.${key}`);
    }
    expect(off).toEqual([]);
  });
});
