import { BaseEnemy } from './BaseEnemy.js';
import { Bullet } from './bullet.js';
import {
  floor,
  random,
  sqrt,
  sin,
  cos,
  PI,
  normalizeAngle,
} from '../mathUtils.js';
import { CONFIG } from '../config.js';
import { DAMAGE_RESULT } from '../shared/DamageResult.js';

const TANK_POWER_SOUND_CHANCE = 0.5; // per beat 1 while charging
// Per attempt once the speech timer is up (= today's effective rate)
const TANK_SPEECH_CHANCE = 0.025;

const PI_4 = PI / 4;
const THREE_PI_4 = (3 * PI) / 4;

// The armour plates. `hits` is the impact-angle range a plate takes (0 is a
// shot at the nose), `side` the direction it breaks off in, and `rect` where
// it is drawn (plate thickness, plate length, chassis side y, chassis front
// x). The impact angle is where the shot came from, and y points down, so the
// left plate (drawn at -y) takes the negative angles
const ARMOR_PLATES = [
  {
    name: 'front',
    hits: (a) => a >= -PI_4 && a <= PI_4,
    side: 0,
    fill: [120, 120, 140],
    stroke: [60, 60, 70],
    rect: (t, len, sideY, frontX) => [frontX, -len * 0.4, t * 1.5, len * 0.8],
  },
  {
    name: 'left',
    hits: (a) => a < -PI_4 && a > -THREE_PI_4,
    side: -PI / 2,
    fill: [100, 100, 120],
    stroke: [50, 50, 60],
    rect: (t, len, sideY) => [-len / 2, -sideY - t, len, t],
  },
  {
    name: 'right',
    hits: (a) => a > PI_4 && a < THREE_PI_4,
    side: PI / 2,
    fill: [100, 100, 120],
    stroke: [50, 50, 60],
    rect: (t, len, sideY) => [-len / 2, sideY, len, t],
  },
];

