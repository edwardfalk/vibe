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
 * Normalize angle to [-PI, PI]
 * @param {number} angle
 * @returns {number}
 */
export function normalizeAngle(angle) {
  while (angle > PI) angle -= TWO_PI;
  while (angle < -PI) angle += TWO_PI;
  return angle;
}
