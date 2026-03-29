/**
 * CollisionSystem.js - Handles all collision detection between bullets, enemies, and player
 */

import { dist } from '../mathUtils.js';
import { CONFIG } from '../config.js';
import { Bullet } from '../entities/bullet.js';
import { EnemyDeathHandler } from './combat/EnemyDeathHandler.js';
import {
  beginMetricsFrame,
  buildPerformanceSnapshot,
  createEmptyFrameMetrics,
  createEmptyRollingMetrics,
  finalizeMetricsFrame,
} from './collision/CollisionMetrics.js';
import {
  buildEnemySpatialGrid,
  queryNearbyEnemyIndices,
} from './collision/CollisionSpatialGrid.js';
import { DAMAGE_RESULT } from '../shared/DamageResult.js';
import { handleDamageResult } from '../shared/DamageResultHandler.js';
import {
  handleContactCollisions,
  handleRusherExplosionCollision,
  handleStabberAttackCollision,
} from './combat/PlayerContactHandlers.js';
import { createContextAccessor } from '../shared/ContextAccessor.js';
import { applyKillFeedback } from './combat/KillFeedback.js';

// Single-pass compaction: O(n) instead of O(n²) from repeated splice
function compactArray(arr) {
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    if (!arr[read]._remove) arr[write++] = arr[read];
  }
  arr.length = write;
}

export class CollisionSystem {
  constructor(context = null) {
    // Collision detection settings
    this.friendlyFireEnabled = true;
    this.frameMetrics = createEmptyFrameMetrics();
    this.rollingMetrics = createEmptyRollingMetrics();
    this.context = context;
    this.getContextValue = createContextAccessor(() => this.context);
    this.enemyDeathHandler = new EnemyDeathHandler(context || window);
  }

  setContext(context) {
    this.context = context;
    this.enemyDeathHandler.setContext(context || window);
  }

  // Main collision detection function
  checkBulletCollisions() {
    this.beginCollisionMetricsFrame();
    const enemies = this.getContextValue('enemies');
    const enemySpatialGrid = buildEnemySpatialGrid(enemies);
    this.checkPlayerBulletsVsEnemies(enemySpatialGrid);
    this.checkEnemyBulletsVsPlayer();
    this.checkEnemyBulletsVsEnemies(enemySpatialGrid);

    // Compact bullet arrays after all collision checks (mark-and-compact)
    const playerBullets = this.getContextValue('playerBullets');
    const enemyBullets = this.getContextValue('enemyBullets');
    if (playerBullets) compactArray(playerBullets);
    if (enemyBullets) compactArray(enemyBullets);

    this.finalizeCollisionMetricsFrame();
  }

  beginCollisionMetricsFrame() {
    const enemies = this.getContextValue('enemies');
    const playerBullets = this.getContextValue('playerBullets');
    const enemyBullets = this.getContextValue('enemyBullets');
    this.frameMetrics = beginMetricsFrame({
      enemiesLength: enemies?.length || 0,
      playerBulletsLength: playerBullets?.length || 0,
      enemyBulletsLength: enemyBullets?.length || 0,
    });
  }

  finalizeCollisionMetricsFrame() {
    finalizeMetricsFrame(this.rollingMetrics, this.frameMetrics);
  }

  getPerformanceSnapshot() {
    return buildPerformanceSnapshot(this.rollingMetrics, this.frameMetrics);
  }

  checkContactCollisions() {
    const playerDied = handleContactCollisions({
      player: this.getContextValue('player'),
      enemies: this.getContextValue('enemies'),
      audio: this.getContextValue('audio'),
      gameState: this.getContextValue('gameState'),
      activeBombs: this.getContextValue('activeBombs'),
    });
    if (playerDied) {
      return;
    }
  }