const ANGER_LINES = [
  'ENOUGH! YOU DIE FIRST!',
  'TARGETING TRAITORS!',
  'FRIENDLY FIRE? NOT ANYMORE!',
  'YOU MADE ME MAD!',
  'TURNING GUNS ON YOU!',
];

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

    // Destructible armour plates (see ARMOR_PLATES)
    const { FRONT, SIDE } = CONFIG.TANK_ARMOR;
    this.plates = {
      front: { hp: FRONT, destroyed: false },
      left: { hp: SIDE, destroyed: false },
      right: { hp: SIDE, destroyed: false },
    };
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
      if (
        this.onBeatOnce(beatClock, 'powerSound', beatClock.isOnBeat([1])) &&
        random() < TANK_POWER_SOUND_CHANCE
      ) {
        if (audioTank) audioTank.playSound('tankPower', this.x, this.y);
      }

      // Power-up tone four beats into the charge. No line here: "CHARGING!"
      // and "FIRE!" 4 s apart both clear the 2.5 s cooldown all voices share.
      // With several tanks, some of their lines are still dropped; the tones
      // carry the attack either way
      if (
        beatsSinceCharge >= 4 &&
        beatsSinceCharge < 5 &&
        audioTank &&
        this.onBeatOnce(beatClock, 'chargeMilestone', beatClock.isOnBeat([1]))
      ) {
        audioTank.playSound('tankPowerUp', this.x, this.y);
      }

      // Fire when charge complete AND on beat 1
      if (
        beatsSinceCharge >= this.chargeDurationBeats &&
        beatClock.canTankShoot()
      ) {
        this.chargingShot = false;
        this._lastTankFireBeat = beatClock.getTotalBeats();

        if (audioTank) {
          audioTank.speak(this, 'FIRE!', 'tank');
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
        if (audioTank) {
          audioTank.speak(this, 'CHARGING!', 'tank');
          audioTank.playSound('tankCharging', this.x, this.y);
        }

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
      gate: (beatClock) => !!beatClock?.isOnBeat([1]),
      chance: TANK_SPEECH_CHANCE,
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
    this.p.stroke(138, 43, 226);
    this.p.strokeWeight(2);
    this.p.fill(20, 15, 35);

    const thickness = s * 0.2;
    const length = s * 1.0;
    const chassisSideY = s * 0.6;
    const chassisFrontX = s * 0.5;
    for (const plate of ARMOR_PLATES) {
      this.p.push();
      if (!this.plates[plate.name].destroyed) {
        this.p.fill(...plate.fill);
        this.p.stroke(...plate.stroke);
        this.p.strokeWeight(2);
      } else {
        this.p.fill(50, 50, 50, 150);
        this.p.noStroke();
      }
      this.p.rect(
        ...plate.rect(thickness, length, chassisSideY, chassisFrontX)
      );
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
    // Three layers: a deep boom with a reverb tail, and two detuned zaps
    // whose beating makes the electric buzz
    const audio = this.getContextValue('audio');
    if (audio) {
      for (const name of ['tankEnergy', 'tankZap', 'tankArc']) {
        audio.playSound(name, this.x, this.y);
      }
    }
    bullet.ownerId = this.id; // Track which tank fired this
    return bullet;
  }

  /**
   * Override takeDamage to handle armor and anger system
   */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    const audio = this.getContextValue('audio');
    if (bulletAngle === null) {
      if (audio) audio.playSound('tankHit', this.x, this.y);
      return super.takeDamage(amount, bulletAngle, damageSource);
    }

    const impactAngle = normalizeAngle(bulletAngle - this.aimAngle + PI);
    const plate = ARMOR_PLATES.find(
      (pl) => !this.plates[pl.name].destroyed && pl.hits(impactAngle)
    );
    if (plate) {
      const armor = this.plates[plate.name];
      armor.hp -= amount;
      if (audio) audio.playSound('hit', this.x, this.y);
      this.hitFlash = 8;
      if (armor.hp > 0) return DAMAGE_RESULT.DAMAGED; // the plate took it all

      const overflow = -armor.hp;
      armor.hp = 0;
      armor.destroyed = true;
      if (audio) audio.playSound('explosion', this.x, this.y);
      this.breakArmor(plate);
      this.trackAnger(damageSource);
      if (overflow <= 0) return DAMAGE_RESULT.DAMAGED;
      if (audio) audio.playSound('tankHit', this.x, this.y);
      return super.takeDamage(overflow, bulletAngle, damageSource);
    }

    if (audio) audio.playSound('tankHit', this.x, this.y);
    this.trackAnger(damageSource);
    return super.takeDamage(amount, bulletAngle, damageSource);
  }

  /** Debris, a label and a shake where an armour plate broke off */
  breakArmor(plate) {
    const ox = cos(this.aimAngle + plate.side) * this.size * 0.6;
    const oy = sin(this.aimAngle + plate.side) * this.size * 0.6;

    const explosionManager = this.getContextValue('explosionManager');
    const floatingText = this.getContextValue('floatingText');
    const cameraSystem = this.getContextValue('cameraSystem');
    if (explosionManager) {
      explosionManager.addExplosion(this.x + ox, this.y + oy, 'armor-break');
    }
    if (floatingText) {
      floatingText.addText(
        this.x + ox,
        this.y + oy - 15,
        'ARMOR BREAK!',
        [150, 150, 200],
        12
      );
    }
    if (cameraSystem) {
      cameraSystem.addShake(12, 15);
    }
  }

  /** Hits from other enemies make the tank angry at their type */
  trackAnger(damageSource) {
    if (!damageSource || damageSource === 'player') return;
    const count = (this.damageTracker.get(damageSource) || 0) + 1;
    this.damageTracker.set(damageSource, count);
    if (count >= this.angerThreshold && !this.isAngry) {
      this.isAngry = true;
      this.angerTarget = damageSource;
      this.angerCooldown = this.maxAngerCooldown;
      const audio = this.getContextValue('audio');
      if (audio) audio.speak(this, random(ANGER_LINES), 'tank');
    }
  }
}

export { Tank };
