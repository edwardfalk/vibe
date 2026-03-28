import {
  DAMAGE_RESULT,
  normalizeDamageResult,
} from './contracts/DamageResult.js';

/**
 * Handles a normalized damage result with standard effects.
 *
 * All three call-sites (CollisionSystem, EnemyUpdatePipeline, AreaDamageHandler)
 * share the same EXPLODING/DAMAGED/DIED switch structure. This function captures
 * the common behavior and parameterizes the differences via `ctx`.
 *
 * @param {*} rawResult - Raw return value from enemy.takeDamage()
 * @param {object} enemy - The damaged enemy
 * @param {object} ctx - Context bag:
 *   Required: { explosionManager, audio }
 *   Death handling (at least one): { enemyDeathHandler } or { onDeath(enemy) }
 *   Scoring: { gameState, scorePoints } (default 10)
 *   Kill feedback (optional): { killFeedback: { beatClock, floatingText,
 *       visualEffectsManager, cameraSystem, getHitStopFrames, setHitStopFrames } }
 *   Hit position (optional): { hitX, hitY } - where the hit visual goes,
 *       defaults to enemy.x, enemy.y
 *   Floating damage (optional): { floatingText, bulletDamage } - shows damage number on DAMAGED
 * @returns {string} The normalized DAMAGE_RESULT value
 */
export function handleDamageResult(rawResult, enemy, ctx) {
  const result = normalizeDamageResult(rawResult);

  const hitX = ctx.hitX ?? enemy.x;
  const hitY = ctx.hitY ?? enemy.y;

  if (result === DAMAGE_RESULT.EXPLODING) {
    addHitEffect(ctx, hitX, hitY);
    return result;
  }

  if (result === DAMAGE_RESULT.DIED) {
    // Death effects (explosion + type-specific sound)
    if (ctx.onDeath) {
      ctx.onDeath(enemy);
    } else if (ctx.enemyDeathHandler) {
      ctx.enemyDeathHandler.handleEnemyDeath(
        enemy,
        enemy.type,
        enemy.x,
        enemy.y
      );
    }

    // Extra audio on death (e.g. friendly-fire explosion sound)
    if (ctx.deathAudio && ctx.audio) {
      ctx.audio[ctx.deathAudio](enemy.x, enemy.y);
    }

    enemy.markedForRemoval = true;

    // Scoring: either full kill-feedback or simple addKill + addScore
    if (ctx.killFeedback) {
      const { applyKillFeedback } = ctx.killFeedback;
      applyKillFeedback({
        gameState: ctx.gameState,
        enemy,
        enemyType: enemy.type,
        ...ctx.killFeedback,
      });
    } else if (ctx.gameState) {
      ctx.gameState.addKill();
      const points = ctx.scorePoints ?? 10;
      ctx.gameState.addScore(points);
    }

    return result;
  }

  // DAMAGED or NONE
  if (result === DAMAGE_RESULT.DAMAGED) {
    addHitEffect(ctx, hitX, hitY);

    // Optional floating damage number
    if (ctx.floatingText && ctx.bulletDamage != null) {
      const size = Number(enemy.size) || 0;
      ctx.floatingText.addDamage(
        enemy.x,
        enemy.y - size * 0.5,
        ctx.bulletDamage
      );
    }
  }

  return result;
}

function addHitEffect(ctx, x, y) {
  if (ctx.explosionManager) {
    ctx.explosionManager.addExplosion(x, y, 'hit');
  }
  if (ctx.audio) {
    ctx.audio.playHit(x, y);
  }
}
