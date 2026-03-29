/**
 * Bullet hit resolution logic extracted from CollisionSystem.
 * Each function resolves what happens when a bullet hits a target.
 */

import { CONFIG } from '../../config.js';
import { Bullet } from '../../entities/bullet.js';
import { DAMAGE_RESULT } from '../../shared/DamageResult.js';
import { handleDamageResult } from '../../shared/DamageResultHandler.js';
import { applyKillFeedback } from '../combat/KillFeedback.js';

/**
 * Resolve a player bullet hitting an enemy.
 * @returns {boolean} true if bullet hit
 */
export function resolveBulletEnemyHit(bullet, enemy, deps) {
  const { getContextValue, handleEnemyDeath, context } = deps;

  const explosionManager = getContextValue('explosionManager');
  const audio = getContextValue('audio');
  const gameState = getContextValue('gameState');
  const floatingText = getContextValue('floatingText');
  const beatClock = getContextValue('beatClock');
  const visualEffectsManager = getContextValue('visualEffectsManager');
  const cameraSystem = getContextValue('cameraSystem');
  if (!bullet.checkCollision(enemy)) return false;

  if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
    console.log(`🎯 Bullet hit ${enemy.type} enemy! Health: ${enemy.health}`);
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
  const rawResult = enemy.takeDamage(bullet.damage, bullet.angle);
  if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
    console.log(
      `[DEBUG] takeDamage result: ${rawResult}, enemyHealthAfter=${enemy.health}`
    );
  }

  const damageResult = handleDamageResult(rawResult, enemy, {
    explosionManager,
    audio,
    gameState,
    onDeath: (e) => handleEnemyDeath(e, enemyType, bullet.x, bullet.y),
    killFeedback: {
      applyKillFeedback,
      beatClock,
      floatingText,
      visualEffectsManager,
      cameraSystem,
      getHitStopFrames: () =>
        context?.get?.('hitStopFrames') ?? window.hitStopFrames ?? 0,
      setHitStopFrames: (value) => {
        if (context && typeof context.set === 'function') {
          context.set('hitStopFrames', value);
          return;
        }
        if (typeof window !== 'undefined') {
          window.hitStopFrames = value;
        }
      },
    },
    hitX: bullet.x,
    hitY: bullet.y,
    floatingText,
    bulletDamage: bullet.damage,
  });

  if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
    if (damageResult === DAMAGE_RESULT.EXPLODING) {
      console.log(
        `💥 RUSHER SHOT! Starting explosion sequence! Was already exploding: ${wasExploding}`
      );
    } else if (damageResult === DAMAGE_RESULT.DIED) {
      console.log(`💀 ${enemyType} killed by bullet!`);
    } else {
      console.log(`🎯 ${enemyType} damaged, health now: ${enemy.health}`);
    }
  }

  // Remove bullet
  Bullet.release(bullet);
  bullet._remove = true;
  return true;
}

/**
 * Handle tank energy ball hitting an enemy (friendly fire).
 */
export function handleTankEnergyBallHit(bullet, enemy, deps) {
  const { getContextValue, handleEnemyDeath } = deps;
  const audio = getContextValue('audio');
  const gameState = getContextValue('gameState');

  if (audio) {
    audio.playTankEnergyBall(bullet.x, bullet.y);
  }

  // Calculate energy cost based on enemy's remaining health
  const energyCost =
    enemy.maxHealth > 0 ? (enemy.health / enemy.maxHealth) * 30 : 0;

  // Kill the enemy and create explosion
  handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y);

  if (audio) {
    audio.playEnemyFrying(enemy.x, enemy.y);
    audio.playExplosion(enemy.x, enemy.y);
  }

  enemy.markedForRemoval = true;

  if (gameState) {
    gameState.addKill();

    // Energy ball kills get bonus points
    let points = 12;
    if (gameState.killStreak >= 5) points *= 2;
    if (gameState.killStreak >= 10) points *= 1.5;

    gameState.addScore(points);
  }

  // Reduce bullet energy proportionally; non-energy bullets get removed immediately
  const energy = bullet.energy;
  if (typeof energy === 'number' && energy > 0) {
    bullet.energy = energy - energyCost;
    if (bullet.energy <= 0) {
      Bullet.release(bullet);
      bullet._remove = true;
    }
  } else {
    Bullet.release(bullet);
    bullet._remove = true;
  }
}

/**
 * Handle regular enemy bullet hitting another enemy (friendly fire).
 */
export function handleRegularEnemyBulletHit(bullet, enemy, deps) {
  const { getContextValue, handleEnemyDeath } = deps;
  const explosionManager = getContextValue('explosionManager');
  const audio = getContextValue('audio');
  const gameState = getContextValue('gameState');

  // Determine bullet source type for tank anger tracking
  let bulletSource = 'unknown';
  if (bullet.type === 'grunt' || bullet.owner === 'enemy-grunt') {
    bulletSource = 'grunt';
  } else if (bullet.type === 'stabber' || bullet.owner === 'enemy-stabber') {
    bulletSource = 'stabber';
  } else if (bullet.type === 'tankEnergy' || bullet.owner === 'enemy-tank') {
    bulletSource = 'tank';
  }

  const damageResult = handleDamageResult(
    enemy.takeDamage(bullet.damage, bullet.angle, bulletSource),
    enemy,
    {
      explosionManager,
      audio,
      gameState,
      onDeath: (e) => handleEnemyDeath(e, e.type, e.x, e.y),
      deathAudio: 'playExplosion',
      scorePoints: 8,
      hitX: bullet.x,
      hitY: bullet.y,
    }
  );

  if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
    if (damageResult === DAMAGE_RESULT.EXPLODING) {
      console.log(`💥 FRIENDLY FIRE caused rusher to explode!`);
    } else if (damageResult === DAMAGE_RESULT.DIED) {
      console.log(
        `💀 ${enemy.type} killed by friendly fire from ${bulletSource}!`
      );
    } else {
      console.log(
        `🎯 Friendly fire damaged ${enemy.type}, health now: ${enemy.health}`
      );
    }
  }

  if (CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS) {
    const enemyBullets = getContextValue('enemyBullets');
    console.log(
      `➖ Removing enemy bullet (hit enemy): ${bullet.owner} hit ${enemy.type} - Remaining: ${enemyBullets.length - 1}`
    );
  }
  Bullet.release(bullet);
  bullet._remove = true;
}
