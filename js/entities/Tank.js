import { BaseEnemy } from './BaseEnemy.js';
import { Bullet } from './bullet.js';
import { floor, random, cos, sin, PI, smooth, clamp01 } from '../mathUtils.js';
import { CONFIG } from '../config.js';
import { DAMAGE_RESULT } from '../shared/DamageResult.js';
import {
  TANK_LINES,
  TANK_ANGER_LINES,
  TANK_CALM_LINES,
  TANK_FIRE,
  TANK_CHARGING,
} from '../audio/DialogueLines.js';
import {
  TANK_COLORS,
  tankMuzzle,
  turnStep,
  nextGunRel,
  tankSide,
} from './TankRenderer.js';

const TANK_POWER_SOUND_CHANCE = 0.5; // per beat 1 while charging
// Per attempt once the speech timer is up (= today's effective rate)
const TANK_SPEECH_CHANCE = 0.025;
const BEATS_PER_BAR = 4;
const POWER_UP_BEATS = 4; // the charge's second bar opens with a power-up tone
const FRAMES_PER_SEC = 60; // BaseEnemy's velocity is px per 60 Hz frame
const DEG = PI / 180;

// The armour plates. `side` is the direction it breaks off in, and `rect`
// where it is drawn (plate thickness, plate length, chassis side y, chassis
// front x)
const ARMOR_PLATES = [
  {
    name: 'front',
    side: 0,
    fill: [120, 120, 140],
    stroke: [60, 60, 70],
    rect: (t, len, sideY, frontX) => [frontX, -len * 0.4, t * 1.5, len * 0.8],
  },
  {
    name: 'left',
    side: -PI / 2,
    fill: [100, 100, 120],
    stroke: [50, 50, 60],
    rect: (t, len, sideY) => [-len / 2, -sideY - t, len, t],
  },
  {
    name: 'right',
    side: PI / 2,
    fill: [100, 100, 120],
    stroke: [50, 50, 60],
    rect: (t, len, sideY) => [-len / 2, sideY, len, t],
  },
];
// Which way a broken plate's debris flies, from his facing
const PLATE_SIDE = { front: 0, left: -PI / 2, right: PI / 2 };

// Damage sources named for the attack rather than the enemy type
const ANGER_SOURCE_TYPE = { stabber_melee: 'stabber' };

/**
 * Tank class - Heavy artillery with charging system
 * Features anger system that targets other enemies when friendly fire occurs
 */
class Tank extends BaseEnemy {
  constructor(x, y, type, config, p, audio) {
    const tankConfig = {
      ...config,
      size: 50,
      health: CONFIG.TANK.HEALTH,
      speed: CONFIG.TANK.DRIFT_PX_S / FRAMES_PER_SEC,
      color: p.color(...TANK_COLORS.skin),
    };

    super(x, y, 'tank', tankConfig, p, audio);

    // His body faces one way and turns only on beat 1; his gun swings
    // within an arc of that facing (TankRenderer.js has the geometry).
    // He spawns facing the hero
    const hero = this.getContextValue('player');
    this.facing = hero ? Math.atan2(hero.y - y, hero.x - x) : 0;
    this.turn = { from: this.facing, to: this.facing, at: null };
    this.gunRel = 0;
    this.aimAngle = this.facing;
    this.lastActedBar = null; // the bar he last acted on beat 1 of
    this.kickAt = null; // when he did (a beat position)
    this.lurchNow = 0; // this frame's lurch, 0 to 1 (drawn too)
    this.poseBeats = null; // the beat position update() last kept

    // His charge, on his bar clock (beat positions)
    this.chargingShot = false;
    this.chargeStartBeat = -1;
    this.chargeDurationBeats = CONFIG.TANK.CHARGE_BEATS;
    this._lastTankFireBeat = -Infinity;
    this.firedAt = null;

    // Tank anger system - tracks who damages it
    this.damageTracker = new Map(); // Track damage sources: enemyType -> count
    this.angerThreshold = 3; // Get angry after 3 hits from same enemy type
    this.isAngry = false;
    this.angerTarget = null; // Which enemy type to target when angry
    this.angerCooldown = 0; // Cooldown before returning to normal behavior
    this.maxAngerCooldown = 600; // 10 seconds of anger
    this.calmLinePending = false;

    // Destructible armour plates (see ARMOR_PLATES)
    const { FRONT, SIDE } = CONFIG.TANK_ARMOR;
    const plate = (hp) => ({ hp, max: hp, destroyed: hp <= 0 });
    this.plates = {
      front: plate(FRONT),
      left: plate(SIDE),
      right: plate(SIDE),
    };
    // When things happened to him, in beat positions (poseBeats), for drawing
    this.plateHitAt = { front: null, left: null, right: null };
    this.plateBrokeAt = { front: null, left: null, right: null };
    this.hitAt = null;
    this.backHitAt = null;
  }

