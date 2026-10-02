import { BaseEnemy } from './BaseEnemy.js';
import { random, sqrt, atan2 } from '../mathUtils.js';
import { CONFIG } from '../config.js';
import { DAMAGE_RESULT } from '../shared/DamageResult.js';
import {
  handleDamageResult,
  STABBER_KILL_POINTS,
} from '../shared/DamageResultHandler.js';
import { GRUNT_LINES, GRUNT_OW } from '../audio/DialogueLines.js';
import { Bullet } from './bullet.js';
import { HEALTH_BAR_HEIGHT_PX, HEALTH_BAR_GAP_PX } from './BaseEnemyHelpers.js';
import {
  GRUNT_COLORS,
  drawGrunt,
  gruntMuzzle,
  gruntPose,
  nextFacing,
} from './GruntRenderer.js';

// Per-beat chances for beat-gated grunt sounds (rolled once per beat)
const GRUNT_WEIRD_NOISE_CHANCE = 0.2;
const GRUNT_MOVE_SOUND_CHANCE = 0.5;
// Per attempt once the speech timer is up (= today's effective rate)
const GRUNT_SPEECH_CHANCE = 0.18;
// Grunts only shoot at the hero from this close
const GRUNT_FIRE_RANGE = 300;
// Shown over a warned grunt that doesn't fire after all
// (lift: px above its health bar's top)
const SHOT_CANCELLED = {
  text: '?',
  color: [180, 180, 180],
  size: 20,
  lift: 14,
};
// Its antenna bobbles reach this many of its drawn sizes above its centre
// before the hop and the float lift them (measured over a bar of every pose:
// 1.26 sizes at ART_SCALE 1.15)
const ANTENNA_REACH = 1.1;
const GRUNT_SHOT_SPEED = 4; // px per frame

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
      color: p.color(...GRUNT_COLORS.body),
    };
    super(x, y, 'grunt', gruntConfig, p, audio);

    // --- Deferred-death state ---------------------------------
    this.pendingStabDeath = false; // true while "ow" delay active
    this.warnedOnBeat = null; // the beat a ring last warned of a shot from
    this.pendingStabDeathTimer = 0; // frames remaining
    this._pendingStabDeathParams = null;

    // --- Its look (GruntRenderer.js) --------------------------
    this.facing = 1; // 1 faces right, -1 left; update() turns it
    // BaseEnemy's random phase, so the look adds no random() call
    this.lookSeed = this.animFrame / p.TWO_PI;
    this.firedAt = null; // the clock's beat position when it last fired
    this.heldOnBeat = null; // the beat it last held its fire on after a warning
    // The beat it is drawn at, kept by update(), so a paused game freezes it.
    // A grunt can be drawn once before its first update.
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition() ?? null;

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
    const inRange = distance < GRUNT_FIRE_RANGE;
    // Warn through the beat before each shot (beats 1 and 3, counted from 0
    // here): the ring closes as beat 2 or 4 lands
    if (inRange && rhythmFX && beatClock?.getCurrentBeat() % 2 === 0) {
      const beatsUntilShot = 1 - beatClock.getBeatPhase();
      rhythmFX.addAttackTelegraph(
        this.x,
        this.y,
        'grunt',
        beatsUntilShot,
        this
      );
      this.warnedOnBeat = beatClock.getTotalBeats();
    }

    if (
      beatClock &&
      this.onBeatOnce(beatClock, 'fire', beatClock.canGruntShoot())
    ) {
      // Warned on the beat just before this one; a warning whose fire
      // window was missed (hitstop, a pause) must not show up a bar later
      const warned = this.warnedOnBeat === beatClock.getTotalBeats() - 1;
      if (inRange) {
        // Coordination: check if another grunt already fired this beat
        const currentTotalBeat = beatClock.getTotalBeats();
        const lastGruntFireBeat = this.getContextValue('gruntFireBeat') ?? -1;
        const alreadyFired = lastGruntFireBeat === currentTotalBeat;

        // Higher skip chance if another grunt already fired this beat
        const skipChance = alreadyFired ? 0.6 : 0.2;
        if (random() >= skipChance && !this.shouldAvoidFriendlyFire()) {
          // Fire!
          this.firedAt = beatClock.getBeatPosition();
          this.context.set('gruntFireBeat', currentTotalBeat);
          return this.createBullet();
        }
      }
      // A warning with nothing after it would look like a glitch
      if (warned) {
        this.heldOnBeat = beatClock.getTotalBeats();
        const { text, color, size } = SHOT_CANCELLED;
        this.getContextValue('floatingText')?.addText(
          this.x,
          this.y - this.healthBarRise - SHOT_CANCELLED.lift,
          text,
          color,
          size
        );
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

  /** @override Turns to face its target once it has moved and aimed */
  update(playerX, playerY, deltaTimeMs) {
    const bullet = super.update(playerX, playerY, deltaTimeMs);
    this.facing = nextFacing(this.facing, this.aimAngle);
    // After super.update(), so a shot it just fired is never in the future
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition() ?? null;
    return bullet;
  }

  /** @override The jelly mirrors to face its target; it never turns with its aim */
  drawFigure(p, s) {
    this.applyHitShake(p);
    drawGrunt(p, s * CONFIG.GRUNT_LOOK.ART_SCALE, this.pose());
  }

  /** Its pose, at the beat update() last kept (frozen while paused) and what it did when */
  pose() {
    const clock = this.getContextValue('beatClock');
    const beats = this.poseBeats;
    const total = Math.floor(beats ?? 0);
    const phase = (beats ?? 0) - total;
    // While its "ow" plays (a pending stab death) no event shows
    const live = beats !== null && !this.pendingStabDeath;
    return gruntPose({
      beats,
      beatSec: (clock?.beatInterval ?? 0) / 1000,
      seed: this.lookSeed,
      aimAngle: this.aimAngle,
      facing: this.facing,
      size: this.size * CONFIG.GRUNT_LOOK.ART_SCALE,
      warn: live && this.warnedOnBeat === total ? phase : -1,
      sinceShot:
        live && this.firedAt !== null ? beats - this.firedAt : Infinity,
      sulk: live && this.heldOnBeat === total ? phase : -1,
    });
  }

  /** Its shot leaves the gun's muzzle, on the side it turns to face */
  createBullet() {
    // This runs inside super.update(), before update() turns it round
    const facing = nextFacing(this.facing, this.aimAngle);
    const { x, y } = gruntMuzzle(
      this.x,
      this.y,
      this.size,
      this.aimAngle,
      facing
    );
    const bullet = Bullet.acquire(
      x,
      y,
      this.aimAngle,
      GRUNT_SHOT_SPEED,
      'enemy-grunt'
    );
    bullet.ownerId = this.id; // so it can't shoot itself
    this.audio?.playSound('alienShoot', this.x, this.y);
    return bullet;
  }

  /**
   * Its health bar's height above its centre, px (drawEnemyHealthBar): clear
   * of its antennae at the top of a hop, at any ?tune setting
   */
  get healthBarRise() {
    const L = CONFIG.GRUNT_LOOK;
    return (
      this.size * L.ART_SCALE * ANTENNA_REACH +
      L.HOP_PX +
      L.HOVER_PX +
      HEALTH_BAR_HEIGHT_PX +
      HEALTH_BAR_GAP_PX
    );
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
    if (!audio.speak(this, GRUNT_OW, 'grunt', true)) {
      audio.playSound('gruntOw', this.x, this.y);
    }
  }
}

export { Grunt };
