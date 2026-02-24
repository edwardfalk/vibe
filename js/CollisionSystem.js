/**
 * CollisionSystem.js - Handles all collision detection between bullets, enemies, and player
 */

import { round, sqrt, atan2, cos, sin, dist } from './mathUtils.js';
import { CONFIG } from './config.js';
import { Bullet } from './bullet.js';
import { EnemyDeathHandler } from './systems/combat/EnemyDeathHandler.js';
import {
  beginMetricsFrame,
  buildPerformanceSnapshot,
  createEmptyFrameMetrics,
  createEmptyRollingMetrics,
  finalizeMetricsFrame,
} from './systems/collision/CollisionMetrics.js';
import {
  buildEnemySpatialGrid,
  queryNearbyEnemyIndices,
} from './systems/collision/CollisionSpatialGrid.js';
import {
  DAMAGE_RESULT,
  normalizeDamageResult,
} from './shared/contracts/DamageResult.js';
import { tryPlaceTankBomb } from './systems/BombSystem.js';

// Default countdown for tank time bombs (in frames)
const TIME_BOMB_FRAMES = 180; // 3 seconds at 60fps

export class CollisionSystem {
  constructor(context = null) {
    // Collision detection settings
    this.friendlyFireEnabled = true;
    this.frameMetrics = createEmptyFrameMetrics();
    this.rollingMetrics = createEmptyRollingMetrics();
    this.context = context;
    this.enemyDeathHandler = new EnemyDeathHandler(context || window);
  }

  setContext(context) {
    this.context = context;
    this.enemyDeathHandler.setContext(context || window);
  }

  getContextValue(key) {
    if (this.context && typeof this.context.get === 'function') {
      return this.context.get(key);
    }
    if (this.context && key in this.context) {
      return this.context[key];
    }
    return window[key];
  }

