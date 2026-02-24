import { atan2, cos, sin } from '../mathUtils.js';
import {
  DAMAGE_RESULT,
  normalizeDamageResult,
} from '../shared/contracts/DamageResult.js';

export function handleAreaDamageEvents(damageEvents, context) {
  const {
    player,
    enemies,
    audio,
    gameState,
    cameraSystem,
    collisionSystem,
    explosionManager,
    enemyDeathHandler,
  } = context;

  for (const event of damageEvents) {
    // Check player damage
    if (player) {
      const dx = event.x - player.x;
      const dy = event.y - player.y;
      const playerDistSq = dx * dx + dy * dy;
      const radiusSq = event.radius * event.radius;
      if (playerDistSq < radiusSq) {
        console.log(
          `☢️ Player took ${event.damage} damage from area effect at (${event.x}, ${event.y})`
        );

        if (audio) {
          audio.playPlayerHit();
        }

        if (gameState) {
          gameState.resetKillStreak(); // Reset kill streak on taking damage
        }

        if (player.takeDamage(event.damage, 'area-effect')) {
          if (gameState) {
            gameState.setGameState('gameOver');
          }
          console.log('💀 PLAYER KILLED BY AREA DAMAGE!');
          continue;
        }

        // Apply knockback
        const knockbackAngle = atan2(player.y - event.y, player.x - event.x);
        const knockbackForce = 6;
        player.velocity.x += cos(knockbackAngle) * knockbackForce;
        player.velocity.y += sin(knockbackAngle) * knockbackForce;

        if (cameraSystem) {
          cameraSystem.addShake(8, 15);
        }
      }
    }

    // Check enemy damage
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      const dx = event.x - enemy.x;
      const dy = event.y - enemy.y;
      const enemyDistSq = dx * dx + dy * dy;
      const radiusSq = event.radius * event.radius;
      if (enemyDistSq < radiusSq) {
        console.log(
          `☢️ ${enemy.type} took ${event.damage} damage from area effect`
        );

        const damageResult = normalizeDamageResult(
          enemy.takeDamage(event.damage, null, 'area')
        );

        if (damageResult === DAMAGE_RESULT.DIED) {
          console.log(`💀 ${enemy.type} killed by area damage!`);

          if (enemyDeathHandler) {
            enemyDeathHandler.handleEnemyDeath(
              enemy,
              enemy.type,
              enemy.x,
              enemy.y
            );
          } else if (collisionSystem) {
            collisionSystem.handleEnemyDeath(
              enemy,
              enemy.type,
              enemy.x,
              enemy.y
            );
          }

          enemy.markedForRemoval = true;

          if (gameState) {
            gameState.addKill();
            gameState.addScore(10); // Area effect kills
          }
        } else if (damageResult === DAMAGE_RESULT.EXPLODING) {
          if (explosionManager) {
            explosionManager.addExplosion(enemy.x, enemy.y, 'hit');
          }
          if (audio) {
            audio.playHit(enemy.x, enemy.y);
          }
          console.log(`💥 Area damage caused ${enemy.type} to explode!`);
        } else {
          if (explosionManager) {
            explosionManager.addExplosion(enemy.x, enemy.y, 'hit');
          }
          if (audio) {
            audio.playHit(enemy.x, enemy.y);
          }
        }
      }
    }
  }
}
