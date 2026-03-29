import { BaseEnemy } from './BaseEnemy.js';
import { Bullet } from './bullet.js';
import { floor, random, sqrt, sin, cos } from '../mathUtils.js';
import {
  spawnArmorBreakEffect,
  handleAngerForDamage,
  processArmorHit,
} from './TankArmorHandler.js';
import { CONFIG } from '../config.js';

const TANK_LINES = [
  'HEAVY ARTILLERY!',
  'SIEGE MODE!',
  'CRUSH!',
  'PULVERIZE!',
  'DEVASTATE!',
  'DO YOU LIFT BRO?',
  'SIZE MATTERS!',
  'BIG MUSCLES!',
  'ALPHA MALE!',
];

/**
 * Tank class - Heavy artillery with charging system
 * Features anger system that targets other enemies when friendly fire occurs
 */
class Tank extends BaseEnemy {
  constructor(x, y, type, config, p, audio) {
    const tankConfig = {
      ...config,
      size: 50,
      health: 60,
      speed: 0.3,
      color: p.color(138, 43, 226), // Blue violet - massive
    };

    super(x, y, 'tank', tankConfig, p, audio);
    this.p = p;
    this.audio = audio;

    // Tank special charging system (beat-aligned)
    this.chargingShot = false;
    this.chargeStartBeat = -1; // Beat number when charge started
    this.chargeDurationBeats = 8; // 2 measures (8 beats)
    this._lastTankFireBeat = -100; // Last beat fired on

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
  updateSpecificBehavior(
    playerX,
    playerY,
    deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS
  ) {
    // Tank anger system - update anger cooldown and targeting
    const dt = deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS; // Normalize to 60fps baseline
    if (this.isAngry) {
      this.angerCooldown -= dt;
      if (this.angerCooldown <= 0) {
        this.isAngry = false;
        this.angerTarget = null;
        console.log(`😌 Tank calmed down, returning to normal behavior`);

        // Tank speaks about calming down (beat-gated)
        const audio = this.getContextValue('audio');
        const beatClock = this.getContextValue('beatClock');
        if (audio && (!beatClock || beatClock.isOnBeat([1]))) {
          const calmLines = [
            'BACK TO NORMAL TARGETS',
            'ANGER SUBSIDING',
            'RETURNING TO MISSION',
            'FOCUS ON HUMAN AGAIN',
          ];
          const calmLine = random(calmLines);
          audio.speak(this, calmLine, 'tank');
        }
      }
    }

    // Calculate movement towards target (player or angry target)
    let targetX = playerX;
    let targetY = playerY;

    // Tank anger targeting - find nearest enemy of angry target type
    const enemies = this.getContextValue('enemies');
    if (this.isAngry && this.angerTarget && enemies) {
      let nearestAngryTarget = null;
      let nearestDistance = Infinity;

      for (const enemy of enemies) {
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
        if (CONFIG?.GAME_SETTINGS?.DEBUG_COLLISIONS) {
          console.log(
            `😡 Tank targeting angry enemy: ${this.angerTarget} at distance ${nearestDistance.toFixed(0)}`
          );
        }
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

    const audioTank = this.getContextValue('audio');
    const beatClock = this.getContextValue('beatClock');
    const rhythmFX = this.getContextValue('rhythmFX');

    // Handle charging shot system (beat-aligned)
    if (!beatClock) return null;

    if (this.chargingShot) {
      const beatsSinceCharge = beatClock.getTotalBeats() - this.chargeStartBeat;

      // Charge-up sound on beat 1 during charge
      if (beatClock.isOnBeat([1]) && random() < 0.25) {
        if (audioTank) audioTank.playSound('tankPower', this.x, this.y);
      }

      // Speech milestones based on beat progress
      if (
        beatsSinceCharge >= 1 &&
        beatsSinceCharge < 2 &&
        audioTank &&
        beatClock.isOnBeat([1])
      ) {
        console.log('🔋 Tank starting to charge!');
        audioTank.speak(this, 'CHARGING!', 'tank');
        audioTank.playSound('tankCharging', this.x, this.y);
      } else if (
        beatsSinceCharge >= 4 &&
        beatsSinceCharge < 5 &&
        audioTank &&
        beatClock.isOnBeat([1])
      ) {
        console.log('⚡ Tank 50% charged!');
        audioTank.speak(this, 'POWER UP!', 'tank');
        audioTank.playSound('tankPowerUp', this.x, this.y);
      }

      // Fire when charge complete AND on beat 1
      if (
        beatsSinceCharge >= this.chargeDurationBeats &&
        beatClock.canTankShoot()
      ) {
        this.chargingShot = false;
        this._lastTankFireBeat = beatClock.getTotalBeats();

        console.log('💥 Tank firing charged shot!');
        if (audioTank) {
          audioTank.speak(this, 'FIRE!', 'tank');
          if (audioTank.duckDrone) {
            audioTank.duckDrone(500);
          }
        }

        return this.createBullet();
      }
    } else {
      // Start charge on beat 1, within range, with cooldown since last fire
      const beatsSinceLastFire =
        beatClock.getTotalBeats() - this._lastTankFireBeat;
      if (
        distance < 400 &&
        beatsSinceLastFire >= 8 &&
        beatClock.canTankShoot()
      ) {
        this.chargingShot = true;
        this.chargeStartBeat = beatClock.getTotalBeats();
        console.log('🎯 Tank starting charge sequence!');

        // Telegraph the upcoming fire
        if (rhythmFX) {
          rhythmFX.addAttackTelegraph(
            this.x,
            this.y,
            'tank',
            this.chargeDurationBeats
          );
        }
      }
    }

    return null;
  }

  /** @override */
  getAmbientSpeechConfig() {
    return {
      lines: TANK_LINES,
      shouldSpeak: (beatClock) =>
        beatClock && beatClock.isOnBeat([1]) && random() < 0.25,
    };
  }

  /**
   * Draw tank-specific body shape - heavy geometric block
   */
  drawBody(s) {
    this.p.strokeJoin(this.p.MITER);

    // Deep Violet outline
    this.p.stroke(138, 43, 226);
    this.p.strokeWeight(3);

    // Dark heavy interior
    this.p.fill(15, 10, 25);

    // Main heavy hexagon chassis
    this.p.beginShape();
    this.p.vertex(-s * 0.3, -s * 0.6);
    this.p.vertex(s * 0.3, -s * 0.6);
    this.p.vertex(s * 0.6, 0);
    this.p.vertex(s * 0.3, s * 0.6);
    this.p.vertex(-s * 0.3, s * 0.6);
    this.p.vertex(-s * 0.6, 0);
    this.p.endShape(this.p.CLOSE);

    // Glowing core reactor
    this.p.noStroke();
    this.p.fill(148, 0, 211, 150 + Math.sin(this.p.frameCount * 0.1) * 50);
    this.p.ellipse(0, 0, s * 0.5, s * 0.5);

    // Core bright center
    this.p.fill(255, 255, 255, 200);
    this.p.ellipse(0, 0, s * 0.2, s * 0.2);

    // Draw Destructible Armor Pieces
    this.drawArmorPlates(s);
  }

  drawArmorPlates(s) {
    // Synthwave style armor plates - geometric with neon outlines
    const armorPlateThickness = s * 0.2;
    const armorColor = this.p.color(20, 15, 35);
    const outlineColor = this.p.color(138, 43, 226);

    this.p.stroke(outlineColor);
    this.p.strokeWeight(2);
    this.p.fill(armorColor); // Thickness of the side armor plates
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
    const activeBombs = this.getContextValue('activeBombs');
    if (activeBombs?.some((bomb) => bomb.tankId === this.id)) {
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
    const beatClock = this.getContextValue('beatClock');
    const chargePercent = beatClock
      ? Math.min(
          1,
          (beatClock.getTotalBeats() - this.chargeStartBeat) /
            this.chargeDurationBeats
        )
      : 0;

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
    const bullet = Bullet.acquire(
      bulletX,
      bulletY,
      this.aimAngle,
      2,
      'enemy-tank'
    );
    if (!bullet) return null;
    bullet.ownerId = this.id; // Track which tank fired this
    return bullet;
  }

  /**
   * Override takeDamage to handle armor and anger system
   */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    const audio = this.getContextValue('audio');
    if (bulletAngle === null) {
      console.log('🎯 Tank Main Body Hit (no angle info)!');
      if (audio) audio.playSound('tankHit', this.x, this.y);
      const died = super.takeDamage(amount, bulletAngle, damageSource);
      if (died) console.log('💀 Tank Died (main health depleted).');
      return died;
    }

    const armorResult = processArmorHit(
      this,
      amount,
      bulletAngle,
      damageSource
    );
    if (armorResult?.absorbed) return false;

    if (armorResult?.overflowAmount !== undefined) {
      if (armorResult.plate) spawnArmorBreakEffect(this, armorResult.plate);
      handleAngerForDamage(this, damageSource, armorResult.overflowAmount);
      if (armorResult.overflowAmount > 0) {
        if (audio) audio.playSound('tankHit', this.x, this.y);
        return super.takeDamage(
          armorResult.overflowAmount,
          bulletAngle,
          damageSource
        );
      }
      return false;
    }

    console.log(`🎯 Tank Main Body Hit!`);
    if (audio) audio.playSound('tankHit', this.x, this.y);
    handleAngerForDamage(this, damageSource, amount);
    const died = super.takeDamage(amount, bulletAngle, damageSource);
    if (died) console.log('💀 Tank Died (main health depleted).');
    return died;
  }
}

export { Tank };
