import { BaseEnemy } from './BaseEnemy.js';
import { random, sqrt, sin, min } from '../mathUtils.js';
import { CONFIG } from '../config.js';
import { DAMAGE_RESULT } from '../shared/DamageResult.js';

// Per attempt once the speech timer is up (= today's effective rate)
const RUSHER_SPEECH_CHANCE = 0.03;

// A lit rusher blows this long after its minimum fuse even if no beat 1 or 3
// comes (a bar at 120 BPM, which has two)
const FUSE_MAX_BEAT_WAIT_MS = 2000;

const RUSHER_LINES = [
  'KAMIKAZE TIME!',
  'SUICIDE RUN!',
  'INCOMING!',
  'BOOM!',
  'EXPLOSIVE DIARRHEA!',
  'LEEROY JENKINS!',
  'WHEEE!',
  "CAN'T STOP!",
  'YOLO!',
  'KAMIKAZE PIZZA PARTY!',
];

/**
 * Rusher class - Suicide bomber mechanics
 * Battle cry and charge when near; shot or at point-blank, it brakes to a stop
 * and explodes on beat 1 or 3 once the fuse has burnt (CONFIG.RUSHER)
 */
class Rusher extends BaseEnemy {
  constructor(x, y, type, config, p, audio) {
    const rusherConfig = {
      ...config,
      size: 22,
      health: 1,
      speed: 2.8,
      color: p.color(255, 20, 147), // Deep pink - aggressive
    };

    super(x, y, 'rusher', rusherConfig, p, audio);
    this.p = p;
    this.audio = audio;

    this.hasScreamed = false;
    this.chargeDistance = 150; // Distance to start battle cry and charge
    this.explodeDistance = 50; // Distance that lights the fuse unshot

    // Lit fuse: shot or close enough, the rusher brakes and waits for the
    // blast (CONFIG.RUSHER)
    this.vibrating = false;
    this.fuseMs = 0;
  }

  /** 0 when lit, 1 once FUSE_MIN_MS has burnt (it then waits for the beat) */
  get fuseProgress() {
    const { FUSE_MIN_MS } = CONFIG.RUSHER;
    return FUSE_MIN_MS > 0 ? min(this.fuseMs / FUSE_MIN_MS, 1) : 1;
  }

  lightFuse() {
    this.vibrating = true;
    this.fuseMs = 0;

    const rhythmFX = this.getContextValue('rhythmFX');
    if (rhythmFX) {
      rhythmFX.addAttackTelegraph(this.x, this.y, 'rusher', 0.5);
    }
  }

  /**
   * Brake to a stop, then explode on the first beat 1 or 3 after the
   * minimum fuse
   */
  burnFuse(deltaTimeMs) {
    const { FUSE_MIN_MS, BRAKE, EXPLOSION_RADIUS, EXPLOSION_DAMAGE } =
      CONFIG.RUSHER;
    this.fuseMs += deltaTimeMs;

    const keep = BRAKE ** (deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS);
    this.velocity.x *= keep;
    this.velocity.y *= keep;

    if (this.fuseMs < FUSE_MIN_MS) return null;
    const beatClock = this.getContextValue('beatClock');
    const onBeat = !beatClock || beatClock.canRusherExplode();
    if (!onBeat && this.fuseMs < FUSE_MIN_MS + FUSE_MAX_BEAT_WAIT_MS) {
      return null;
    }

    return {
      type: 'rusher-explosion',
      x: this.x,
      y: this.y,
      radius: EXPLOSION_RADIUS,
      damage: EXPLOSION_DAMAGE,
    };
  }

  /**
   * Update specific rusher behavior - suicide bombing
   * @param {number} playerX - Player X position
   * @param {number} playerY - Player Y position
   * @param {number} deltaTimeMs - Time elapsed since last frame in milliseconds
   */
  updateSpecificBehavior(playerX, playerY, deltaTimeMs) {
    if (this.vibrating) return this.burnFuse(deltaTimeMs);

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distance = sqrt(dx * dx + dy * dy);

    if (distance <= this.explodeDistance) {
      this.lightFuse();
      const audio = this.getContextValue('audio') || this.audio;
      if (audio) audio.playRusherCharge(this.x, this.y);
      return null;
    }

    const unitX = dx / distance;
    const unitY = dy / distance;

    if (distance <= this.chargeDistance) {
      // Battle cry and charge sequence
      if (!this.hasScreamed) {
        this.hasScreamed = true;

        // Rusher scream with audio
        const audio = this.getContextValue('audio') || this.audio;
        const beatClock = this.getContextValue('beatClock');
        if (audio) {
          const battleCries = [
            'INCOMING!',
            'BOOM!',
            'KAMIKAZE!',
            'WHEEE!',
            'YOLO!',
            "CAN'T STOP!",
            'EXPLOSIVE DIARRHEA!',
            'LEEROY JENKINS!',
            'KAMIKAZE PIZZA PARTY!',
          ];
          const battleCry = random(battleCries);
          audio.speak(this, battleCry, 'rusher');

          if (!beatClock || beatClock.canRusherCharge()) {
            audio.playRusherCharge(this.x, this.y);
          }
        }
      }

      // Charge at 50% speed boost
      this.velocity.x = unitX * this.speed * 1.5;
      this.velocity.y = unitY * this.speed * 1.5;
    } else {
      // Normal approach
      this.velocity.x = unitX * this.speed;
      this.velocity.y = unitY * this.speed;
    }

    return null;
  }

