/**
 * SpawnSystem - enemy spawning logic (moved to @vibe/systems)
 */
import { floor, min, max, random, sin, cos, PI } from '@vibe/core/mathUtils.js';
import { EnemyFactory } from '@vibe/entities/EnemyFactory.js';

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
      const currentEnemyCount = window.gameState.enemies
        ? window.gameState.enemies.length
        : 0;
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
    if (!window.gameState) return;
    const gs = window.gameState;
    if (!gs.enemies) gs.enemies = [];
    const level = gs.level;
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
      gs.enemies.push(enemy);
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
    const margin = 50;
    const MIN_PLAYER_DISTANCE = 400;
    const MIN_PLAYER_DISTANCE_SQ = MIN_PLAYER_DISTANCE * MIN_PLAYER_DISTANCE;
    const MIN_ENEMY_DISTANCE = 200;
    const MIN_ENEMY_DISTANCE_SQ = MIN_ENEMY_DISTANCE * MIN_ENEMY_DISTANCE;

    let attempts = 0;
    let spawnX, spawnY;
    let worldX = 0,
      worldY = 0;
    do {
      // Pick a random side of the screen to spawn from (0–3)
      switch (floor(random(4))) {
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
        default:
          spawnX = -margin;
          spawnY = random(0, p.height);
      }

      // Convert screen-space edge position to world-space around current camera
      if (
        window.cameraSystem &&
        typeof window.cameraSystem.screenToWorld === 'function'
      ) {
        const world = window.cameraSystem.screenToWorld(spawnX, spawnY);
        worldX = world.x;
        worldY = world.y;
      } else if (p) {
        // Fallback: center-based conversion
        worldX = spawnX - p.width / 2;
        worldY = spawnY - p.height / 2;
      } else {
        // Last resort: treat as already-world
        worldX = spawnX;
        worldY = spawnY;
      }

      // Reject positions too close to the player (world-space)
      const distToPlayerSq = this.getDistanceSq(
        worldX,
        worldY,
        player.x,
        player.y
      );
      if (distToPlayerSq < MIN_PLAYER_DISTANCE_SQ) {
        attempts++;
        continue;
      }

      // Reject positions too close to existing enemies
      if (
        window.gameState?.enemies &&
        window.gameState.enemies.some(
          (e) =>
            this.getDistanceSq(worldX, worldY, e.x, e.y) < MIN_ENEMY_DISTANCE_SQ
        )
      ) {
        attempts++;
        continue;
      }
      const angle = random(0, Math.PI * 2);
      break;
    } while (attempts < 50);

    if (attempts >= 50) {
      console.warn('⚠️ Could not find good spawn position, using fallback');
      const angle = random(0, PI * 2);
      worldX = player.x + cos(angle) * 600;
      worldY = player.y + sin(angle) * 600;
    }
    return { x: worldX, y: worldY };
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
    if (!window.gameState) return null;
    const gs = window.gameState;
    if (!gs.enemies) gs.enemies = [];

    // If coordinates aren't provided, fall back to regular spawn placement
    if (typeof x !== 'number' || typeof y !== 'number') {
      if (typeof this.findSpawnPosition === 'function') {
        const pos = this.findSpawnPosition();
        x = pos.x;
        y = pos.y;
      } else {
        x = 0;
        y = 0;
      }
    }

    const enemy = this.enemyFactory.createEnemy(x, y, enemyType);
    gs.enemies.push(enemy);
    console.log(
      `👾 Force-spawned ${enemyType} at (${x.toFixed(1)}, ${y.toFixed(1)})`
    );
    return enemy;
  }
}
