/**
 * ExplosionConfig - Particle, shockwave, and color config by explosion type.
 * Extracted from Explosion.js for file-size split (~500 line guideline).
 */

import { random } from '../../mathUtils.js';

/** @typedef {{ particleCount: number, flashIntensity: number, maxTimer: number, hasShockwave: boolean, maxShockwaveRadius: number, hasArmorFragments: boolean, hasEnergyRings: boolean, hasEnergyDischarge: boolean }} ExplosionTypeConfig */
/** @typedef {{ vxRange: [number, number], vyRange: [number, number], sizeRange: [number, number], lifeRange: [number, number] }} ParticleParams */

const DEFAULT_PARTICLE_PARAMS = {
  vxRange: [-2, 2],
  vyRange: [-2, 2],
  sizeRange: [2, 5],
  lifeRange: [15, 25],
};

const PARTICLE_PARAMS_BY_TYPE = {
  'tank-plasma': {
    vxRange: [-2, 2],
    vyRange: [-2, 2],
    sizeRange: [4, 10],
    lifeRange: [50, 70],
  },
  'rusher-explosion': {
    vxRange: [-8, 8],
    vyRange: [-8, 8],
    sizeRange: [6, 18],
    lifeRange: [40, 80],
  },
  'grunt-bullet-kill': {
    vxRange: [-3, 3],
    vyRange: [-3, 3],
    sizeRange: [2, 5],
    lifeRange: [20, 35],
  },
  'grunt-plasma-kill': {
    vxRange: [-3, 3],
    vyRange: [-3, 3],
    sizeRange: [3, 6],
    lifeRange: [30, 45],
  },
  'rusher-bullet-kill': {
    vxRange: [-4, 4],
    vyRange: [-4, 4],
    sizeRange: [3, 8],
    lifeRange: [20, 35],
  },
  'rusher-plasma-kill': {
    vxRange: [-4, 4],
    vyRange: [-4, 4],
    sizeRange: [3, 8],
    lifeRange: [25, 40],
  },
  'tank-bullet-kill': {
    vxRange: [-3, 3],
    vyRange: [-3, 3],
    sizeRange: [4, 10],
    lifeRange: [40, 60],
  },
  'tank-plasma-kill': {
    vxRange: [-4, 4],
    vyRange: [-4, 4],
    sizeRange: [5, 12],
    lifeRange: [45, 70],
  },
  'stabber-bullet-kill': {
    vxRange: [-3, 3],
    vyRange: [-3, 3],
    sizeRange: [2, 6],
    lifeRange: [25, 40],
  },
  'stabber-plasma-kill': {
    vxRange: [-3, 3],
    vyRange: [-3, 3],
    sizeRange: [3, 7],
    lifeRange: [30, 45],
  },
  'grunt-death': {
    vxRange: [-3, 3],
    vyRange: [-3, 3],
    sizeRange: [3, 6],
    lifeRange: [20, 35],
  },
  'stabber-death': {
    vxRange: [-3, 3],
    vyRange: [-3, 3],
    sizeRange: [2, 6],
    lifeRange: [25, 40],
  },
  'tank-death': {
    vxRange: [-3, 3],
    vyRange: [-3, 3],
    sizeRange: [4, 8],
    lifeRange: [35, 50],
  },
  enemy: {
    vxRange: [-3, 3],
    vyRange: [-3, 3],
    sizeRange: [3, 6],
    lifeRange: [20, 35],
  },
  'armor-break': {
    vxRange: [-3, 3],
    vyRange: [-3, 3],
    sizeRange: [3, 7],
    lifeRange: [25, 40],
  },
};

