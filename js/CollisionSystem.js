/**
 * CollisionSystem.js - Handles all collision detection between bullets, enemies, and player
 */

import { round, sqrt, atan2, cos, sin, dist } from './mathUtils.js';
import { CONFIG } from './config.js';

// Default countdown for tank time bombs (in frames)
const TIME_BOMB_FRAMES = 180; // 3 seconds at 60fps

export class CollisionSystem {
  constructor() {
    // Collision detection settings
    this.friendlyFireEnabled = true;
  }

  // Main collision detection function
  checkBulletCollisions() {
    this.checkPlayerBulletsVsEnemies();
    this.checkEnemyBulletsVsPlayer();
    this.checkEnemyBulletsVsEnemies();
  }

  // ADD: Check contact collisions between enemies and player
  checkContactCollisions() {
    if (!window.player || !window.enemies) return;

    for (let i = window.enemies.length - 1; i >= 0; i--) {
      const enemy = window.enemies[i];

      // Check if enemy is touching player
      if (enemy.checkCollision(window.player)) {
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
          if (window.audio) {
            window.audio.playPlayerHit();
          }
          if (window.gameState) {
            window.gameState.resetKillStreak(); // Reset kill streak on taking damage
          }
        }

        if (window.player.takeDamage(damage, `${enemy.type}-contact`)) {
          if (window.gameState) {
            window.gameState.setGameState('gameOver');
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
          window.activeBombs = window.activeBombs || [];
          // Place bomb if under limit (regardless of debug mode)
          if (window.activeBombs.length < 3) {
            const timer = TIME_BOMB_FRAMES;
            window.activeBombs.push({
              x: enemy.x,
              y: enemy.y,
              timer,
              maxTimer: timer,
              tankId: enemy.id,
            });
            // Only log bomb placement in debug mode
            if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
              console.log(
                `💣 Tank placed time bomb at (${round(enemy.x)}, ${round(enemy.y)})`
              );
            }
          }
        }
      }
    }
  }

  // Player bullets vs enemies
  checkPlayerBulletsVsEnemies() {
    if (!window.playerBullets || !window.enemies) return;

    for (let i = window.playerBullets.length - 1; i >= 0; i--) {
      const bullet = window.playerBullets[i];

      for (let j = window.enemies.length - 1; j >= 0; j--) {
        const enemy = window.enemies[j];

        // Log positions and health before collision check
        if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
          console.log(
            `[DEBUG] Checking bullet vs enemy: bullet=(${bullet.x.toFixed(1)},${bullet.y.toFixed(1)}) enemy=(${enemy.x.toFixed(1)},${enemy.y.toFixed(1)}) enemyHealth=${enemy.health}`
          );
        }

        if (bullet.checkCollision(enemy)) {
          if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(
              `🎯 Bullet hit ${enemy.type} enemy! Health: ${enemy.health}`
            );
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
          const damageResult = enemy.takeDamage(bullet.damage, bullet.angle);
          if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(
              `[DEBUG] takeDamage result: ${damageResult}, enemyHealthAfter=${enemy.health}`
            );
          }

          if (damageResult === 'exploding') {
            // Rusher started exploding - create hit effect but don't remove enemy yet
            if (window.explosionManager) {
              window.explosionManager.addExplosion(bullet.x, bullet.y, 'hit');
            }
            if (window.audio) {
              window.audio.playHit(bullet.x, bullet.y);
            }
            if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
              console.log(
                `💥 RUSHER SHOT! Starting explosion sequence! Was already exploding: ${wasExploding}`
              );
            }
          } else if (damageResult === true) {
            // Enemy died - create beautiful fragment explosion
            this.handleEnemyDeath(enemy, enemyType, bullet.x, bullet.y);

            enemy.markedForRemoval = true;
            if (window.gameState) {
              window.gameState.addKill();

              // Calculate score with multipliers
              let points = 10;
              if (window.gameState.killStreak >= 5) points *= 2; // Double points for 5+ streak
              if (window.gameState.killStreak >= 10) points *= 1.5; // 3x total for 10+ streak

              window.gameState.addScore(points);
            }
            if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
              console.log(`💀 ${enemyType} killed by bullet!`);
            }
          } else {
            // Enemy hit but not dead - smaller effect
            if (window.explosionManager) {
              window.explosionManager.addExplosion(bullet.x, bullet.y, 'hit');
            }
            if (window.audio) {
              window.audio.playHit(bullet.x, bullet.y);
            }
            if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
              console.log(
                `🎯 ${enemyType} damaged, health now: ${enemy.health}`
              );
            }
          }

          // Remove bullet
          if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
            console.log(`[DEBUG] Removing bullet at index ${i} after hit`);
          }
          window.playerBullets.splice(i, 1);
          break; // Important: break to avoid hitting multiple enemies with same bullet
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

  // Enemy bullets vs player
  checkEnemyBulletsVsPlayer() {
    if (!window.enemyBullets || !window.player) return;

    for (let i = window.enemyBullets.length - 1; i >= 0; i--) {
      const bullet = window.enemyBullets[i];

      // Check player collision
      if (bullet.checkCollision(window.player)) {
        if (window.audio) {
          window.audio.playPlayerHit();
        }

        if (window.gameState) {
          window.gameState.resetKillStreak(); // Reset kill streak on taking damage
        }

        if (
          window.player.takeDamage(
            bullet.damage,
            `${bullet.owner || bullet.type}-bullet`
          )
        ) {
          if (window.gameState) {
            window.gameState.setGameState('gameOver');
          }
          console.log(
            `💀 PLAYER DIED! Game state changed to gameOver. Test mode: ${window.testMode}`
          );
          return;
        }
        window.enemyBullets.splice(i, 1);
        break; // Exit loop since bullet hit player
      }
    }
  }

  // Enemy bullets vs enemies (friendly fire)
  checkEnemyBulletsVsEnemies() {
    if (!this.friendlyFireEnabled || !window.enemyBullets || !window.enemies)
      return;

    for (let i = window.enemyBullets.length - 1; i >= 0; i--) {
      const bullet = window.enemyBullets[i];

      for (let j = window.enemies.length - 1; j >= 0; j--) {
        const enemy = window.enemies[j];

        // Check if bullet hits enemy (but not the one that fired it)
        if (bullet.checkCollision(enemy) && bullet.ownerId !== enemy.id) {
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
    if (window.audio) {
      window.audio.playTankEnergyBall(bullet.x, bullet.y);
    }

    // Calculate energy cost based on enemy's remaining health
    const energyCost = (enemy.health / enemy.maxHealth) * 30;

    // Kill the enemy and create explosion
    this.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y, true);

    if (window.audio) {
      window.audio.playEnemyFrying(enemy.x, enemy.y);
      window.audio.playExplosion(enemy.x, enemy.y);
    }

    enemy.markedForRemoval = true;

    if (window.gameState) {
      window.gameState.addKill();

      // Energy ball kills get bonus points
      let points = 12;
      if (window.gameState.killStreak >= 5) points *= 2;
      if (window.gameState.killStreak >= 10) points *= 1.5;

      window.gameState.addScore(points);
    }

    // Reduce bullet energy proportionally
    if (bullet.energy) {
      bullet.energy -= energyCost;

      // If energy depleted, remove bullet
      if (bullet.energy <= 0) {
        window.enemyBullets.splice(bulletIndex, 1);
      }
    }
  }

  // Handle regular enemy bullet hitting enemy
  handleRegularEnemyBulletHit(bullet, enemy, bulletIndex, enemyIndex) {
    // Determine bullet source type for tank anger tracking
    let bulletSource = 'unknown';
    if (bullet.type === 'grunt' || bullet.owner === 'enemy-grunt') {
      bulletSource = 'grunt';
    } else if (bullet.type === 'stabber' || bullet.owner === 'enemy-stabber') {
      bulletSource = 'stabber';
    } else if (bullet.type === 'tankEnergy' || bullet.owner === 'enemy-tank') {
      bulletSource = 'tank';
    }

    const damageResult = enemy.takeDamage(
      bullet.damage,
      bullet.angle,
      bulletSource
    );

    if (damageResult === 'exploding') {
      // Rusher started exploding
      if (window.explosionManager) {
        window.explosionManager.addExplosion(bullet.x, bullet.y, 'hit');
      }
      if (window.audio) {
        window.audio.playHit(bullet.x, bullet.y);
      }
      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(`💥 FRIENDLY FIRE caused rusher to explode!`);
      }
    } else if (damageResult === true) {
      // Enemy died from friendly fire
      this.handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);

      if (window.audio) {
        window.audio.playExplosion(enemy.x, enemy.y);
      }

      enemy.markedForRemoval = true;
      if (window.gameState) {
        window.gameState.addKill();
        window.gameState.addScore(8); // Friendly fire kills get some points
      }

      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(
          `💀 ${enemy.type} killed by friendly fire from ${bulletSource}!`
        );
      }
    } else {
      // Enemy damaged but not dead
      if (window.explosionManager) {
        window.explosionManager.addExplosion(bullet.x, bullet.y, 'hit');
      }
      if (window.audio) {
        window.audio.playHit(bullet.x, bullet.y);
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
        `➖ Removing enemy bullet (hit enemy): ${bullet.owner} hit ${enemy.type} - Remaining: ${window.enemyBullets.length - 1}`
      );
    }
    window.enemyBullets.splice(bulletIndex, 1);
  }

  // Handle enemy death effects
  handleEnemyDeath(enemy, enemyType, x, y, isEnergyBall = false) {
    if (!window.explosionManager || !window.audio) return;

    if (enemyType === 'tank') {
      // Tanks get special plasma effects + fragments
      window.explosionManager.addFragmentExplosion(x, y, enemy);
      window.explosionManager.addPlasmaCloud(x, y);
      if (window.cameraSystem) {
        window.cameraSystem.addShake(8, 15);
      }
      window.audio.playTankOhNo(x, y);
      window.audio.playExplosion(x, y);
    } else {
      // All other enemies get beautiful fragment explosions
      window.explosionManager.addFragmentExplosion(x, y, enemy);

      // Type-specific kill sounds ONLY (remove generic explosion)
      if (enemyType === 'grunt') {
        window.audio.playGruntPop(x, y);
      } else if (enemyType === 'stabber') {
        window.audio.playStabberOhNo(x, y);
      } else if (enemyType === 'rusher') {
        window.audio.playRusherOhNo(x, y);
      } else {
        window.audio.playEnemyOhNo(x, y);
      }
    }
  }

  // Handle stabber attack collision
  handleStabberAttack(attack, stabber) {
    if (!window.player) return;

    if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
      console.log('🗡️ Stabber executing deadly stab attack!');
    }

    // Check if player is still in stab range
    const distance = Math.sqrt(
      (window.player.x - stabber.x) ** 2 + (window.player.y - stabber.y) ** 2
    );

    if (distance <= attack.range + 10) {
      // Small buffer for fairness
      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(
          `⚔️ STABBER HIT! Player took ${attack.damage} damage from stab attack`
        );
      }

      if (window.audio) {
        window.audio.playPlayerHit();
        window.audio.playStabberAttack(stabber.x, stabber.y);
      }

      if (window.gameState) {
        window.gameState.resetKillStreak(); // Reset kill streak on taking damage
      }

      // Apply damage and knockback
      if (window.player.takeDamage(attack.damage, 'stabber-legacy')) {
        if (window.gameState) {
          window.gameState.setGameState('gameOver');
        }
        if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
          console.log('💀 PLAYER KILLED BY STABBER ATTACK!');
        }
        return;
      }

      // Apply knockback to player
      const knockbackAngle = Math.atan2(
        window.player.y - stabber.y,
        window.player.x - stabber.x
      );
      const knockbackForce = 8;
      window.player.velocity.x += Math.cos(knockbackAngle) * knockbackForce;
      window.player.velocity.y += Math.sin(knockbackAngle) * knockbackForce;

      // Screen shake for dramatic effect
      if (window.cameraSystem) {
        window.cameraSystem.addShake(10, 20);
      }

      // Create impact effect
      if (window.explosionManager) {
        window.explosionManager.addExplosion(
          window.player.x,
          window.player.y,
          'hit'
        );
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
    if (!window.player) return;

    const distance = Math.sqrt(
      (window.player.x - explosion.x) ** 2 +
        (window.player.y - explosion.y) ** 2
    );

    if (distance <= explosion.radius) {
      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(
          `💥 RUSHER EXPLOSION HIT PLAYER! Distance: ${distance.toFixed(1)}, Radius: ${explosion.radius}`
        );
      }

      if (window.audio) {
        window.audio.playPlayerHit();
        window.audio.playRusherExplosion(explosion.x, explosion.y);
      }

      if (window.gameState) {
        window.gameState.resetKillStreak(); // Reset kill streak on taking damage
      }

      // Apply damage
      if (window.player.takeDamage(explosion.damage, 'rusher-explosion')) {
        if (window.gameState) {
          window.gameState.setGameState('gameOver');
        }
        console.log('💀 PLAYER KILLED BY RUSHER EXPLOSION!');
        return;
      }

      // Apply knockback
      const knockbackAngle = Math.atan2(
        window.player.y - explosion.y,
        window.player.x - explosion.x
      );
      const knockbackForce = 12;
      window.player.velocity.x += Math.cos(knockbackAngle) * knockbackForce;
      window.player.velocity.y += Math.sin(knockbackAngle) * knockbackForce;

      // Strong screen shake
      if (window.cameraSystem) {
        window.cameraSystem.addShake(15, 25);
      }

      // Create impact effect
      if (window.explosionManager) {
        window.explosionManager.addExplosion(
          window.player.x,
          window.player.y,
          'hit'
        );
      }

      // Remove the rusher that exploded
      if (
        window.enemies &&
        rusherIndex >= 0 &&
        rusherIndex < window.enemies.length
      ) {
        // Mark the rusher for removal; actual removal will be handled in the cleanup phase
        window.enemies[rusherIndex].markedForRemoval = true;
      }
    }
  }
}
