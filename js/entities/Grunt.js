import { BaseEnemy } from './BaseEnemy.js';
import { random, sqrt, atan2 } from '../mathUtils.js';
import { CONFIG } from '../config.js';
import { DAMAGE_RESULT } from '../shared/DamageResult.js';
import {
  handleDamageResult,
  STABBER_KILL_POINTS,
} from '../shared/DamageResultHandler.js';

// Per-beat chances for beat-gated grunt sounds (rolled once per beat)
const GRUNT_WEIRD_NOISE_CHANCE = 0.2;
const GRUNT_MOVE_SOUND_CHANCE = 0.5;
// Per attempt once the speech timer is up (= today's effective rate)
const GRUNT_SPEECH_CHANCE = 0.18;

const GRUNT_LINES = [
  'KILL HUMAN!',
  'DESTROY TARGET!',
  'ELIMINATE!',
  'ATTACK MODE!',
  'HOSTILE DETECTED!',
  'ENGAGE ENEMY!',
  'FIRE WEAPONS!',
  'DEATH TO HUMANS!',
  'WAIT WHAT?',
  'I FORGOT SOMETHING!',
  'WHERE AM I?',
  'HELP!',
  'WRONG PLANET?',
  'NEED BACKUP!',
  'LOST AGAIN!',
  'OOPS!',
  'MY HELMET IS TIGHT!',
  'WIFI PASSWORD?',
  'MOMMY?',
  'SCARED!',
  'IS THAT MY TARGET?',
  'WHICH BUTTON?',
  "I'M CONFUSED!",
];

/**
 * Grunt class - Tactical ranged combat AI
 * Maintains tactical distance, uses friendly fire avoidance, confused personality
 */
class Grunt extends BaseEnemy {
  constructor(x, y, type, config, p, audio) {
    const gruntConfig = {
      ...config,
      size: 26,
      health: 2,
      speed: 1.2,
      color: p.color(50, 205, 50), // Lime green
    };
    super(x, y, 'grunt', gruntConfig, p, audio);

    // --- Deferred-death state ---------------------------------
    this.pendingStabDeath = false; // true while "ow" delay active
    this.pendingStabDeathTimer = 0; // frames remaining
    this._pendingStabDeathParams = null;

    // Grunt weird noises are now beat-gated (no timer needed)
  }