const COLOR_PALETTES = {
  'tank-plasma': [
    [138, 43, 226],
    [64, 224, 208],
    [255, 20, 147],
    [255, 255, 255],
    [0, 191, 255],
    [255, 215, 0],
  ],
  'rusher-explosion': [
    [255, 20, 147],
    [255, 69, 0],
    [255, 215, 0],
    [255, 255, 255],
    [255, 140, 0],
    [255, 182, 193],
    [255, 255, 0],
  ],
  'grunt-death': [
    [50, 205, 50],
    [0, 255, 127],
    [34, 139, 34],
    [255, 255, 255],
    [144, 238, 144],
    [0, 255, 0],
  ],
  'stabber-death': [
    [255, 215, 0],
    [255, 255, 0],
    [255, 140, 0],
    [255, 255, 255],
    [218, 165, 32],
    [255, 248, 220],
  ],
  'tank-death': [
    [138, 43, 226],
    [123, 104, 238],
    [72, 61, 139],
    [255, 255, 255],
    [0, 191, 255],
    [147, 112, 219],
  ],
  default: [
    [255, 69, 0],
    [255, 140, 0],
    [255, 215, 0],
    [255, 255, 255],
    [255, 20, 147],
    [138, 43, 226],
  ],
};

/**
 * Get explosion type config (particle count, flash, timer, shockwave, special effects).
 * @param {string} type
 * @returns {ExplosionTypeConfig}
 */
export function getExplosionConfig(type) {
  const hasShockwave =
    type === 'rusher-explosion' ||
    type === 'tank-plasma' ||
    type === 'tank-plasma-kill';
  const maxShockwaveRadius = type === 'rusher-explosion' ? 120 : 60;

  let particleCount = 3;
  let flashIntensity = 0;
  let maxTimer = 30;
  const hasArmorFragments = type === 'tank-bullet-kill';
  const hasEnergyRings = type === 'tank-plasma-kill';
  const hasEnergyDischarge =
    type.includes('tank') && type.includes('plasma-kill');

  if (type === 'tank-plasma') {
    particleCount = 15;
    flashIntensity = 0.3;
    maxTimer = 50;
  } else if (type === 'rusher-explosion') {
    particleCount = 25;
    flashIntensity = 0.4;
    maxTimer = 50;
  } else if (type === 'grunt-bullet-kill') {
    particleCount = 3;
  } else if (type === 'grunt-plasma-kill') {
    particleCount = 4;
  } else if (type === 'rusher-bullet-kill') {
    particleCount = 6;
  } else if (type === 'rusher-plasma-kill') {
    particleCount = 8;
    flashIntensity = 0.1;
  } else if (type === 'tank-bullet-kill') {
    particleCount = 18;
    flashIntensity = 0.4;
  } else if (type === 'tank-plasma-kill') {
    particleCount = 20;
    flashIntensity = 0.5;
  } else if (type === 'stabber-bullet-kill') {
    particleCount = 4;
  } else if (type === 'stabber-plasma-kill') {
    particleCount = 6;
  } else if (type === 'enemy') {
    particleCount = 4;
  } else if (type === 'armor-break') {
    particleCount = 8;
    flashIntensity = 0.2;
  }

  if (type.includes('plasma-kill')) {
    maxTimer = 25;
  } else if (type.includes('bullet-kill')) {
    maxTimer = 20;
  }

  return {
    particleCount,
    flashIntensity,
    maxTimer,
    hasShockwave,
    maxShockwaveRadius,
    hasArmorFragments,
    hasEnergyRings,
    hasEnergyDischarge,
  };
}

/**
 * Get particle velocity/size/life params for explosion type.
 * @param {string} type
 * @returns {ParticleParams}
 */
export function getParticleParams(type) {
  return PARTICLE_PARAMS_BY_TYPE[type] || DEFAULT_PARTICLE_PARAMS;
}

/**
 * Get random particle color for explosion type.
 * @param {string} type
 * @returns {[number, number, number]}
 */
export function getParticleColor(type) {
  if (type.includes('bullet-kill') || type.includes('plasma-kill')) {
    if (type.includes('grunt')) return getParticleColor('grunt-death');
    if (type.includes('stabber')) return getParticleColor('stabber-death');
    if (type.includes('tank')) return getParticleColor('tank-death');
    if (type.includes('rusher')) return getParticleColor('rusher-explosion');
  }

  const palette = COLOR_PALETTES[type] || COLOR_PALETTES.default;
  return random(palette);
}
