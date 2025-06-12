/* CollisionSystem.js - Handles all collision detection (migrated to @vibe/systems) */
import { round, sqrt, atan2, cos, sin, dist } from '@vibe/core/mathUtils.js';
import { CONFIG } from '@vibe/core/config.js';

// Default countdown for tank time bombs (in frames)
const TIME_BOMB_FRAMES = 180; // 3 seconds at 60fps

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

  // Contact player ↔ enemy collisions
  checkContactCollisions() {
    if (!window.player || !window.enemies) return;
    for (let i = window.enemies.length - 1; i >= 0; i--) {
      const enemy = window.enemies[i];
      if (enemy.checkCollision(window.player)) {
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
        if (window.player.takeDamage(damage, `${enemy.type}-contact`)) {
          window.gameState?.setGameState('gameOver');
          return;
        } else if (shouldPlaceBomb) {
          window.activeBombs = window.activeBombs || [];
          if (window.activeBombs.length < 3) {
            const timer = TIME_BOMB_FRAMES;
            window.activeBombs.push({ x: enemy.x, y: enemy.y, timer, maxTimer: timer, tankId: enemy.id });
          }
        }
      }
    }
  }

  /* The remainder of the original CollisionSystem implementation is lengthy.
     To keep migration practical, we keep the rest of logic in the legacy file.
     TODO: Port full implementation here and remove legacy stub. */
} 