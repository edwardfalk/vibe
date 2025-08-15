// mathUtils.js - Shared Math utilities for Vibe (moved to @vibe/core)

export const max = Math.max;
export const min = Math.min;
export const floor = Math.floor;
export const ceil = Math.ceil;
export const round = Math.round;
export const sin = Math.sin;
export const cos = Math.cos;
export const atan2 = Math.atan2;
export const sqrt = Math.sqrt;
export const PI = Math.PI;
export const TWO_PI = Math.PI * 2;

// --- Seeded PRNG -------------------------------------------------------------
let _rng = null;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Set deterministic random seed used by mathUtils.random().
 * @param {number} seed - 32-bit integer seed.
 */
export function setRandomSeed(seed) {
  _rng = mulberry32(seed >>> 0);
}

/**
 * Clear seeded RNG so mathUtils.random() falls back to Math.random.
 */
export function clearRandomSeed() {
  _rng = null;
}

/**
 * Linear interpolation between two values
 * @param {number} start
 * @param {number} stop
 * @param {number} amt - Amount to interpolate (0.0 to 1.0)
 * @returns {number}
 */
export function lerp(start, stop, amt) {
  return start + (stop - start) * amt;
}

/**
 * Distance between two points
 */
export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return sqrt(dx * dx + dy * dy);
}

/**
 * Normalize angle to [-PI, PI]
 */
export function normalizeAngle(angle) {
  while (angle > PI) angle -= TWO_PI;
  while (angle < -PI) angle += TWO_PI;
  return angle;
}

/**
 * Random number in [min, max)
 * Mirrors p5.random behavior if single arg provided.
 */
export function random(minOrMax = undefined, max = undefined) {
  const randFn = _rng ?? Math.random;
  // No arguments → 0-1
  if (typeof minOrMax === 'undefined') {
    return randFn();
  }

  // Single argument → range [0, arg)
  if (typeof max === 'undefined') {
    return randFn() * minOrMax;
  }

  // Two arguments → range [min, max)
  return randFn() * (max - minOrMax) + minOrMax;
}

export const randomRange = random;
