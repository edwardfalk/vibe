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
  // No arguments → 0-1
  if (typeof minOrMax === 'undefined') {
    return _rng();
  }

  // NEW: If first argument is an array → pick a random element (p5.js compatibility)
  if (Array.isArray(minOrMax)) {
    const arr = minOrMax;
    // Guard against empty array – return undefined to avoid NaN cascades
    if (arr.length === 0) return undefined;
    return arr[floor(_rng() * arr.length)];
  }

  // Single numeric argument → range [0, arg)
  if (typeof max === 'undefined') {
    return _rng() * minOrMax;
  }

  // Two numeric arguments → range [min, max)
  return _rng() * (max - minOrMax) + minOrMax;
}

export const randomRange = random;

// --- Seedable RNG ---------------------------------------------------------
// Mulberry32 PRNG for deterministic runs. Good speed/quality for gameplay/testing.
let _rng = Math.random;
let _rngState = 0;

function mulberry32(seed) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Set deterministic RNG seed. Pass null/undefined to restore Math.random.
 */
export function setRandomSeed(seed) {
  if (seed === null || typeof seed === 'undefined') {
    _rng = Math.random;
    _rngState = 0;
    return;
  }
  const s = seed >>> 0 || 0;
  _rngState = s;
  _rng = mulberry32(s);
}

/**
 * Get current RNG seed/state (0 when using Math.random)
 */
export function getRandomSeed() {
  return _rngState;
}
