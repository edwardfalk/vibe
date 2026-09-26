import { CONFIG } from '../config.js';
import { handleDamageResult } from '../shared/DamageResultHandler.js';

export function handleAreaDamageEvents(damageEvents, context) {
  const {
    player,
    enemies,
    audio,
    gameState,
    cameraSystem,
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
        if (player.hurt(event.damage, 'area-effect')) continue;

        // Apply knockback
        player.knockBack(event.x, event.y, CONFIG.PLAYER.KNOCKBACK_AREA);

        if (cameraSystem) {
          cameraSystem.addShake(8, 15);
        }
      }
    }

    damageEnemiesInRadius(
      event,
      enemies,
      {
        explosionManager,
        audio,
        // No scoring once the player has died, this frame or earlier
        gameState: gameState?.gameState === 'playing' ? gameState : null,
        onDeath: (e) =>
          enemyDeathHandler?.handleEnemyDeath(e, e.type, e.x, e.y),
        scorePoints: 10,
      },
      'area'
    );
  }
}

/**
 * Damage every live enemy the circle touches; an enemy counts when its hit
 * radius reaches inside, not only its centre. ctx goes to handleDamageResult.
 */
export function damageEnemiesInRadius(event, enemies, ctx, source) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (enemy.markedForRemoval) continue;
    const reach = event.radius + (enemy.hitRadius ?? enemy.size / 2);
    const dx = event.x - enemy.x;
    const dy = event.y - enemy.y;
    if (dx * dx + dy * dy > reach * reach) continue;
    handleDamageResult(
      enemy.takeDamage(event.damage, null, source),
      enemy,
      ctx
    );
  }
}