  /** @override He keeps the beat position he is drawn at, and his gun is his aim */
  update(playerX, playerY, deltaTimeMs) {
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition() ?? null;
    const bullet = super.update(playerX, playerY, deltaTimeMs);
    // BaseEnemy.update pointed aimAngle at the hero; his aim is his gun's
    this.aimAngle = this.facing + this.gunRel;
    return bullet;
  }

  /**
   * Turn on beat 1, aim, drift and lurch, charge and fire, all on the beat
   * clock. Returns his shot, or null.
   */
  updateSpecificBehavior(
    playerX,
    playerY,
    deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS
  ) {
    const T = CONFIG.TANK;
    this.updateAnger(deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS);
    const target = this.target(playerX, playerY);
    const toTarget = Math.atan2(target.y - this.y, target.x - this.x);
    const distance = Math.hypot(target.x - this.x, target.y - this.y);
    const beatClock = this.getContextValue('beatClock');
    // The frame's one clock reading: update() kept the same one, and tests
    // that call this directly get theirs here
    const beats = beatClock?.getBeatPosition() ?? null;
    this.poseBeats = beats;
    const beatSec = (beatClock?.beatInterval ?? 0) / 1000;

    // Beat 1: the first update in a bar he hasn't acted in, however late in
    // that bar. First seen past beat 1 (a spawn ending mid-bar), he notes
    // the bar and waits for the next
    let fire = false;
    if (beats !== null) {
      this.facing = this.facingAt(beats, beatSec);
      const bar = Math.floor(beats / BEATS_PER_BAR);
      if (this.lastActedBar === null && beats - bar * BEATS_PER_BAR >= 1) {
        this.lastActedBar = bar;
      } else if (bar !== this.lastActedBar) {
        this.lastActedBar = bar;
        this.kickAt = beats;
        fire = this.onKick(bar * BEATS_PER_BAR, toTarget, distance);
      }
      this.facing = this.facingAt(beats, beatSec);
    }
    this.gunRel = nextGunRel(
      this.gunRel,
      this.facing,
      toTarget,
      T.AIM_ARC_DEG * DEG,
      deltaTimeMs / 1000,
      T.AIM_TAU_SEC
    );

    // A slow drift toward his target, and a lurch along his facing from
    // when he acted on beat 1; closer than LURCH_MIN_DIST_PX he holds still
    const near = distance <= T.LURCH_MIN_DIST_PX;
    this.lurchNow =
      near || beats === null || this.kickAt === null
        ? 0
        : Math.exp(-((beats - this.kickAt) * beatSec) / T.LURCH_TAU_SEC);
    const drift = near ? 0 : T.DRIFT_PX_S;
    const lurch = T.LURCH_PX_S * this.lurchNow;
    this.velocity.x =
      (Math.cos(toTarget) * drift + Math.cos(this.facing) * lurch) /
      FRAMES_PER_SEC;
    this.velocity.y =
      (Math.sin(toTarget) * drift + Math.sin(this.facing) * lurch) /
      FRAMES_PER_SEC;

    if (!fire) return null;
    this.chargingShot = false;
    this.firedAt = beats;
    this.getContextValue('audio')?.speak(this, TANK_FIRE, 'tank');
    return this.createBullet();
  }

  /**
   * Beat 1 (kickBeat is the bar's start, counting the charge in bars): turn
   * toward the target, then start a charge, power it up or call the shot.
   * Returns true when the charged shot is due.
   */
  onKick(kickBeat, toTarget, distance) {
    const T = CONFIG.TANK;
    const step = turnStep(
      this.facing,
      toTarget,
      T.TURN_STEP_DEG * DEG,
      T.TURN_DEADZONE_DEG * DEG
    );
    if (step !== 0) {
      this.turn = {
        from: this.facing,
        to: this.facing + step,
        at: this.kickAt,
      };
    }
    const audio = this.getContextValue('audio');
    if (this.chargingShot) {
      const since = kickBeat - this.chargeStartBeat;
      if (since >= this.chargeDurationBeats) {
        this._lastTankFireBeat = kickBeat;
        return true;
      }
      if (random() < TANK_POWER_SOUND_CHANCE) {
        audio?.playSound('tankPower', this.x, this.y);
      }
      // A tone, no line: "CHARGING!" and "FIRE!" 4 s apart both clear the
      // 2.5 s cooldown all voices share; the tones carry the attack
      if (since === POWER_UP_BEATS) {
        audio?.playSound('tankPowerUp', this.x, this.y);
      }
      return false;
    }
    if (
      distance < T.CHARGE_RANGE_PX &&
      kickBeat - this._lastTankFireBeat >= T.RECHARGE_BEATS
    ) {
      this.chargingShot = true;
      this.chargeStartBeat = kickBeat;
      audio?.speak(this, TANK_CHARGING, 'tank');
      audio?.playSound('tankCharging', this.x, this.y);
    }
    return false;
  }

