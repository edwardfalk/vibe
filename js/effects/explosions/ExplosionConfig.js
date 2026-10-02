/**
 * ExplosionConfig - Particle, shockwave, and color config by explosion type.
 * Extracted from Explosion.js for file-size split (~500 line guideline).
 */

import { random } from '../../mathUtils.js';

/** @typedef {{ particleCount: number, maxTimer: number, hasShockwave: boolean }} ExplosionTypeConfig */
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
  default: [
    [255, 69, 0],
    [255, 140, 0],
    [255, 215, 0],
    [255, 255, 255],
    [255, 20, 147],
    [138, 43, 226],
  ],
};

/** Particle count, lifetime (frames) and shockwave for each type */
const TYPE_CONFIG = {
  'tank-plasma': { particleCount: 15, maxTimer: 50, hasShockwave: true },
  'armor-break': { particleCount: 8, maxTimer: 30, hasShockwave: false },
};
const DEFAULT_TYPE_CONFIG = {
  particleCount: 3,
  maxTimer: 30,
  hasShockwave: false,
};

/**
 * Get explosion type config (particle count, timer, shockwave).
 * @param {string} type
 * @returns {ExplosionTypeConfig}
 */
export function getExplosionConfig(type) {
  return TYPE_CONFIG[type] || DEFAULT_TYPE_CONFIG;
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
  return random(COLOR_PALETTES[type] || COLOR_PALETTES.default);
}
