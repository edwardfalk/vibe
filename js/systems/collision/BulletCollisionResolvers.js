/**
 * Bullet hit resolution logic extracted from CollisionSystem.
 * Each function resolves what happens when a bullet hits a target.
 */

import { Bullet } from '../../entities/bullet.js';
import { handleDamageResult } from '../../shared/DamageResultHandler.js';
import { applyKillFeedback } from '../combat/KillFeedback.js';

/**
 * Resolve a player bullet hitting an enemy.
 * @returns {boolean} true if bullet hit
 */
export function resolveBulletEnemyHit(bullet, enemy, deps) {
  const { getContextValue, handleEnemyDeath, getContext } = deps;
  if (!bullet.checkCollision(enemy)) return false;

  const context = getContext();
  const explosionManager = getContextValue('explosionManager');
  const audio = getContextValue('audio');
  const gameState = getContextValue('gameState');
  const floatingText = getContextValue('floatingText');
  const beatClock = getContextValue('beatClock');
  const visualEffectsManager = getContextValue('visualEffectsManager');
  const cameraSystem = getContextValue('cameraSystem');

  // Read before damage is applied
  const enemyType = enemy.type;

  // Damage enemy (pass bullet angle for knockback)
  const rawResult = enemy.takeDamage(bullet.damage, bullet.angle);

  handleDamageResult(rawResult, enemy, {
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

  handleDamageResult(
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

  Bullet.release(bullet);
  bullet._remove = true;
}
