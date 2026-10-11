import { describe, it, expect } from 'vitest';
import { medianHz } from '../../js/audio/speech/pitch.js';

const RATE = 22050;
const cents = (a, b) => 1200 * Math.log2(a / b);

// A buzzy voiced tone: up to 20 harmonics falling off as 1/k, like a voice
function voiced(hz, seconds = 1, rate = RATE) {
  return Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => {
    let sum = 0;
    for (let k = 1; k <= 20 && k * hz < rate / 2; k++) {
      sum += Math.sin((2 * Math.PI * k * hz * i) / rate) / k;
    }
    return 0.1 * sum;
  });
}

describe('medianHz', () => {
  it('reads a voiced tone at its fundamental, from a growl to a squeak', () => {
    for (const hz of [47.3, 91.7, 213.4, 477.1]) {
      expect(Math.abs(cents(medianHz(voiced(hz), RATE), hz))).toBeLessThan(5);
    }
  });

  it('reads at any sample rate', () => {
    const tone = voiced(213.4, 1, 44100);
    expect(Math.abs(cents(medianHz(tone, 44100), 213.4))).toBeLessThan(5);
  });

  it('reads the fundamental when a harmonic is louder', () => {
    const hz = 131.7;
    const weak = voiced(hz).map(
      (x, i) => x + 0.3 * Math.sin((2 * Math.PI * 2 * hz * i) / RATE)
    );
    expect(Math.abs(cents(medianHz(weak, RATE), hz))).toBeLessThan(5);
  });

  it('takes the median: a short stretch at another pitch does not move it', () => {
    const line = new Float32Array(RATE);
    line.set(voiced(151.3, 0.7));
    line.set(voiced(302.9, 0.3), Math.round(RATE * 0.7));
    expect(Math.abs(cents(medianHz(line, RATE), 151.3))).toBeLessThan(5);
  });

  it('skips what rings 40 dB under the line, however long it lasts', () => {
    const line = new Float32Array(RATE);
    line.set(voiced(151.3, 0.4));
    line.set(
      voiced(302.9, 0.6).map((x) => x / 100),
      Math.round(RATE * 0.4)
    );
    expect(Math.abs(cents(medianHz(line, RATE), 151.3))).toBeLessThan(5);
  });

  it('reads the same pitch at any level', () => {
    const tone = voiced(183.1);
    const quiet = tone.map((x) => x / 300);
    expect(medianHz(quiet, RATE)).toBeCloseTo(medianHz(tone, RATE), 6);
  });

  it('reads nothing in silence, noise or a line shorter than a frame', () => {
    let seed = 7;
    const noise = Float32Array.from({ length: RATE }, () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return 0.2 * (seed / 2 ** 30 - 1);
    });
    expect(medianHz(new Float32Array(RATE), RATE)).toBeNull();
    expect(medianHz(noise, RATE)).toBeNull();
    expect(medianHz(voiced(200, 0.02), RATE)).toBeNull();
  });
});
