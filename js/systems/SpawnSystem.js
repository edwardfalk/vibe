/**
 * SpawnSystem.js - Handles enemy spawning logic and timing
 */

import { EnemyFactory } from '../entities/EnemyFactory.js';
import { CONFIG } from '../config.js';
import { createContextAccessor } from '../shared/ContextAccessor.js';
import {
  max,
  min,
  floor,
  ceil,
  round,
  random,
  sin,
  cos,
  atan2,
  sqrt,
} from '../mathUtils.js';

// Waves arrive on the strong beats (1 and 3). A beat-1-only grid rounded
// every interval up to a whole bar, so 6 beats meant 8 and per-level
// speed-ups did nothing until the interval fell to 4.
const SPAWN_BEATS = [1, 3];

// Level at which each enemy type joins the regular mix
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

    this.enemyFactory = new EnemyFactory(context);
    this.getContextValue = createContextAccessor(() => this.context);
  }

  // Update spawning system (beat-aligned)
  update() {
    const gameState = this.getContextValue('gameState');
    if (!gameState || gameState.gameState !== 'playing') return;

    const beatClock = this.getContextValue('beatClock');
    if (!beatClock) return;

    if (!beatClock.isOnBeat(SPAWN_BEATS)) return;

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
      const enemy = this.enemyFactory.createEnemy(
        spawnPos.x,
        spawnPos.y,
        enemyType,
        p
      );
      enemies.push(enemy);
      console.log(
        `👾 Spawned ${enemyType} at level ${level} (${enemies.length}/${this.getMaxEnemiesForLevel(level)} enemies)`
      );
    }
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
    let attempts = 0;
    let spawnX, spawnY;
    do {
      // Spawn OFF-SCREEN at edges, then enemies move toward player
      const margin = 50; // Distance beyond screen edge
      const side = floor(random(4)); // 0=top, 1=right, 2=bottom, 3=left
      switch (side) {
        case 0: // Top
          spawnX = random(0, p.width);
          spawnY = -margin;
          break;
        case 1: // Right
          spawnX = p.width + margin;
          spawnY = random(0, p.height);
          break;
        case 2: // Bottom
          spawnX = random(0, p.width);
          spawnY = p.height + margin;
          break;
        case 3: // Left
          spawnX = -margin;
          spawnY = random(0, p.height);
          break;
      }

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
      break;
    } while (attempts < 50);

    // Fallback if no good position found after many attempts
    if (attempts >= 50) {
      console.warn('⚠️ Could not find good spawn position, using fallback');
      // Spawn far off-screen in random direction
      const angle = random(0, Math.PI * 2);
      spawnX = player.x + cos(angle) * 600;
      spawnY = player.y + sin(angle) * 600;
    }

    console.log(
      `📍 Spawning enemy OFF-SCREEN at (${round(spawnX)}, ${round(spawnY)}) - distance from player: ${round(this.getDistance(spawnX, spawnY, player.x, player.y))}px`
    );

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

  // Force spawn specific enemy type (for testing)
  forceSpawn(enemyType, x, y) {
    const enemies = this.getContextValue('enemies');
    if (!enemies) return null;

    const p = this.getContextValue('p') ?? this.context?.get?.('p');
    const enemy = this.enemyFactory.createEnemy(x, y, enemyType, p);
    if (!enemy) return null;
    enemies.push(enemy);

    console.log(`🎯 Force spawned ${enemyType} at (${x}, ${y})`);
    return enemy;
  }
}
