/**
 * SpawnSystem - enemy spawning logic (moved to @vibe/systems)
 */
import { floor, min, max, random, sin, cos, PI, TWO_PI } from '@vibe/core/mathUtils.js';
import { EnemyFactory } from '../../entities/src/EnemyFactory.js';

export class SpawnSystem {
  constructor() {
    this.enemySpawnTimer = 0;
    this.enemySpawnRate = 180;

    this.baseSpawnRate = 180;
    this.minSpawnRate = 60;
    this.spawnRateDecreasePerLevel = 8;

    this.enemyFactory = new EnemyFactory();
  }

  update() {
    if (!window.gameState || window.gameState.gameState !== 'playing') return;
    this.enemySpawnTimer++;
    const currentSpawnRate = max(
      this.minSpawnRate,
      this.baseSpawnRate -
        (window.gameState.level - 1) * this.spawnRateDecreasePerLevel
    );
    if (this.enemySpawnTimer >= currentSpawnRate) {
      this.enemySpawnTimer = 0;
      const maxEnemies = this.getMaxEnemiesForLevel(window.gameState.level);
      const currentEnemyCount = window.enemies ? window.enemies.length : 0;
      if (currentEnemyCount < maxEnemies) {
        const enemiesToSpawn = min(2, maxEnemies - currentEnemyCount);
        this.spawnEnemies(enemiesToSpawn);
      }
    }
  }

  getMaxEnemiesForLevel(level) {
    return min(2 + floor(level / 2), 6);
  }

  spawnEnemies(count) {
    if (!window.enemies) window.enemies = [];
    const level = window.gameState ? window.gameState.level : 1;
    const p = window.p || (window.player && window.player.p);
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
      console.log(`👾 Spawned ${enemyType} at level ${level}`);
    }
  }

  getEnemyTypeForLevel(level) {
    const weightedTypes = [];
    if (level <= 2) {
      weightedTypes.push('grunt', 'grunt', 'grunt');
      if (level >= 2) weightedTypes.push('stabber');
    } else if (level <= 4) {
      weightedTypes.push('grunt', 'grunt', 'stabber', 'stabber');
      if (level >= 3) weightedTypes.push('rusher');
    } else {
      weightedTypes.push('grunt', 'stabber', 'rusher', 'tank');
    }
    return weightedTypes[floor(random() * weightedTypes.length)];
  }

  findSpawnPosition() {
    const player = window.player;
    if (!player) {
      return { x: random(100, 700), y: random(100, 500) };
    }

    const MIN_ENEMY_DISTANCE_SQ = 100 * 100; // 100px should be enough
    let attempts = 0;
    let spawnX, spawnY;

    do {
      const angle = random() * TWO_PI;
      const radius = random(500, 800); // Slightly smaller ring
      spawnX = player.x + cos(angle) * radius;
      spawnY = player.y + sin(angle) * radius;

      // Use the spatial hash grid for a fast check of the local area
      const neighbors =
        window.collisionSystem?.grid?.neighbors(spawnX, spawnY) || [];

      if (neighbors.length === 0) {
        return { x: spawnX, y: spawnY }; // Area is empty, this is a valid spot
      }

      const isTooClose = neighbors.some(
        (e) =>
          this.getDistanceSq(spawnX, spawnY, e.x, e.y) < MIN_ENEMY_DISTANCE_SQ
      );

      if (!isTooClose) {
        return { x: spawnX, y: spawnY }; // Valid position found
      }

      attempts++;
    } while (attempts < 100); // Increased attempts

    // Fallback: Spiral search for a free spot
    console.warn(
      `⚠️ Could not find random spawn position after 100 attempts. Starting spiral search.`
    );
    let spiralAngle = random() * TWO_PI;
    let spiralRadius = 500;
    for (let i = 0; i < 200; i++) {
      // Spiral for max 200 steps
      spiralAngle += 0.2; // Radian increment
      spiralRadius += 2; // Move outwards
      spawnX = player.x + cos(spiralAngle) * spiralRadius;
      spawnY = player.y + sin(spiralAngle) * spiralRadius;

      // Clamp to screen bounds
      spawnX = max(0, min(800, spawnX));
      spawnY = max(0, min(600, spawnY));

      const neighbors =
        window.collisionSystem?.grid?.neighbors(spawnX, spawnY) || [];
      if (neighbors.length === 0) {
        console.log(
          `✅ Found valid spawn position via spiral search at attempt ${i + 1}`
        );
        return { x: spawnX, y: spawnY };
      }
    }

    console.error(
      '💥 Catastrophic spawn failure: Could not find any valid spawn position after spiral search.'
    );
    // Clamp last resort to screen bounds
    return { x: max(0, min(800, player.x)), y: max(0, min(600, player.y)) };
  }

  getDistanceSq(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  reset() {
    this.enemySpawnTimer = 0;
    this.enemySpawnRate = this.baseSpawnRate;
  }

  forceSpawn(enemyType, x, y) {
    console.log(
      `[SpawnSystem] forceSpawn called: type=${enemyType}, x=${x}, y=${y}`
    );
    if (!window.enemies) window.enemies = [];
    const p = window.p || (window.player && window.player.p);
    const audio = window.audio;
    const enemy = this.enemyFactory.createEnemy(x, y, enemyType, p, audio);
    if (enemy) {
      window.enemies.push(enemy);
      console.log(`🎯 Force spawned ${enemyType}`);
    }
    return enemy;
  }
}
