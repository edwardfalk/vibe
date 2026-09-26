/**
 * CollisionSystem.js - Handles all collision detection between bullets, enemies, and player
 */

import { Bullet } from '../entities/bullet.js';
import {
  handleContactCollisions,
  handleRusherExplosionCollision,
} from './combat/PlayerContactHandlers.js';
import { createContextAccessor } from '../shared/ContextAccessor.js';
import {
  resolveBulletEnemyHit,
  handleTankEnergyBallHit,
  handleRegularEnemyBulletHit,
} from './collision/BulletCollisionResolvers.js';

// Single-pass compaction: O(n) instead of O(n²) from repeated splice
function compactArray(arr) {
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    if (!arr[read]._remove) arr[write++] = arr[read];
  }
  arr.length = write;
}

export class CollisionSystem {
  constructor(context, enemyDeathHandler) {
    this.context = context;
    this.getContextValue = createContextAccessor(() => this.context);
    this.enemyDeathHandler = enemyDeathHandler;
    this.resolverDeps = {
      getContextValue: this.getContextValue,
      handleEnemyDeath: (e, type, x, y) => this.handleEnemyDeath(e, type, x, y),
      getContext: () => this.context,
    };
  }

  // Main collision detection function
  checkBulletCollisions() {
    this.checkPlayerBulletsVsEnemies();
    this.checkEnemyBulletsVsPlayer();
    this.checkEnemyBulletsVsEnemies();

    // Compact bullet arrays after all collision checks (mark-and-compact).
    // A hit releases its bullet to the pool but leaves it in the array until
    // here, so nothing may acquire a bullet between the first Bullet.release
    // this frame and this compaction: reset() would clear _remove and the
    // array would keep a live duplicate.
    const playerBullets = this.getContextValue('playerBullets');
    const enemyBullets = this.getContextValue('enemyBullets');
    if (playerBullets) compactArray(playerBullets);
    if (enemyBullets) compactArray(enemyBullets);
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
  checkPlayerBulletsVsEnemies() {
    const playerBullets = this.getContextValue('playerBullets');
    const enemies = this.getContextValue('enemies');
    if (!playerBullets || !enemies) return;

    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const bullet = playerBullets[i];
      if (bullet._remove) continue;

      for (let j = 0; j < enemies.length; j++) {
        if (this.resolveBulletEnemyHit(bullet, i, enemies[j])) {
          break;
        }
      }
    }
  }

  resolveBulletEnemyHit(bullet, bulletIndex, enemy) {
    return resolveBulletEnemyHit(bullet, enemy, this.resolverDeps);
  }

  // Enemy bullets vs player
  checkEnemyBulletsVsPlayer() {
    const enemyBullets = this.getContextValue('enemyBullets');
    const player = this.getContextValue('player');
    const gameState = this.getContextValue('gameState');
    if (!enemyBullets || !player) return;

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const bullet = enemyBullets[i];
      if (bullet._remove) continue;

      // Check player collision
      if (bullet.checkCollision(player)) {
        if (player.takeDamage(bullet.damage, `${bullet.owner}-bullet`)) {
          if (gameState) {
            gameState.setGameState('gameOver');
          }
        }
        Bullet.release(bullet);
        bullet._remove = true;
        break; // Exit loop since bullet hit player
      }
    }
  }

  // Enemy bullets vs enemies (friendly fire)
  checkEnemyBulletsVsEnemies() {
    const enemyBullets = this.getContextValue('enemyBullets');
    const enemies = this.getContextValue('enemies');
    if (!enemyBullets || !enemies) return;

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const bullet = enemyBullets[i];
      if (bullet._remove) continue;

      for (let j = 0; j < enemies.length; j++) {
        const enemy = enemies[j];
        if (bullet.ownerId === enemy.id) continue;

        // Check if bullet hits enemy (but not the one that fired it)
        if (bullet.checkCollision(enemy)) {
          // Handle different bullet types
          if (bullet.owner === 'enemy-tank') {
            this.handleTankEnergyBallHit(bullet, enemy);
          } else {
            this.handleRegularEnemyBulletHit(bullet, enemy);
          }
          break; // Exit inner loop since bullet hit an enemy
        }
      }
    }
  }

  handleTankEnergyBallHit(bullet, enemy) {
    handleTankEnergyBallHit(bullet, enemy, this.resolverDeps);
  }

  handleRegularEnemyBulletHit(bullet, enemy) {
    handleRegularEnemyBulletHit(bullet, enemy, this.resolverDeps);
  }

  // Handle enemy death effects
  handleEnemyDeath(enemy, enemyType, x, y) {
    this.enemyDeathHandler.handleEnemyDeath(enemy, enemyType, x, y);
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
