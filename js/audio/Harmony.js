/**
 * Harmony.js - The pitch grid, BeatClock's counterpart: BeatClock answers
 * "when", Harmony answers "which note".
 *
 * A note is [degree, octave]: a degree of natural minor on CONFIG.HUM.ROOT,
 * in pure ratios, and an octave counted from the root (1 = the root's own).
 * The root never changes key but drifts slowly, like an old analog synth;
 * hz() includes the drift at the audio time a sound starts, and the sound
 * keeps it. Plain functions with no state: CONFIG.HUM is read live.
 */

import { CONFIG } from '../config.js';

/** The roots on offer, equal-tempered with A1 = 55 Hz */
export const ROOTS = { E: 41.203, F: 43.654, 'F#': 46.249, G: 48.999, A: 55 };

/** Natural minor on the root in pure ratios; 'b5' is the sour note outside it */
export const DEGREES = {
  1: 1,
  2: 9 / 8,
  b3: 6 / 5,
  4: 4 / 3,
  5: 3 / 2,
  b6: 8 / 5,
  b7: 9 / 5,
  b5: 45 / 32,
};

// The drift is two slow sines: [frequency in Hz, share of DRIFT_CENTS]
const DRIFT_SINES = [
  [0.031, 0.6],
  [0.077, 0.4],
];
const CENTS_PER_OCTAVE = 1200;

/** How far the root has drifted at audio time t, in cents */
export function driftCents(t) {
  const sum = DRIFT_SINES.reduce(
    (total, [freq, share]) => total + share * Math.sin(2 * Math.PI * freq * t),
    0
  );
  return CONFIG.HUM.DRIFT_CENTS * sum;
}

/**
 * The frequency of a note at audio time t (seconds), drift included. Throws
 * on an unknown root or degree, so a typo in a preset fails its test
 * instead of playing a wrong note.
 * @param {[string, number]} note [degree, octave]
 * @param {number} [t] the audio time the sound starts
 */
export function hz([degree, octave], t = 0) {
  const root = CONFIG.HUM.ROOT;
  if (!Object.hasOwn(ROOTS, root)) throw new Error(`Unknown root: ${root}`);
  if (!Object.hasOwn(DEGREES, degree)) {
    throw new Error(`Unknown degree: ${degree}`);
  }
  return (
    ROOTS[root] *
    2 ** (octave - 1) *
    DEGREES[degree] *
    2 ** (driftCents(t) / CENTS_PER_OCTAVE)
  );
}
