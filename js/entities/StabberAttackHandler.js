/**
 * StabberAttackHandler - Encapsulates Stabber melee attack logic.
 * Three-phase system: approach → prepare → dash attack.
 * Extracted from Stabber.js for file-size split (~500 line guideline).
 */

import {
  floor,
  random,
  sqrt,
  sin,
  cos,
  atan2,
  normalizeAngle,
} from '../mathUtils.js';
import { CONFIG } from '../config.js';

const STABBER_CHANT_CHANCE = 0.35; // per off-beat window

/** Update stabber attack behavior; returns hit result or null. */
const MAX_DELTA_MS = 100;

export function updateStabberBehavior(stabber, playerX, playerY, deltaTimeMs) {
  const dx = playerX - stabber.x;
  const dy = playerY - stabber.y;
  const distance = sqrt(dx * dx + dy * dy);

  const clampedDeltaMs = Math.min(deltaTimeMs, MAX_DELTA_MS);
  const dt = clampedDeltaMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS;
  if (stabber.stabCooldown > 0) stabber.stabCooldown -= dt;

  // Beat-gated stabber chant (replaces frame-based stabChantTimer)
  const beatClock = stabber.getContextValue('beatClock');
  if (
    beatClock &&
    stabber.onBeatOnce(beatClock, 'chant', beatClock.canStabberAttack()) &&
    !stabber.stabPreparing &&
    !stabber.isStabbing &&
    !stabber.stabWarning &&
    !stabber.stabRecovering &&
    random() < STABBER_CHANT_CHANCE
  ) {
    const audio = stabber.getContextValue('audio');
    if (audio) {
      audio.playSound('stabberChant', stabber.x, stabber.y);
    }
  }

  const dtSeconds = clampedDeltaMs / 1000;
  stabber.x += stabber.knockbackVelocity.x * dtSeconds;
  stabber.y += stabber.knockbackVelocity.y * dtSeconds;
  const decayFactor = Math.pow(stabber.knockbackDecay, dt);
  stabber.knockbackVelocity.x *= decayFactor;
  stabber.knockbackVelocity.y *= decayFactor;

  if (stabber.stabRecovering) {
    return handleRecoveryPhase(stabber, dt);
  }
  if (stabber.isStabbing) {
    return handleStabbingPhase(stabber, playerX, playerY, dt);
  }
  if (stabber.stabWarning) {
    return handleWarningPhase(stabber, dt);
  }
  if (stabber.stabPreparing) {
    return handlePreparingPhase(stabber, dx, dy, distance, dt);
  }

  return handleNormalMovement(stabber, dx, dy, distance);
}

function handleRecoveryPhase(stabber, dt) {
  stabber.stabRecoveryTime += dt;
  const penetrationFrames = 10;
  const penetrationSpeedFactor = 0.5;

  if (
    stabber.stabRecoveryTime <= penetrationFrames &&
    stabber.stabDirection !== null
  ) {
    const progress = stabber.stabRecoveryTime / penetrationFrames;
    const currentPenetrationSpeed =
      stabber.speed * 7.0 * penetrationSpeedFactor * (1 - progress);
    const dx = cos(stabber.stabDirection) * currentPenetrationSpeed * dt;
    const dy = sin(stabber.stabDirection) * currentPenetrationSpeed * dt;
    stabber.x += dx;
    stabber.y += dy;
    stabber.velocity.x = 0;
    stabber.velocity.y = 0;
  } else {
    stabber.velocity.x = 0;
    stabber.velocity.y = 0;
  }

  // Recovery ends at next beat 3.5 (with minimum recovery time)
  const minRecoveryFrames = 90; // ~1.5 second minimum
  const beatClock = stabber.getContextValue('beatClock');
  if (stabber.stabRecoveryTime >= minRecoveryFrames) {
    if (!beatClock || beatClock.canStabberAttack()) {
      stabber.stabRecovering = false;
      stabber.stabRecoveryTime = 0;
      stabber.stabCooldown = 0;
    }
  }
  return null;
}

