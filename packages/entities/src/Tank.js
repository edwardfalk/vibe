import { BaseEnemy } from './BaseEnemy.js';
import { Bullet } from './bullet.js';
import {
  floor,
  random,
  sqrt,
  sin,
  cos,
  PI,
  TWO_PI,
  normalizeAngle,
  min,
  max,
} from '@vibe/core';
import { CONFIG } from '@vibe/core';
import { speakAmbient } from './EnemySpeechUtils.js';
import { SOUND } from '@vibe/core';
import { EnemyEventBus } from './EnemyEventBus.js';

/**
 * Tank class - Heavy artillery with charging system
 * Features anger system that targets other enemies when friendly fire occurs
 */
class Tank extends BaseEnemy {
  constructor(x, y, type, config, p, audio) {
    const tankConfig = {
      size: 50,
      health: 60,
      speed: 0.3,
      color: p.color(138, 43, 226), // Blue violet - massive
    };

    super(x, y, 'tank', tankConfig, p, audio);
    this.p = p;
    this.audio = audio;

    // Tank special charging system
    this.chargingShot = false;
    this.chargeTime = 0;
    this.maxChargeTime = 240; // 4 seconds at 60fps - long, dramatic charge

    // Tank anger system - tracks who damages it
    this.damageTracker = new Map(); // Track damage sources: enemyType -> count
    this.angerThreshold = 3; // Get angry after 3 hits from same enemy type
    this.isAngry = false;
    this.angerTarget = null; // Which enemy type to target when angry
    this.angerCooldown = 0; // Cooldown before returning to normal behavior
    this.maxAngerCooldown = 600; // 10 seconds of anger

    // Destructible Armor Pieces
    this.frontArmorHP = 120;
    this.frontArmorDestroyed = false;
    this.leftArmorHP = 80;
    this.rightArmorHP = 80;
    this.leftArmorDestroyed = false;
    this.rightArmorDestroyed = false;

    console.log(
      '🛡️ Tank created with charging system, anger tracking, and multi-part armor initialized'
    );
  }

