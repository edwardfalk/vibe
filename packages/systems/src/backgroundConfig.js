/**
 * backgroundConfig.js - Centralized configuration for all background visual elements
 */

// Simple configuration object that can be modified at runtime
export const BACKGROUND_CONFIG = {
  // Cosmic aurora gradient settings
  aurora: {
    enabled: true,
    gradientSteps: 120, // Higher = smoother gradient
    timeVariation: {
      speed: 0.003, // How fast colors shift over time
      intensity: 2, // How much colors vary
      redMult: 0.2,
      greenMult: 0.1,
      blueMult: 0.3
    },
    colors: {
      // Deep space colors (RGB values)
      deep: { r: 2, g: 0, b: 8 },
      darkPurple: { r: 12, g: 8, b: 25 },
      cosmicBlue: { r: 8, g: 15, b: 35 },
      darkFinish: { r: 15, g: 5, b: 20 }
    }
  },

  // Parallax layer settings
  parallax: {
    enabled: true,
    layers: {
      distantStars: {
        enabled: true,
        count: 50,
        size: { min: 1, max: 3 },
        brightness: { min: 0.3, max: 1 },
        twinkleSpeed: { min: 0.01, max: 0.03 },
        scrollSpeed: 0.1
      },
      nebulaClouds: {
        enabled: true,
        count: 8,
        size: { min: 100, max: 300 },
        alpha: { min: 0.05, max: 0.15 },
        driftSpeed: { min: 0.1, max: 0.3 },
        colors: {
          rRange: { min: 40, max: 80 },
          gRange: { min: 20, max: 60 },
          bRange: { min: 60, max: 120 }
        },
        scrollSpeed: 0.3
      },
      mediumStars: {
        enabled: true,
        count: 30,
        size: { min: 2, max: 5 },
        brightness: { min: 0.5, max: 1 },
        colors: ['white', 'blue', 'yellow', 'orange'],
        scrollSpeed: 0.5
      },
      closeDebris: {
        enabled: true,
        count: 15,
        size: { min: 2, max: 4 },
        alpha: { min: 150, max: 255 },
        flickerSpeed: { min: 0.05, max: 0.15 },
        scrollSpeed: 0.8
      }
    }
  },

  // Subtle space elements
  spaceElements: {
    enabled: true,
    nebulaClouds: {
      enabled: true,
      timeSpeed: 0.01,
      colorVariation: {
        amplitude: { sin: 20, cos: 30 },
        frequency: { sin: 1, cos: 1.3 }
      },
      positions: [
        { x: 0.2, y: 0.3, w: 200, h: 150, alpha: 20 },
        { x: 0.7, y: 0.6, w: 180, h: 120, alpha: 15 }
      ]
    },
    shootingStars: {
      enabled: true,
      count: 3,
      speed: 3,
      trailLength: 5,
      spawnChance: 0.002, // Per frame chance
      colors: {
        core: [255, 255, 255],
        trail: [255, 215, 0] // Gold trail
      }
    }
  },

  // Interactive background effects (respond to player/enemies)
  interactive: {
    enabled: true,
    cosmicWormhole: {
      enabled: true,
      intensity: { min: 0.3, max: 1.0 },
      rippleRadius: { min: 50, max: 120 },
      particleCount: 50,
      particleSpeed: { min: 0.002, max: 0.008 }
    },
    backgroundWaves: {
      enabled: true,
      waveCount: 3,
      yPosition: 0.7, // 70% down the screen
      amplitude: { primary: 15, secondary: 10 },
      frequency: { primary: 0.008, secondary: 0.004 },
      timeSpeed: { primary: 0.3, secondary: 0.2 },
      strokeWeight: 1,
      alpha: { base: 15, perWave: 5 }
    }
  },

  // Health and game state based effects
  gameState: {
    enabled: true,
    healthEffects: {
      enabled: true,
      lowHealthThreshold: 0.3,
      highHealthThreshold: 0.9,
      dangerPulse: {
        speed: 0.2,
        alpha: 15
      },
      healingGlow: {
        alpha: 8,
        color: [0, 150, 255]
      }
    },
    scoreEffects: {
      enabled: true,
      cosmicEnergy: {
        maxScore: 1000, // Score where effect maxes out
        particleCount: 5,
        size: { min: 10, max: 30 },
        alpha: { min: 5, max: 15 },
        color: [255, 215, 0] // Gold
      }
    },
    killStreakEffects: {
      enabled: true,
      threshold: 5, // Kill streak to activate
      maxStreak: 10, // Where effect maxes out
      borderPulse: {
        speed: 0.3,
        alpha: 100,
        color: [255, 100, 255] // Magenta
      },
      strokeWeight: 6
    }
  },

  // Psychedelic effects (cosmic time driven)
  psychedelic: {
    enabled: true,
    cosmicTime: {
      speed: 0.002, // How fast cosmic time advances
      colorShiftSpeed: 0.003
    },
    effects: {
      cosmicWormhole: {
        enabled: true,
        intensity: 0.8
      },
      backgroundWaves: {
        enabled: true,
        subtlety: 0.5 // 0 = original intensity, 1 = very subtle
      },
      cosmicBlast: {
        enabled: true,
        triggerOnKill: true
      }
    }
  }
};

// Preset configurations for different visual styles
export const BACKGROUND_PRESETS = {
  minimal: {
    name: "Minimal Space",
    description: "Clean space background with minimal distractions",
    overrides: {
      'parallax.layers.distantStars.count': 25,
      'parallax.layers.nebulaClouds.count': 4,
      'parallax.layers.mediumStars.count': 15,
      'parallax.layers.closeDebris.enabled': false,
      'spaceElements.shootingStars.enabled': false,
      'interactive.enabled': false,
      'psychedelic.enabled': false
    }
  },
  
  classic: {
    name: "Classic Space",
    description: "Original space background before psychedelic effects",
    overrides: {
      'interactive.enabled': false,
      'psychedelic.enabled': false,
      'spaceElements.shootingStars.enabled': true
    }
  },
  
  psychedelic: {
    name: "Psychedelic Space",
    description: "Full trippy space experience",
    overrides: {
      'psychedelic.enabled': true,
      'interactive.enabled': true,
      'spaceElements.shootingStars.count': 5
    }
  },
  
  performance: {
    name: "Performance Mode",
    description: "Optimized for slower systems",
    overrides: {
      'aurora.gradientSteps': 60,
      'parallax.layers.distantStars.count': 30,
      'parallax.layers.nebulaClouds.count': 5,
      'parallax.layers.mediumStars.count': 20,
      'parallax.layers.closeDebris.count': 10,
      'spaceElements.shootingStars.count': 2,
      'interactive.cosmicWormhole.particleCount': 25,
      'psychedelic.enabled': false
    }
  }
};

// Helper function to apply a preset
export function applyBackgroundPreset(config, presetName) {
  const preset = BACKGROUND_PRESETS[presetName];
  if (!preset) {
    console.warn(`🌌 Unknown background preset: ${presetName}`);
    return config;
  }
  
  const newConfig = JSON.parse(JSON.stringify(config)); // Deep clone
  
  for (const [path, value] of Object.entries(preset.overrides)) {
    setNestedProperty(newConfig, path, value);
  }
  
  console.log(`🌌 Applied background preset: ${preset.name}`);
  return newConfig;
}

// Helper function to set nested properties by dot notation
function setNestedProperty(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
}