  // Player bullets vs enemies
  checkPlayerBulletsVsEnemies(enemySpatialGrid = null) {
    const playerBullets = this.getContextValue('playerBullets');
    const enemies = this.getContextValue('enemies');
    if (!playerBullets || !enemies) return;

    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const bullet = playerBullets[i];
      if (bullet._remove) continue;
      const candidateEnemyIndices = enemySpatialGrid
        ? queryNearbyEnemyIndices(enemySpatialGrid, bullet)
        : (() => {
            const indices = [];
            for (let idx = enemies.length - 1; idx >= 0; idx--)
              indices.push(idx);
            return indices;
          })();
      this.frameMetrics.playerBulletCandidates += candidateEnemyIndices.length;

      for (let k = 0; k < candidateEnemyIndices.length; k++) {
        const j = candidateEnemyIndices[k];
        const enemy = enemies[j];
        if (!enemy) continue;

        // Log positions and health before collision check
        if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
          console.log(
            `[DEBUG] Checking bullet vs enemy: bullet=(${bullet.x.toFixed(1)},${bullet.y.toFixed(1)}) enemy=(${enemy.x.toFixed(1)},${enemy.y.toFixed(1)}) enemyHealth=${enemy.health}`
          );
        }

        this.frameMetrics.playerBulletChecks++;
        if (this.resolveBulletEnemyHit(bullet, i, enemy)) {
          this.frameMetrics.playerBulletHits++;
          break;
        }

        if (enemy.type === 'grunt' && bullet.owner === 'player') {
          const distance = dist(bullet.x, bullet.y, enemy.x, enemy.y);
          if (distance < 50 && CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(
              `[DEBUG] Bullet near grunt: bullet=(${bullet.x.toFixed(1)},${bullet.y.toFixed(1)}) enemy=(${enemy.x.toFixed(1)},${enemy.y.toFixed(1)}) dist=${distance.toFixed(1)} health=${enemy.health} markedForRemoval=${enemy.markedForRemoval}`
            );
          }
        }
      }
    }
  }

  resolveBulletEnemyHit(bullet, bulletIndex, enemy) {
    const explosionManager = this.getContextValue('explosionManager');
    const audio = this.getContextValue('audio');
    const gameState = this.getContextValue('gameState');
    const floatingText = this.getContextValue('floatingText');
    const beatClock = this.getContextValue('beatClock');
    const visualEffectsManager = this.getContextValue('visualEffectsManager');
    const cameraSystem = this.getContextValue('cameraSystem');
    const playerBullets = this.getContextValue('playerBullets');
    if (!bullet.checkCollision(enemy)) return false;

    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      console.log(`🎯 Bullet hit ${enemy.type} enemy! Health: ${enemy.health}`);
    }

    // Store enemy type for logging
    const enemyType = enemy.type;
    const wasExploding = enemy.exploding;

    // Damage enemy (pass bullet angle for knockback)
    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      console.log(
        `[DEBUG] Calling takeDamage on enemy: type=${enemyType}, health=${enemy.health}, bullet.damage=${bullet.damage}, bullet.angle=${bullet.angle}`
      );
    }
    const rawResult = enemy.takeDamage(bullet.damage, bullet.angle);
    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      console.log(
        `[DEBUG] takeDamage result: ${rawResult}, enemyHealthAfter=${enemy.health}`
      );
    }

    const damageResult = handleDamageResult(rawResult, enemy, {
      explosionManager,
      audio,
      gameState,
      onDeath: (e) => this.handleEnemyDeath(e, enemyType, bullet.x, bullet.y),
      killFeedback: {
        applyKillFeedback,
        beatClock,
        floatingText,
        visualEffectsManager,
        cameraSystem,
        getHitStopFrames: () =>
          this.context?.get?.('hitStopFrames') ?? window.hitStopFrames ?? 0,
        setHitStopFrames: (value) => {
          if (this.context && typeof this.context.set === 'function') {
            this.context.set('hitStopFrames', value);
            return;
          }
          if (typeof window !== 'undefined') {
            window.hitStopFrames = value;
          }
        },
      },
      hitX: bullet.x,
      hitY: bullet.y,
      floatingText,
      bulletDamage: bullet.damage,
    });

    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      if (damageResult === DAMAGE_RESULT.EXPLODING) {
        console.log(
          `💥 RUSHER SHOT! Starting explosion sequence! Was already exploding: ${wasExploding}`
        );
      } else if (damageResult === DAMAGE_RESULT.DIED) {
        console.log(`💀 ${enemyType} killed by bullet!`);
      } else {
        console.log(`🎯 ${enemyType} damaged, health now: ${enemy.health}`);
      }
    }

    // Remove bullet
    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      console.log(`[DEBUG] Removing bullet at index ${bulletIndex} after hit`);
    }
    Bullet.release(bullet);
    bullet._remove = true;
    return true;
  }

  // Enemy bullets vs player
  checkEnemyBulletsVsPlayer() {
    const enemyBullets = this.getContextValue('enemyBullets');
    const player = this.getContextValue('player');
    const audio = this.getContextValue('audio');
    const gameState = this.getContextValue('gameState');
    if (!enemyBullets || !player) return;

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const bullet = enemyBullets[i];
      if (bullet._remove) continue;

      // Check player collision
      if (bullet.checkCollision(player)) {
        if (audio) {
          audio.playPlayerHit();
        }

        if (gameState) {
          gameState.resetKillStreak(); // Reset kill streak on taking damage
        }

        if (
          player.takeDamage(
            bullet.damage,
            `${bullet.owner || bullet.type}-bullet`
          )
        ) {
          if (gameState) {
            gameState.setGameState('gameOver');
          }
          if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(
              `💀 PLAYER DIED! Game state changed to gameOver.`
            );
          }
        }
        Bullet.release(bullet);
        bullet._remove = true;
        break; // Exit loop since bullet hit player
      }
    }
  }

  // Enemy bullets vs enemies (friendly fire)
  checkEnemyBulletsVsEnemies(enemySpatialGrid = null) {
    const enemyBullets = this.getContextValue('enemyBullets');
    const enemies = this.getContextValue('enemies');
    if (!this.friendlyFireEnabled || !enemyBullets || !enemies) return;

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const bullet = enemyBullets[i];
      if (bullet._remove) continue;
      const candidateEnemyIndices = enemySpatialGrid
        ? queryNearbyEnemyIndices(enemySpatialGrid, bullet)
        : (() => {
            const indices = [];
            for (let idx = enemies.length - 1; idx >= 0; idx--)
              indices.push(idx);
            return indices;
          })();
      this.frameMetrics.enemyBulletCandidates += candidateEnemyIndices.length;

      for (let k = 0; k < candidateEnemyIndices.length; k++) {
        const j = candidateEnemyIndices[k];
        const enemy = enemies[j];
        if (!enemy) continue;
        if (bullet.ownerId === enemy.id) continue;

        // Check if bullet hits enemy (but not the one that fired it)
        this.frameMetrics.enemyBulletChecks++;
        if (bullet.checkCollision(enemy)) {
          this.frameMetrics.enemyBulletHits++;
          if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(
              `🔥 FRIENDLY FIRE! ${bullet.type || 'Enemy'} bullet hit ${enemy.type} enemy!`
            );
          }

          // Handle different bullet types
          if (bullet.type === 'tankEnergy' || bullet.owner === 'enemy-tank') {
            this.handleTankEnergyBallHit(bullet, enemy, i, j);
          } else {
            this.handleRegularEnemyBulletHit(bullet, enemy, i, j);
          }
          break; // Exit inner loop since bullet hit an enemy
        }
      }
    }
  }

  // Handle tank energy ball hitting enemy
  handleTankEnergyBallHit(bullet, enemy, bulletIndex, enemyIndex) {
    const audio = this.getContextValue('audio');
    const gameState = this.getContextValue('gameState');
    const enemyBullets = this.getContextValue('enemyBullets');
    if (audio) {
      audio.playTankEnergyBall(bullet.x, bullet.y);
    }

    // Calculate energy cost based on enemy's remaining health
    const energyCost =
      enemy.maxHealth > 0 ? (enemy.health / enemy.maxHealth) * 30 : 0;

    // Kill the enemy and create explosion
    this.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);

    if (audio) {
      audio.playEnemyFrying(enemy.x, enemy.y);
      audio.playExplosion(enemy.x, enemy.y);
    }

    enemy.markedForRemoval = true;

    if (gameState) {
      gameState.addKill();

      // Energy ball kills get bonus points
      let points = 12;
      if (gameState.killStreak >= 5) points *= 2;
      if (gameState.killStreak >= 10) points *= 1.5;

      gameState.addScore(points);
    }

    // Reduce bullet energy proportionally; non-energy bullets get removed immediately
    const energy = bullet.energy;
    if (typeof energy === 'number' && energy > 0) {
      bullet.energy = energy - energyCost;
      if (bullet.energy <= 0) {
        Bullet.release(bullet);
        bullet._remove = true;
      }
    } else {
      Bullet.release(bullet);
      bullet._remove = true;
    }
  }

  // Handle regular enemy bullet hitting enemy
  handleRegularEnemyBulletHit(bullet, enemy, bulletIndex, enemyIndex) {
    const explosionManager = this.getContextValue('explosionManager');
    const audio = this.getContextValue('audio');
    const gameState = this.getContextValue('gameState');
    const enemyBullets = this.getContextValue('enemyBullets');
    // Determine bullet source type for tank anger tracking
    let bulletSource = 'unknown';
    if (bullet.type === 'grunt' || bullet.owner === 'enemy-grunt') {
      bulletSource = 'grunt';
    } else if (bullet.type === 'stabber' || bullet.owner === 'enemy-stabber') {
      bulletSource = 'stabber';
    } else if (bullet.type === 'tankEnergy' || bullet.owner === 'enemy-tank') {
      bulletSource = 'tank';
    }

    const damageResult = handleDamageResult(
      enemy.takeDamage(bullet.damage, bullet.angle, bulletSource),
      enemy,
      {
        explosionManager,
        audio,
        gameState,
        onDeath: (e) => this.handleEnemyDeath(e, e.type, e.x, e.y),
        deathAudio: 'playExplosion',
        scorePoints: 8,
        hitX: bullet.x,
        hitY: bullet.y,
      }
    );

    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      if (damageResult === DAMAGE_RESULT.EXPLODING) {
        console.log(`💥 FRIENDLY FIRE caused rusher to explode!`);
      } else if (damageResult === DAMAGE_RESULT.DIED) {
        console.log(
          `💀 ${enemy.type} killed by friendly fire from ${bulletSource}!`
        );
      } else {
        console.log(
          `🎯 Friendly fire damaged ${enemy.type}, health now: ${enemy.health}`
        );
      }
    }

    // Remove bullet after hit
    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      console.log(
        `➖ Removing enemy bullet (hit enemy): ${bullet.owner} hit ${enemy.type} - Remaining: ${enemyBullets.length - 1}`
      );
    }
    Bullet.release(bullet);
    bullet._remove = true;
  }

  // Handle enemy death effects
  handleEnemyDeath(enemy, enemyType, x, y) {
    this.enemyDeathHandler.handleEnemyDeath(enemy, enemyType, x, y);
  }

  // Handle stabber attack collision
  handleStabberAttack(attack, stabber) {
    handleStabberAttackCollision({
      attack,
      stabber,
      player: this.getContextValue('player'),
      audio: this.getContextValue('audio'),
      gameState: this.getContextValue('gameState'),
      cameraSystem: this.getContextValue('cameraSystem'),
      explosionManager: this.getContextValue('explosionManager'),
    });
  }

  // Handle rusher explosion collision
  handleRusherExplosion(explosion, rusherEnemy) {
    handleRusherExplosionCollision({
      explosion,
      rusherEnemy,
      player: this.getContextValue('player'),
      audio: this.getContextValue('audio'),
      gameState: this.getContextValue('gameState'),
      cameraSystem: this.getContextValue('cameraSystem'),
      explosionManager: this.getContextValue('explosionManager'),
    });
  }
}