function handleStabbingPhase(stabber, playerX, playerY, dt) {
  stabber.stabAnimationTime += dt;

  if (stabber.stabDirection === null) {
    stabber.velocity.x = 0;
    stabber.velocity.y = 0;
    stabber.isStabbing = false;
    stabber.stabAnimationTime = 0;
    stabber.stabRecovering = true;
    stabber.stabRecoveryTime = 0;
    stabber.stabCooldown = 120;
    stabber.stabDirection = null;
    return null;
  }

  stabber.velocity.x = cos(stabber.stabDirection) * stabber.speed * 7.0;
  stabber.velocity.y = sin(stabber.stabDirection) * stabber.speed * 7.0;

  if (stabber.stabAnimationTime > 1) {
    const hitResult = checkStabHit(stabber, playerX, playerY);
    if (
      hitResult &&
      (hitResult.playerHit ||
        (hitResult.enemiesHit && hitResult.enemiesHit.length > 0))
    ) {
      stabber.isStabbing = false;
      stabber.stabAnimationTime = 0;
      stabber.stabRecovering = true;
      stabber.stabRecoveryTime = 0;
      stabber.stabCooldown = 180;
      stabber.stabDirection = null;
      return hitResult;
    }
  }

  if (stabber.stabAnimationTime >= stabber.maxStabAnimationTime) {
    stabber.isStabbing = false;
    stabber.stabAnimationTime = 0;
    stabber.stabRecovering = true;
    stabber.stabRecoveryTime = 0;
    stabber.stabCooldown = 120;
    stabber.stabDirection = null;
    return null;
  }
  return null;
}

function handleWarningPhase(stabber, dt) {
  stabber.stabWarningTime += dt;
  stabber.velocity.x = 0;
  stabber.velocity.y = 0;

  // Gate warning sounds to beat boundaries for rhythmic consistency
  const beatClockWarn = stabber.getContextValue('beatClock');
  const onBeat = beatClockWarn
    ? beatClockWarn.canStabberAttack() || beatClockWarn.isOnBeat()
    : true;
  const audioWarn = stabber.getContextValue('audio') || stabber.audio;
  if (!stabber.stabWarningPlayed && audioWarn && onBeat) {
    stabber.stabWarningPlayed = true;
    audioWarn.playSound('stabberStalk', stabber.x, stabber.y);
    audioWarn.playSound('stabberKnife', stabber.x, stabber.y);
    const stabWarnings = [
      'STAB TIME!',
      'SLICE AND DICE!',
      'ACUPUNCTURE TIME!',
      'STABBY MCSTABFACE!',
    ];
    const warning = random(stabWarnings);
    audioWarn.speak(stabber, warning, 'stabber');
  }

  // Transition to dash after ~half a beat (beat-relative duration)
  const beatClock = stabber.getContextValue('beatClock');
  const warningDuration = beatClock
    ? (beatClock.beatInterval * 0.5) / CONFIG.GAME_SETTINGS.FRAME_TIME_MS
    : 15;
  if (stabber.stabWarningTime >= warningDuration) {
    stabber.stabWarning = false;
    stabber.stabWarningTime = 0;
    stabber.stabWarningPlayed = false;
    stabber.isStabbing = true;
    stabber.stabAnimationTime = 0;

    const audioDash = stabber.getContextValue('audio');
    if (audioDash) {
      audioDash.playSound('stabberDash', stabber.x, stabber.y);
    }
  }
  return null;
}

function handlePreparingPhase(stabber, dx, dy, distance, dt) {
  const beatClock = stabber.getContextValue('beatClock');

  // First frame: knife extend sound
  if (stabber.stabPreparingTime === 0) {
    const audio = stabber.getContextValue('audio');
    if (audio) audio.playSound('stabberKnifeExtend', stabber.x, stabber.y);
  }

  stabber.stabPreparingTime += dt;

  // Back up during preparation if too close
  if (distance < 200) {
    const moveBackSpeed = stabber.speed * 0.5;
    if (distance > 0) {
      const unitX = dx / distance;
      const unitY = dy / distance;
      stabber.velocity.x = -unitX * moveBackSpeed;
      stabber.velocity.y = -unitY * moveBackSpeed;
    } else {
      stabber.velocity.x = 0;
      stabber.velocity.y = 0;
    }
  } else {
    stabber.velocity.x = 0;
    stabber.velocity.y = 0;
  }

  // Warn on beat 3; the dash follows half a beat later, on 3.5
  const minPrepFrames = 30; // ~0.5 seconds minimum
  if (
    stabber.stabPreparingTime >= minPrepFrames &&
    beatClock &&
    beatClock.isOnBeat([3])
  ) {
    stabber.stabPreparing = false;
    stabber.stabPreparingTime = 0;
    stabber.stabWarning = true;
    stabber.stabWarningTime = 0;
    stabber.stabWarningPlayed = false;
    stabber.stabDirection = stabber.aimAngle;
  }
  return null;
}

