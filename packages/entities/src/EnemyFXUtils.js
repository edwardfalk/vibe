/* EnemyFXUtils.js - Visual effect helpers shared by enemy classes */

export function addMotionTrail(x, y, color, thickness = 3) {
  if (typeof visualEffectsManager !== 'undefined' && visualEffectsManager) {
    try {
      visualEffectsManager.addMotionTrail(x, y, color, thickness);
    } catch (e) {
      console.log('⚠️ MotionTrail error:', e);
    }
  }
}

// Internal property key to store per-entity timer
const TIMER_KEY = Symbol('trailTimer');

/**
 * Conditionally adds a trail based on elapsed deltaMs.
 * Stores a private timer on the entity instance using a Symbol to avoid name clashes.
 */
export function maybeAddMotionTrail(
  entity,
  deltaMs,
  color,
  intervalMs = 66.67,
  thickness = 3
) {
  entity[TIMER_KEY] = (entity[TIMER_KEY] || 0) + deltaMs;
  if (entity[TIMER_KEY] >= intervalMs) {
    addMotionTrail(entity.x, entity.y, color, thickness);
    entity[TIMER_KEY] = 0;
  }
} 