  // Main collision detection function
  checkBulletCollisions() {
    this.beginCollisionMetricsFrame();
    const enemies = this.getContextValue('enemies');
    const enemySpatialGrid = buildEnemySpatialGrid(enemies);
    this.checkPlayerBulletsVsEnemies(enemySpatialGrid);
    this.checkEnemyBulletsVsPlayer();
    this.checkEnemyBulletsVsEnemies(enemySpatialGrid);
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

  // ADD: Check contact collisions between enemies and player
  checkContactCollisions() {
    const player = this.getContextValue('player');
    const enemies = this.getContextValue('enemies');
    const audio = this.getContextValue('audio');
    const gameState = this.getContextValue('gameState');
    const activeBombs = this.getContextValue('activeBombs');
    if (!player || !enemies) return;

    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];

      // Check if enemy is touching player
      if (enemy.checkCollision(player)) {
        let damage = 0;
        let shouldPlaceBomb = false;

        // Different contact damage rules based on enemy type
        switch (enemy.type) {
          case 'grunt':
            damage = 1; // Standard contact damage for grunts
            break;
          case 'tank':
            // Tanks place bombs instead of dealing direct damage
            shouldPlaceBomb = true;
            break;
          case 'rusher':
            // Rushers don't deal contact damage - only explosion damage
            break;
          case 'stabber':
            // Stabbers don't deal contact damage - only melee attack damage
            break;
        }

        if (damage > 0 && CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
          console.log(`💥 ${enemy.type} contact damage! Damage: ${damage}`);
        }

        // Only play hurt sound and reset kill streak if actual damage is dealt
        if (damage > 0) {
          if (audio) {
            audio.playPlayerHit();
          }
          if (gameState) {
            gameState.resetKillStreak(); // Reset kill streak on taking damage
          }
        }

        if (player.takeDamage(damage, `${enemy.type}-contact`)) {
          if (gameState) {
            gameState.setGameState('gameOver');
          }
          if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(
              `💀 PLAYER DIED from ${enemy.type} contact! Game state changed to gameOver.`
            );
          }
          return;
        } else if (shouldPlaceBomb) {
          // Tank contact - place bomb
          if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(`💣 Tank contact - placing time bomb!`);
          }
          if (!activeBombs) return;
          tryPlaceTankBomb(activeBombs, enemy);
          if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(
              `💣 Tank placed time bomb at (${round(enemy.x)}, ${round(enemy.y)})`
            );
          }
        }
      }
    }
  }

  // Player bullets vs enemies
  checkPlayerBulletsVsEnemies(enemySpatialGrid = null) {
    const playerBullets = this.getContextValue('playerBullets');
    const enemies = this.getContextValue('enemies');
    if (!playerBullets || !enemies) return;

    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const bullet = playerBullets[i];
      const candidateEnemyIndices = enemySpatialGrid
        ? queryNearbyEnemyIndices(enemySpatialGrid, bullet)
        : enemies.map((_, index) => index).reverse();
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
    const damageResult = normalizeDamageResult(
      enemy.takeDamage(bullet.damage, bullet.angle)
    );
    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      console.log(
        `[DEBUG] takeDamage result: ${damageResult}, enemyHealthAfter=${enemy.health}`
      );
    }

    if (damageResult === DAMAGE_RESULT.EXPLODING) {
      // Rusher started exploding - create hit effect but don't remove enemy yet
      if (explosionManager) {
        explosionManager.addExplosion(bullet.x, bullet.y, 'hit');
      }
      if (audio) {
        audio.playHit(bullet.x, bullet.y);
      }
      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(
          `💥 RUSHER SHOT! Starting explosion sequence! Was already exploding: ${wasExploding}`
        );
      }
    } else if (damageResult === DAMAGE_RESULT.DIED) {
      this.handleEnemyDeath(enemy, enemyType, bullet.x, bullet.y);

      enemy.markedForRemoval = true;
      if (gameState) {
        gameState.addKill();

        let points = 10;
        if (gameState.killStreak >= 5) points *= 2;
        if (gameState.killStreak >= 10) points *= 1.5;

        gameState.addScore(points);

        // Kill text + hitstop
        if (floatingText) {
          floatingText.addKill(
            enemy.x,
            enemy.y,
            enemyType,
            gameState.killStreak
          );
        }

        // Enhanced hitstop with chromatic aberration and beat-sensitivity
        const isOnBeat = beatClock && beatClock.isOnBeat();
        const baseStopFrames = isOnBeat ? 5 : 3; // Longer hitstop when on-beat
        const streakBonus = gameState.killStreak >= 5 ? 2 : 0;
        const stopFrames = baseStopFrames + streakBonus;
        const current =
          this.context?.get?.('hitStopFrames') ?? window.hitStopFrames ?? 0;
        const next = Math.max(current, stopFrames);
        if (this.context && typeof this.context.set === 'function') {
          this.context.set('hitStopFrames', next);
        } else if (typeof window !== 'undefined') {
          window.hitStopFrames = next;
        }

        // Trigger chromatic aberration on beat-perfect kills
        if (isOnBeat && visualEffectsManager) {
          const chromaIntensity = gameState.killStreak >= 5 ? 0.8 : 0.5;
          visualEffectsManager.triggerChromaticAberration(
            chromaIntensity,
            stopFrames * 3
          );
          // Also trigger bloom for on-beat kills
          visualEffectsManager.triggerBloom(0.4, stopFrames * 2);
        }
      }

      // Screen shake on kill (handleEnemyDeath already shakes for tank)
      if (cameraSystem && enemyType !== 'tank') {
        const shakeIntensity = enemyType === 'rusher' ? 12 : 8;
        cameraSystem.addShake(shakeIntensity, 12);
      }

      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(`💀 ${enemyType} killed by bullet!`);
      }
    } else {
      // Enemy hit but not dead
      if (explosionManager) {
        explosionManager.addExplosion(bullet.x, bullet.y, 'hit');
      }
      if (audio) {
        audio.playHit(bullet.x, bullet.y);
      }

      // Floating damage number
      if (floatingText) {
        const size = Number(enemy.size) || 0;
        floatingText.addDamage(enemy.x, enemy.y - size * 0.5, bullet.damage);
      }

      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(`🎯 ${enemyType} damaged, health now: ${enemy.health}`);
      }
    }

    // Remove bullet
    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      console.log(`[DEBUG] Removing bullet at index ${bulletIndex} after hit`);
    }
    Bullet.release(bullet);
    playerBullets.splice(bulletIndex, 1);
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
            const testMode =
              this.getContextValue('testModeManager')?.enabled ?? false;
            console.log(
              `💀 PLAYER DIED! Game state changed to gameOver. Test mode: ${testMode}`
            );
          }
          return;
        }
        Bullet.release(bullet);
        enemyBullets.splice(i, 1);
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
      const candidateEnemyIndices = enemySpatialGrid
        ? queryNearbyEnemyIndices(enemySpatialGrid, bullet)
        : enemies.map((_, index) => index).reverse();
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
    const energyCost = (enemy.health / enemy.maxHealth) * 30;

    // Kill the enemy and create explosion
    this.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y, true);

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

    // Reduce bullet energy proportionally
    if (bullet.energy) {
      bullet.energy -= energyCost;

      // If energy depleted, remove bullet
      if (bullet.energy <= 0) {
        Bullet.release(bullet);
        enemyBullets.splice(bulletIndex, 1);
      }
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

    const damageResult = normalizeDamageResult(
      enemy.takeDamage(bullet.damage, bullet.angle, bulletSource)
    );

    if (damageResult === DAMAGE_RESULT.EXPLODING) {
      // Rusher started exploding
      if (explosionManager) {
        explosionManager.addExplosion(bullet.x, bullet.y, 'hit');
      }
      if (audio) {
        audio.playHit(bullet.x, bullet.y);
      }
      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(`💥 FRIENDLY FIRE caused rusher to explode!`);
      }
    } else if (damageResult === DAMAGE_RESULT.DIED) {
      // Enemy died from friendly fire
      this.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);

      if (audio) {
        audio.playExplosion(enemy.x, enemy.y);
      }

      enemy.markedForRemoval = true;
      if (gameState) {
        gameState.addKill();
        gameState.addScore(8); // Friendly fire kills get some points
      }

      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(
          `💀 ${enemy.type} killed by friendly fire from ${bulletSource}!`
        );
      }
    } else {
      // Enemy damaged but not dead
      if (explosionManager) {
        explosionManager.addExplosion(bullet.x, bullet.y, 'hit');
      }
      if (audio) {
        audio.playHit(bullet.x, bullet.y);
      }
      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
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
    enemyBullets.splice(bulletIndex, 1);
  }

  // Handle enemy death effects
  handleEnemyDeath(enemy, enemyType, x, y, isEnergyBall = false) {
    this.enemyDeathHandler.handleEnemyDeath(enemy, enemyType, x, y);
  }

  // Handle stabber attack collision
  handleStabberAttack(attack, stabber) {
    const player = this.getContextValue('player');
    const audio = this.getContextValue('audio');
    const gameState = this.getContextValue('gameState');
    const cameraSystem = this.getContextValue('cameraSystem');
    const explosionManager = this.getContextValue('explosionManager');
    if (!player) return;

    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      console.log('🗡️ Stabber executing deadly stab attack!');
    }

    // Check if player is still in stab range
    const distance = Math.sqrt(
      (player.x - stabber.x) ** 2 + (player.y - stabber.y) ** 2
    );

    if (distance <= attack.range + 10) {
      // Small buffer for fairness
      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(
          `⚔️ STABBER HIT! Player took ${attack.damage} damage from stab attack`
        );
      }

      if (audio) {
        audio.playPlayerHit();
        audio.playStabberAttack(stabber.x, stabber.y);
      }

      if (gameState) {
        gameState.resetKillStreak(); // Reset kill streak on taking damage
      }

      // Apply damage and knockback
      if (player.takeDamage(attack.damage, 'stabber-legacy')) {
        if (gameState) {
          gameState.setGameState('gameOver');
        }
        if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
          console.log('💀 PLAYER KILLED BY STABBER ATTACK!');
        }
        return;
      }

      // Apply knockback to player
      const knockbackAngle = Math.atan2(
        player.y - stabber.y,
        player.x - stabber.x
      );
      const knockbackForce = 8;
      player.velocity.x += Math.cos(knockbackAngle) * knockbackForce;
      player.velocity.y += Math.sin(knockbackAngle) * knockbackForce;

      // Screen shake for dramatic effect
      if (cameraSystem) {
        cameraSystem.addShake(10, 20);
      }

      // Create impact effect
      if (explosionManager) {
        explosionManager.addExplosion(player.x, player.y, 'hit');
      }
    } else {
      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(
          `🗡️ Stabber attack missed! Player distance: ${distance.toFixed(1)}, range: ${attack.range}`
        );
      }
    }
  }

  // Handle rusher explosion collision
  handleRusherExplosion(explosion, rusherIndex) {
    const player = this.getContextValue('player');
    const audio = this.getContextValue('audio');
    const gameState = this.getContextValue('gameState');
    const cameraSystem = this.getContextValue('cameraSystem');
    const explosionManager = this.getContextValue('explosionManager');
    const enemies = this.getContextValue('enemies');
    if (!player) return;

    const distance = Math.sqrt(
      (player.x - explosion.x) ** 2 + (player.y - explosion.y) ** 2
    );

    if (distance <= explosion.radius) {
      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(
          `💥 RUSHER EXPLOSION HIT PLAYER! Distance: ${distance.toFixed(1)}, Radius: ${explosion.radius}`
        );
      }

      if (audio) {
        audio.playPlayerHit();
        audio.playRusherExplosion(explosion.x, explosion.y);
      }

      if (gameState) {
        gameState.resetKillStreak(); // Reset kill streak on taking damage
      }

      // Apply damage
      if (player.takeDamage(explosion.damage, 'rusher-explosion')) {
        if (gameState) {
          gameState.setGameState('gameOver');
        }
        console.log('💀 PLAYER KILLED BY RUSHER EXPLOSION!');
        return;
      }

      // Apply knockback
      const knockbackAngle = Math.atan2(
        player.y - explosion.y,
        player.x - explosion.x
      );
      const knockbackForce = 12;
      player.velocity.x += Math.cos(knockbackAngle) * knockbackForce;
      player.velocity.y += Math.sin(knockbackAngle) * knockbackForce;

      // Strong screen shake
      if (cameraSystem) {
        cameraSystem.addShake(15, 25);
      }

      // Create impact effect
      if (explosionManager) {
        explosionManager.addExplosion(player.x, player.y, 'hit');
      }

      // Remove the rusher that exploded
      if (enemies && rusherIndex >= 0 && rusherIndex < enemies.length) {
        enemies[rusherIndex].markedForRemoval = true;
      }
    }
  }
}
