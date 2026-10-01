import { describe, it, expect } from 'vitest';
import {
  STAGE_PARAMS,
  createReverbImpulse,
  driveCurve,
  renderChain,
  stageDefaults,
  stepCurve,
  validateChain,
} from '../../js/audio/speech/effects.js';
import { mulberry32 } from '../../js/mathUtils.js';

// Just enough of an AudioContext to build an impulse buffer in Node
const fakeContext = (sampleRate) => ({
  sampleRate,
  createBuffer: (channels, length) => {
    const data = Array.from(
      { length: channels },
      () => new Float32Array(length)
    );
    return { getChannelData: (c) => data[c] };
  },
});

describe('speech effects', () => {
  it('gives every stage parameter a range with its default inside', () => {
    for (const [type, params] of Object.entries(STAGE_PARAMS)) {
      for (const [min, max, step, value] of Object.values(params)) {
        expect(min).toBeLessThan(max);
        expect(step).toBeGreaterThan(0);
        expect(value).toBeGreaterThanOrEqual(min);
        expect(value).toBeLessThanOrEqual(max);
      }
      expect(Object.keys(stageDefaults(type))).toEqual(Object.keys(params));
    }
  });

  it('accepts every stage it knows and refuses anything else', () => {
    expect(() =>
      validateChain(Object.keys(STAGE_PARAMS).map((type) => ({ type })))
    ).not.toThrow();
    expect(() => validateChain([{ type: 'flange' }])).toThrow(
      'Unknown effect stage "flange"'
    );
    expect(() => validateChain([null])).toThrow('Unknown effect stage');
  });

  it('crushes to exactly the asked number of levels, full scale', () => {
    for (const levels of [2, 15, 16]) {
      const curve = stepCurve(levels);
      expect(new Set(curve).size).toBe(levels);
      expect(Math.min(...curve)).toBeCloseTo(-1, 6);
      expect(Math.max(...curve)).toBeCloseTo(1, 6);
    }
  });

  it('drives as the auditions did: tanh(amount·x), scaled to full scale', () => {
    const curve = driveCurve(5);
    const x = (i) => (i / (curve.length - 1)) * 2 - 1;
    for (const i of [0, 1000, 2662, curve.length - 1]) {
      expect(curve[i]).toBeCloseTo(Math.tanh(5 * x(i)) / Math.tanh(5), 6);
    }
  });

  it('makes the same reverb impulse from the same seed', () => {
    const a = createReverbImpulse(fakeContext(100), 1, 3.2, mulberry32(7));
    const b = createReverbImpulse(fakeContext(100), 1, 3.2, mulberry32(7));
    expect(a.getChannelData(0)).toEqual(b.getChannelData(0));
    expect(a.getChannelData(1)).toEqual(b.getChannelData(1));
  });

  it('passes a line through an empty chain untouched', async () => {
    const line = Float32Array.of(0.1, -0.2, 0.3);
    expect(await renderChain(line, 22050, [])).toBe(line);
  });
});
