/**
 * SpawnSystem.js - Handles enemy spawning logic and timing
 */

import { Grunt } from '../entities/Grunt.js';
import { Rusher } from '../entities/Rusher.js';
import { Tank } from '../entities/Tank.js';
import { Stabber } from '../entities/Stabber.js';
import { CONFIG } from '../config.js';
import { createContextAccessor } from '../shared/ContextAccessor.js';
import { max, min, floor, random, sqrt } from '../mathUtils.js';

// Level at which each enemy type joins the regular mix
const ENEMY_CLASSES = {
  grunt: Grunt,
  rusher: Rusher,
  tank: Tank,
  stabber: Stabber,
};

export const ENEMY_INTRO_LEVEL = { stabber: 2, rusher: 3, tank: 5 };

// The next type to be introduced after this level, or null
export function nextNewEnemyType(level) {
  let next = null;
  for (const [type, introLevel] of Object.entries(ENEMY_INTRO_LEVEL)) {
    if (introLevel > level && (!next || introLevel < ENEMY_INTRO_LEVEL[next])) {
      next = type;
    }
  }
  return next;
}

export class SpawnSystem {
  constructor(context = null) {
    this.context = context;
    // Beat-aligned spawning; intervals and caps come from CONFIG.PACING
    this.lastSpawnBeat = -Infinity;
    this.previewed = new Set(); // types already given a one-off taste
    this.getContextValue = createContextAccessor(() => this.context);
  }

  // Update spawning system (beat-aligned)
  update() {
    const gameState = this.getContextValue('gameState');
    if (!gameState || gameState.gameState !== 'playing') return;

    const beatClock = this.getContextValue('beatClock');
    if (!beatClock) return;

    // Waves land on any beat, so the interval counts whole beats (fractions
    // round up). Restricting waves to beat 1 rounded every interval up to a
    // whole bar, which cancelled the per-level speed-up. Spawns are off
    // screen and silent, so the downbeat added nothing audible.
    if (!beatClock.isOnBeat()) return;

    const totalBeats = beatClock.getTotalBeats();
    const pacing = CONFIG.PACING;
    const currentSpawnInterval = max(
      pacing.MIN_SPAWN_INTERVAL_BEATS,
      pacing.SPAWN_INTERVAL_BEATS -
        (gameState.level - 1) * pacing.SPAWN_INTERVAL_DROP_PER_LEVEL
    );

    // Check if enough beats have passed since last spawn
    if (totalBeats - this.lastSpawnBeat < currentSpawnInterval) return;

    this.lastSpawnBeat = totalBeats;

    // A single guest of the next new type, ahead of its level (may exceed
    // the cap by one; it's a taste, not a wave)
    const preview = nextNewEnemyType(gameState.level);
    if (
      pacing.PREVIEW_NEW_ENEMY &&
      preview &&
      !this.previewed.has(preview) &&
      gameState.getProgressToNextLevel() >= pacing.PREVIEW_AT_PROGRESS
    ) {
      this.previewed.add(preview);
      this.spawnEnemies(1, preview);
      return;
    }

    const enemies = this.getContextValue('enemies');
    const maxEnemies = this.getMaxEnemiesForLevel(gameState.level);
    const currentEnemyCount = enemies ? enemies.length : 0;

    if (currentEnemyCount < maxEnemies) {
      const enemiesToSpawn = min(2, maxEnemies - currentEnemyCount);
      this.spawnEnemies(enemiesToSpawn);
    }
  }

  // Get maximum enemies allowed for current level
  getMaxEnemiesForLevel(level) {
    const { BASE_MAX_ENEMIES, MAX_ENEMIES_CAP } = CONFIG.PACING;
    return min(BASE_MAX_ENEMIES + floor(level / 2), MAX_ENEMIES_CAP);
  }

  // Spawn enemies based on level progression
  spawnEnemies(count, forcedType = null) {
    const gameState = this.getContextValue('gameState');
    const enemies = this.getContextValue('enemies');
    const player = this.getContextValue('player');
    if (!enemies) return;
    const level = gameState ? gameState.level : 1;
    const p = player && player.p;
    for (let i = 0; i < count; i++) {
      const enemyType = forcedType ?? this.getEnemyTypeForLevel(level);
      const spawnPos = this.findSpawnPosition();
      enemies.push(this.createEnemy(spawnPos.x, spawnPos.y, enemyType, p));
    }
  }

