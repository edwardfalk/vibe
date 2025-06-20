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
      alpha: 180,
      sizeMult: 1.2,
    },
    burst: {
      // Slightly stronger since Stabber is melee focused
      count: 18,
      palette: [
        [255, 140, 0],
        [255, 200, 50],
        [255, 255, 180],
      ],
      gravity: 0.12,
      fade: 0.04,
    },
  },

  grunt: {
    glow: {
      // Soft green that matches eye colour
      color: [50, 200, 50],
      alpha: 90,
      sizeMult: 1.05,
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
      alpha: 110,
      sizeMult: 1.15,
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
      alpha: 130,
      sizeMult: 1.4,
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