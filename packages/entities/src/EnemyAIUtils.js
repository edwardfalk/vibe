/* EnemyAIUtils.js - Shared helpers for enemy AI logic (avoid duplication)
 * All math functions are imported from @vibe/core per project standards.
 */
import { atan2, random, PI } from '@vibe/core';

// Squared distance between two points
export function distanceSq(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

// Minimal angular difference between two angles (radians)
export function angleDiff(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, PI * 2 - diff);
}

/**
 * Determine if a ranged enemy should withhold firing to avoid friendly fire.
 * Rough port of the previous Grunt implementation but reusable for all ranged enemies.
 *
 * @param {object} self - The enemy instance evaluating the shot (expects x, y, aimAngle).
 * @param {number} aimAngle - Absolute aim angle in radians.
 * @param {object} grid - The spatial hash grid for collision detection.
 * @param {number} range - Max distance to consider (default 400).
 * @param {number} tolerance - Angular tolerance in radians (default 15°).
 * @param {number} avoidProb - Probability [0-1] to avoid when a friend is in line (default 0.7).
 * @returns {boolean} true if the shot should be avoided.
 */
export function shouldAvoidFriendlyFire(
  self,
  aimAngle,
  grid,
  range = 400,
  tolerance = PI / 12,
  avoidProb = 0.7
) {
  if (!grid || aimAngle === undefined || aimAngle === null) return false;

  const { x, y } = self;

  // Query neighbors in a cone shape for efficiency
  const potentialObstacles = grid.coneQuery(x, y, aimAngle, range, tolerance);

  for (const enemy of potentialObstacles) {
    if (enemy === self) continue;

    // A nearby enemy is in the line of fire, decide whether to abort shot
    return random() < avoidProb;
  }

  return false;
}
