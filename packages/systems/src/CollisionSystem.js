/* CollisionSystem.js - Handles all collision detection (migrated to @vibe/systems) */
import { round, sqrt, atan2, cos, sin, dist } from '@vibe/core/mathUtils.js';
import { CONFIG } from '@vibe/core/config.js';
import { SpatialHashGrid } from './SpatialHashGrid.js';

// Default countdown for tank time bombs (in frames)
const TIME_BOMB_FRAMES = 180; // 3 seconds at 60fps

// TODO: Create a ticket to safely remove ExplosionManager if the new event-bus/config-driven VFX system is now the only handler for all enemy explosions.

export class CollisionSystem {
  constructor() {
    this.friendlyFireEnabled = true;
  }

  // Main collision detection function
  checkBulletCollisions() {
    this.checkPlayerBulletsVsEnemies();
    this.checkEnemyBulletsVsPlayer();
    this.checkEnemyBulletsVsEnemies();
  }

  // Contact player ↔ enemy and enemy ↔ enemy collisions
  checkContactCollisions() {
    if (!this.grid) return;

    // Player vs. Nearby Enemies
    if (window.player) {
      const nearbyEnemies = this.grid.neighbors(
        window.player.x,
        window.player.y
      );
      for (const enemy of nearbyEnemies) {
        if (enemy.checkCollision(window.player)) {
          this.handlePlayerEnemyContact(window.player, enemy);
        }
      }
    }

    // Enemy vs. Enemy
    const allEnemies = window.enemies || [];
    for (const enemy of allEnemies) {
      if (enemy.markedForRemoval) continue;
      const nearbyEnemies = this.grid.neighbors(enemy.x, enemy.y);
      for (const other of nearbyEnemies) {
        if (enemy === other || other.markedForRemoval) continue;

        // Simple circle-based collision and separation
        const distSq = (enemy.x - other.x) ** 2 + (enemy.y - other.y) ** 2;
        const requiredDist = enemy.size / 2 + other.size / 2;
        if (distSq < requiredDist ** 2) {
          this.handleEnemyEnemyContact(enemy, other);
        }
      }
    }
  }

  handlePlayerEnemyContact(player, enemy) {
    let damage = 0;
    let shouldPlaceBomb = false;
    switch (enemy.type) {
      case 'grunt':
        damage = 1;
        break;
      case 'tank':
        shouldPlaceBomb = true;
        break;
    }
    if (damage > 0) {
      window.audio?.playPlayerHit();
      window.gameState?.resetKillStreak();
    }
    if (player.takeDamage(damage, `${enemy.type}-contact`)) {
      window.gameState?.setGameState('gameOver');
    } else if (shouldPlaceBomb) {
      window.activeBombs = window.activeBombs || [];
      if (window.activeBombs.length < 3) {
        const timer = TIME_BOMB_FRAMES;
        window.activeBombs.push({
          x: enemy.x,
          y: enemy.y,
          timer,
          maxTimer: timer,
          tankId: enemy.id,
        });
      }
    }
  }

  handleEnemyEnemyContact(enemy, other) {
    // Simple push-apart logic to prevent stacking
    const dx = other.x - enemy.x;
    const dy = other.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const overlap = enemy.size / 2 + other.size / 2 - distance;
    if (overlap > 0) {
      const pushX = (dx / distance) * overlap * 0.5;
      const pushY = (dy / distance) * overlap * 0.5;

      enemy.x -= pushX;
      enemy.y -= pushY;
      other.x += pushX;
      other.y += pushY;
    }
  }

  // --- Optimised Bullet ↔ Enemy / Player collisions -----------------------
  // Uses squared-distance checks to avoid expensive Math.sqrt calls inside
  // the hot inner loops.  All arrays are iterated in reverse so we can splice
  // in-place without index issues.

