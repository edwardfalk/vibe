/**
 * BaseEnemyHelpers - Shared color, glow, and draw helpers for BaseEnemy.
 * Extracted from BaseEnemy.js for file-size split (~500 line guideline).
 */

/** Get enemy colors by type. Returns { skinColor, helmetColor, weaponColor, eyeColor }. */
export function getEnemyColors(type, p) {
  if (type === 'rusher') {
    return {
      skinColor: p.color(255, 105, 180),
      helmetColor: p.color(139, 0, 139),
      weaponColor: p.color(255, 20, 147),
      eyeColor: p.color(255, 215, 0),
    };
  }
  if (type === 'tank') {
    return {
      skinColor: p.color(123, 104, 238),
      helmetColor: p.color(72, 61, 139),
      weaponColor: p.color(138, 43, 226),
      eyeColor: p.color(0, 191, 255),
    };
  }
  if (type === 'stabber') {
    return {
      skinColor: p.color(255, 215, 0),
      helmetColor: p.color(218, 165, 32),
      weaponColor: p.color(255, 255, 224),
      eyeColor: p.color(255, 69, 0),
    };
  }
  return {
    skinColor: p.color(50, 205, 50),
    helmetColor: p.color(34, 139, 34),
    weaponColor: p.color(0, 255, 127),
    eyeColor: p.color(255, 20, 147),
  };
}

const GLOW_RGB = {
  tank: [100, 50, 200],
  rusher: [255, 100, 150],
  stabber: [255, 140, 0],
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

/** Draw enemy health bar. */
export function drawEnemyHealthBar(p, enemy) {
  if (enemy.health >= enemy.maxHealth || enemy.markedForRemoval) return;

  const barWidth = enemy.size * 1.2;
  const barHeight = 4;
  const barY = enemy.y - enemy.size * 0.8;

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
