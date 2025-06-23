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
    return Math.random();
  }

  // NEW: If first argument is an array → pick a random element (p5.js compatibility)
  if (Array.isArray(minOrMax)) {
    const arr = minOrMax;
    // Guard against empty array – return undefined to avoid NaN cascades
    if (arr.length === 0) return undefined;
    return arr[floor(Math.random() * arr.length)];
  }

  // Single numeric argument → range [0, arg)
  if (typeof max === 'undefined') {
    return Math.random() * minOrMax;
  }

  // Two numeric arguments → range [min, max)
  return Math.random() * (max - minOrMax) + minOrMax;
}

export const randomRange = random;