  createEnemy(x, y, type, p) {
    const config = { context: this.context };
    const audio = this.getContextValue('audio');
    return new ENEMY_CLASSES[type](x, y, type, config, p, audio);
  }

  // Determine enemy type based on level
  getEnemyTypeForLevel(level) {
    let weightedTypes = [];

    if (level < ENEMY_INTRO_LEVEL.rusher) {
      // Early levels: mostly grunts
      weightedTypes = ['grunt', 'grunt', 'grunt'];
      if (level >= ENEMY_INTRO_LEVEL.stabber) weightedTypes.push('stabber');
    } else if (level < ENEMY_INTRO_LEVEL.tank) {
      // Mid levels: mix of grunt, stabber, rusher
      weightedTypes = ['grunt', 'grunt', 'stabber', 'stabber', 'rusher'];
    } else {
      // High levels: all enemy types with tanks
      weightedTypes = ['grunt', 'stabber', 'rusher', 'tank'];
    }

    return random(weightedTypes);
  }

  // Find a good spawn position away from player
  findSpawnPosition() {
    const player = this.getContextValue('player');
    if (!player) {
      const w = CONFIG.GAME_SETTINGS?.WORLD_WIDTH ?? 1150;
      const h = CONFIG.GAME_SETTINGS?.WORLD_HEIGHT ?? 850;
      return { x: random(100, w - 100), y: random(100, h - 100) };
    }
    const p = player.p;
    // The view in world coordinates, and the world's edges
    const camera = this.getContextValue('cameraSystem');
    const topLeft = camera.screenToWorld(0, 0);
    const bottomRight = camera.screenToWorld(p.width, p.height);
    const halfW = CONFIG.GAME_SETTINGS.WORLD_WIDTH / 2;
    const halfH = CONFIG.GAME_SETTINGS.WORLD_HEIGHT / 2;
    const margin = CONFIG.PACING.SPAWN_MARGIN;
    // `margin` past each view edge with that much world beyond it, anywhere
    // along the edge (within the world)
    const alongX = () =>
      random(max(topLeft.x, -halfW), min(bottomRight.x, halfW));
    const alongY = () =>
      random(max(topLeft.y, -halfH), min(bottomRight.y, halfH));
    const top = topLeft.y - margin;
    const right = bottomRight.x + margin;
    const bottom = bottomRight.y + margin;
    const left = topLeft.x - margin;
    const sides = [
      top >= -halfH && (() => [alongX(), top]),
      right <= halfW && (() => [right, alongY()]),
      bottom <= halfH && (() => [alongX(), bottom]),
      left >= -halfW && (() => [left, alongY()]),
    ].filter(Boolean);
    let attempts = 0;
    let found = false;
    let spawnX, spawnY;
    do {
      // Spawn out of view, then enemies move toward player
      [spawnX, spawnY] = random(sides)();

      // Check minimum distance from player (should be far since off-screen)
      const distanceFromPlayer = this.getDistance(
        spawnX,
        spawnY,
        player.x,
        player.y
      );

      // Ensure reasonable distance
      if (distanceFromPlayer < 400) {
        attempts++;
        continue;
      }

      attempts++;

      // Check if too close to existing enemies
      const enemies = this.getContextValue('enemies');
      if (enemies && enemies.length > 0) {
        let tooCloseToOtherEnemy = false;
        for (const enemy of enemies) {
          if (this.getDistance(spawnX, spawnY, enemy.x, enemy.y) < 200) {
            tooCloseToOtherEnemy = true;
            break;
          }
        }
        if (tooCloseToOtherEnemy) continue;
      }

      // If we get here, position is good
      found = true;
      break;
    } while (attempts < 50);

    // No spot kept its distance: the last one is still out of view
    if (!found) {
      console.warn('⚠️ Could not find good spawn position, using fallback');
    }

    return { x: spawnX, y: spawnY };
  }

  // Helper function to calculate distance
  getDistance(x1, y1, x2, y2) {
    return sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  // Reset spawning system
  reset() {
    this.lastSpawnBeat = -Infinity;
    this.previewed.clear();
  }
}
