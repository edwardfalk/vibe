/**
 * fxConfig.js – Centralised tuning values for all explosion FX.
 * Designers can safely tweak these numbers without touching core logic.
 * All values are multipliers or ranges where 1 == neutral.
 */

export const explosionFX = {
  /** Multiplies base particle count for every explosion */
  particleMultiplier: 1.3,

  /** Scales particle size */
  sizeMultiplier: 1.2,

  /** Scales particle lifetime (ms) */
  lifeMultiplier: 1.25,

  /** Random glow intensity range [min, max] */
  glowRange: [0.3, 0.8],
}; 