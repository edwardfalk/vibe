import { CONFIG } from '../../config.js';
import {
  handleDamageResult,
  STABBER_KILL_POINTS,
} from '../../shared/DamageResultHandler.js';
import { damageEnemiesInRadius } from '../../effects/AreaDamageHandler.js';

function handleRusherExplosionResult(result, enemy, context, blasts) {
  const {
    collisionSystem,
    explosionManager,
    visualEffectsManager,
    audio,
    cameraSystem,
  } = context;

  if (collisionSystem) {
    collisionSystem.handleRusherExplosion(result, enemy);
  }

  if (explosionManager) {
    explosionManager.addExplosion(result.x, result.y, 'rusher-explosion', {
      chain: result.chain,
    });
  }

  if (visualEffectsManager) {
    try {
      visualEffectsManager.triggerChromaticAberration(0.8, 45);
      visualEffectsManager.triggerBloom(0.5, 30);
    } catch (error) {
      console.warn('⚠️ Explosion effects error:', error);
    }
  }

  if (audio) {
    audio.playSound('rusherCrash', result.x, result.y);
  }

  if (cameraSystem) {
    cameraSystem.addShake(28, 40);
  }

  if (enemy) enemy.markedForRemoval = true;
  blasts.push(result);
}

function handleStabberAttackResult(result, context) {
  const { player, gameState, cameraSystem, explosionManager, collisionSystem } =
    context;

  if (result.type === 'stabber-melee' && result.playerHit && player) {
    if (!player.hurt(result.damage, 'stabber-melee')) {
      player.knockBack(result.x, result.y, CONFIG.PLAYER.KNOCKBACK_STAB);

      if (cameraSystem) {
        cameraSystem.addShake(10, 20);
      }

      if (explosionManager) {
        explosionManager.addExplosion(player.x, player.y, 'hit');
      }
    }
  }

  if (!result.enemiesHit || result.enemiesHit.length <= 0) return;

  for (let k = result.enemiesHit.length - 1; k >= 0; k--) {
    const hit = result.enemiesHit[k];
    const targetEnemy = hit.enemy;

    handleDamageResult(
      targetEnemy.takeDamage(hit.damage, hit.angle, 'stabber_melee'),
      targetEnemy,
      {
        explosionManager,
        gameState,
        onDeath: (e) => {
          if (collisionSystem) {
            collisionSystem.handleEnemyDeath(e, e.type, e.x, e.y, {
              dir: hit.angle,
            });
          }
        },
        scorePoints: STABBER_KILL_POINTS,
      }
    );
  }
}

export function updateEnemiesAndResolveResults(context) {
  const { enemies, enemyBullets, player, deltaTimeMs } = context;

  const blasts = [];
  // The array stays as it is until every enemy has updated: a death inside
  // an update (a stab kill) asks its neighbours to answer from it, and
  // compacting as the loop goes lists the ones already kept twice
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];

    if (enemy.markedForRemoval) {
      continue;
    }

    const result = enemy.update(
      player ? player.x : CONFIG.GAME_SETTINGS.WORLD_WIDTH / 2,
      player ? player.y : CONFIG.GAME_SETTINGS.WORLD_HEIGHT / 2,
      deltaTimeMs
    );

    if (result) {
      if (result.type === 'rusher-explosion') {
        handleRusherExplosionResult(result, enemy, context, blasts);
      } else if (typeof result.checkCollision === 'function') {
        enemyBullets.push(result);
      } else if (
        result.type === 'stabber-melee' ||
        result.type === 'stabber-miss'
      ) {
        handleStabberAttackResult(result, context);
      } else {
        console.warn(`⚠️ Unknown object returned from enemy update:`, result);
      }
    }
  }
  dropRemoved(enemies);

  if (blasts.length > 0) damageEnemiesInBlasts(blasts, context);
}

/** Takes the enemies marked for removal out of the array, in place */
function dropRemoved(enemies) {
  let write = 0;
  for (const enemy of enemies) {
    if (!enemy.markedForRemoval) enemies[write++] = enemy;
  }
  enemies.length = write;
}

/**
 * Blasts land after compaction, so each enemy is in the array once, and
 * what they kill leaves it before bullets run. A rusher caught in a blast
 * lights its own fuse and blows on its own beat.
 */
function damageEnemiesInBlasts(blasts, context) {
  const { enemies, gameState, collisionSystem } = context;
  // The exploded rushers are already out of the array
  for (const result of blasts) {
    damageEnemiesInRadius(
      result,
      enemies,
      {
        explosionManager: context.explosionManager,
        // No scoring from blasts in the frame the game ended
        gameState,
        onDeath: (e, blow) =>
          collisionSystem?.handleEnemyDeath(e, e.type, e.x, e.y, blow),
        scorePoints: 10,
      },
      'rusher-blast'
    );
  }
  dropRemoved(enemies);
}
