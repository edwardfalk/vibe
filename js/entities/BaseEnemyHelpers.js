/**
 * BaseEnemyHelpers - Shared color, glow, and draw helpers for BaseEnemy.
 * Extracted from BaseEnemy.js for file-size split (~500 line guideline).
 */

import { CONFIG } from '../config.js';

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

/** Get glow color for enemy type. */
export function getGlowColorForType(type, p, isSpeaking) {
  if (type === 'tank') {
    return isSpeaking ? p.color(150, 100, 255) : p.color(100, 50, 200);
  }
  if (type === 'rusher') {
    return isSpeaking ? p.color(255, 150, 200) : p.color(255, 100, 150);
  }
  if (type === 'stabber') {
    return isSpeaking ? p.color(255, 200, 50) : p.color(255, 140, 0);
  }
  return isSpeaking ? p.color(100, 255, 100) : p.color(50, 200, 50);
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

  if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
    console.log(
      `[ENEMY DEBUG] drawHealthBar: type=${enemy.type} health=${enemy.health} maxHealth=${enemy.maxHealth} at (${enemy.x.toFixed(1)},${enemy.y.toFixed(1)})`
    );
  }

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

/** Draw enemy speech bubble. */
export function drawEnemySpeechBubble(p, enemy) {
  if (!enemy.speechText || enemy.speechTimer <= 0) return;

  p.fill(255, 255, 255);
  p.stroke(0, 0, 0);
  p.strokeWeight(1);
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(10);
  p.text(enemy.speechText, enemy.x, enemy.y - enemy.size - 15);
  p.noStroke();
}