  // Player bullets can only damage enemies
  checkPlayerBulletsVsEnemies() {
    if (!window.playerBullets?.length || !window.enemies?.length) return;

    const bullets = window.playerBullets;
    const enemies = window.enemies;

    // Use the centralized spatial grid for faster look-ups
    const useGrid = this.grid && enemies.length > 20; // Lower threshold

    // Pre-compute thresholds (radius^2) – assumes fairly uniform bullet sizes
    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      if (!bullet.active) continue;

      let bulletRemoved = false;

      const enemyList = useGrid
        ? this.grid.neighbors(bullet.x, bullet.y)
        : enemies;

      // Bullet vs every enemy (reverse order to allow safe splice)
      for (let j = enemyList.length - 1; j >= 0; j--) {
        const enemy = enemyList[j];
        if (!enemy || enemy.markedForRemoval) continue;

        // Fast circle-radius check (squared distance)
        const threshold = (bullet.size + enemy.size) * 0.5;
        const threshSq = threshold * threshold;
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        if (dx * dx + dy * dy > threshSq) continue; // Early reject

        // Use precise segment distance to avoid tunnelling at high speeds
        if (!bullet.checkCollision(enemy)) continue;

        // 💥 Collision!
        const killResult = enemy.takeDamage(
          bullet.damage,
          bullet.angle,
          'bullet',
          bullet.x,
          bullet.y
        );

        // Play hit sound for every bullet hit (before checking for death)
        if (window.audio) {
          if (
            enemy.type === 'stabber' &&
            typeof window.audio.playStabberHit === 'function'
          ) {
            window.audio.playStabberHit(enemy.x, enemy.y);
          } else if (typeof window.audio.playHit === 'function') {
            window.audio.playHit(enemy.x, enemy.y);
          }
        }

        // Remove / deactivate bullet unless it is penetrating
        if (!bullet.penetrating) {
          bullet.destroy?.();
          bullets.splice(i, 1);
          bulletRemoved = true;
        }

        // Enemy died
        if (killResult === true) {
          this.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);
          enemy.markedForRemoval = true; // Actual removal happens in GameLoop

          // Score + streaks
          window.gameState?.addKill();
          window.gameState?.addScore(10);
        } else if (killResult === 'exploding') {
          // [BUGFIX: see ticket "Legacy explosionManager triggers wrong VFX colors"]
          // All explosions now handled by event-bus VFX system only.
          window.audio?.playHit(enemy.x, enemy.y);
        }

        if (bulletRemoved) break; // Current bullet is gone ⇒ next bullet
      }
    }
  }

  // Enemy bullets can damage the player
  checkEnemyBulletsVsPlayer() {
    if (!window.enemyBullets?.length || !window.player) return;
    const bullets = window.enemyBullets;
    const player = window.player;

    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      if (!bullet.active) continue;

      const threshold = (bullet.size + player.size) * 0.5;
      const threshSq = threshold * threshold;
      const dx = bullet.x - player.x;
      const dy = bullet.y - player.y;
      if (dx * dx + dy * dy > threshSq) continue;

      if (!bullet.checkCollision(player)) continue;

      // Player hit!
      const lethal = player.takeDamage(
        bullet.damage,
        'bullet',
        bullet.x,
        bullet.y
      );
      window.audio?.playPlayerHit();
      window.gameState?.resetKillStreak();

      // Destroy bullet unless penetrating (tank energy ball)
      if (!bullet.penetrating) {
        bullet.destroy?.();
        bullets.splice(i, 1);
      }

      if (lethal) {
        window.gameState?.setGameState('gameOver');
        return; // No further processing if game ended
      }
    }
  }

  // Optional: enemy friendly-fire (enemy bullets vs other enemies)
  checkEnemyBulletsVsEnemies() {
    if (!this.friendlyFireEnabled) return;
    if (!window.enemyBullets?.length || !window.enemies?.length) return;

    const bullets = window.enemyBullets;
    const enemies = window.enemies;

    // Use the centralized spatial grid for faster look-ups
    const useGrid = this.grid && enemies.length > 20; // Lower threshold

    for (let i = bullets.length - 1; i >= 0; i--) {
      const bullet = bullets[i];
      if (!bullet.active) continue;

      const enemyList = useGrid
        ? this.grid.neighbors(bullet.x, bullet.y)
        : enemies;

      for (let j = enemyList.length - 1; j >= 0; j--) {
        const enemy = enemyList[j];
        if (!enemy || enemy.markedForRemoval) continue;

        // Skip bullet's owner (when ownerId matches)
        if (bullet.ownerId && bullet.ownerId === enemy.id) continue;

        const threshold = (bullet.size + enemy.size) * 0.5;
        const threshSq = threshold * threshold;
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        if (dx * dx + dy * dy > threshSq) continue;

        if (!bullet.checkCollision(enemy)) continue;

        // Friendly-fire!
        const killResult = enemy.takeDamage(
          bullet.damage,
          bullet.angle,
          'friendly-fire',
          bullet.x,
          bullet.y
        );

        if (!bullet.penetrating) {
          bullet.destroy?.();
          bullets.splice(i, 1);
        }

        if (killResult === true) {
          this.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);
          enemy.markedForRemoval = true;
          window.gameState?.addKill();
          window.gameState?.addScore(5); // smaller reward
        } else if (killResult === 'exploding') {
          // [BUGFIX: see ticket "Legacy explosionManager triggers wrong VFX colors"]
          // All explosions now handled by event-bus VFX system only.
          window.audio?.playHit(enemy.x, enemy.y);
        }

        // Break inner loop once bullet processed (unless penetrating)
        if (!bullet.active) break;
      }
    }
  }

  // Visual/SFX helper – centralized enemy death handling
  handleEnemyDeath(enemy, type, x, y) {
    // [BUGFIX: see ticket "Legacy explosionManager triggers wrong VFX colors"]
    // All explosions now handled by event-bus VFX system only.
    // No legacy ExplosionManager call here.

    // Special enemy-type audio or default explosion
    switch (type) {
      case 'grunt':
        window.audio?.playGruntPop?.(x, y);
        break;
      case 'rusher':
        window.audio?.playRusherExplosion?.(x, y);
        break;
      case 'tank':
        window.audio?.playExplosion?.(x, y);
        break;
      case 'stabber':
        window.audio?.playStabberAttack?.(x, y);
        break;
      default:
        window.audio?.playExplosion?.(x, y);
    }

    // Camera feedback
    window.cameraSystem?.addShake(6, 12);
  }

  /*
   * Handle area-damage explosion generated by a Rusher enemy.
   * The explosionEvent object comes from enemy.update() and has the shape
   *   { x, y, radius, damage }
   * We apply splash damage to player and other enemies, trigger VFX/SFX, and
   * mark the exploding Rusher for removal.
   */
  handleRusherExplosion(explosionEvent, enemyIndex) {
    if (!explosionEvent) return;

    const { x, y, radius, damage } = explosionEvent;
    const radiusSq = radius * radius;

    // Visual FX – forward to explosion manager
    // [BUGFIX: see ticket "Legacy explosionManager triggers wrong VFX colors"]
    // All explosions now handled by event-bus VFX system only.

    // Damage player if inside blast radius
    if (window.player) {
      const dx = x - window.player.x;
      const dy = y - window.player.y;
      if (dx * dx + dy * dy < radiusSq) {
        const lethal = window.player.takeDamage?.(
          damage,
          'rusher-explosion',
          x,
          y
        );
        window.audio?.playPlayerHit();
        window.gameState?.resetKillStreak();
        if (lethal) {
          window.gameState?.setGameState('gameOver');
        }
      }
    }

    // Damage other enemies (friendly fire)
    if (window.enemies?.length) {
      for (let i = window.enemies.length - 1; i >= 0; i--) {
        if (i === enemyIndex) continue; // Skip the exploding rusher itself
        const enemy = window.enemies[i];
        if (!enemy || enemy.markedForRemoval) continue;
        const dx = x - enemy.x;
        const dy = y - enemy.y;
        if (dx * dx + dy * dy >= radiusSq) continue;

        const killResult = enemy.takeDamage?.(
          damage,
          null,
          'rusher-explosion',
          x,
          y
        );
        if (killResult === true) {
          this.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);
          enemy.markedForRemoval = true;
          window.gameState?.addKill();
          window.gameState?.addScore(10);
        }
      }
    }

    // Camera shake effect
    window.cameraSystem?.addShake?.(12, 25);

    // Finally remove the Rusher itself
    if (
      typeof enemyIndex === 'number' &&
      window.enemies &&
      window.enemies[enemyIndex]
    ) {
      window.enemies[enemyIndex].markedForRemoval = true;
    }
  }

  /*
   * Wrapper expected by GameLoop.js. Runs both bullet and contact collision checks
   * and returns a basic result object. TODO: populate playerHit/enemyHit flags with
   * actual hit detections once full refactor is done.
   */
  checkCollisions(
    player = null,
    enemies = [],
    bullets = [],
    playerBullets = []
  ) {
    this.checkBulletCollisions();
    this.checkContactCollisions();
    // Currently, detailed hit info is not calculated in the new system; return false.
    return { playerHit: false, enemyHit: false };
  }
}
