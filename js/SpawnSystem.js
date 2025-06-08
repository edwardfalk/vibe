/**
 * SpawnSystem.js - Handles enemy spawning logic and timing
 */

import { EnemyFactory } from './EnemyFactory.js';
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
} from './mathUtils.js';

export class SpawnSystem {
  constructor() {
    // Spawning timers
    this.enemySpawnTimer = 0;
    this.enemySpawnRate = 180; // frames - slower, more controlled spawning

    // Spawn rate progression
    this.baseSpawnRate = 180;
    this.minSpawnRate = 60; // Fastest possible spawn rate
    this.spawnRateDecreasePerLevel = 8; // How much faster spawning gets per level

    // Create enemy factory
    this.enemyFactory = new EnemyFactory();
  }

  // Update spawning system
  update() {
    if (!window.gameState || window.gameState.gameState !== 'playing') return;

    // Update spawn timer
    this.enemySpawnTimer++;

    // Calculate current spawn rate based on level
    const currentSpawnRate = max(
      this.minSpawnRate,
      this.baseSpawnRate -
        (window.gameState.level - 1) * this.spawnRateDecreasePerLevel
    );

    // Spawn enemies when timer reaches spawn rate
    if (this.enemySpawnTimer >= currentSpawnRate) {
      this.enemySpawnTimer = 0;

      // Calculate how many enemies to spawn based on level
      const maxEnemies = this.getMaxEnemiesForLevel(window.gameState.level);
      const currentEnemyCount = window.enemies ? window.enemies.length : 0;

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
    if (!window.enemies) window.enemies = [];
    const level = window.gameState ? window.gameState.level : 1;
    const p = window.player && window.player.p;
    for (let i = 0; i < count; i++) {
      const enemyType = this.getEnemyTypeForLevel(level);
      const spawnPos = this.findSpawnPosition();
      const enemy = this.enemyFactory.createEnemy(
        spawnPos.x,
        spawnPos.y,
        enemyType,
        p
      );
      window.enemies.push(enemy);
      console.log(
        `👾 Spawned ${enemyType} at level ${level} (${window.enemies.length}/${this.getMaxEnemiesForLevel(level)} enemies)`
      );
    }
  }

  // Determine enemy type based on level
  getEnemyTypeForLevel(level) {
    const enemyTypes = [];

    // Grunts available from level 1
    enemyTypes.push('grunt');

    // Stabbers available from level 2
    if (level >= 2) {
      enemyTypes.push('stabber');
    }

    // Rushers available from level 3
    if (level >= 3) {
      enemyTypes.push('rusher');
    }

    // Tanks available from level 5
    if (level >= 5) {
      enemyTypes.push('tank');
    }

    // Weight the selection to favor appropriate enemies for level
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
    const player = window.player;
    if (!player) {
      // fallback: use 800x600 as default if no player (should never happen in normal play)
      return { x: random(100, 700), y: random(100, 500) };
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
      if (window.enemies && window.enemies.length > 0) {
        let tooCloseToOtherEnemy = false;
        for (const enemy of window.enemies) {
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
    if (!window.enemies) window.enemies = [];

    const enemy = this.enemyFactory.createEnemy(x, y, enemyType);
    window.enemies.push(enemy);

    console.log(`🎯 Force spawned ${enemyType} at (${x}, ${y})`);
    return enemy;
  }
}