  /**
   * Update specific grunt behavior - tactical ranged combat
   * @param {number} playerX - Player X position
   * @param {number} playerY - Player Y position
   * @param {number} deltaTimeMs - Time elapsed since last frame in milliseconds
   */
  updateSpecificBehavior(
    playerX,
    playerY,
    deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS
  ) {
    // Handle delayed death if stabbed
    const dt = deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS; // Normalize to 60fps baseline
    if (this.pendingStabDeath) {
      this.pendingStabDeathTimer -= dt;
      if (this.pendingStabDeathTimer <= 0) {
        this.pendingStabDeath = false;
        // Actually die now, through the same path (and score) as any stab kill
        const { amount, bulletAngle, damageSource } =
          this._pendingStabDeathParams;
        this._pendingStabDeathParams = null;
        const collisionSystem = this.getContextValue('collisionSystem');
        handleDamageResult(
          super.takeDamage(amount, bulletAngle, damageSource),
          this,
          {
            explosionManager: this.getContextValue('explosionManager'),
            audio: this.getContextValue('audio'),
            gameState: this.getContextValue('gameState'),
            onDeath: (e) =>
              collisionSystem?.handleEnemyDeath(e, e.type, e.x, e.y),
            scorePoints: STABBER_KILL_POINTS,
          }
        );
        // Mark for removal instead of splicing the array
        this.markedForRemoval = true;
        this.velocity.x = 0; // Ensure Grunt stops moving during delayed death
        this.velocity.y = 0;
        return null;
      }
      // While pending death, do nothing else
      this.velocity.x = 0; // Ensure Grunt stops moving during delayed death
      this.velocity.y = 0;
      return null;
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distance = sqrt(dx * dx + dy * dy);

    // Handle grunt weird noise (beat-gated)
    const beatClock = this.getContextValue('beatClock');
    const audio = this.getContextValue('audio');
    if (
      this.onBeatOnce(beatClock, 'weirdNoise', beatClock?.isOnBeat([2, 4])) &&
      random() < GRUNT_WEIRD_NOISE_CHANCE
    ) {
      this.makeGruntWeirdNoise();
    }

    // Grunts maintain tactical distance (150-250 pixels)
    const tooClose = 150;
    const tooFar = 250;

    this.velocity.x = 0;
    this.velocity.y = 0;

    let moveSound = null;
    if (distance > 0) {
      const unitX = dx / distance;
      const unitY = dy / distance;

      if (distance < tooClose) {
        // Too close - retreat while maintaining line of sight
        this.velocity.x = -unitX * this.speed * 0.8;
        this.velocity.y = -unitY * this.speed * 0.8;

        // Tactical side-step 40% of the time
        if (random() < 0.4) {
          this.velocity.x += random(-0.5, 0.5);
          this.velocity.y += random(-0.5, 0.5);
        }
        moveSound = 'gruntRetreat';
      } else if (distance > tooFar) {
        // Too far - advance but maintain tactical spacing
        this.velocity.x = unitX * this.speed * 0.6;
        this.velocity.y = unitY * this.speed * 0.6;
        moveSound = 'gruntAdvance';
      } else {
        // At ideal distance - maintain position with small movements
        this.velocity.x = random(-0.3, 0.3);
        this.velocity.y = random(-0.3, 0.3);
      }
    }
    if (
      moveSound &&
      audio &&
      this.onBeatOnce(beatClock, 'moveSound', beatClock?.isOnBeat([2, 4])) &&
      random() < GRUNT_MOVE_SOUND_CHANCE
    ) {
      audio.playSound(moveSound, this.x, this.y);
    }

    // BEAT-ALIGNED GRUNT SHOOTING: once per beat 2 or 4, with random skip
    const rhythmFX = this.getContextValue('rhythmFX');
    if (distance < 300 && beatClock) {
      const timeToNextAttack = beatClock.getTimeToNextBeat();
      const beatInterval = beatClock.beatInterval;
      const safeScale =
        beatInterval && Number.isFinite(beatInterval)
          ? timeToNextAttack / beatInterval
          : 0;
      if (timeToNextAttack < 500 && beatClock.isOnBeat([2, 4])) {
        if (rhythmFX && safeScale >= 0) {
          rhythmFX.addAttackTelegraph(this.x, this.y, 'grunt', safeScale);
        }
      }

      if (this.onBeatOnce(beatClock, 'fire', beatClock.canGruntShoot())) {
        // Coordination: check if another grunt already fired this beat
        const currentTotalBeat = beatClock.getTotalBeats();
        const lastGruntFireBeat = this.getContextValue('gruntFireBeat') ?? -1;
        const alreadyFired = lastGruntFireBeat === currentTotalBeat;

        // Higher skip chance if another grunt already fired this beat
        const skipChance = alreadyFired ? 0.6 : 0.2;
        if (random() >= skipChance && !this.shouldAvoidFriendlyFire()) {
          // Fire!
          this.muzzleFlash = 4;
          this.context.set('gruntFireBeat', currentTotalBeat);
          return this.createBullet();
        }
      }
    }

    return null;
  }

  /**
   * Check if grunt should avoid friendly fire
   */
  shouldAvoidFriendlyFire() {
    const enemies = this.getContextValue('enemies');
    if (!enemies) return false;
    // Defensive: If aimAngle is not set, skip friendly fire check to avoid NaN results
    if (typeof this.aimAngle !== 'number') return false;

    const bulletPath = {
      startX: this.x,
      startY: this.y,
      angle: this.aimAngle,
      range: 400, // Check 400 pixels ahead
    };

    for (const otherEnemy of enemies) {
      if (otherEnemy === this) continue; // Skip self

      // Calculate if other enemy is in the line of fire
      const dx = otherEnemy.x - this.x;
      const dy = otherEnemy.y - this.y;
      const distanceToOther = sqrt(dx * dx + dy * dy);

      if (distanceToOther < bulletPath.range) {
        // Calculate angle to other enemy
        const angleToOther = atan2(dy, dx);
        // Minimal angular difference (handle wrap-around)
        const angleDifference = Math.abs(angleToOther - bulletPath.angle);
        const normalizedAngleDiff = Math.min(
          angleDifference,
          Math.PI * 2 - angleDifference
        );

        // If other enemy is within 20 degrees of aim angle, consider avoiding
        if (normalizedAngleDiff < Math.PI / 9) {
          // 20 degrees
          // 45% chance to avoid shooting (grunts try to avoid but aren't perfect)
          if (random() < 0.45) {
            return true;
          } else {
            return false;
          }
        }
      }
    }

    return false;
  }

  /**
   * Make weird grunt noises (separate from speech)
   */
  makeGruntWeirdNoise() {
    const audio = this.getContextValue('audio');
    if (audio) {
      const weirdSounds = [
        'gruntMalfunction',
        'gruntBeep',
        'gruntWhir',
        'gruntError',
        'gruntGlitch',
      ];
      const randomSound = random(weirdSounds);
      audio.playSound(randomSound, this.x, this.y);
    }
  }

  /** @override */
  getAmbientSpeechConfig() {
    return {
      lines: GRUNT_LINES,
      gate: (beatClock) => !!beatClock?.isOnBeat([2, 4]),
      chance: GRUNT_SPEECH_CHANCE,
    };
  }

  /**
   * The head and antennae lean the art about 6 px toward local -y (measured
   * -25..+13 px across a bullet's path); this puts it back on the hit circle.
   * @override
   */
  get artOffsetY() {
    return this.size * 0.23;
  }

  /**
   * Draw grunt-specific body shape with round, bumbling baby-like features
   */
  drawBody(s) {
    // Main round body (baby-like proportions)
    this.p.fill(this.bodyColor);
    this.p.noStroke();
    this.p.ellipse(0, 0, s, s * 0.9); // Rounder main body

    const r = this.p.red(this.bodyColor);
    const g = this.p.green(this.bodyColor);
    const b = this.p.blue(this.bodyColor);

    // Round baby-like head (larger and rounder)
    this.p.fill(r + 20, g + 20, b + 20);
    this.p.ellipse(0, -s * 0.4, s * 0.8, s * 0.8); // Big round head

    // Simple round helmet (baby helmet style)
    this.p.fill(120, 120, 150); // Gray helmet color
    this.p.arc(0, -s * 0.4, s * 0.85, s * 0.5, this.p.PI, this.p.TWO_PI);

    // Small gold triangle badge (looks official but cute)
    this.p.fill(255, 215, 0); // Gold
    this.p.triangle(0, -s * 0.6, -s * 0.06, -s * 0.5, s * 0.06, -s * 0.5);

    // BIG ROUND BUMBLING EYES (different sizes for silly look)
    this.p.fill(100, 255, 100); // Bright green eyes
    this.p.ellipse(-s * 0.15, -s * 0.35, s * 0.16); // Left eye (bigger and rounder)
    this.p.ellipse(s * 0.12, -s * 0.38, s * 0.12); // Right eye (smaller, slightly offset)

    // Eye highlights (make them look innocent/bumbling)
    this.p.fill(255);
    this.p.ellipse(-s * 0.12, -s * 0.32, s * 0.06); // Left highlight (bigger)
    this.p.ellipse(s * 0.15, -s * 0.36, s * 0.04); // Right highlight (smaller)

    // SHORT STUMPY ANTENNAE (baby-like proportions)
    this.p.stroke(this.bodyColor);
    this.p.strokeWeight(3); // Thicker for baby look
    this.p.line(-s * 0.15, -s * 0.7, -s * 0.18, -s * 0.85); // Left antenna (shorter)
    this.p.line(s * 0.15, -s * 0.7, s * 0.18, -s * 0.85); // Right antenna (shorter)

    // Round antenna bobbles (bigger and more prominent)
    this.p.fill(100, 255, 100); // Matching eye color
    this.p.noStroke();
    this.p.ellipse(-s * 0.18, -s * 0.85, s * 0.12); // Left bobble (bigger)
    this.p.ellipse(s * 0.18, -s * 0.85, s * 0.12); // Right bobble (bigger)

    // Chubby little arms
    this.p.fill(r + 10, g + 10, b + 10);
    this.p.ellipse(-s * 0.4, -s * 0.1, s * 0.2, s * 0.35); // Left arm (round)
    this.p.ellipse(s * 0.4, -s * 0.1, s * 0.2, s * 0.35); // Right arm (round)

    // Little round hands
    this.p.fill(this.bodyColor);
    this.p.ellipse(-s * 0.45, s * 0.05, s * 0.12); // Left hand
    this.p.ellipse(s * 0.45, s * 0.05, s * 0.12); // Right hand

    // Minimal tactical gear (just a belt so they look "official")
    this.p.fill(r + 30, g + 30, b + 30);
    this.p.rect(-s * 0.3, s * 0.1, s * 0.6, s * 0.08); // Simple belt
  }

  /**
   * Special deferred death logic for stabber melee:
   * If a Grunt is killed by a stabber melee attack, it plays an "ow" sound and delays actual death for a short period (e.g., 12 frames).
   * Only after the delay does it call super.takeDamage() to trigger death effects (explosion, score, removal).
   * This ensures all death effects are triggered exactly once, preventing double explosions or score increments.
   * This pattern is unique to Grunt and not used for other enemies unless they require similar dramatic or audio effects.
   */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    // Reject further damage while deferred death is pending
    if (this.pendingStabDeath) return DAMAGE_RESULT.DAMAGED;

    if (
      damageSource === 'stabber_melee' &&
      this.health > 0 &&
      amount >= this.health
    ) {
      // About to die from stabber: play 'ow', delay death
      const audio = this.getContextValue('audio');
      if (audio) this.sayOw(audio);
      // Set up delayed death, but don't call super.takeDamage() yet
      if (!this.pendingStabDeath) {
        this.pendingStabDeath = true;
        this.pendingStabDeathTimer = 12; // ~200ms at 60fps
        this._pendingStabDeathParams = { amount, bulletAngle, damageSource };
      }
      // Signal DAMAGED (not DIED) — deferred timer handles death exclusively
      return DAMAGE_RESULT.DAMAGED;
    }
    const result = super.takeDamage(amount, bulletAngle, damageSource);
    const died = result === DAMAGE_RESULT.DIED;
    const audioSurv = this.getContextValue('audio');
    if (damageSource !== 'stabber_melee' && !died && audioSurv) {
      audioSurv.playSound('gruntHit', this.x, this.y);
    }
    if (
      damageSource === 'stabber_melee' &&
      !died &&
      audioSurv &&
      this.speechCooldown <= 0
    ) {
      this.sayOw(audioSurv);
      this.speechCooldown = 60; // 1s cooldown to avoid spam
    }
    return result;
  }

  /** "Ow": spoken (forced past the voice cooldown), else the sound */
  sayOw(audio) {
    if (!audio.speak(this, 'ow', 'grunt', true)) {
      audio.playSound('gruntOw', this.x, this.y);
    }
  }
}

export { Grunt };
