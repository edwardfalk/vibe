/**
 * CollisionSystem.js - Handles all collision detection between bullets, enemies, and player
 */

import { CONFIG } from '../config.js';
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
import { NOTE_OWNER, hangNote } from '../entities/BassNote.js';

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
      handleEnemyDeath: (...args) => this.handleEnemyDeath(...args),
      getContext: () => this.context,
    };
  }

  // Main collision detection function
  checkBulletCollisions() {
    this.checkPlayerBulletsVsNotes();
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
    handleContactCollisions({
      player: this.getContextValue('player'),
      enemies: this.getContextValue('enemies'),
      audio: this.getContextValue('audio'),
      activeBombs: this.getContextValue('activeBombs'),
      beatClock: this.getContextValue('beatClock'),
    });
  }

  /**
   * Player bullets vs the bassists' notes, before anything else: a shot note
   * hangs (BassNote.hangNote), so it can't reach the hero this frame. The
   * shot is spent on it. shortcut: the shot's path against where the note
   * is now (a note moves far slower than a shot); sweep both if one slips
   * through
   */
  checkPlayerBulletsVsNotes() {
    const playerBullets = this.getContextValue('playerBullets');
    const enemyBullets = this.getContextValue('enemyBullets');
    if (!playerBullets || !enemyBullets) return;
    const beats = this.getContextValue('beatClock')?.getBeatPosition() ?? null;
    for (const note of enemyBullets) {
      if (note.owner !== NOTE_OWNER || note._remove || note.hung) continue;
      const shot = playerBullets.find(
        (b) => !b._remove && b.checkCollision(note)
      );
      if (!shot) continue;
      this.getContextValue('gameState')?.addShotHit();
      Bullet.release(shot);
      shot._remove = true;
      hangNote(note, beats);
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
        // Killed earlier this frame; leaves the array next frame
        if (enemies[j].markedForRemoval) continue;
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
    if (!enemyBullets || !player) return;

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const bullet = enemyBullets[i];
      if (bullet._remove || bullet.hung) continue; // a shot note is spent

      // Check player collision
      if (bullet.checkCollision(player)) {
        const damage =
          bullet.owner === 'enemy-tank'
            ? CONFIG.PLAYER.DAMAGE_TANK_BALL
            : bullet.owner === NOTE_OWNER
              ? CONFIG.PLAYER.DAMAGE_BASS_NOTE
              : CONFIG.PLAYER.DAMAGE_GRUNT_BULLET;
        player.hurt(damage, `${bullet.owner}-bullet`);
        Bullet.release(bullet);
        bullet._remove = true;
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
      if (bullet._remove || bullet.hung) continue;
      const note = bullet.owner === NOTE_OWNER;

      for (let j = 0; j < enemies.length; j++) {
        const enemy = enemies[j];
        if (bullet.ownerId === enemy.id || enemy.markedForRemoval) continue;
        // A bassist's note passes through his kind
        if (note && enemy.type === 'bassist') continue;

        // Check if bullet hits enemy (but not the one that fired it)
        if (bullet.checkCollision(enemy)) {
          // Handle different bullet types: the heavy shots kill outright
          if (bullet.owner === 'enemy-tank' || note) {
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
  handleEnemyDeath(enemy, enemyType, x, y, blow) {
    this.enemyDeathHandler.handleEnemyDeath(enemy, enemyType, x, y, blow);
  }

  // Handle rusher explosion collision
  handleRusherExplosion(explosion, rusherEnemy) {
    handleRusherExplosionCollision({
      explosion,
      rusherEnemy,
      player: this.getContextValue('player'),
      cameraSystem: this.getContextValue('cameraSystem'),
      explosionManager: this.getContextValue('explosionManager'),
    });
  }
}
