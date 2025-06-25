// Core package barrel file
// TODO: Re-export GameLoop, GameState, BeatClock after migration.

export * from './mathUtils.js';
export * from './config.js';
export { BeatClock } from './BeatClock.js';
export { GameState } from './GameState.js';
export { Audio } from './Audio.js';
export { MusicManager } from './audio/MusicManager.js';
export { explosionFX } from './fxConfig.js';
export { explosionPalette } from './fxPalette.js';
export { SOUND } from './audio/SoundIds.js';
