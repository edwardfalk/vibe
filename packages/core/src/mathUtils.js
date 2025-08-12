// mathUtils.js - Shared Math utilities for Vibe
// Single source of truth for math constants and helpers.

// Constants
export const PI = Math.PI;
export const TWO_PI = Math.PI * 2;

// Direct bindings to Math (explicit for tree-shaking and clarity)
export const max = Math.max;
export const min = Math.min;
export const floor = Math.floor;
export const ceil = Math.ceil;
export const round = Math.round;
export const sin = Math.sin;
export const cos = Math.cos;
export const atan2 = Math.atan2;
export const sqrt = Math.sqrt;

/**
 * Linear interpolation between two values
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
 * Random number in [min, max) with p5-like overloads
 */
export function random(minOrMax = undefined, max = undefined) {
  if (typeof minOrMax === 'undefined') return _rng();
  if (Array.isArray(minOrMax)) {
    const arr = minOrMax;
    if (arr.length === 0) return undefined;
    return arr[floor(_rng() * arr.length)];
  }
  if (typeof max === 'undefined') return _rng() * minOrMax;
  return _rng() * (max - minOrMax) + minOrMax;
}
export const randomRange = random;

// --- Seedable RNG ---------------------------------------------------------
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
export function getRandomSeed() {
  return _rngState;
}
