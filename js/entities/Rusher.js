import { BaseEnemy } from './BaseEnemy.js';
import { floor, random, sqrt, sin, cos, ceil } from '../mathUtils.js';
import { CONFIG } from '../config.js';
import { DAMAGE_RESULT } from '../shared/contracts/DamageResult.js';

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
 * Two-stage system: battle cry at distance, explosion when close, enhanced explosion effects
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

    // Rusher explosion system
    this.exploding = false;
    this.explosionTimer = 0;
    this.maxExplosionTime = 90; // 1.5 second warning at 60fps
    this.explosionRadius = 120; // INCREASED: Bigger explosion radius for more mayhem
    this.maxExplosionRadius = 120; // ADD: Maximum explosion radius for termination check
    this.hasScreamed = false;
    this.shotTriggered = false; // Track if explosion was triggered by being shot
    this.chargeDistance = 150; // Distance to start battle cry and charge
    this.explodeDistance = 50; // Distance to actually explode
    this.isCharging = false; // Track if currently charging

    // Vibrate state - hold between proximity trigger and beat-aligned explosion
    this.vibrating = false;
    this.vibrateStartTime = 0;

    // deltaTime-based timing for motion trail
    this.motionTrailTimer = 0;
    this.motionTrailInterval = 66.67; // ~4 frames at 60fps (4 * 16.67ms)
  }

  get effectiveExplosionTime() {
    return this.shotTriggered
      ? this.maxExplosionTime * 0.5
      : this.maxExplosionTime;
  }

  /**
   * Update specific rusher behavior - suicide bombing
   * @param {number} playerX - Player X position
   * @param {number} playerY - Player Y position
   * @param {number} deltaTimeMs - Time elapsed since last frame in milliseconds
   */
  updateSpecificBehavior(playerX, playerY, deltaTimeMs) {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distance = sqrt(dx * dx + dy * dy);

    // Update deltaTime-based timers
    const dt = deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS; // Normalize to 60fps baseline

    // Update motion trail timer
    this.motionTrailTimer += deltaTimeMs;
    if (this.isCharging && this.motionTrailTimer >= this.motionTrailInterval) {
      this.drawMotionTrail();
      this.motionTrailTimer = 0;
    }

    // Vibrate state handler - waiting for beat to explode
    if (this.vibrating) {
      this.vibrateStartTime += deltaTimeMs;

      const beatClock = this.getContextValue('beatClock');
      if (beatClock && beatClock.canRusherExplode()) {
        this.vibrating = false;
        this.exploding = true;
        this.explosionTimer = 0;
        this.maxExplosionTime = 5; // Near-instant after beat hit
      }

      // Safety: explode if vibrated too long or no beatClock
      if (this.vibrating && (!beatClock || this.vibrateStartTime > 2000)) {
        this.vibrating = false;
        this.exploding = true;
        this.explosionTimer = 0;
        this.maxExplosionTime = 5;
      }

      return null;
    }

    if (this.exploding) {
      // Explosion countdown using deltaTime
      this.explosionTimer += dt;

      // Check if explosion should occur
      if (this.explosionTimer >= this.effectiveExplosionTime) {
        // Create explosion
        return {
          type: 'rusher-explosion',
          x: this.x,
          y: this.y,
          radius: this.explosionRadius,
          damage: 35,
        };
      }

      // Continue moving toward player while exploding (slightly slower)
      if (distance > 0) {
        const unitX = dx / distance;
        const unitY = dy / distance;
        this.velocity.x = unitX * this.speed * 0.3; // Much slower while exploding
        this.velocity.y = unitY * this.speed * 0.3;
      }
    } else {
      // Normal movement behavior
      this.velocity.x = 0;
      this.velocity.y = 0;

      if (distance > 0) {
        const unitX = dx / distance;
        const unitY = dy / distance;

        if (distance <= this.explodeDistance) {
          // Close enough - enter vibrate state, wait for beat to explode
          this.vibrating = true;
          this.vibrateStartTime = 0;
          this.speed = 0; // Stop moving
          console.log(
            `💥 RUSHER VIBRATING! Distance: ${distance.toFixed(0)}px`
          );

          const audio = this.getContextValue('audio') || this.audio;
          if (audio) audio.playRusherCharge(this.x, this.y);

          // Register explosion telegraph
          const rhythmFX = this.getContextValue('rhythmFX');
          if (rhythmFX) {
            rhythmFX.addAttackTelegraph(
              this.x,
              this.y,
              'rusher',
              0.2 // About to explode very soon
            );
          }
        } else if (distance <= this.chargeDistance) {
          // Battle cry and charge sequence
          if (!this.hasScreamed) {
            this.hasScreamed = true;
            this.isCharging = true;

            console.log(
              `🗣️ RUSHER BATTLE CRY! Starting charge at distance: ${distance.toFixed(0)}px`
            );

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
      }
    }

    return null;
  }

  /** @override */
  getAmbientSpeechConfig() {
    return {
      lines: RUSHER_LINES,
      shouldSpeak: (beatClock) =>
        beatClock && beatClock.canRusherExplode() && random() < 0.15,
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
    if (this.exploding) {
      const pulse = this.p.sin(this.p.frameCount * 0.5) * 0.5 + 0.5;
      return this.p.color(255, 50 + pulse * 100, 50 + pulse * 100);
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

    // Vibrating rusher — increasing intensity while waiting for beat
    if (this.vibrating) {
      const intensity = Math.min(this.vibrateStartTime / 1000, 1); // 0 to 1 over 1s
      const shake = (2 + intensity * 4) * (Math.random() - 0.5);
      bobble += shake;
      waddle += shake * 0.7;
    }

    // Intense vibration for exploding rushers
    if (this.exploding) {
      const intensity = (this.explosionTimer / this.effectiveExplosionTime) * 8;
      bobble += sin(this.p.frameCount * 0.8) * intensity;
      waddle += cos(this.p.frameCount * 1.2) * intensity;
    }

    return { bobble, waddle };
  }

  /**
   * Draw motion trail for charging rushers
   * Note: This is now called from updateSpecificBehavior based on deltaTime timer
   */
  drawMotionTrail() {
    const visualEffectsManager = this.getContextValue('visualEffectsManager');
    if (visualEffectsManager) {
      try {
        const trailColor = [255, 100, 100];
        visualEffectsManager.addMotionTrail(this.x, this.y, trailColor, 3);
      } catch (error) {
        console.log('⚠️ Rusher trail error:', error);
      }
    }
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
    if (this.vibrating || this.exploding) {
      this.drawExplosionWarning();
    }
  }

  /**
   * Draw explosion warning
   */
  drawExplosionWarning() {
    const explosionPercent = this.explosionTimer / this.effectiveExplosionTime;
    const pulse = sin(this.p.frameCount * 1.5) * 0.5 + 0.5;
    const warningRadius = this.explosionRadius * (0.3 + explosionPercent * 0.7);

    // Outer warning circle - more intense if shot
    const intensity = this.shotTriggered ? 150 : 100;
    this.p.fill(255, 0, 0, 50 + pulse * intensity);
    this.p.noStroke();
    this.p.ellipse(this.x, this.y, warningRadius * 2);

    // Inner danger zone
    this.p.fill(255, 100, 0, 30 + pulse * 80);
    this.p.ellipse(this.x, this.y, warningRadius * 1.2);

    // Countdown text
    this.p.fill(255, 255, 255);
    this.p.textAlign(this.p.CENTER, this.p.CENTER);
    this.p.textSize(12);
    const countdown = ceil(
      (this.effectiveExplosionTime - this.explosionTimer) / 60
    );
    this.p.text(countdown, this.x, this.y - this.size - 20);

    // Add "SHOT!" text if triggered by shooting
    if (this.shotTriggered) {
      this.p.fill(255, 255, 0);
      this.p.textSize(10);
      this.p.text('SHOT!', this.x, this.y - this.size - 35);
    }
  }

  /**
   * Override takeDamage to handle explosion trigger
   */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    const audio = this.getContextValue('audio');
    if (audio) {
      audio.playSound('rusherHit', this.x, this.y);
    }

    // Rushers enter vibrate state when shot, then explode on beat
    if (!this.exploding && !this.vibrating) {
      this.vibrating = true;
      this.vibrateStartTime = 0;
      this.shotTriggered = true; // Mark as shot-triggered
      this.speed = 0; // Stop moving
      console.log(`💥 RUSHER SHOT: Vibrating! Health: ${this.health}`);

      // Just set hit flash for visual feedback, don't apply damage yet
      // The rusher will be removed when explosion timer completes
      this.hitFlash = 8;

      // Register explosion telegraph when shot
      const rhythmFX = this.getContextValue('rhythmFX');
      if (rhythmFX) {
        rhythmFX.addAttackTelegraph(
          this.x,
          this.y,
          'rusher',
          0.5 // Exploding very soon (shot-triggered is faster)
        );
      }

      // Return special flag so pipeline keeps entity for explosion
      return DAMAGE_RESULT.EXPLODING;
    }

    // Apply normal damage
    return super.takeDamage(amount, bulletAngle, damageSource);
  }

  /**
   * Override update to pass deltaTimeMs to specific behavior
   */
  update(playerX, playerY, deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS) {
    // Call specific behavior first, then parent update
    const behaviorResult = this.updateSpecificBehavior(
      playerX,
      playerY,
      deltaTimeMs
    );
    const baseUpdateResult = super.update(playerX, playerY, deltaTimeMs);
    return behaviorResult != null ? behaviorResult : baseUpdateResult;
  }

  /**
   * Rushers don't shoot - they explode
   */
  createBullet() {
    return null;
  }
}

export { Rusher };
