// mathUtils.js - Shared Math function aliases for Vibe

export const max = Math.max;
export const min = Math.min;
export const floor = Math.floor;
export const ceil = Math.ceil;
export const round = Math.round;
export const random = Math.random;
export const sin = Math.sin;
export const cos = Math.cos;
export const atan2 = Math.atan2;
export const sqrt = Math.sqrt;
export const PI = Math.PI;
export const TWO_PI = Math.PI * 2;

/**
 * Linear interpolation between two values
 * @param {number} start - Starting value
 * @param {number} stop - Ending value  
 * @param {number} amt - Amount to interpolate (0.0 to 1.0)
 * @returns {number}
 */
export function lerp(start, stop, amt) {
  return start + (stop - start) * amt;
}

/**
 * Calculate distance between two points
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return sqrt(dx * dx + dy * dy);
}

/**
 * Normalize angle to [-PI, PI]
 * @param {number} angle
 * @returns {number}
 */
export function normalizeAngle(angle) {
  while (angle > PI) angle -= TWO_PI;
  while (angle < -PI) angle += TWO_PI;
  return angle;
}

/**
 * Generate a random number between min (inclusive) and max (exclusive).
 * If only one argument is provided, the range is [0, min).
 * Mirrors the behavior of p5.js random().
 * @param {number} min
 * @param {number} [max]
 * @returns {number}
 */
export function randomRange(min, max) {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return random() * (max - min) + min;
}
