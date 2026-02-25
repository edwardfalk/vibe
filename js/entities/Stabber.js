import { BaseEnemy } from './BaseEnemy.js';
import { floor, random, sin, cos, ceil } from '../mathUtils.js';
import { CONFIG } from '../config.js';
import { updateStabberBehavior } from './StabberAttackHandler.js';

/**
 * Stabber class - Melee assassin with armor system
 * Features three-phase attack system: approach → prepare → dash attack
 */
class Stabber extends BaseEnemy {
  constructor(x, y, type, config, p, audio) {
    const stabberConfig = {
      ...config,
      size: 28,
      health: 10,
      speed: 1.5,
      color: p.color(255, 215, 0), // Gold - heavily armored melee fighter
    };

    super(x, y, 'stabber', stabberConfig, p, audio);
    this.p = p;
    this.audio = audio;

    // Stabber melee system - heavily armored close combat specialist
    // Tunable parameters are now config-driven for easier balancing
    this.minStabDistance = CONFIG.STABBER_SETTINGS.MIN_STAB_DISTANCE; // Minimum distance to initiate stab
    this.maxStabDistance = CONFIG.STABBER_SETTINGS.MAX_STAB_DISTANCE; // Maximum distance to initiate stab
    this.stabCooldown = 0;
    this.stabPreparing = false;
    this.stabPreparingTime = 0;
    this.maxStabPreparingTime = CONFIG.STABBER_SETTINGS.MAX_PREPARE_TIME; // Preparation phase duration
    this.stabWarning = false;
    this.stabWarningTime = 0;
    this.stabWarningPlayed = false;
    this.maxStabWarningTime = CONFIG.STABBER_SETTINGS.MAX_WARNING_TIME; // Warning phase duration
    this.hasYelledStab = false;

    // deltaTime-based timing for motion trail
    this.motionTrailTimer = 0;
    this.motionTrailInterval = 66.67; // ~4 frames at 60fps (4 * 16.67ms)

    // Atmospheric TTS system
    const speechConfig =
      CONFIG.SPEECH_SETTINGS['STABBER'] || CONFIG.SPEECH_SETTINGS.DEFAULT;
    this.stabChantTimer = random(
      (speechConfig.CHANT_MIN || 3) * 60,
      (speechConfig.CHANT_MAX || 6) * 60
    );
    this.isStabbing = false;
    this.stabAnimationTime = 0;
    this.maxStabAnimationTime = 120; // 2 second stab animation (dash) - CONTINUOUS HIT WINDOW
    this.stabRecovering = false;
    this.stabRecoveryTime = 0;
    this.maxStabRecoveryTime = 120; // 2 seconds stuck after attack

    // Knockback system for armored stabbers
    this.knockbackVelocity = { x: 0, y: 0 };
    this.knockbackDecay = 0.85; // How quickly knockback fades

    // Attack direction locking
    this.stabDirection = null; // Direction locked during stab attack

    // Armor properties
    this.armor = 2; // Reduces incoming damage
    // Update meleeReach to match new knife length (s * 0.6 * 2.0 + s * 0.15)
    this.meleeReach = 38; // For s=28, matches visual tip
  }

  /**
   * Update specific stabber behavior - melee assassination.
   * Delegates to StabberAttackHandler.
   */
  updateSpecificBehavior(playerX, playerY, deltaTimeMs) {
    return updateStabberBehavior(this, playerX, playerY, deltaTimeMs);
  }

  /**
   * Trigger ambient speech specific to stabbers
   */
  triggerAmbientSpeech() {
    const audio = this.getContextValue('audio');
    const beatClock = this.getContextValue('beatClock');
    if (audio && this.speechCooldown <= 0) {
      if (beatClock?.canStabberAttack() && random() < 0.2) {
        const stabberLines = [
          'STAB!',
          'SLICE!',
          'CUT!',
          'POKE!',
          'ACUPUNCTURE!',
          'LITTLE PRICK!',
          'STABBY MCSTABFACE!',
          'NEEDLE THERAPY!',
          'I COLLECT BELLY BUTTONS!',
        ];
        const randomLine = stabberLines[floor(random() * stabberLines.length)];
        audio.speak(this, randomLine, 'stabber');
        this.speechCooldown = this.maxSpeechCooldown;
      }
    }
  }

  /**
   * Get animation modifications for attack phases
   */
  getAnimationModifications() {
    // No rotation during attack phases
    if (
      this.stabPreparing ||
      this.stabWarning ||
      this.isStabbing ||
      this.stabRecovering
    ) {
      // Additional animation modifications could go here
      return { bobble: 0, waddle: 0 };
    }

    return { bobble: 0, waddle: 0 };
  }

