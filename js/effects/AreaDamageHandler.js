import { atan2, cos, sin } from '../mathUtils.js';
import { DAMAGE_RESULT } from '../shared/DamageResult.js';
import { handleDamageResult } from '../shared/DamageResultHandler.js';

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

        const damageResult = handleDamageResult(
          enemy.takeDamage(event.damage, null, 'area'),
          enemy,
          {
            explosionManager,
            audio,
            gameState,
            enemyDeathHandler,
            scorePoints: 10,
          }
        );

        if (damageResult === DAMAGE_RESULT.DIED) {
          console.log(`💀 ${enemy.type} killed by area damage!`);
        } else if (damageResult === DAMAGE_RESULT.EXPLODING) {
          console.log(`💥 Area damage caused ${enemy.type} to explode!`);
        }
      }
    }
  }
}