  /** His facing at a beat position: along the latest turn's ease, then held */
  facingAt(beats, beatSec) {
    const { from, to, at } = this.turn;
    if (at === null || beatSec <= 0) return to;
    return (
      from +
      (to - from) *
        smooth(clamp01(((beats - at) * beatSec) / CONFIG.TANK.TURN_SEC))
    );
  }

  /** Who he is after: the hero, or while angry the nearest live alien of that kind */
  target(playerX, playerY) {
    if (this.isAngry && this.angerTarget) {
      let best = null;
      let bestD = Infinity;
      for (const e of this.getContextValue('enemies') ?? []) {
        if (e === this || e.markedForRemoval || e.type !== this.angerTarget) {
          continue;
        }
        const d = (e.x - this.x) ** 2 + (e.y - this.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (best) return best;
    }
    return { x: playerX, y: playerY };
  }

  /** His anger runs down; once it has, he says so on the next beat 1 */
  updateAnger(dt) {
    if (this.isAngry) {
      this.angerCooldown -= dt;
      if (this.angerCooldown <= 0) {
        this.isAngry = false;
        this.angerTarget = null;
        this.damageTracker.clear(); // a fresh count for the next grudge
        this.calmLinePending = true; // said on the next beat 1
      }
    }
    if (!this.calmLinePending) return;
    const audio = this.getContextValue('audio');
    const beatClock = this.getContextValue('beatClock');
    if (
      !beatClock ||
      this.onBeatOnce(beatClock, 'calmLine', beatClock.isOnBeat([1]))
    ) {
      this.calmLinePending = false;
      if (audio) audio.speak(this, random(TANK_CALM_LINES), 'tank');
    }
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
    // From the cannon's muzzle, along his gun (TankRenderer.js)
    const { x, y } = tankMuzzle(
      this.x,
      this.y,
      this.size * CONFIG.TANK_LOOK.ART_SCALE,
      this.facing,
      this.gunRel
    );
    const bullet = Bullet.acquire(
      x,
      y,
      this.facing + this.gunRel,
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

  /** Plates by his facing; his bare back, or a broken plate, lets it through */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    const audio = this.getContextValue('audio');
    this.hitAt = this.poseBeats;
    if (bulletAngle === null) {
      if (audio) audio.playSound('tankHit', this.x, this.y);
      return super.takeDamage(amount, bulletAngle, damageSource);
    }

    // Where the shot came from, against his facing: the game's impact angle
    const side = tankSide(bulletAngle - this.facing + PI);
    const armor = this.plates[side]; // undefined for his back
    if (armor && !armor.destroyed) {
      armor.hp -= amount;
      this.plateHitAt[side] = this.poseBeats;
      if (audio) audio.playSound('hit', this.x, this.y);
      this.hitFlash = 8;
      if (armor.hp > 0) return DAMAGE_RESULT.DAMAGED; // the plate took it all

      const overflow = -armor.hp;
      armor.hp = 0;
      armor.destroyed = true;
      this.plateBrokeAt[side] = this.poseBeats;
      if (audio) audio.playSound('explosion', this.x, this.y);
      this.breakArmor(side);
      this.trackAnger(damageSource);
      if (overflow <= 0) return DAMAGE_RESULT.DAMAGED;
      if (audio) audio.playSound('tankHit', this.x, this.y);
      return super.takeDamage(overflow, bulletAngle, damageSource);
    }

    this.backHitAt = this.poseBeats; // his bare back, or skin under a broken plate
    if (audio) audio.playSound('tankHit', this.x, this.y);
    this.trackAnger(damageSource);
    return super.takeDamage(amount, bulletAngle, damageSource);
  }

  /** Debris, a label and a shake where an armour plate broke off */
  breakArmor(name) {
    const ox = cos(this.facing + PLATE_SIDE[name]) * this.size * 0.6;
    const oy = sin(this.facing + PLATE_SIDE[name]) * this.size * 0.6;

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
  trackAnger(source) {
    if (!source || source === 'player') return;
    // A stab is named for the attack; the grudge is against the stabber
    const damageSource = ANGER_SOURCE_TYPE[source] ?? source;
    const count = (this.damageTracker.get(damageSource) || 0) + 1;
    this.damageTracker.set(damageSource, count);
    if (count >= this.angerThreshold && !this.isAngry) {
      this.isAngry = true;
      this.calmLinePending = false;
      this.angerTarget = damageSource;
      this.angerCooldown = this.maxAngerCooldown;
      const audio = this.getContextValue('audio');
      if (audio) audio.speak(this, random(TANK_ANGER_LINES), 'tank');
    }
  }
}

export { Tank };
