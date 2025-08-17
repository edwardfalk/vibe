// Central configuration for all visual effects intensity, particle counts, and
// colors. The goal is to keep tuning in one location and make effects
// correlate with each enemy's signature colour palette.
//
// NOTE: This file intentionally has **zero** runtime dependencies so it can be
// imported anywhere (core, entities, fx) without risk of circular-imports.

export const effectsConfig = {
  // Global, cross-enemy settings
  global: {
    // Dynamically reduced when Adaptive LOD is enabled. 1 = 100 % quality.
    lodMultiplier: 1.0,

    // Toggle for heavy debug logs / profiler. Switched in GameLoop.
    debugEffects: true,
  },

  // Per-enemy overrides ------------------------------------------------------
  // Values not supplied fall back to the sensible defaults inside helpers.
  stabber: {
    glow: {
      // Matches knife core orange-white
      color: [255, 140, 0],
      alpha: 60, // Even more reduced stabber glow
      sizeMult: 1.0, // No size multiplication for stabber
    },
    burst: {
      // Increased slightly so stabber attacks have a noticeable burst
      count: 20, // Restored closer to original intensity
      palette: [
        [255, 140, 0],
        [255, 200, 50],
        [255, 255, 180],
      ],
      gravity: 0.14, // Increased to make particles fall faster
      // Slow the fade a touch so particles linger during the dash
      fade: 0.045,
    },
  },

  grunt: {
    glow: {
      // Soft green that matches eye colour
      color: [50, 200, 50],
      alpha: 65, // Further reduced grunt glow
      sizeMult: 1.0, // No size multiplier for grunt
    },
    burst: {
      count: 12,
      palette: [
        [50, 200, 50],
        [100, 255, 100],
        [30, 150, 30],
      ],
      gravity: 0.1,
      fade: 0.05,
    },
  },

  rusher: {
    glow: {
      // Pinkish red charger
      color: [255, 100, 150],
      alpha: 55, // Even more reduced rusher glow
      sizeMult: 1.0, // No size multiplication for rusher
    },
    burst: {
      count: 25,
      palette: [
        [255, 80, 120],
        [255, 40, 80],
        [255, 140, 160],
      ],
      gravity: 0.13,
      fade: 0.045,
    },
  },

  tank: {
    glow: {
      color: [100, 50, 200],
      alpha: 70, // Further reduced for subtler tank glow
      sizeMult: 1.1, // Smaller glow size
    },
    burst: {
      count: 20,
      palette: [
        [150, 100, 255],
        [100, 50, 200],
        [200, 150, 255],
      ],
      gravity: 0.09,
      fade: 0.04,
    },
  },
};

// Convenience helper ---------------------------------------------------------
export function getEnemyConfig(type = '') {
  return effectsConfig[type] || {};
}
