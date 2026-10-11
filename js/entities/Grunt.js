import { BaseEnemy } from './BaseEnemy.js';
import { sqrt, atan2 } from '../mathUtils.js';
import { CONFIG } from '../config.js';
import { DAMAGE_RESULT } from '../shared/DamageResult.js';
import {
  handleDamageResult,
  STABBER_KILL_POINTS,
} from '../shared/DamageResultHandler.js';
import { GRUNT_LINES, GRUNT_OW } from '../audio/DialogueLines.js';
import { Bullet } from './bullet.js';
import { GRUNT_SHOT_NOTES } from '../audio/SoundConfig.js';
import { GRUNT_VOICES, playedChatterVoice } from '../audio/Instruments.js';
import { HEALTH_BAR_HEIGHT_PX, HEALTH_BAR_GAP_PX } from './BaseEnemyHelpers.js';
import {
  GRUNT_COLORS,
  drawGrunt,
  gruntMuzzle,
  gruntPose,
  nextFacing,
  whineTop,
} from './GruntRenderer.js';

// A friend this close and this near his aim blocks his shot
const LINE_OF_FIRE_PX = 400;
const LINE_OF_FIRE_RAD = Math.PI / 9; // 20°
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
 * A grunt: the alien's cannon fodder, one of a swarm (GruntSwarm.js) that
 * moves him; he fires on 2 and 4, his own note, his own look and death
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
    this.warnedOnBeat = null; // the beat his swarm picked him to fire after
    this.fireOnBeat = null; // the beat his swarm's volley has him fire on
    this.pendingStabDeathTimer = 0; // frames remaining
    this._pendingStabDeathParams = null;

    // --- Its look (GruntRenderer.js) --------------------------
    this.facing = 1; // 1 faces right, -1 left; update() turns it
    // BaseEnemy's random phase, so the look adds no random() call
    this.lookSeed = this.animFrame / p.TWO_PI;
    this.firedAt = null; // the clock's beat position when it last fired
    this.heldOnBeat = null; // the beat it last held its fire on after a warning
    this.chatter = null; // { beat, voice } of its last chatter, for its move
    // The beat it is drawn at, kept by update(), so a paused game freezes it.
    // A grunt can be drawn once before its first update.
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition() ?? null;
  }

  /**
   * Each frame, after he moved: a stabbed grunt's delayed death, else his
   * wind-up ring and the shot his swarm settled
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
              collisionSystem?.handleEnemyDeath(e, e.type, e.x, e.y, {
                dir: bulletAngle,
              }),
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

    const beatClock = this.getContextValue('beatClock');
    // His swarm steers him and picks who fires (GruntSwarm, before the
    // enemies move); BaseEnemy.update has moved him. A grunt with no swarm
    // stands and never fires.
    if (!beatClock) return null;
    const total = beatClock.getTotalBeats();
    // Picked: his ring runs through the beat he was picked on (1 or 3,
    // the only beats a swarm picks on) and closes as the 2 or 4 lands
    const rhythmFX = this.getContextValue('rhythmFX');
    if (rhythmFX && this.warnedOnBeat === total) {
      const beatsUntilShot = 1 - beatClock.getBeatPhase();
      rhythmFX.addAttackTelegraph(
        this.x,
        this.y,
        'grunt',
        beatsUntilShot,
        this
      );
    }

    // His swarm settled this beat's volley: he fires, or, picked, holds,
    // once. He reads its stamps alone: a window check of his own, a moment
    // later in the same frame, could find the 2 or 4 already landed
    if (this.swarm?.settledBeat === total && this.actedOnBeat !== total) {
      this.actedOnBeat = total;
      if (this.fireOnBeat === total) {
        this.firedAt = beatClock.getBeatPosition();
        return this.createBullet();
      }
      // Warned on the beat just before this one; a warning whose fire
      // window was missed (hitstop, a pause) must not show up a bar later.
      // A warning with nothing after it would look like a glitch.
      if (this.warnedOnBeat === total - 1) {
        this.heldOnBeat = total;
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
   * Another enemy within 20° of his aim and LINE_OF_FIRE_PX: his shot would
   * hit a friend, so his swarm doesn't pick him, or holds his shot
   */
  lineBlocked() {
    const enemies = this.getContextValue('enemies');
    if (!enemies || typeof this.aimAngle !== 'number') return false;
    for (const other of enemies) {
      if (other === this || other.markedForRemoval) continue;
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      if (sqrt(dx * dx + dy * dy) >= LINE_OF_FIRE_PX) continue;
      const off = Math.abs(atan2(dy, dx) - this.aimAngle);
      if (Math.min(off, Math.PI * 2 - off) < LINE_OF_FIRE_RAD) return true;
    }
    return false;
  }

  /** His chatter (separate from speech), in his own voice; his pose shows it */
  makeGruntWeirdNoise() {
    const beat = this.getContextValue('beatClock')?.getTotalBeats();
    this.chatter =
      beat === undefined
        ? null
        : { beat, voice: playedChatterVoice(this.chatterVoice()) };
    this.getContextValue('audio')?.playSound('gruntChatter', this.x, this.y, {
      voice: this.chatterVoice(),
      seed: this.lookSeed,
    });
  }

  /**
   * His chatter's voice for life, by his look's seed: what is left of it
   * once his shot's note is picked, so the two don't go together
   */
  chatterVoice() {
    const rest = (this.lookSeed * GRUNT_SHOT_NOTES.length) % 1;
    return GRUNT_VOICES[Math.floor(rest * GRUNT_VOICES.length)];
  }

  /** @override One grunt speaks for his swarm (GruntSwarm.speaker) */
  getAmbientSpeechConfig() {
    if (this.swarm && this.swarm.speaker !== this) return null;
    return {
      lines: GRUNT_LINES,
      gate: (beatClock) => !!beatClock?.isOnBeat([2, 4]),
      chance: CONFIG.SPEECH_SETTINGS.GRUNT.CHANCE,
    };
  }

  /** @override Turns to face its target once it has moved and aimed */
  update(playerX, playerY, deltaTimeMs) {
    const bullet = super.update(playerX, playerY, deltaTimeMs);
    // A swarm's push can carry a grunt at its edge past the world's
    this.keepInWorld();
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
    const since = (event) => (live && event ? beats - event.beat : Infinity);
    const call = this.swarm?.call;
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
      sinceChatter: since(this.chatter),
      chatterVoice: this.chatter?.voice ?? null,
      sinceCall: since(call),
      call: call?.heading ?? null,
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
    // A volley of n carries about one shot's energy (GruntSwarm.settle)
    this.audio?.playSound('alienShoot', this.x, this.y, {
      note: this.shotNote(),
      seed: this.lookSeed,
      gain: this.swarm?.volleyGain ?? 1,
    });
    return bullet;
  }

  /** His shot's note for life, by his look's seed: a crowd plays both */
  shotNote() {
    return GRUNT_SHOT_NOTES[
      Math.floor(this.lookSeed * GRUNT_SHOT_NOTES.length)
    ];
  }

  /**
   * Its health bar's height above its centre, px (drawEnemyHealthBar): clear
   * of its antennae at the top of a hop, at any ?tune setting
   */
  get healthBarRise() {
    const L = CONFIG.GRUNT_LOOK;
    const reach = this.size * L.ART_SCALE * ANTENNA_REACH;
    return (
      Math.max(reach + L.HOP_PX, whineTop(reach)) +
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
    // His hit climbs from his health before it (Audio.playTone)
    const before = { health: this.health, maxHealth: this.maxHealth };

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
      audioSurv.playSound('gruntHit', this.x, this.y, before);
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
