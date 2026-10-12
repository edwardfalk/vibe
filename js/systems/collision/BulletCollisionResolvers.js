/**
 * Bullet hit resolution logic extracted from CollisionSystem.
 * Each function resolves what happens when a bullet hits a target.
 */

import { CONFIG } from '../../config.js';
import { Bullet } from '../../entities/bullet.js';
import {
  handleDamageResult,
  killPoints,
} from '../../shared/DamageResultHandler.js';
import { applyKillFeedback } from '../combat/KillFeedback.js';
import { NOTE_OWNER } from '../../entities/BassNote.js';

/**
 * Resolve a player bullet hitting an enemy.
 * @returns {boolean} true if bullet hit
 */
export function resolveBulletEnemyHit(bullet, enemy, deps) {
  const { getContextValue, handleEnemyDeath, getContext } = deps;
  if (!bullet.checkCollision(enemy)) return false;

  const context = getContext();
  const explosionManager = getContextValue('explosionManager');
  const gameState = getContextValue('gameState');
  const floatingText = getContextValue('floatingText');
  const beatClock = getContextValue('beatClock');
  const visualEffectsManager = getContextValue('visualEffectsManager');
  const cameraSystem = getContextValue('cameraSystem');

  // Read before damage is applied
  const enemyType = enemy.type;

  gameState?.addShotHit();
  // Damage enemy (pass bullet angle for knockback)
  const result = enemy.takeDamage(bullet.damage, bullet.angle);

  handleDamageResult(result, enemy, {
    explosionManager,
    gameState,
    onDeath: (e) =>
      handleEnemyDeath(e, enemyType, bullet.x, bullet.y, { dir: bullet.angle }),
    killFeedback: {
      applyKillFeedback,
      beatClock,
      floatingText,
      visualEffectsManager,
      cameraSystem,
      getHitStopFrames: () => context.get('hitStopFrames') ?? 0,
      setHitStopFrames: (value) => context.set('hitStopFrames', value),
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
  // A tank's ball, or a bassist's note: another tank only takes
  // a dent, through his armour, and the shot is spent on him; so is it on a
  // rusher, whom it lights as any hit does (he never dies of damage: he
  // blows on his beat); any other alien it meets dies outright
  // A bassist's note dents by its own number, and kills without the ball's sounds
  const note = bullet.owner === NOTE_OWNER;
  if (enemy.type === 'tank' || enemy.type === 'rusher') {
    const dent = note
      ? CONFIG.BASSIST.NOTE_DAMAGE_TO_TANKS
      : CONFIG.TANK.SHOT_DAMAGE_TO_TANKS;
    handleRegularEnemyBulletHit(bullet, enemy, deps, dent);
    return;
  }
  const { getContextValue, handleEnemyDeath } = deps;
  const audio = getContextValue('audio');
  const gameState = getContextValue('gameState');
  if (audio && !note) {
    audio.playSound('tankBallKill', bullet.x, bullet.y);
  }

  // Calculate energy cost based on enemy's remaining health
  const energyCost =
    enemy.maxHealth > 0 ? (enemy.health / enemy.maxHealth) * 30 : 0;

  // Kill the enemy: his own death
  handleEnemyDeath(enemy, enemy.type, enemy.x, enemy.y, { dir: bullet.angle });

  if (audio && !note) {
    audio.playSound('enemyFrying', enemy.x, enemy.y);
  }

  enemy.markedForRemoval = true;

  if (gameState) {
    gameState.addKill();

    // Energy ball kills get bonus points
    let points = killPoints(enemy, 12);
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
export function handleRegularEnemyBulletHit(
  bullet,
  enemy,
  deps,
  damage = bullet.damage
) {
  const { getContextValue, handleEnemyDeath } = deps;
  const explosionManager = getContextValue('explosionManager');
  const gameState = getContextValue('gameState');

  // Determine bullet source type for tank anger tracking
  let bulletSource = 'unknown';
  if (bullet.owner === 'enemy-grunt') {
    bulletSource = 'grunt';
  } else if (bullet.owner === 'enemy-stabber') {
    bulletSource = 'stabber';
  } else if (bullet.owner === 'enemy-tank') {
    bulletSource = 'tank';
  } else if (bullet.owner === NOTE_OWNER) {
    bulletSource = 'bassist';
  }

  handleDamageResult(
    enemy.takeDamage(damage, bullet.angle, bulletSource),
    enemy,
    {
      explosionManager,
      gameState,
      onDeath: (e) =>
        handleEnemyDeath(e, e.type, e.x, e.y, { dir: bullet.angle }),
      scorePoints: 8,
      hitX: bullet.x,
      hitY: bullet.y,
    }
  );

  Bullet.release(bullet);
  bullet._remove = true;
}
