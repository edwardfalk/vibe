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
    effectWeight: 1.0,
    glow: {
      // Matches knife core orange-white
      color: [255, 140, 0],
      alpha: 180,
      sizeMult: 1.2,
    },
    burst: {
      count: 14,
      palette: [
        [255, 140, 0],
        [255, 200, 50],
        [255, 255, 180],
      ],
      sizeMult: 1.0,
      gravity: 0.12,
      fade: 0.04,
    },
    miniBurst: {
      count: 4,
      palette: [
        [255, 180, 80],
        [255, 220, 120],
      ],
      sizeMult: 0.6,
      gravity: 0.10,
      fade: 0.06,
    },
  },

  grunt: {
    effectWeight: 0.8,
    glow: {
      // Soft green that matches eye colour
      color: [50, 200, 50],
      alpha: 90,
      sizeMult: 1.05,
    },
    burst: {
      count: 14,
      palette: [
        [50, 200, 50],
        [100, 255, 100],
        [30, 150, 30],
      ],
      sizeMult: 1.0,
      gravity: 0.1,
      fade: 0.05,
    },
    miniBurst: {
      count: 4,
      palette: [
        [80, 220, 80],
        [120, 255, 120],
      ],
      sizeMult: 0.7,
      gravity: 0.09,
      fade: 0.06,
    },
  },

  rusher: {
    effectWeight: 0.9,
    glow: {
      // Pinkish red charger
      color: [255, 100, 150],
      alpha: 110,
      sizeMult: 1.15,
    },
    burst: {
      count: 18,
      palette: [
        [255, 80, 120],
        [255, 40, 80],
        [255, 140, 160],
      ],
      sizeMult: 1.2,
      gravity: 0.13,
      fade: 0.045,
    },
    miniBurst: {
      count: 5,
      palette: [
        [255, 120, 160],
        [255, 180, 200],
      ],
      sizeMult: 0.8,
      gravity: 0.11,
      fade: 0.06,
    },
  },

  tank: {
    effectWeight: 1.0,
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
      sizeMult: 1.4,
      gravity: 0.09,
      fade: 0.04,
    },
    miniBurst: {
      count: 6,
      palette: [
        [180, 130, 255],
        [120, 80, 220],
      ],
      sizeMult: 0.9,
      gravity: 0.08,
      fade: 0.05,
    },
  },
};

// Convenience helper ---------------------------------------------------------
export function getEnemyConfig(type = '') {
  return effectsConfig[type] || {};
}
