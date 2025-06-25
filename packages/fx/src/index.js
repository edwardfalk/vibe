// FX package barrel file
// TODO: export explosion classes, visual effects after migration.

// [BUGFIX: see ticket "Legacy explosionManager triggers wrong VFX colors"]
// Only export current, used VFX systems.

export * from './effects.js';
export { EffectsManager } from './effects.js';
export * from './visualEffects.js';
export * from './explosions/Explosion.js';
export * from './explosions/PlasmaCloud.js';
export * from './explosions/RadioactiveDebris.js';
export * from './explosions/ExplosionManager.js';
export * from './effectsConfig.js';
export { default as EffectsProfiler } from './EffectsProfiler.js';
export { default as ProfilerOverlay } from './ProfilerOverlay.js';

// Expose EffectsProfiler globally for automated Playwright probes
import EffectsProfiler from './EffectsProfiler.js';
if (typeof window !== 'undefined') {
  window.EffectsProfiler = EffectsProfiler;
}
