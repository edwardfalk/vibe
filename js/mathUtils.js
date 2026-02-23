// mathUtils.js - Shared Math function aliases for Vibe

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
 * p5-compatible random(). Supports:
 *   random()          → 0..1
 *   random(max)       → 0..max
 *   random(min, max)  → min..max
 *   random(array)     → random element
 */
export function random(a, b) {
  if (Array.isArray(a)) {
    if (a.length === 0) throw new Error('random(array): array must not be empty');
    return a[floor(Math.random() * a.length)];
  }
  if (a === undefined) return Math.random();
  if (b === undefined) return Math.random() * a;
  return Math.random() * (b - a) + a;
}

/**
 * Linear interpolation between a and b by t (0..1).
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Clamp value between low and high.
 */
export function constrain(value, low, high) {
  return max(low, min(high, value));
}

/**
 * Calculate distance between two points.
 */
export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return sqrt(dx * dx + dy * dy);
}

/**
 * Normalize angle to [-PI, PI].
 */
export function normalizeAngle(angle) {
  while (angle > PI) angle -= TWO_PI;
  while (angle < -PI) angle += TWO_PI;
  return angle;
}

/**
 * Alias for random(min, max). Kept for backward compat.
 */
export function randomRange(a, b) {
  if (b === undefined) {
    b = a;
    a = 0;
  }
  return random(a, b);
}
