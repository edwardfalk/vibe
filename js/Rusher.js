import { BaseEnemy } from './BaseEnemy.js';
import { floor, random, sqrt, sin, cos } from './mathUtils.js';
import { CONFIG } from './config.js';

/**
 * Rusher class - Suicide bomber mechanics
 * Two-stage system: battle cry at distance, explosion when close, enhanced explosion effects
 */
class Rusher extends BaseEnemy {
  constructor(x, y, type, config, p, audio) {
    const rusherConfig = {
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

    // deltaTime-based timing for motion trail
    this.motionTrailTimer = 0;
    this.motionTrailInterval = 66.67; // ~4 frames at 60fps (4 * 16.67ms)
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
    const dt = deltaTimeMs / 16.6667; // Normalize to 60fps baseline

    // Update motion trail timer
    this.motionTrailTimer += deltaTimeMs;
    if (this.isCharging && this.motionTrailTimer >= this.motionTrailInterval) {
      this.drawMotionTrail();
      this.motionTrailTimer = 0;
    }

    if (this.exploding) {
      // Explosion countdown using deltaTime
      this.explosionTimer += dt;

      // Check if explosion should occur
      const explosionTime = this.shotTriggered
        ? this.maxExplosionTime * 0.5
        : this.maxExplosionTime;

      if (this.explosionTimer >= explosionTime) {
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
          // Close enough - explode immediately
          this.exploding = true;
          this.explosionTimer = 0;
          console.log(
            `💥 RUSHER PROXIMITY EXPLOSION! Distance: ${distance.toFixed(0)}px`
          );
        } else if (distance <= this.chargeDistance) {
          // Battle cry and charge sequence
          if (!this.hasScreamed) {
            this.hasScreamed = true;
            this.isCharging = true;

            console.log(
              `🗣️ RUSHER BATTLE CRY! Starting charge at distance: ${distance.toFixed(0)}px`
            );

            // Rusher scream with audio
            if (window.audio) {
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
              const battleCry =
                battleCries[floor(random() * battleCries.length)];
              window.audio.speak(this, battleCry, 'rusher');

              // Play rusher charge sound on-beat
              if (!window.beatClock || window.beatClock.canRusherCharge()) {
                window.audio.playRusherCharge(this.x, this.y);
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

  /**
   * Trigger ambient speech specific to rushers
   */
  triggerAmbientSpeech() {
    if (window.audio && this.speechCooldown <= 0) {
      if (window.beatClock && random() < 0.15) {
        const rusherLines = [
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
        const randomLine = rusherLines[floor(random() * rusherLines.length)];
        window.audio.speak(this, randomLine, 'rusher');
        this.speechCooldown = this.maxSpeechCooldown;
      }
    }
  }

  /**
   * Enhanced glow effects for rushers
   */
  getGlowColor(isSpeaking) {
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

    // Intense vibration for exploding rushers
    if (this.exploding) {
      const intensity = (this.explosionTimer / this.maxExplosionTime) * 8;
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
    if (typeof visualEffectsManager !== 'undefined' && visualEffectsManager) {
      try {
        const trailColor = [255, 100, 100];
        visualEffectsManager.addMotionTrail(this.x, this.y, trailColor, 3);
      } catch (error) {
        console.log('⚠️ Rusher trail error:', error);
      }
    }
  }

  /**
   * Draw rusher-specific body shape
   */
  drawBody(s) {
    // Lean, angular body for speed
    this.p.fill(this.bodyColor);
    this.p.noStroke();
    this.p.beginShape();
    this.p.vertex(-s * 0.3, -s * 0.4);
    this.p.vertex(s * 0.3, -s * 0.3);
    this.p.vertex(s * 0.4, s * 0.3);
    this.p.vertex(s * 0.2, s * 0.6);
    this.p.vertex(-s * 0.2, s * 0.6);
    this.p.vertex(-s * 0.4, s * 0.3);
    this.p.endShape(this.p.CLOSE);
  }

  /**
   * Draw type-specific indicators
   */
  drawSpecificIndicators() {
    if (this.exploding) {
      this.drawExplosionWarning();
    }
  }

  /**
   * Draw explosion warning
   */
  drawExplosionWarning() {
    const explosionTime = this.shotTriggered
      ? this.maxExplosionTime * 0.5
      : this.maxExplosionTime;
    const explosionPercent = this.explosionTimer / explosionTime;
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
    const countdown = ceil((explosionTime - this.explosionTimer) / 60);
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
    // Rushers explode when shot, regardless of health
    if (!this.exploding) {
      this.exploding = true;
      this.explosionTimer = 0;
      this.shotTriggered = true; // Mark as shot-triggered for faster explosion
      console.log(`💥 RUSHER SHOT: Starting explosion! Health: ${this.health}`);
      // Return special flag to indicate explosion started
      return 'exploding';
    }

    // Apply normal damage
    return super.takeDamage(amount, bulletAngle, damageSource);
  }

  /**
   * Override update to pass deltaTimeMs to specific behavior
   */
  update(playerX, playerY, deltaTimeMs = 16.6667) {
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
