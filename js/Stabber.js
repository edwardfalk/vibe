import { BaseEnemy } from './BaseEnemy.js';
import {
  floor,
  random,
  sqrt,
  sin,
  cos,
  atan2,
  min,
  max,
  ceil,
} from './mathUtils.js';
import { CONFIG } from './config.js';

/**
 * Stabber class - Melee assassin with armor system
 * Features three-phase attack system: approach → prepare → dash attack
 */
class Stabber extends BaseEnemy {
  constructor(x, y, type, config, p, audio, context = null) {
    const stabberConfig = {
      size: 28,
      health: 10,
      speed: 1.5,
      color: p.color(255, 215, 0), // Gold - heavily armored melee fighter
    };

    super(x, y, 'stabber', stabberConfig, p, audio, context);
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
   * Update specific stabber behavior - melee assassination
   * @param {number} playerX - Player X position
   * @param {number} playerY - Player Y position
   * @param {number} deltaTimeMs - Time elapsed since last frame in milliseconds
   */
  updateSpecificBehavior(playerX, playerY, deltaTimeMs) {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distance = sqrt(dx * dx + dy * dy);

    // Update stabber timers using deltaTime
    const dt = deltaTimeMs / 16.6667; // Normalize to 60fps baseline
    if (this.stabCooldown > 0) this.stabCooldown -= dt;
    if (this.stabChantTimer > 0) this.stabChantTimer -= dt;

    // Update motion trail timer
    this.motionTrailTimer += deltaTimeMs;
    if (this.motionTrailTimer >= this.motionTrailInterval) {
      this.drawMotionTrail();
      this.motionTrailTimer = 0;
    }

    // Handle atmospheric chanting
    if (this.stabChantTimer <= 0 && this.speechCooldown <= 0) {
      const speechConfig =
        CONFIG.SPEECH_SETTINGS['STABBER'] || CONFIG.SPEECH_SETTINGS.DEFAULT;
      this.stabChantTimer = random(
        (speechConfig.CHANT_MIN || 3) * 60,
        (speechConfig.CHANT_MAX || 6) * 60
      );

      // Enhanced stabber ambient sounds on off-beat 3.5 with 30% chance
      const beatClock = this.getContextValue('beatClock');
      const audio = this.getContextValue('audio');
      if (beatClock?.canStabberAttack() && audio) {
        const ambientSounds = ['stabberChant', 'stabberStalk'];
        const sound = ambientSounds[floor(random() * ambientSounds.length)];
        audio.playSound(sound, this.x, this.y);
        console.log(`🗡️ Stabber ambient sound: ${sound} on off-beat 3.5`);
      }
    }

    // Apply knockback velocity and decay
    this.x += this.knockbackVelocity.x;
    this.y += this.knockbackVelocity.y;
    this.knockbackVelocity.x *= this.knockbackDecay;
    this.knockbackVelocity.y *= this.knockbackDecay;

    // Recovery phase - stuck after attack
    if (this.stabRecovering) {
      this.stabRecoveryTime += dt;

      // Visual penetration: Brief follow-through movement for the first few frames
      const penetrationFrames = 10; // How long the follow-through lasts
      const penetrationSpeedFactor = 0.5; // How fast the follow-through is (relative to dash speed component)

      // --- Immediate follow-through displacement fix ---
      // We update position (x, y) directly here instead of setting velocity,
      // because velocity is applied earlier in the frame by BaseEnemy.update().
      // This avoids a one-frame delay and ensures the follow-through is visible instantly.
      if (
        this.stabRecoveryTime <= penetrationFrames &&
        this.stabDirection !== null
      ) {
        const progress = this.stabRecoveryTime / penetrationFrames;
        const currentPenetrationSpeed =
          this.speed * 7.0 * penetrationSpeedFactor * (1 - progress); // Decays to 0
        const dx = cos(this.stabDirection) * currentPenetrationSpeed;
        const dy = sin(this.stabDirection) * currentPenetrationSpeed;
        this.x += dx;
        this.y += dy;
        // Set velocity to 0 to avoid double movement next frame
        this.velocity.x = 0;
        this.velocity.y = 0;
      } else {
        // After penetration effect, cannot move during recovery
        this.velocity.x = 0;
        this.velocity.y = 0;
      }

      if (this.stabRecoveryTime >= this.maxStabRecoveryTime) {
        this.stabRecovering = false;
        this.stabRecoveryTime = 0;
        console.log(`⚡ Stabber recovered from attack`);
      }

      return null;
    }

    // Stabbing phase - explosive dash forward
    if (this.isStabbing) {
      this.stabAnimationTime += dt;

      // Early guard: if stabDirection is null, skip dash and hit logic
      if (this.stabDirection === null) {
        // Early exit: If stabDirection is lost, abort dash and enter recovery phase to prevent immediate resumption
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.isStabbing = false; // Properly exit stabbing state if direction is lost
        this.stabAnimationTime = 0;
        this.stabRecovering = true;
        this.stabRecoveryTime = 0;
        this.stabCooldown = 120; // Apply cooldown as with a missed dash
        this.stabDirection = null;
        // Optionally log a warning
        // console.warn('Stabber tried to dash with null stabDirection');
        return null;
      }

      // Set/Maintain dash velocity based on locked stabDirection
      this.velocity.x = cos(this.stabDirection) * this.speed * 7.0;
      this.velocity.y = sin(this.stabDirection) * this.speed * 7.0;

      // Continuous hit check during the dash (after the first frame of movement)
      if (this.stabAnimationTime > 1) {
        const hitResult = this.checkStabHit(playerX, playerY);
        // Check for hit on player OR other enemies
        if (
          hitResult &&
          (hitResult.playerHit ||
            (hitResult.enemiesHit && hitResult.enemiesHit.length > 0))
        ) {
          console.log(
            `🗡️ Stabber HIT during dash (frame ${this.stabAnimationTime}). Target: ${hitResult.playerHit ? 'Player' : 'Enemy'}. Recovering.`
          );

          // Spawn hit visual effect
          const visualEffectsManager = this.getContextValue(
            'visualEffectsManager'
          );
          if (visualEffectsManager && this.stabDirection !== null) {
            const impactX =
              this.x + cos(this.stabDirection) * (this.meleeReach * 0.9);
            const impactY =
              this.y + sin(this.stabDirection) * (this.meleeReach * 0.9);
            visualEffectsManager.addExplosion(
              impactX,
              impactY,
              20,
              [255, 255, 100],
              0.5,
              5,
              8
            );
          }

          // Apply damage to player if hit
          // if (hitResult.playerHit && window.player && typeof window.player.takeDamage === 'function') {
          //     console.log('🩸 Stabber is damaging the player!');
          //     window.player.takeDamage(hitResult.damage, 'stabber-melee');
          // }

          // Apply damage to other enemies hit (friendly fire)
          if (hitResult.enemiesHit && hitResult.enemiesHit.length > 0) {
            // Do not apply damage here; GameLoop.js will handle it
            // hitResult.enemiesHit.forEach(enemyHitInfo => {
            //     if (enemyHitInfo.enemy && typeof enemyHitInfo.enemy.takeDamage === 'function') {
            //         console.log(`🗡️ Stabber applying friendly fire to ${enemyHitInfo.enemy.type} for ${enemyHitInfo.damage} damage.`);
            //         enemyHitInfo.enemy.takeDamage(enemyHitInfo.damage, enemyHitInfo.angle, 'stabber_melee');
            //     }
            // });
          }

          this.isStabbing = false;
          this.stabAnimationTime = 0;
          this.stabRecovering = true;
          this.stabRecoveryTime = 0;
          this.stabCooldown = 180; // Cooldown after successful hit
          this.stabDirection = null;
          return hitResult; // Propagate hit result
        }
      }

      // Check if max dash duration reached (missed for the entire duration)
      if (this.stabAnimationTime >= this.maxStabAnimationTime) {
        console.log(
          `🗡️ Stabber completed full dash (frame ${this.stabAnimationTime}) without a decisive hit. Recovering.`
        );
        this.isStabbing = false;
        this.stabAnimationTime = 0;
        this.stabRecovering = true;
        this.stabRecoveryTime = 0;
        this.stabCooldown = 120; // Shorter cooldown on a full miss? Or keep same.
        this.stabDirection = null;
        // Optionally, call checkStabHit one last time for miss effects/logging if desired
        // return this.checkStabHit(playerX, playerY); // This would be a guaranteed miss by now
        return null; // Or just return null
      }

      return null; // Still stabbing
    }

    // Warning phase - stopped and signaling
    if (this.stabWarning) {
      this.stabWarningTime += dt;

      // Completely stopped during warning
      this.velocity.x = 0;
      this.velocity.y = 0;

      // Play warning sounds
      const audioWarn = this.getContextValue('audio');
      if (this.stabWarningTime === 1 && audioWarn) {
        audioWarn.playSound('stabberStalk', this.x, this.y);
        audioWarn.playSound('stabberKnife', this.x, this.y);

        const stabWarnings = [
          'STAB TIME!',
          'SLICE AND DICE!',
          'ACUPUNCTURE TIME!',
          'STABBY MCSTABFACE!',
        ];
        const warning = stabWarnings[floor(random() * stabWarnings.length)];
        audioWarn.speak(this, warning, 'stabber');
      }

      if (this.stabWarningTime >= this.maxStabWarningTime) {
        this.stabWarning = false;
        this.stabWarningTime = 0;
        this.isStabbing = true;
        this.stabAnimationTime = 0;

        const audioDash = this.getContextValue('audio');
        if (audioDash) {
          audioDash.playSound('stabberDash', this.x, this.y);
        }

        console.log(`🚀 Stabber starting explosive dash attack!`);
      }

      return null;
    }

    // Preparing phase - gradual slow to stop
    if (this.stabPreparing) {
      const audioPrep = this.getContextValue('audio');
      const beatClockPrep = this.getContextValue('beatClock');
      if (
        this.stabPreparingTime === 0 &&
        audioPrep &&
        beatClockPrep?.canStabberAttack()
      ) {
        audioPrep.playSound('stabberKnifeExtend', this.x, this.y);
      }
      this.stabPreparingTime += dt;

      const prepProgressRatio =
        this.stabPreparingTime / this.maxStabPreparingTime;

      if (prepProgressRatio < 0.25) {
        // First 25% of prepare time: move back
        const moveBackSpeed = this.speed * 0.5;
        if (distance > 0) {
          // Avoid division by zero if distance is 0
          const unitX = dx / distance;
          const unitY = dy / distance;
          this.velocity.x = -unitX * moveBackSpeed; // Move AWAY from player
          this.velocity.y = -unitY * moveBackSpeed;
        } else {
          // If for some reason distance is 0, don't move (or move in a default direction)
          this.velocity.x = 0;
          this.velocity.y = 0;
        }
      } else {
        // Remaining 75% of prepare time: stay still
        this.velocity.x = 0;
        this.velocity.y = 0;
      }

      if (this.stabPreparingTime >= this.maxStabPreparingTime) {
        // Enter warning phase
        this.stabPreparing = false;
        this.stabPreparingTime = 0;
        this.stabWarning = true;
        this.stabWarningTime = 0;

        // Lock attack direction
        this.stabDirection = this.aimAngle;

        console.log(
          `⚠️ Stabber entering warning phase, direction locked at ${((this.stabDirection * 180) / Math.PI).toFixed(1)}°`
        );
      }

      return null;
    }

    // Normal movement and attack initiation
    this.velocity.x = 0;
    this.velocity.y = 0;

    if (distance > 0 && this.stabCooldown <= 0) {
      const unitX = dx / distance;
      const unitY = dy / distance;

      if (distance < this.minStabDistance) {
        // Too close, fall back
        // Move away from player at normal speed
        this.velocity.x = -unitX * this.speed * 1.2;
        this.velocity.y = -unitY * this.speed * 1.2;
        if (CONFIG.DEBUG)
          console.log(
            `🎯 Stabber TOO CLOSE (dist: ${distance.toFixed(0)}px), falling back.`
          );
      } else if (distance <= this.maxStabDistance) {
        const beatClockAtk = this.getContextValue('beatClock');
        const rhythmFX = this.getContextValue('rhythmFX');
        if (beatClockAtk) {
          const currentBeat = beatClockAtk.getCurrentBeat();
          const beatPhase = beatClockAtk.getBeatPhase();
          let beatsUntilStab = null;

          if (currentBeat === 2) {
            if (beatPhase < 0.75) {
              beatsUntilStab = 0.75 - beatPhase;
            }
          } else if (currentBeat === 3) {
            if (beatPhase > 0.25) {
              beatsUntilStab = 3.75 - beatPhase;
            }
          }

          if (beatsUntilStab !== null && beatsUntilStab < 1.5 && rhythmFX) {
            rhythmFX.addAttackTelegraph(
              this.x,
              this.y,
              'stabber',
              beatsUntilStab
            );
          }

          if (beatClockAtk.canStabberAttack()) {
            this.stabPreparing = true;
            this.stabPreparingTime = 0;
            if (CONFIG.DEBUG)
              console.log(
                `🎯 Stabber starting attack (dist: ${distance.toFixed(0)}px) on beat.`
              );
          } else {
            // Creep slowly if in range and off-beat
            this.velocity.x = unitX * this.speed * 0.8;
            this.velocity.y = unitY * this.speed * 0.8;
            if (CONFIG.DEBUG)
              console.log(
                `🎯 Stabber in range (dist: ${distance.toFixed(0)}px), creeping slowly off-beat.`
              );
          }
        }
      } else {
        // Outside attack range
        // Normal approach at 160% speed
        this.velocity.x = unitX * this.speed * 1.6;
        this.velocity.y = unitY * this.speed * 1.6;
      }
    }

    return null;
  }

  /**
   * Check if stab hit player during dash
   */
  checkStabHit(playerX, playerY) {
    if (this.stabDirection == null) {
      return {
        type: 'stabber-miss',
        reason: 'no_stab_direction',
        playerHit: false,
        enemiesHit: [],
      };
    }
    // Calculate tip position
    const s = this.size;
    const extensionFactor =
      this.stabPreparing || this.stabWarning || this.isStabbing ? 2.0 : 1.0;
    const knifeLength = s * 0.6 * extensionFactor;
    // Move tip slightly forward for hit check
    const tipOffset = 4;
    const tipX =
      this.x + cos(this.stabDirection) * (knifeLength + s * 0.15 + tipOffset);
    const tipY =
      this.y + sin(this.stabDirection) * (knifeLength + s * 0.15 + tipOffset);
    // Use tip position for hit detection
    const playerDistance = sqrt((playerX - tipX) ** 2 + (playerY - tipY) ** 2);
    const stabReach = 16; // More forgiving hitbox
    // Angle check as before
    const playerAngle = atan2(playerY - this.y, playerX - this.x);
    // Modular angle difference to handle wrap-around
    let playerDiff =
      ((this.stabDirection - playerAngle + Math.PI) % (2 * Math.PI)) - Math.PI;
    if (playerDiff < -Math.PI) playerDiff += 2 * Math.PI;
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
    // Check player hit
    if (playerDistance <= stabReach && inStabDirection) {
      result.type = 'stabber-melee';
      result.playerHit = true;
      result.damage = 25;
      result.reach = stabReach;
      result.stabAngle = this.stabDirection;
      result.hitType = 'player';
      if (visualEffectsManager) {
        visualEffectsManager.addExplosion(
          tipX,
          tipY,
          10,
          [255, 255, 180],
          0.7,
          3,
          8
        );
        visualEffectsManager.addExplosion(
          tipX,
          tipY,
          14,
          [255, 40, 40],
          0.5,
          2,
          10
        );
      }
      if (audioHit) {
        audioHit.playSound('stabberKnifeHit', tipX, tipY);
      }
    }
    if (enemies) {
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        if (enemy === this) continue;
        const enemyDistance = sqrt(
          (enemy.x - tipX) ** 2 + (enemy.y - tipY) ** 2
        );
        if (enemyDistance <= stabReach) {
          const enemyAngle = atan2(enemy.y - this.y, enemy.x - this.x);
          // Modular angle difference to handle wrap-around
          let enemyDiff =
            ((this.stabDirection - enemyAngle + Math.PI) % (2 * Math.PI)) -
            Math.PI;
          if (enemyDiff < -Math.PI) enemyDiff += 2 * Math.PI;
          const enemyAngleDifference = Math.abs(enemyDiff);
          const enemyInStabDirection = enemyAngleDifference <= maxStabAngle;
          if (enemyInStabDirection) {
            result.enemiesHit.push({
              enemy: enemy,
              index: i,
              damage: 25,
              angle: this.stabDirection,
            });
            // (Effects and sounds moved outside loop)
          }
        }
      }
      if (result.enemiesHit.length > 0) {
        if (visualEffectsManager) {
          visualEffectsManager.addExplosion(
            tipX,
            tipY,
            10,
            [255, 255, 180],
            0.7,
            3,
            8
          );
          visualEffectsManager.addExplosion(
            tipX,
            tipY,
            14,
            [255, 40, 40],
            0.5,
            2,
            10
          );
        }
        if (audioHit) {
          audioHit.playSound('stabberKnifeHit', tipX, tipY);
        }
      }
    }
    if (result.type === 'stabber-miss') {
      if (visualEffectsManager) {
        try {
          visualEffectsManager.addExplosion(
            this.x,
            this.y,
            15,
            [255, 215, 0],
            0.8
          );
        } catch (error) {
          console.log('⚠️ Stabber miss explosion error:', error);
        }
      }
      result.reason =
        playerDistance > stabReach ? 'out_of_reach' : 'wrong_direction';
      result.distance = playerDistance;
      result.reach = stabReach;
    }
    return result;
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

    // Apply damage using actual damage amount
    this.health -= actualDamage;
    // Clamp health to never go below 0, and check for NaN
    if (isNaN(this.health) || this.health < 0) this.health = 0;
    this.hitFlash = 8;

    if (this.health <= 0) {
      return true; // Enemy died
    }
    return false;
  }

  /**
   * Stabbers don't shoot projectiles - they use melee attacks
   */
  createBullet() {
    return null;
  }
}

export { Stabber };