  /**
   * Update specific tank behavior - heavy artillery
   * @param {number} playerX - Player X position
   * @param {number} playerY - Player Y position
   * @param {number} deltaTimeMs - Time elapsed since last frame in milliseconds
   */
  updateSpecificBehavior(playerX, playerY, deltaTimeMs = 16.6667) {
    // Tank anger system - update anger cooldown and targeting
    const dt = deltaTimeMs / 16.6667; // Normalize to 60fps baseline
    if (this.isAngry) {
      this.angerCooldown -= dt;
      if (this.angerCooldown <= 0) {
        this.isAngry = false;
        this.angerTarget = null;
        console.log(`😌 Tank calmed down, returning to normal behavior`);

        // Tank speaks about calming down
        if (window.audio) {
          const calmLines = [
            'BACK TO NORMAL TARGETS',
            'ANGER SUBSIDING',
            'RETURNING TO MISSION',
            'FOCUS ON HUMAN AGAIN',
          ];
          const calmLine = calmLines[floor(random() * calmLines.length)];
          window.audio.speak(this, calmLine, 'tank');
        }
      }
    }

    // Calculate movement towards target (player or angry target)
    let targetX = playerX;
    let targetY = playerY;

    // Tank anger targeting - find nearest enemy of angry target type
    if (this.isAngry && this.angerTarget && window.enemies) {
      let nearestAngryTarget = null;
      let nearestDistance = Infinity;

      for (const enemy of window.enemies) {
        if (enemy.type === this.angerTarget && enemy !== this) {
          const dist = sqrt((enemy.x - this.x) ** 2 + (enemy.y - this.y) ** 2);
          if (dist < nearestDistance) {
            nearestDistance = dist;
            nearestAngryTarget = enemy;
          }
        }
      }

      if (nearestAngryTarget) {
        targetX = nearestAngryTarget.x;
        targetY = nearestAngryTarget.y;
        console.log(
          `😡 Tank targeting angry enemy: ${this.angerTarget} at distance ${nearestDistance.toFixed(0)}`
        );
      }
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = sqrt(dx * dx + dy * dy);

    // Tank movement - very slow and steady
    this.velocity.x = 0;
    this.velocity.y = 0;

    if (distance > 0) {
      const unitX = dx / distance;
      const unitY = dy / distance;

      // Tanks move very slowly but relentlessly
      this.velocity.x = unitX * this.speed;
      this.velocity.y = unitY * this.speed;
    }

    // Handle charging shot system
    if (this.chargingShot) {
      this.chargeTime += dt;

      // Tank power sound at different charge stages
      if (window.audio && window.beatClock) {
        // Tank power sounds play on beat 1 with 25% chance
        if (window.beatClock.isOnBeat([1]) && random() < 0.25) {
          window.audio.playSound(SOUND.tankPower, this.x, this.y);
        }
      }

      // Different charging sounds at different stages
      if (this.chargeTime >= 1 && this.chargeTime < 1 + dt && window.audio) {
        console.log('🔋 Tank starting to charge!');
        window.audio.speak(this, 'CHARGING!', 'tank');
        window.audio.playSound(SOUND.tankCharging, this.x, this.y);
      } else if (
        this.chargeTime >= this.maxChargeTime / 2 &&
        this.chargeTime < this.maxChargeTime / 2 + dt &&
        window.audio
      ) {
        console.log('⚡ Tank 50% charged!');
        window.audio.speak(this, 'POWER UP!', 'tank');
        window.audio.playSound(SOUND.tankPowerUp, this.x, this.y);
      }

      if (this.chargeTime >= this.maxChargeTime) {
        // Fire the charged shot
        this.chargingShot = false;
        this.chargeTime = 0;
        this.shootCooldown = 180; // 3 second cooldown after firing

        console.log('💥 Tank firing charged shot!');
        if (window.audio) {
          window.audio.speak(this, 'FIRE!', 'tank');
        }

        return this.createBullet();
      }
    } else if (distance < 400 && this.shootCooldown <= 0) {
      // RHYTHMIC TANK SHOOTING: Tanks can only shoot on beat 1 (bass drum pattern)
      if (window.beatClock && window.beatClock.canTankShoot()) {
        // Start charging
        this.chargingShot = true;
        this.chargeTime = 0;
        if (window.audio && typeof window.audio.playSound === 'function') {
          window.audio.playSound(SOUND.enemyChargeUp, this.x, this.y);
        }
        console.log('🎯 Tank starting charge sequence!');
      }
    }

    return null;
  }

  /**
   * Trigger ambient speech specific to tanks
   */
  triggerAmbientSpeech() {
    speakAmbient(this, 'tank', { probability: 0.25, beatList: [1] });
  }

  /**
   * Draw tank-specific body shape
   */
  drawBody(s) {
    // Massive, blocky body
    this.p.fill(this.bodyColor);
    this.p.noStroke();
    this.p.rect(-s * 0.5, -s * 0.6, s, s * 1.2); // Main chassis (center part)

    // Decorative plating on main chassis (these are not the destructible armor)
    this.p.fill(
      this.bodyColor.levels[0] + 20,
      this.bodyColor.levels[1] + 20,
      this.bodyColor.levels[2] + 20
    );
    this.p.rect(-s * 0.45, -s * 0.5, s * 0.9, s * 0.2); // Top plate on chassis
    this.p.rect(-s * 0.45, -s * 0.1, s * 0.9, s * 0.2); // Middle plate on chassis
    this.p.rect(-s * 0.45, s * 0.3, s * 0.9, s * 0.2); // Bottom plate on chassis

    // Tank treads (visual only)
    this.p.fill(
      this.bodyColor.levels[0] - 30,
      this.bodyColor.levels[1] - 30,
      this.bodyColor.levels[2] - 30
    );
    this.p.rect(-s * 0.55, -s * 0.7, s * 1.1, s * 0.15); // Top of treads
    this.p.rect(-s * 0.55, s * 0.55, s * 1.1, s * 0.15); // Bottom of treads

    // Draw Destructible Armor Pieces (these are drawn relative to the tank's center after rotation)
    this.drawArmorPlates(s, {
      front: this.frontArmorDestroyed ? 0 : this.frontArmorHP / 120,
      left: this.leftArmorDestroyed ? 0 : this.leftArmorHP / 80,
      right: this.rightArmorDestroyed ? 0 : this.rightArmorHP / 80,
    });
  }

  drawArmorPlates(s, armorFrac = { front: 1, left: 1, right: 1 }) {
    // We are in the Tank's local coordinate system, centered and rotated.
    // Main chassis' local Y extents are roughly -s*0.6 to +s*0.6.
    // Main chassis' local X extents are roughly -s*0.5 to +s*0.5.

    const armorPlateThickness = s * 0.2; // Thickness of the side armor plates
    const armorPlateLength = s * 1.0; // Length of the side armor plates
    const chassisSideY = s * 0.6; // Y-coordinate of the edge of the main chassis' side.
    const chassisFrontX = s * 0.5; // X-coordinate of the front of the main chassis.

    // Front Armor (Tank's local +X side - its nose)
    this.p.push();
    if (!this.frontArmorDestroyed) {
      this.p.fill(120, 120, 140);
      this.p.stroke(60, 60, 70);
      this.p.strokeWeight(2);
      // rect(x_top_left, y_top_left, width, height)
      // x_top_left is chassisFrontX (places it on the front edge of the chassis)
      // y_top_left is -armorPlateLength / 2 + s * 0.1 (to align with cannon visually, slightly narrower than side armor)
      // width is armorPlateThickness (it extends along X-axis)
      // height is armorPlateLength * 0.8 (making it slightly shorter than side plates for visual distinction)
      this.p.rect(
        chassisFrontX,
        -armorPlateLength * 0.4,
        armorPlateThickness * 1.5,
        armorPlateLength * 0.8
      );
    } else {
      this.p.fill(50, 50, 50, 150);
      this.p.noStroke();
      this.p.rect(
        chassisFrontX,
        -armorPlateLength * 0.4,
        armorPlateThickness * 1.5,
        armorPlateLength * 0.8
      );
    }
    this.p.pop();

    // Left Armor (Tank's local -Y side)
    this.p.push();
    if (!this.leftArmorDestroyed) {
      this.p.fill(100, 100, 120);
      this.p.stroke(50, 50, 60);
      this.p.strokeWeight(2);
      // rect(x_top_left, y_top_left, width, height)
      // x_top_left is -armorPlateLength / 2 to center it along the tank's X-axis.
      // y_top_left is -chassisSideY - armorPlateThickness (places it outside the chassis on the -Y side).
      this.p.rect(
        -armorPlateLength / 2,
        -chassisSideY - armorPlateThickness,
        armorPlateLength,
        armorPlateThickness
      );
    } else {
      this.p.fill(50, 50, 50, 150);
      this.p.noStroke();
      this.p.rect(
        -armorPlateLength / 2,
        -chassisSideY - armorPlateThickness,
        armorPlateLength,
        armorPlateThickness
      );
    }
    this.p.pop();

    // Right Armor (Tank's local +Y side)
    this.p.push();
    if (!this.rightArmorDestroyed) {
      this.p.fill(100, 100, 120);
      this.p.stroke(50, 50, 60);
      this.p.strokeWeight(2);
      // x_top_left is -armorPlateLength / 2.
      // y_top_left is +chassisSideY (places it outside the chassis on the +Y side).
      this.p.rect(
        -armorPlateLength / 2,
        chassisSideY,
        armorPlateLength,
        armorPlateThickness
      );
    } else {
      this.p.fill(50, 50, 50, 150);
      this.p.noStroke();
      this.p.rect(
        -armorPlateLength / 2,
        chassisSideY,
        armorPlateLength,
        armorPlateThickness
      );
    }
    this.p.pop();

    // For front armor
    if (!this.frontArmorDestroyed && armorFrac.front < 1) {
      this.p.push();
      this.p.stroke(220, 220, 255, 180 * (1 - armorFrac.front));
      this.p.strokeWeight(2);
      // Draw 2-4 jagged cracks vertically
      for (let c = 0; c < 2 + Math.floor((1 - armorFrac.front) * 3); c++) {
        const x0 = chassisFrontX + 4 + c * 6;
        let y = -armorPlateLength * 0.4 + 4;
        for (let seg = 0; seg < 5; seg++) {
          const x1 = x0 + random(-2, 2);
          const y1 = y + (armorPlateLength * 0.8) / 5 + random(-2, 2);
          this.p.line(x0, y, x1, y1);
          y = y1;
        }
      }
      this.p.pop();
    }
    // For left armor
    if (!this.leftArmorDestroyed && armorFrac.left < 1) {
      this.p.push();
      this.p.stroke(220, 220, 255, 180 * (1 - armorFrac.left));
      this.p.strokeWeight(2);
      for (let c = 0; c < 2 + Math.floor((1 - armorFrac.left) * 2); c++) {
        let x = -armorPlateLength / 2 + 6 + c * 12;
        const y0 = -chassisSideY - armorPlateThickness + 2;
        for (let seg = 0; seg < 4; seg++) {
          const x1 = x + (armorPlateLength / 4) + random(-2, 2);
          const y1 = y0 + random(-2, 2);
          this.p.line(x, y0, x1, y1);
          x = x1;
        }
      }
      this.p.pop();
    }
    // For right armor
    if (!this.rightArmorDestroyed && armorFrac.right < 1) {
      this.p.push();
      this.p.stroke(220, 220, 255, 180 * (1 - armorFrac.right));
      this.p.strokeWeight(2);
      for (let c = 0; c < 2 + Math.floor((1 - armorFrac.right) * 2); c++) {
        let x = -armorPlateLength / 2 + 6 + c * 12;
        const y0 = chassisSideY + armorPlateThickness + armorPlateThickness / 2;
        for (let seg = 0; seg < 4; seg++) {
          const x1 = x + (armorPlateLength / 4) + random(-2, 2);
          const y1 = y0 + random(-2, 2);
          this.p.line(x, y0, x1, y1);
          x = x1;
        }
      }
      this.p.pop();
    }
  }

  /**
   * Override weapon drawing for tank's heavy weapon
   */
  drawWeapon(s) {
    // Massive tank cannon
    this.p.fill(this.weaponColor);
    this.p.rect(s * 0.3, -s * 0.1, s * 0.8, s * 0.2);

    // Cannon details
    this.p.fill(
      this.weaponColor.levels[0] + 30,
      this.weaponColor.levels[1] + 30,
      this.weaponColor.levels[2] + 30
    );
    this.p.rect(s * 0.35, -s * 0.08, s * 0.7, s * 0.06);
    this.p.rect(s * 0.35, s * 0.02, s * 0.7, s * 0.06);

    // Muzzle flash (larger for tank)
    if (this.muzzleFlash > 0) {
      this.p.fill(255, 255, 100, this.muzzleFlash * 30);
      this.p.ellipse(s * 1.1, 0, s * 0.4, s * 0.2);
      this.muzzleFlash--;
    }
  }

  /**
   * Draw type-specific indicators
   */
  drawSpecificIndicators() {
    if (this.chargingShot) {
      this.drawChargingIndicator();
    }
    if (
      window.activeBombs &&
      window.activeBombs.some((bomb) => bomb.tankId === this.id)
    ) {
      this.p.push();
      this.p.fill(255, 0, 0);
      this.p.textAlign(this.p.CENTER, this.p.CENTER);
      this.p.textSize(16);
      this.p.stroke(0, 0, 0);
      this.p.strokeWeight(3);
      this.p.text('TIME BOMB!', this.x, this.y - this.size - 50);
      this.p.pop();
    }
  }

  /**
   * Draw charging indicator
   */
  drawChargingIndicator() {
    const chargePercent = this.chargeTime / this.maxChargeTime;

    // Charging circle around tank
    const pulse = sin(this.p.frameCount * 2.0) * 0.3 + 0.7;
    const chargeRadius = this.size * (0.8 + chargePercent * 0.4);

    // Outer charge field
    this.p.fill(100, 200, 255, 30 + chargePercent * 50 + pulse * 30);
    this.p.noStroke();
    this.p.ellipse(this.x, this.y, chargeRadius * 2.5);

    // Inner energy core
    this.p.fill(150, 220, 255, 60 + chargePercent * 80 + pulse * 40);
    this.p.ellipse(this.x, this.y, chargeRadius * 1.5);

    // Charge percentage text
    this.p.fill(255, 255, 255);
    this.p.textAlign(this.p.CENTER, this.p.CENTER);
    this.p.textSize(10);
    this.p.text(
      `${floor(chargePercent * 100)}%`,
      this.x,
      this.y - this.size - 25
    );

    // "CHARGING" text
    if (chargePercent > 0.3) {
      this.p.textSize(12);
      this.p.text('CHARGING', this.x, this.y - this.size - 40);
    }
  }

  /**
   * Create tank's devastating energy ball
   */
  createBullet() {
    const bulletDistance = this.size * 0.9;
    const bulletX = this.x + cos(this.aimAngle) * bulletDistance;
    const bulletY = this.y + sin(this.aimAngle) * bulletDistance;

    // Devastating slow energy ball with owner ID
    const bullet = new Bullet(bulletX, bulletY, this.aimAngle, 2, 'enemy-tank');
    bullet.ownerId = this.id; // Track which tank fired this
    return bullet;
  }

  /**
   * Override takeDamage to handle armor and anger system
   */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    // Calculate angle of attack relative to tank's facing direction
    if (bulletAngle === null) {
      // No angle: bypass armor, apply damage directly to main body
      console.log('🎯 Tank Main Body Hit (no angle info)!');
      const died = super.takeDamage(amount, bulletAngle, damageSource);
      if (died) {
        console.log('💀 Tank Died (main health depleted).');
        if (died && window.audio && typeof window.audio.playSound === 'function') {
          window.audio.playSound(SOUND.tankDeathThump, this.x, this.y);
        }
      }
      return died;
    }
    const impactAngle = normalizeAngle(bulletAngle - this.aimAngle + PI);
    const PI_4 = PI / 4; // 45 degrees
    const THREE_PI_4 = (3 * PI) / 4; // 135 degrees

    // Check Front Armor Hit (impactAngle between -PI/4 and PI/4)
    if (
      !this.frontArmorDestroyed &&
      impactAngle >= -PI_4 &&
      impactAngle <= PI_4
    ) {
      // Calculate overflow damage if incoming damage exceeds armor HP
      const prevHP = this.frontArmorHP;
      this.frontArmorHP -= amount;
      if (window.audio) window.audio.playSound(SOUND.hit, this.x, this.y);
      if (this.frontArmorHP <= 0) {
        EnemyEventBus.emitArmorBroken({ id: this.id, part: 'front', x: this.x, y: this.y });
        // Armor destroyed, propagate leftover damage to main body
        const leftover = -this.frontArmorHP; // positive overflow
        this.frontArmorDestroyed = true;
        this.frontArmorHP = 0;
        console.log('💥 Tank Front Armor Destroyed!');
        if (window.audio)
          window.audio.playSound(SOUND.explosion, this.x, this.y);
        // TODO: Add visual effect for front armor breaking
        this.hitFlash = 8;
        if (leftover > 0) {
          // Pass overflow damage to main body
          return super.takeDamage(leftover, bulletAngle, damageSource);
        }
        // Emit armor damaged progress
        EnemyEventBus.emitArmorDamaged({
          id: this.id,
          part: 'front',
          x: this.x,
          y: this.y,
          armorRemaining: Math.max(0, this.frontArmorHP) / 120,
        });
        return false; // No overflow, armor absorbed
      }
      this.hitFlash = 8;
      // Emit armor damaged progress
      EnemyEventBus.emitArmorDamaged({
        id: this.id,
        part: 'front',
        x: this.x,
        y: this.y,
        armorRemaining: Math.max(0, this.frontArmorHP) / 120,
      });
      return false; // Armor absorbed
    }
    // Check Left Armor Hit (impactAngle between PI/4 and 3PI/4)
    else if (
      !this.leftArmorDestroyed &&
      impactAngle > PI_4 &&
      impactAngle < THREE_PI_4
    ) {
      // Calculate overflow damage if incoming damage exceeds armor HP
      const prevHP = this.leftArmorHP;
      this.leftArmorHP -= amount;
      if (window.audio) window.audio.playSound(SOUND.hit, this.x, this.y);
      if (this.leftArmorHP <= 0) {
        EnemyEventBus.emitArmorBroken({ id: this.id, part: 'left', x: this.x, y: this.y });
        // Armor destroyed, propagate leftover damage to main body
        const leftover = -this.leftArmorHP; // positive overflow
        this.leftArmorDestroyed = true;
        this.leftArmorHP = 0;
        console.log('💥 Tank Left Armor Destroyed!');
        if (window.audio)
          window.audio.playSound(SOUND.explosion, this.x, this.y);
        // TODO: Add visual effect for armor breaking
        this.hitFlash = 8;
        if (leftover > 0) {
          // Pass overflow damage to main body
          return super.takeDamage(leftover, bulletAngle, damageSource);
        }
        // Emit armor damaged progress
        EnemyEventBus.emitArmorDamaged({
          id: this.id,
          part: 'left',
          x: this.x,
          y: this.y,
          armorRemaining: Math.max(0, this.leftArmorHP) / 80,
        });
        return false; // No overflow, armor absorbed
      }
      this.hitFlash = 8;
      // Emit armor damaged progress
      EnemyEventBus.emitArmorDamaged({
        id: this.id,
        part: 'left',
        x: this.x,
        y: this.y,
        armorRemaining: Math.max(0, this.leftArmorHP) / 80,
      });
      return false; // Armor absorbed
    }
    // Check Right Armor Hit (impactAngle between -3PI/4 and -PI/4)
    else if (
      !this.rightArmorDestroyed &&
      impactAngle < -PI_4 &&
      impactAngle > -THREE_PI_4
    ) {
      // Calculate overflow damage if incoming damage exceeds armor HP
      const prevHP = this.rightArmorHP;
      this.rightArmorHP -= amount;
      if (window.audio) window.audio.playSound(SOUND.hit, this.x, this.y);
      if (this.rightArmorHP <= 0) {
        EnemyEventBus.emitArmorBroken({ id: this.id, part: 'right', x: this.x, y: this.y });
        // Armor destroyed, propagate leftover damage to main body
        const leftover = -this.rightArmorHP; // positive overflow
        this.rightArmorDestroyed = true;
        this.rightArmorHP = 0;
        console.log('💥 Tank Right Armor Destroyed!');
        if (window.audio)
          window.audio.playSound(SOUND.explosion, this.x, this.y);
        // TODO: Add visual effect for armor breaking
        this.hitFlash = 8;
        if (leftover > 0) {
          // Pass overflow damage to main body
          return super.takeDamage(leftover, bulletAngle, damageSource);
        }
        // Emit armor damaged progress
        EnemyEventBus.emitArmorDamaged({
          id: this.id,
          part: 'right',
          x: this.x,
          y: this.y,
          armorRemaining: Math.max(0, this.rightArmorHP) / 80,
        });
        return false; // No overflow, armor absorbed
      }
      this.hitFlash = 8;
      // Emit armor damaged progress
      EnemyEventBus.emitArmorDamaged({
        id: this.id,
        part: 'right',
        x: this.x,
        y: this.y,
        armorRemaining: Math.max(0, this.rightArmorHP) / 80,
      });
      return false; // Armor absorbed
    }

    // Hit main body (front/rear, or side if armor is gone)
    console.log(`🎯 Tank Main Body Hit!`);

    // Tank anger system - track damage sources (only if main body is hit by non-player)
    if (damageSource && damageSource !== 'player') {
      const currentCount = this.damageTracker.get(damageSource) || 0;
      this.damageTracker.set(damageSource, currentCount + 1);
      console.log(
        `💢 Tank hit by ${damageSource}! Count: ${currentCount + 1}. AngerTarget: ${this.angerTarget}`
      );
      if (currentCount + 1 >= this.angerThreshold && !this.isAngry) {
        this.isAngry = true;
        this.angerTarget = damageSource; // Target the type of enemy that angered it
        this.angerCooldown = this.maxAngerCooldown;
        console.log(`😡 TANK IS ANGRY! Targeting ${this.angerTarget} enemies!`);
        if (window.audio) {
          const angerLines = [
            'ENOUGH! YOU DIE FIRST!',
            'TARGETING TRAITORS!',
            'FRIENDLY FIRE? NOT ANYMORE!',
            'YOU MADE ME MAD!',
            'TURNING GUNS ON YOU!',
          ];
          window.audio.speak(
            this,
            angerLines[floor(random() * angerLines.length)],
            'tank'
          );
        }
      }
    }
    // Apply damage to main health
    const died = super.takeDamage(amount, bulletAngle, damageSource);
    if (died) {
      console.log('💀 Tank Died (main health depleted).');
      if (died && window.audio && typeof window.audio.playSound === 'function') {
        window.audio.playSound(SOUND.tankDeathThump, this.x, this.y);
      }
    }
    return died;
  }
}

export { Tank };
