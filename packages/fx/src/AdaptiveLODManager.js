// Adaptive LOD Manager
// Adjusts effectsConfig.global.lodMultiplier based on recent FPS average.
import EffectsProfiler from './EffectsProfiler.js';
import { effectsConfig } from './effectsConfig.js';

const LOWER_THRESHOLD = 17; // ms (≈58 FPS)
const UPPER_THRESHOLD = 12; // ms (≈83 FPS)
const ADJUST_STEP = 0.1;
const MIN_MULT = 0.3;
const MAX_MULT = 1.0;
let frameCounter = 0;

function update() {
  frameCounter++;
  if (frameCounter % 60 !== 0) return; // adjust once per second

  const stats = EffectsProfiler.getStats();
  if (!stats || !stats.avg) return;
  const avgMs = parseFloat(stats.avg);

  if (
    avgMs > LOWER_THRESHOLD &&
    effectsConfig.global.lodMultiplier > MIN_MULT
  ) {
    effectsConfig.global.lodMultiplier = Math.max(
      MIN_MULT,
      effectsConfig.global.lodMultiplier - ADJUST_STEP
    );
  } else if (
    avgMs < UPPER_THRESHOLD &&
    effectsConfig.global.lodMultiplier < MAX_MULT
  ) {
    effectsConfig.global.lodMultiplier = Math.min(
      MAX_MULT,
      effectsConfig.global.lodMultiplier + ADJUST_STEP
    );
  }
}

export default { update };
