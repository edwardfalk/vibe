/**
 * BaseEnemyHelpers - Shared color, glow, and draw helpers for BaseEnemy.
 * Extracted from BaseEnemy.js for file-size split (~500 line guideline).
 */

import { GRUNT_COLORS } from './GruntRenderer.js';
import { TANK_COLORS } from './TankRenderer.js';
import { RUSHER_COLORS } from './RusherRenderer.js';

const GLOW_RGB = {
  tank: TANK_COLORS.armour,
  rusher: RUSHER_COLORS.bike,
  stabber: [255, 140, 0],
  grunt: GRUNT_COLORS.glow,
};
const DEFAULT_GLOW_RGB = [50, 200, 50];

/** Glow colour for an enemy type, as [r, g, b]. */
export function getGlowColorForType(type) {
  return GLOW_RGB[type] ?? DEFAULT_GLOW_RGB;
}

/** Get glow size for enemy type. */
export function getGlowSizeForType(type, size) {
  if (type === 'tank') return size * 1.5;
  if (type === 'rusher' || type === 'stabber') return size * 1.2;
  return size * 1.1;
}

export const HEALTH_BAR_HEIGHT_PX = 4;
export const HEALTH_BAR_GAP_PX = 2; // between a health bar and the art below it

/** Draw enemy health bar. */
export function drawEnemyHealthBar(p, enemy) {
  if (enemy.health >= enemy.maxHealth || enemy.markedForRemoval) return;

  const barWidth = enemy.size * 1.2;
  const barHeight = HEALTH_BAR_HEIGHT_PX;
  // An enemy that reaches higher (the grunt's antennae) lifts its bar
  const barY = enemy.y - (enemy.healthBarRise ?? enemy.size * 0.8);

  p.fill(100, 100, 100);
  p.rect(enemy.x - barWidth / 2, barY, barWidth, barHeight);

  const healthPercent = Math.max(
    0,
    Math.min(1, enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 0)
  );
  const healthColor =
    healthPercent > 0.5
      ? p.color(0, 255, 0)
      : healthPercent > 0.25
        ? p.color(255, 255, 0)
        : p.color(255, 0, 0);
  p.fill(healthColor);
  p.rect(enemy.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);

  if (enemy.health <= 0) {
    p.stroke(255, 0, 0);
    p.strokeWeight(3);
    p.line(
      enemy.x - barWidth / 2,
      barY,
      enemy.x + barWidth / 2,
      barY + barHeight
    );
    p.line(
      enemy.x + barWidth / 2,
      barY,
      enemy.x - barWidth / 2,
      barY + barHeight
    );
    p.noStroke();
  }
}
