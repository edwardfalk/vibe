import { atan2, cos, sin } from '../../mathUtils.js';
import {
  DAMAGE_RESULT,
  normalizeDamageResult,
} from '../../shared/contracts/DamageResult.js';

function handleRusherExplosionResult(result, enemyIndex, context) {
  const {
    enemies,
    collisionSystem,
    explosionManager,
    visualEffectsManager,
    audio,
    cameraSystem,
  } = context;

  if (collisionSystem) {
    collisionSystem.handleRusherExplosion(result, enemyIndex);
  }

  if (explosionManager) {
    explosionManager.addExplosion(result.x, result.y, 'rusher-explosion');
  }

  if (visualEffectsManager) {
    try {
      visualEffectsManager.addExplosionParticles(
        result.x,
        result.y,
        'rusher-explosion'
      );
      visualEffectsManager.triggerChromaticAberration(0.8, 45);
      visualEffectsManager.triggerBloom(0.5, 30);
    } catch (error) {
      console.log('⚠️ Explosion effects error:', error);
    }
  }

  if (audio) {
    audio.playExplosion(result.x, result.y);
  }

  if (cameraSystem) {
    cameraSystem.addShake(18, 30);
  }

  console.log(`💥 RUSHER EXPLOSION at (${result.x}, ${result.y})!`);
  const enemy = enemies[enemyIndex];
  if (enemy) enemy.markedForRemoval = true;
}

function handleStabberAttackResult(result, context) {
  const {
    enemies,
    player,
    gameState,
    audio,
    cameraSystem,
    explosionManager,
    collisionSystem,
  } = context;

  console.log(
    `🗡️ Stabber attack result: ${result.type} at (${Math.round(result.x)}, ${Math.round(result.y)})`
  );

  if (result.type === 'stabber-melee' && result.playerHit && player) {
    console.log(
      `⚔️ STABBER HIT! Player took ${result.damage} damage from stab attack`
    );

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
      console.log('💀 PLAYER KILLED BY STABBER ATTACK!');
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

    const damageResult = normalizeDamageResult(
      targetEnemy.takeDamage(hit.damage, hit.angle, 'stabber')
    );

    if (damageResult === DAMAGE_RESULT.DIED) {
      console.log(`💀 ${targetEnemy.type} killed by stabber friendly fire!`);

      if (collisionSystem) {
        collisionSystem.handleEnemyDeath(
          targetEnemy,
          targetEnemy.type,
          targetEnemy.x,
          targetEnemy.y
        );
      }

      const enemyIndex = enemies.indexOf(targetEnemy);
      if (enemyIndex !== -1) {
        enemies[enemyIndex].markedForRemoval = true;
      }

      if (gameState) {
        gameState.addKill();
        gameState.addScore(15);
      }
    } else if (damageResult === DAMAGE_RESULT.EXPLODING) {
      if (explosionManager) {
        explosionManager.addExplosion(targetEnemy.x, targetEnemy.y, 'hit');
      }
      if (audio) {
        audio.playHit(targetEnemy.x, targetEnemy.y);
      }
      console.log(
        `💥 Stabber friendly fire caused ${targetEnemy.type} to explode!`
      );
    } else {
      if (explosionManager) {
        explosionManager.addExplosion(targetEnemy.x, targetEnemy.y, 'hit');
      }
      if (audio) {
        audio.playHit(targetEnemy.x, targetEnemy.y);
      }
      console.log(
        `🗡️ ${targetEnemy.type} damaged by stabber friendly fire, health: ${targetEnemy.health}`
      );
    }
  }
}

export function updateEnemiesAndResolveResults(context) {
  const { enemies, enemyBullets, player, deltaTimeMs } = context;

  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    if (enemy.health <= 0 || enemy.markedForRemoval) {
      continue;
    }

    const result = enemy.update(
      player ? player.x : 400,
      player ? player.y : 300,
      deltaTimeMs
    );

    if (!result) continue;

    if (result.type === 'rusher-explosion') {
      handleRusherExplosionResult(result, i, context);
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
      handleStabberAttackResult(result, context);
      continue;
    }

    console.warn(`⚠️ Unknown object returned from enemy update:`, result);
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].markedForRemoval) enemies.splice(i, 1);
  }
}