function handleNormalMovement(stabber, dx, dy, distance) {
  stabber.velocity.x = 0;
  stabber.velocity.y = 0;

  if (distance <= 0 || stabber.stabCooldown > 0) return null;

  const unitX = dx / distance;
  const unitY = dy / distance;

  if (distance < stabber.minStabDistance) {
    stabber.velocity.x = -unitX * stabber.speed * 1.2;
    stabber.velocity.y = -unitY * stabber.speed * 1.2;
    return null;
  }

  if (distance <= stabber.maxStabDistance) {
    const beatClockAtk = stabber.getContextValue('beatClock');
    const rhythmFX = stabber.getContextValue('rhythmFX');
    if (beatClockAtk) {
      const currentBeat = beatClockAtk.getCurrentBeat();
      const beatPhase = beatClockAtk.getBeatPhase();
      // Beats until the next dash at 3.5 (beat index 2, halfway)
      let beatsUntilStab = 2.5 - (currentBeat + beatPhase);
      if (beatsUntilStab <= 0) beatsUntilStab += 4;

      if (beatsUntilStab < 1.5 && rhythmFX) {
        rhythmFX.addAttackTelegraph(
          stabber.x,
          stabber.y,
          'stabber',
          beatsUntilStab
        );
      }

      if (beatClockAtk.canStabberAttack()) {
        stabber.stabPreparing = true;
        stabber.stabPreparingTime = 0;
        stabber.knockbackVelocity = { x: 0, y: 0 };
      } else {
        stabber.velocity.x = unitX * stabber.speed * 0.8;
        stabber.velocity.y = unitY * stabber.speed * 0.8;
      }
    }
    return null;
  }

  stabber.velocity.x = unitX * stabber.speed * 1.6;
  stabber.velocity.y = unitY * stabber.speed * 1.6;
  return null;
}

/** Check if stab hit player or other enemies during dash. */
export function checkStabHit(stabber, playerX, playerY) {
  const audioHit = stabber.getContextValue('audio');
  const enemies = stabber.getContextValue('enemies') ?? [];

  if (stabber.stabDirection == null) {
    return {
      type: 'stabber-miss',
      reason: 'no_stab_direction',
      playerHit: false,
      enemiesHit: [],
    };
  }

  const s = stabber.size;
  const extensionFactor =
    stabber.stabPreparing || stabber.stabWarning || stabber.isStabbing
      ? 2.0
      : 1.0;
  const knifeLength = s * 0.6 * extensionFactor;
  const tipOffset = 4;
  const tipX =
    stabber.x +
    cos(stabber.stabDirection) * (knifeLength + s * 0.15 + tipOffset);
  const tipY =
    stabber.y +
    sin(stabber.stabDirection) * (knifeLength + s * 0.15 + tipOffset);

  const playerDistance = sqrt((playerX - tipX) ** 2 + (playerY - tipY) ** 2);
  const stabReach = 16;
  const playerAngle = atan2(playerY - stabber.y, playerX - stabber.x);
  const playerDiff = normalizeAngle(stabber.stabDirection - playerAngle);
  const angleDifference = Math.abs(playerDiff);
  const maxStabAngle = Math.PI / 6;
  const inStabDirection = angleDifference <= maxStabAngle;

  const result = {
    type: 'stabber-miss',
    x: tipX,
    y: tipY,
    playerHit: false,
    enemiesHit: [],
  };

  if (playerDistance <= stabReach && inStabDirection) {
    result.type = 'stabber-melee';
    result.playerHit = true;
    result.damage = 25;
    result.reach = stabReach;
    result.stabAngle = stabber.stabDirection;
    result.hitType = 'player';
    if (audioHit) {
      audioHit.playSound('stabberKnifeHit', tipX, tipY);
    }
  }

  if (enemies) {
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (enemy === stabber) continue;
      const enemyDistance = sqrt((enemy.x - tipX) ** 2 + (enemy.y - tipY) ** 2);
      if (enemyDistance <= stabReach) {
        const enemyAngle = atan2(enemy.y - stabber.y, enemy.x - stabber.x);
        const enemyDiff = normalizeAngle(stabber.stabDirection - enemyAngle);
        const enemyAngleDifference = Math.abs(enemyDiff);
        const enemyInStabDirection = enemyAngleDifference <= maxStabAngle;
        if (enemyInStabDirection) {
          result.enemiesHit.push({
            enemy,
            index: i,
            damage: 25,
            angle: stabber.stabDirection,
          });
        }
      }
    }
    if (result.enemiesHit.length > 0) {
      if (audioHit) {
        audioHit.playSound('stabberKnifeHit', tipX, tipY);
      }
    }
  }

  if (result.type === 'stabber-miss') {
    result.reason =
      playerDistance > stabReach ? 'out_of_reach' : 'wrong_direction';
    result.distance = playerDistance;
    result.reach = stabReach;
  }
  return result;
}