  /**
   * Draw motion trail for stabbers
   * Note: This is now called from updateSpecificBehavior based on deltaTime timer
   */
  drawMotionTrail() {
    const visualEffectsManager = this.getContextValue('visualEffectsManager');
    if (visualEffectsManager) {
      try {
        const trailColor = [255, 140, 0];
        visualEffectsManager.addMotionTrail(this.x, this.y, trailColor, 3);
      } catch (error) {
        console.log('⚠️ Stabber trail error:', error);
      }
    }
  }

  /**
   * Override aim angle update to lock during attack phases
   *
   * --- Update order refactor ---
   * We run updateSpecificBehavior() first to set velocity and state,
   * then call super.update() to apply velocity to position.
   * This ensures all velocity changes take effect in the same frame,
   * preventing frame delays and making the update logic robust.
   */
  update(playerX, playerY, deltaTimeMs = 16.6667) {
    // 1. Run Stabber-specific logic first (sets velocity, handles state)
    const behaviorResult = this.updateSpecificBehavior(
      playerX,
      playerY,
      deltaTimeMs
    );
    // 2. Then call parent update to apply velocity to position, handle common logic
    const baseUpdateResult = super.update(playerX, playerY, deltaTimeMs);
    // Only return behaviorResult if it is neither null nor undefined; otherwise, return baseUpdateResult
    return behaviorResult != null ? behaviorResult : baseUpdateResult;
  }

  /**
   * Draw stabber-specific body shape
   */
  drawBody(s) {
    // Compact, armored body for stabber
    this.p.fill(this.bodyColor);
    this.p.noStroke();
    this.p.ellipse(0, 0, s, s * 0.9);

    // Armor plating details
    this.p.fill(
      this.bodyColor.levels[0] + 20,
      this.bodyColor.levels[1] + 20,
      this.bodyColor.levels[2] + 20
    );
    this.p.ellipse(0, -s * 0.2, s * 0.6, s * 0.3); // Chest armor
    this.p.ellipse(-s * 0.25, s * 0.1, s * 0.3, s * 0.4); // Left armor plate
    this.p.ellipse(s * 0.25, s * 0.1, s * 0.3, s * 0.4); // Right armor plate
  }

  /**
   * Override weapon drawing for stabber's extending laser knife
   */
  drawWeapon(s) {
    // Base knife dimensions
    const knifeLength = s * 0.6; // Base length
    const knifeWidth = s * 0.2; // Base width
    let extensionFactor = 1.0; // Default (retracted)
    const extendedFactor = 2.0; // New fixed extension (about half of old max)
    let isExtended = false;

    // Determine state
    if (this.stabPreparing || this.stabWarning || this.isStabbing) {
      extensionFactor = extendedFactor;
      isExtended = true;
    }
    // Color: always white when extended or retracted
    this.p.fill(255, 255, 255);

    const currentKnifeLength = s * 0.6 * extensionFactor;

    // Draw main blade
    this.p.beginShape();
    this.p.vertex(s * 0.3, -knifeWidth / 2); // Base back bottom
    this.p.vertex(s * 0.3 + currentKnifeLength + s * 0.15, 0); // Sharp point
    this.p.vertex(s * 0.3, knifeWidth / 2); // Base back top
    this.p.endShape(this.p.CLOSE);

    // Knife handle
    this.p.fill(200, 200, 200);
    this.p.rect(s * 0.2, -knifeWidth / 3, s * 0.2, knifeWidth * 0.67);

    // Glow at tip if extended
    if (isExtended) {
      const tipX = s * 0.3 + currentKnifeLength + s * 0.15;
      const tipY = 0;
      const glowColor = this.p.color(120, 200, 255, 180);
      this.p.noStroke();
      this.p.fill(glowColor);
      this.p.ellipse(tipX, tipY, 10, 10);
      this.p.fill(255, 255, 255, 200);
      this.p.ellipse(tipX, tipY, 5, 5);
    }
  }

  /**
   * Draw type-specific indicators
   */
  drawSpecificIndicators() {
    if (this.stabWarning) {
      this.drawStabWarning();
    } else if (this.stabRecovering) {
      this.drawStabRecovery();
    }
  }

