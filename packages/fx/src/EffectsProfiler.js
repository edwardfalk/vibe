// Lightweight frame-time + effect counter profiler for Vibe
// ---------------------------------------------------------
// Design goals:
// • Zero dependencies – pure JS so it can run inside browser or tests.
// • Minimal allocations after init – use typed arrays for frame ring-buffer.
// • Guarded by a runtime flag so production builds pay ~0 cost.
//
// Usage pattern from GameLoop:
//   import EffectsProfiler from '@vibe/fx/EffectsProfiler.js';
//   EffectsProfiler.startFrame();   // at very top of p.draw()
//   ... game rendering/update ...
//   EffectsProfiler.endFrame();     // just before exiting p.draw()
//   // ProfilerOverlay internally calls EffectsProfiler.getStats()
//

const MAX_FRAMES = 120; // rolling window – two seconds @60fps
const frameTimes = new Float32Array(MAX_FRAMES);
let framePtr = 0;
let frameStart = 0;

// Simple counter map { 'stabber-explosion': 23, 'grunt-glow': 15 }
const counters = Object.create(null);

// Runtime toggle (updated by GameLoop based on CONFIG)
let enabled = true;

// Environment check for performance API
if (
  typeof performance === 'undefined' ||
  typeof performance.now !== 'function'
) {
  // Provide a fallback for performance.now
  globalThis.performance = {
    now: () => Date.now(),
  };
}

function startFrame() {
  if (!enabled) return;
  frameStart = performance.now();
}

function endFrame() {
  if (!enabled) return;
  const dt = performance.now() - frameStart;
  frameTimes[framePtr % MAX_FRAMES] = dt;
  framePtr++;
}

function registerEffect(category, payload = {}) {
  if (!enabled) return;
  const key = payload.enemy ? `${payload.enemy}-${category}` : category;
  counters[key] = (counters[key] || 0) + 1;
}

function getStats() {
  if (!enabled) return {};
  const sampleCount = Math.min(framePtr, MAX_FRAMES);
  let sum = 0,
    min = Infinity,
    max = 0;
  for (let i = 0; i < sampleCount; i++) {
    const v = frameTimes[i];
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const avg = sampleCount ? sum / sampleCount : 0;
  const fps = avg ? 1000 / avg : 0;
  return {
    fps: fps.toFixed(1),
    avg: avg.toFixed(2),
    min: min.toFixed(2),
    max: max.toFixed(2),
    counters: { ...counters },
  };
}

function reset() {
  framePtr = 0;
  // Fix: clear all keys in counters
  for (const key in counters) {
    if (Object.prototype.hasOwnProperty.call(counters, key)) {
      delete counters[key];
    }
  }
}

function setEnabled(v) {
  enabled = !!v;
}

export default {
  startFrame,
  endFrame,
  registerEffect,
  getStats,
  reset,
  setEnabled,
};
