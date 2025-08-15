// EnemyOps.js – Extract enemy update and area-damage handling
import { CONFIG } from '@vibe/core';
import { atan2, cos, sin } from '@vibe/core';

export function updateEnemies(p, enemies, player, playerBullets, enemyBullets) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    // Remove dead/flagged enemies
    if (enemy.health <= 0 || enemy.markedForRemoval) {
      if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
        console.log(
          `🗑️ Removing dead enemy: ${enemy.type} at (${enemy.x.toFixed(1)}, ${enemy.y.toFixed(1)}) health=${enemy.health} marked=${enemy.markedForRemoval}`
        );
      }
      enemies.splice(i, 1);
      continue;
    }

    const result = enemy.update(
      player ? player.x : 400,
      player ? player.y : 300,
      p.deltaTime
    );
    if (!result) continue;

    if (result.type === 'rusher-explosion') {
      if (window.collisionSystem) {
        window.collisionSystem.handleRusherExplosion(result, i);
      }
      try {
        window.dispatchEvent(
          new CustomEvent('vfx:rusher-explosion', {
            detail: { x: result.x, y: result.y },
          })
        );
      } catch (_) {}
      window.audio?.playExplosion(result.x, result.y);
      console.log(`💥 RUSHER EXPLOSION at (${result.x}, ${result.y})!`);
      enemies.splice(i, 1);
      continue;
    }

    if (typeof result.checkCollision === 'function') {
      enemyBullets.push(result);
      console.log(
        `➕ Added enemy bullet to array: ${result.owner} at (${Math.round(result.x)}, ${Math.round(result.y)}) - Total: ${enemyBullets.length}`
      );
      continue;
    }

    if (result.type === 'stabber-melee' || result.type === 'stabber-miss') {
      if (
        result.type === 'stabber-melee' &&
        result.playerHit &&
        window.player
      ) {
        window.audio?.playPlayerHit();
        window.gameState?.resetKillStreak();
        if (window.player.takeDamage(result.damage, 'stabber-melee')) {
          window.gameState?.setGameState('gameOver');
          console.log('💀 PLAYER KILLED BY STABBER ATTACK!');
        } else {
          const knockbackAngle = atan2(
            window.player.y - result.y,
            window.player.x - result.x
          );
          const knockbackForce = 8;
          window.player.velocity.x += cos(knockbackAngle) * knockbackForce;
          window.player.velocity.y += sin(knockbackAngle) * knockbackForce;
          window.cameraSystem?.addShake(10, 20);
          try {
            window.dispatchEvent(
              new CustomEvent('vfx:enemy-hit', {
                detail: {
                  x: window.player.x,
                  y: window.player.y,
                  type: 'stabber',
                },
              })
            );
          } catch (_) {}
        }
      }
      if (result.enemiesHit && result.enemiesHit.length > 0) {
        for (let k = result.enemiesHit.length - 1; k >= 0; k--) {
          const hit = result.enemiesHit[k];
          const targetEnemy = hit.enemy;
          const damageResult = targetEnemy.takeDamage(
            hit.damage,
            hit.angle,
            'stabber'
          );
          if (damageResult === true) {
            window.collisionSystem?.handleEnemyDeath(
              targetEnemy,
              targetEnemy.type,
              targetEnemy.x,
              targetEnemy.y
            );
            const idx = enemies.indexOf(targetEnemy);
            if (idx !== -1) enemies[idx].markedForRemoval = true;
            window.gameState?.addKill();
            window.gameState?.addScore(15);
          } else if (damageResult === 'exploding') {
            try {
              window.dispatchEvent(
                new CustomEvent('vfx:enemy-hit', {
                  detail: {
                    x: targetEnemy.x,
                    y: targetEnemy.y,
                    type: targetEnemy.type,
                  },
                })
              );
            } catch (_) {}
            window.audio?.playHit(targetEnemy.x, targetEnemy.y);
            console.log(
              `💥 Stabber friendly fire caused ${targetEnemy.type} to explode!`
            );
          } else {
            try {
              window.dispatchEvent(
                new CustomEvent('vfx:enemy-hit', {
                  detail: {
                    x: targetEnemy.x,
                    y: targetEnemy.y,
                    type: targetEnemy.type,
                  },
                })
              );
            } catch (_) {}
            window.audio?.playHit(targetEnemy.x, targetEnemy.y);
          }
        }
      }
    }
  }
}

export function handleAreaDamageEvents(damageEvents, enemies) {
  for (const event of damageEvents) {
    if (window.player) {
      const dx = event.x - window.player.x;
      const dy = event.y - window.player.y;
      const playerDistSq = dx * dx + dy * dy;
      const radiusSq = event.radius * event.radius;
      if (playerDistSq < radiusSq) {
        window.audio?.playPlayerHit();
        window.gameState?.resetKillStreak();
        if (window.player.takeDamage(event.damage, 'area-effect')) {
          window.gameState?.setGameState('gameOver');
        } else {
          const knockbackAngle = atan2(
            window.player.y - event.y,
            window.player.x - event.x
          );
          const knockbackForce = 6;
          window.player.velocity.x += cos(knockbackAngle) * knockbackForce;
          window.player.velocity.y += sin(knockbackAngle) * knockbackForce;
          window.cameraSystem?.addShake(8, 15);
        }
      }
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const dx = event.x - enemy.x;
      const dy = event.y - enemy.y;
      const enemyDistSq = dx * dx + dy * dy;
      const radiusSq = event.radius * event.radius;
      if (enemyDistSq < radiusSq) {
        const damageResult = enemy.takeDamage(event.damage, null, 'area');
        if (damageResult === true) {
          window.collisionSystem?.handleEnemyDeath(
            enemy,
            enemy.type,
            enemy.x,
            enemy.y
          );
          enemy.markedForRemoval = true;
          window.gameState?.addKill();
          window.gameState?.addScore(10);
        } else if (damageResult === 'exploding') {
          try {
            window.dispatchEvent(
              new CustomEvent('vfx:enemy-hit', {
                detail: { x: enemy.x, y: enemy.y, type: enemy.type },
              })
            );
          } catch (_) {}
          window.audio?.playHit(enemy.x, enemy.y);
        } else {
          try {
            window.dispatchEvent(
              new CustomEvent('vfx:enemy-hit', {
                detail: { x: enemy.x, y: enemy.y, type: enemy.type },
              })
            );
          } catch (_) {}
          window.audio?.playHit(enemy.x, enemy.y);
        }
      }
    }
  }
}