  /**
   * Draw stab warning indicator
   */
  drawStabWarning() {
    const stabPercent = this.stabWarningTime / this.maxStabWarningTime;

    // Dramatic charging animation with building energy
    const pulse = sin(this.p.frameCount * 3.0) * 0.5 + 0.5;
    const chargePulse = sin(this.p.frameCount * 1.5) * 0.3 + 0.7;
    const warningRadius = this.size * (1.2 + stabPercent * 0.8); // Growing energy field

    // Building energy circle - intensifying over time
    this.p.fill(255, 150, 0, 40 + stabPercent * 60 + pulse * 40);
    this.p.noStroke();
    this.p.ellipse(this.x, this.y, warningRadius * 2);

    // Inner charging core - pulsing faster as charge builds
    this.p.fill(255, 200, 0, 60 + stabPercent * 80 + chargePulse * 60);
    this.p.ellipse(this.x, this.y, warningRadius);

    // Charging sparks around the stabber
    if (this.p.frameCount % 3 === 0) {
      for (let i = 0; i < 6; i++) {
        const sparkAngle =
          (this.p.frameCount * 0.1 + (i * Math.PI) / 3) % (2 * Math.PI);
        const sparkDist = this.size * (0.8 + stabPercent * 0.4);
        const sparkX = this.x + cos(sparkAngle) * sparkDist;
        const sparkY = this.y + sin(sparkAngle) * sparkDist;

        this.p.fill(255, 255, 0, 120 + stabPercent * 100);
        this.p.ellipse(sparkX, sparkY, 3 + stabPercent * 3);
      }
    }

    // Energy buildup text
    if (stabPercent > 0.5) {
      this.p.fill(255, 255, 255, 150 + stabPercent * 100);
      this.p.textAlign(this.p.CENTER, this.p.CENTER);
      this.p.textSize(8 + stabPercent * 4);
      this.p.text('CHARGING', this.x, this.y - this.size - 25);
    }
  }

  /**
   * Draw stab recovery indicator
   */
  drawStabRecovery() {
    const recoveryPercent = this.stabRecoveryTime / this.maxStabRecoveryTime;

    // Exhausted/stuck indicator - fading red glow
    const pulse = sin(this.p.frameCount * 1.0) * 0.3 + 0.7;
    const recoveryRadius = this.size * (1.5 - recoveryPercent * 0.5); // Shrinking as recovery progresses

    // Exhausted red glow - fading over time
    this.p.fill(255, 0, 0, 60 - recoveryPercent * 40 + pulse * 20);
    this.p.noStroke();
    this.p.ellipse(this.x, this.y, recoveryRadius * 1.5);

    // Inner exhaustion core
    this.p.fill(200, 0, 0, 40 - recoveryPercent * 30 + pulse * 15);
    this.p.ellipse(this.x, this.y, recoveryRadius);

    // Recovery progress text
    if (recoveryPercent < 0.8) {
      this.p.fill(255, 255, 255, 200 - recoveryPercent * 100);
      this.p.textAlign(this.p.CENTER, this.p.CENTER);
      this.p.textSize(8);
      this.p.text('STUCK', this.x, this.y - this.size - 20);

      // Countdown
      const countdown = ceil(
        (this.maxStabRecoveryTime - this.stabRecoveryTime) / 60
      );
      this.p.textSize(6);
      this.p.text(countdown + 's', this.x, this.y - this.size - 10);
    }
  }

  /**
   * Override takeDamage to handle armor system and interrupt attacks
   */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    // Apply armor damage reduction
    let actualDamage = amount;
    if (this.armor) {
      actualDamage = max(1, amount - this.armor); // Minimum 1 damage
      console.log(
        `🛡️ Stabber armor reduced damage: ${amount} -> ${actualDamage}`
      );
    }

    // INTERRUPT ATTACK when taking damage - prevents phantom hits after knockback
    if (this.stabPreparing || this.stabWarning) {
      console.log(
        `🚫 Stabber attack interrupted by damage! Was in: ${this.stabPreparing ? 'preparing' : 'warning'} phase`
      );

      // Reset all attack states
      this.stabPreparing = false;
      this.stabPreparingTime = 0;
      this.stabWarning = false;
      this.stabWarningTime = 0;
      this.isStabbing = false;
      this.stabAnimationTime = 0;
      this.stabDirection = null;

      // Enter recovery state after interruption
      this.stabRecovering = true;
      this.stabRecoveryTime = 0;

      // Add cooldown to prevent immediate re-attack
      this.stabCooldown = 60; // 1 second cooldown after interruption
    }

    // Apply knockback when hit
    if (bulletAngle !== null) {
      const knockbackForce = 8; // Strong knockback for armored stabbers
      this.knockbackVelocity.x += cos(bulletAngle) * knockbackForce;
      this.knockbackVelocity.y += sin(bulletAngle) * knockbackForce;
      console.log(`⚡ Stabber knocked back! Knockback: ${knockbackForce}`);
    }

    return super.takeDamage(actualDamage, bulletAngle, damageSource);
  }

  /**
   * Stabbers don't shoot projectiles - they use melee attacks
   */
  createBullet() {
    return null;
  }
}

export { Stabber };
