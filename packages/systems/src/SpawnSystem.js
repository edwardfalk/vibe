/**
 * SpawnSystem - enemy spawning logic (moved to @vibe/systems)
 */
import { floor, min, max, random, sin, cos, sqrt, round } from '@vibe/core/mathUtils.js';
import { EnemyFactory } from '../../../js/EnemyFactory.js';

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
      this.baseSpawnRate - (window.gameState.level - 1) * this.spawnRateDecreasePerLevel
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
    const p = window.player && window.player.p;
    for (let i = 0; i < count; i++) {
      const enemyType = this.getEnemyTypeForLevel(level);
      const spawnPos = this.findSpawnPosition();
      const enemy = this.enemyFactory.createEnemy(spawnPos.x, spawnPos.y, enemyType, p);
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
    if (!player) return { x: random(100, 700), y: random(100, 500) };
    const p = player.p;
    let attempts = 0;
    let spawnX, spawnY;
    do {
      const margin = 50;
      const side = floor(random(4));
      switch (side) {
        case 0:
          spawnX = random(0, p.width);
          spawnY = -margin;
          break;
        case 1:
          spawnX = p.width + margin;
          spawnY = random(0, p.height);
          break;
        case 2:
          spawnX = random(0, p.width);
          spawnY = p.height + margin;
          break;
        case 3:
          spawnX = -margin;
          spawnY = random(0, p.height);
          break;
      }
      const distanceFromPlayer = this.getDistance(spawnX, spawnY, player.x, player.y);
      if (distanceFromPlayer < 400) { attempts++; continue; }
      attempts++;
      if (window.enemies && window.enemies.some(e => this.getDistance(spawnX, spawnY, e.x, e.y) < 200)) continue;
      break;
    } while (attempts < 50);

    if (attempts >= 50) {
      console.warn('⚠️ Could not find good spawn position, using fallback');
      const angle = random(0, Math.PI * 2);
      spawnX = player.x + cos(angle) * 600;
      spawnY = player.y + sin(angle) * 600;
    }
    return { x: spawnX, y: spawnY };
  }

  getDistance(x1, y1, x2, y2) {
    return sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  reset() {
    this.enemySpawnTimer = 0;
    this.enemySpawnRate = this.baseSpawnRate;
  }

  forceSpawn(enemyType, x, y) {
    if (!window.enemies) window.enemies = [];
    const enemy = this.enemyFactory.createEnemy(x, y, enemyType);
    window.enemies.push(enemy);
    console.log(`🎯 Force spawned ${enemyType}`);
    return enemy;
  }
} 