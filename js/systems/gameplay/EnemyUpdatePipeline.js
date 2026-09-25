import { atan2, cos, sin } from '../../mathUtils.js';
import { CONFIG } from '../../config.js';
import { handleDamageResult } from '../../shared/DamageResultHandler.js';

function handleRusherExplosionResult(result, enemy, context) {
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
    explosionManager.addExplosion(result.x, result.y, 'rusher-explosion');
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
    audio.playExplosion(result.x, result.y);
  }

  if (cameraSystem) {
    cameraSystem.addShake(28, 40);
  }

  if (enemy) enemy.markedForRemoval = true;
}

function handleStabberAttackResult(result, context) {
  const {
    player,
    gameState,
    audio,
    cameraSystem,
    explosionManager,
    collisionSystem,
  } = context;

  if (result.type === 'stabber-melee' && result.playerHit && player) {
    if (audio) {
      audio.playPlayerHit();
    }

    if (gameState) {
      gameState.resetKillStreak();
    }

    if (player.takeDamage(result.damage, 'stabber-melee')) {
      if (gameState) {
        gameState.setGameState('gameOver');
      }
    } else {
      const knockbackAngle = atan2(player.y - result.y, player.x - result.x);
      const knockbackForce = 8;
      player.velocity.x += cos(knockbackAngle) * knockbackForce;
      player.velocity.y += sin(knockbackAngle) * knockbackForce;

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
        audio,
        gameState,
        onDeath: (e) => {
          if (collisionSystem) {
            collisionSystem.handleEnemyDeath(e, e.type, e.x, e.y);
          }
        },
        scorePoints: 15,
      }
    );
  }
}

export function updateEnemiesAndResolveResults(context) {
  const { enemies, enemyBullets, player, deltaTimeMs } = context;

  let write = 0;
  for (let read = 0; read < enemies.length; read++) {
    const enemy = enemies[read];

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
        handleRusherExplosionResult(result, enemy, context);
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

    if (!enemy.markedForRemoval) {
      enemies[write++] = enemy;
    }
  }
  enemies.length = write;
}
