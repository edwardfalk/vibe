/**
 * SpawnSystem.js - Handles enemy spawning logic and timing
 */

import { EnemyFactory } from '../entities/EnemyFactory.js';
import { CONFIG } from '../config.js';
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

export class SpawnSystem {
  constructor(context = null) {
    this.context = context;
    // Spawning timers
    this.enemySpawnTimer = 0;
    this.enemySpawnRate = 180; // frames - slower, more controlled spawning

    // Spawn rate progression
    this.baseSpawnRate = 180;
    this.minSpawnRate = 60; // Fastest possible spawn rate
    this.spawnRateDecreasePerLevel = 8; // How much faster spawning gets per level

    this.enemyFactory = new EnemyFactory(context);
  }

  getContextValue(key) {
    if (this.context && typeof this.context.get === 'function') {
      return this.context.get(key);
    }
    return window[key];
  }

  // Update spawning system
  update() {
    const gameState = this.getContextValue('gameState');
    if (!gameState || gameState.gameState !== 'playing') return;

    // Update spawn timer
    this.enemySpawnTimer++;

    // Calculate current spawn rate based on level
    const currentSpawnRate = max(
      this.minSpawnRate,
      this.baseSpawnRate -
        (gameState.level - 1) * this.spawnRateDecreasePerLevel
    );

    // Spawn enemies when timer reaches spawn rate
    if (this.enemySpawnTimer >= currentSpawnRate) {
      this.enemySpawnTimer = 0;

      const enemies = this.getContextValue('enemies');
      const maxEnemies = this.getMaxEnemiesForLevel(gameState.level);
      const currentEnemyCount = enemies ? enemies.length : 0;

      if (currentEnemyCount < maxEnemies) {
        const enemiesToSpawn = min(2, maxEnemies - currentEnemyCount);
        this.spawnEnemies(enemiesToSpawn);
      }
    }
  }

  // Get maximum enemies allowed for current level
  getMaxEnemiesForLevel(level) {
    return min(2 + floor(level / 2), 6); // Start with 2, max 6
  }

  // Spawn enemies based on level progression
  spawnEnemies(count) {
    const gameState = this.getContextValue('gameState');
    const enemies = this.getContextValue('enemies');
    const player = this.getContextValue('player');
    if (!enemies) return;
    const level = gameState ? gameState.level : 1;
    const p = player && player.p;
    for (let i = 0; i < count; i++) {
      const enemyType = this.getEnemyTypeForLevel(level);
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

    if (level <= 2) {
      // Early levels: mostly grunts
      weightedTypes = ['grunt', 'grunt', 'grunt'];
      if (level >= 2) weightedTypes.push('stabber');
    } else if (level <= 4) {
      // Mid levels: mix of grunt, stabber, rusher
      weightedTypes = ['grunt', 'grunt', 'stabber', 'stabber'];
      if (level >= 3) weightedTypes.push('rusher');
    } else {
      // High levels: all enemy types with tanks
      weightedTypes = ['grunt', 'stabber', 'rusher', 'tank'];
    }

    return weightedTypes[floor(random() * weightedTypes.length)];
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
    this.enemySpawnTimer = 0;
    this.enemySpawnRate = this.baseSpawnRate;
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