  /** @override */
  getAmbientSpeechConfig() {
    return {
      lines: RUSHER_LINES,
      gate: (beatClock) => !!beatClock?.canRusherExplode(),
      chance: RUSHER_SPEECH_CHANCE,
    };
  }

  /**
   * Enhanced glow effects for rushers
   */
  getGlowColor(isSpeaking) {
    if (this.vibrating) {
      const pulse = this.p.sin(this.p.frameCount * 0.3) * 0.5 + 0.5;
      return this.p.color(255, 80 + pulse * 80, 50);
    }
    return isSpeaking
      ? this.p.color(255, 150, 200)
      : this.p.color(255, 100, 150);
  }

  /**
   * Get animation modifications for explosive behavior
   * Note: Visual effects use frameCount (appropriate for visual timing)
   */
  getAnimationModifications() {
    let bobble = 0;
    let waddle = 0;

    // Lit rusher shakes harder as the fuse burns down
    if (this.vibrating) {
      const shake = (2 + this.fuseProgress * 6) * (Math.random() - 0.5);
      bobble += shake;
      waddle += shake * 0.7;
    }

    return { bobble, waddle };
  }

  /**
   * Draw rusher-specific body shape - sharp arrow/dart design
   */
  drawBody(s) {
    this.p.strokeJoin(this.p.MITER);

    // Hot pink outline
    this.p.stroke(255, 20, 147);
    this.p.strokeWeight(2);

    // Dark interior
    this.p.fill(20, 5, 15);

    // Sharp swept-back shape
    this.p.beginShape();
    this.p.vertex(0, -s * 0.6); // Sharp nose
    this.p.vertex(s * 0.4, s * 0.4); // Right wing tip
    this.p.vertex(0, s * 0.2); // Back indent
    this.p.vertex(-s * 0.4, s * 0.4); // Left wing tip
    this.p.endShape(this.p.CLOSE);

    // Inner glowing lines
    this.p.stroke(255, 105, 180, 150);
    this.p.strokeWeight(1);
    this.p.line(0, -s * 0.5, 0, s * 0.1); // Center spine
    this.p.line(0, 0, s * 0.2, s * 0.2); // Right rib
    this.p.line(0, 0, -s * 0.2, s * 0.2); // Left rib

    // Thruster flame at the back
    this.p.noStroke();
    this.p.fill(255, 0, 255, 200); // Yellow/Pink flame
    this.p.triangle(
      -s * 0.2,
      s * 0.25,
      s * 0.2,
      s * 0.25,
      0,
      s * 0.6 + random() * s * 0.3
    );
  }

  /**
   * Draw type-specific indicators
   */
  drawSpecificIndicators() {
    if (this.vibrating) {
      this.drawExplosionWarning();
    }
  }

  /**
   * The blast's full reach, blinking faster and filling in as the fuse
   * burns, so the player sees how far to run
   */
  drawExplosionWarning() {
    const radius = CONFIG.RUSHER.EXPLOSION_RADIUS;
    const progress = this.fuseProgress;
    const pulse = sin(this.fuseMs * (0.01 + progress * 0.03)) * 0.5 + 0.5;

    this.p.noFill();
    this.p.stroke(255, 40, 40, 120 + pulse * 135);
    this.p.strokeWeight(2);
    this.p.ellipse(this.x, this.y, radius * 2);

    this.p.noStroke();
    this.p.fill(255, 60, 0, 25 + pulse * 50);
    this.p.ellipse(this.x, this.y, radius * 2 * progress);
  }

  /**
   * Override takeDamage to handle explosion trigger
   */
  takeDamage() {
    this.hitFlash = 8;
    // Lit, it is committed to exploding and ignores further hits
    if (this.vibrating) return DAMAGE_RESULT.EXPLODING;

    const audio = this.getContextValue('audio');
    if (audio) {
      audio.playSound('rusherHit', this.x, this.y);
    }

    // Shot: light the fuse; the pipeline keeps it until the blast
    this.lightFuse();
    return DAMAGE_RESULT.EXPLODING;
  }

  /**
   * Rushers don't shoot - they explode
   */
  createBullet() {
    return null;
  }
}

export { Rusher };
