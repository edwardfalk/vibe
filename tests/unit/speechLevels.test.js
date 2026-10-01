import { describe, it, expect } from 'vitest';
import {
  loudness,
  matchLoudness,
  fitCeiling,
  isUsable,
} from '../../js/audio/speech/levels.js';

const RATE = 22050;
const sine = (amplitude, seconds = 1, freq = 220) =>
  Float32Array.from(
    { length: Math.round(RATE * seconds) },
    (_, i) => amplitude * Math.sin((2 * Math.PI * freq * i) / RATE)
  );
const peakOf = (s) => s.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

describe('speech levels', () => {
  it('measures a sine peaking at -20 dBFS as -23 dB RMS', () => {
    expect(loudness(sine(0.1), RATE)).toBeCloseTo(-23.01, 1);
  });

  it('ignores silence around the line', () => {
    const padded = new Float32Array(RATE * 3);
    padded.set(sine(0.1), RATE);
    // A frame the tone only partly fills still counts, so allow ±0.5 dB;
    // counting the silence as well would read 4.8 dB low
    expect(loudness(padded, RATE)).toBeCloseTo(-23, 0);
  });

  it('calls a silent line -Infinity', () => {
    expect(loudness(new Float32Array(RATE), RATE)).toBe(-Infinity);
  });

  it('matches a line to its target', () => {
    expect(loudness(matchLoudness(sine(0.1), RATE, -20), RATE)).toBeCloseTo(
      -20,
      1
    );
  });

  it('never raises a line by more than 20 dB', () => {
    const quiet = sine(0.001); // -63 dB RMS
    expect(loudness(matchLoudness(quiet, RATE, -20), RATE)).toBeCloseTo(-43, 0);
  });

  it('returns a silent line unchanged', () => {
    const silent = new Float32Array(100);
    expect(matchLoudness(silent, RATE, -20)).toBe(silent);
  });

  it('fits a hot line under the ceiling and says by how much', () => {
    const { samples, reductionDb } = fitCeiling(sine(1), -1);
    expect(peakOf(samples)).toBeLessThanOrEqual(10 ** (-1 / 20));
    expect(reductionDb).toBeCloseTo(1, 1);
  });

  it('leaves a line under the ceiling alone', () => {
    const line = sine(0.5);
    expect(fitCeiling(line, -1)).toEqual({ samples: line, reductionDb: 0 });
  });

  it('knows an empty, silent or broken line when it sees one', () => {
    expect(isUsable(new Float32Array(0))).toBe(false);
    expect(isUsable(new Float32Array(50))).toBe(false);
    expect(isUsable(Float32Array.of(0.1, NaN))).toBe(false);
    expect(isUsable(Float32Array.of(0.1, Infinity))).toBe(false);
    expect(isUsable(sine(0.1, 0.01))).toBe(true);
  });
});
