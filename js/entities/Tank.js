import { BaseEnemy } from './BaseEnemy.js';
import { Bullet } from './bullet.js';
import { random, cos, sin, PI, smooth, clamp01, env } from '../mathUtils.js';
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
  tankCannon,
  turnStep,
  turnAt,
  nextGunRel,
  tankSide,
  drawTank,
  TANK_REACH,
  TANK_SIZE,
} from './TankRenderer.js';
import { HEALTH_BAR_HEIGHT_PX, HEALTH_BAR_GAP_PX } from './BaseEnemyHelpers.js';

const TANK_POWER_SOUND_CHANCE = 0.5; // per beat 1 while charging
const BEATS_PER_BAR = 4;
const POWER_UP_BEATS = 4; // the charge's second bar opens with a power-up tone
const FRAMES_PER_SEC = 60; // BaseEnemy's velocity is px per 60 Hz frame
const DEG = PI / 180;

// The beat a hero was last shoved on, by any tank. A shove lands only on a
// beat's first update, so this keeps it to one a frame from all tanks
const shovedOnBeat = new WeakMap();

const PLATE_NAMES = ['front', 'left', 'right'];
// How fast his drawn envelopes fade (s)
const KICK_TAU_SEC = 0.1;
const HIT_TAU_SEC = 0.08;
const FIRE_TAU_SEC = 0.25;
const SHOVE_TAU_SEC = 0.2;

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
      size: TANK_SIZE,
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
    this.seenBeats = null; // his last update's, to tell a stall

    // His charge, on his bar clock (beat positions)
    this.chargingShot = false;
    this.chargeStartBeat = -1;
    this.chargeDurationBeats = CONFIG.TANK.CHARGE_BEATS;
    this._lastTankFireBeat = -Infinity;
    this.firedAt = null;
    this.callsOut = false; // this charge says CHARGING! and FIRE!
    this.lastBeat = null; // the last beat he saw, for the shove
    this.lastShoveBeat = -Infinity;
    this.shovedAt = null;

    // Tank anger system - tracks who damages it
    this.damageTracker = new Map(); // Track damage sources: enemyType -> count
    this.angerThreshold = 3; // Get angry after 3 hits from same enemy type
    this.isAngry = false;
    this.angerTarget = null; // Which enemy type to target when angry
    this.angerCooldown = 0; // Cooldown before returning to normal behavior
    this.maxAngerCooldown = 600; // 10 seconds of anger
    this.calmLinePending = false;

    // Destructible armour plates, by side (tankSide in TankRenderer.js)
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

    this.hitFlashAlpha = 255; // he stays solid when hit: his own parts flash
    this.lookSeed = this.animFrame / p.TWO_PI; // his swagger's phase
  }

  /** @override He keeps the beat position he is drawn at, and his gun is his aim */
  update(playerX, playerY, deltaTimeMs) {
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition() ?? null;
    const bullet = super.update(playerX, playerY, deltaTimeMs);
    // BaseEnemy.update pointed aimAngle at the hero; his aim is his gun's
    this.aimAngle = this.facing + this.gunRel;
    // Stepping round a hero in a corner could carry him out of the world
    this.keepInWorld();
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
    // Read the clock again (update() read it before BaseEnemy moved him):
    // this reading is the one he keeps, and tests that call this directly
    // get theirs here
    const beats = beatClock?.getBeatPosition() ?? null;
    this.poseBeats = beats;
    const beatSec = (beatClock?.beatInterval ?? 0) / 1000;

    // Whole bars since his last update the game sat out (a hidden tab,
    // ?tune's "Sound while paused") don't count toward his charge, as whole
    // beats don't toward a bomb's fuse. A hitstop never lasts a bar
    if (beats !== null && this.seenBeats !== null && this.chargingShot) {
      const missed = Math.floor((beats - this.seenBeats) / BEATS_PER_BAR);
      if (missed >= 1) this.chargeStartBeat += missed * BEATS_PER_BAR;
    }
    this.seenBeats = beats;

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
    // when he acted on beat 1; closer than LURCH_MIN_DIST_PX he comes no
    // closer. A tank in his line of fire makes him step sideways, near or not
    const near = distance <= T.LURCH_MIN_DIST_PX;
    this.lurchNow =
      near || beats === null || this.kickAt === null
        ? 0
        : Math.exp(-((beats - this.kickAt) * beatSec) / T.LURCH_TAU_SEC);
    const drift = near ? 0 : T.DRIFT_PX_S;
    const lurch = T.LURCH_PX_S * this.lurchNow;
    const side = T.SIDESTEP_PX_S * this.laneStep(target, toTarget, distance);
    this.velocity.x =
      (Math.cos(toTarget) * drift +
        Math.cos(this.facing) * lurch -
        Math.sin(toTarget) * side) /
      FRAMES_PER_SEC;
    this.velocity.y =
      (Math.sin(toTarget) * drift +
        Math.sin(this.facing) * lurch +
        Math.cos(toTarget) * side) /
      FRAMES_PER_SEC;

    // Any new beat: a hero in front of him gets shoved
    if (beats !== null) {
      const beat = Math.floor(beats);
      if (this.lastBeat !== null && beat !== this.lastBeat) {
        this.tryShove(beat, beats);
      }
      this.lastBeat = beat;
    }

    if (!fire) return null;
    this.chargingShot = false;
    this.firedAt = beats;
    if (this.callsOut)
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
      // gap between enemies' lines (VOICE_GAP_SEC); the tones carry the attack
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
      this.callsOut = random() < CONFIG.SPEECH_SETTINGS.TANK.CALLOUT_CHANCE;
      if (this.callsOut) audio?.speak(this, TANK_CHARGING, 'tank');
      audio?.playSound('tankCharging', this.x, this.y);
    }
    return false;
  }

  /**
   * The bouncer's shove, on the beat: a hero within reach and on his front
   * side is hit and knocked back, at most once per SHOVE_COOLDOWN_BEATS from
   * him and once a frame from all tanks. A real hit, so the shield takes it
   * whole; the knockback happens either way, as the rusher's blast does.
   */
  tryShove(beatIndex, beats) {
    if (beatIndex - this.lastShoveBeat < CONFIG.TANK.SHOVE_COOLDOWN_BEATS) {
      return;
    }
    const hero = this.getContextValue('player');
    if (!hero || !this.checkCollision(hero)) return;
    const toHero = Math.atan2(hero.y - this.y, hero.x - this.x);
    if (tankSide(toHero - this.facing) !== 'front') return;
    if (shovedOnBeat.get(hero) === beatIndex) return;
    shovedOnBeat.set(hero, beatIndex);
    this.lastShoveBeat = beatIndex;
    this.shovedAt = beats;
    this.getContextValue('audio')?.playSound('tankShove', hero.x, hero.y);
    if (hero.hurt(CONFIG.PLAYER.DAMAGE_TANK_SHOVE, 'tank-shove')) return;
    hero.knockBack(this.x, this.y, CONFIG.PLAYER.KNOCKBACK_TANK_SHOVE);
  }

  /**
   * Which way he steps to keep his line of fire clear: away from the
   * nearest other tank between him and his target and within FIRE_LANE_PX
   * of the line (-1 his left, 1 his right, 0 for a clear lane). One dead
   * ahead sends him right. Other aliens he shoots through.
   */
  laneStep(target, toTarget, distance) {
    const ux = Math.cos(toTarget);
    const uy = Math.sin(toTarget);
    let nearest = Infinity;
    let step = 0;
    for (const e of this.getContextValue('enemies') ?? []) {
      if (e === this || e === target || e.type !== 'tank') continue;
      if (e.markedForRemoval) continue;
      const along = (e.x - this.x) * ux + (e.y - this.y) * uy;
      const across = (e.y - this.y) * ux - (e.x - this.x) * uy; // + is his right
      if (along <= 0 || along >= Math.min(distance, nearest)) continue;
      if (Math.abs(across) >= CONFIG.TANK.FIRE_LANE_PX) continue;
      nearest = along;
      step = across > 0 ? -1 : 1;
    }
    return step;
  }

  /** His facing at a beat position: along the latest turn's ease, then held */
  facingAt(beats, beatSec) {
    return turnAt(this.turn, beats, beatSec, CONFIG.TANK.TURN_SEC);
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
      chance: CONFIG.SPEECH_SETTINGS.TANK.CHANCE,
    };
  }

  /** @override He turns with his facing; drawn from his pose (TankRenderer.js) */
  drawFigure(p, s) {
    this.applyHitShake(p);
    drawTank(p, s * CONFIG.TANK_LOOK.ART_SCALE, this.pose());
  }

  /** His health bar clears his body, shoulders and cannon (TANK_REACH) */
  get healthBarRise() {
    return (
      this.size * CONFIG.TANK_LOOK.ART_SCALE * TANK_REACH +
      HEALTH_BAR_HEIGHT_PX +
      HEALTH_BAR_GAP_PX
    );
  }

  /** His pose, at the beat update() last kept (frozen while paused) and what happened when */
  pose() {
    const beats = this.poseBeats;
    const clock = this.getContextValue('beatClock');
    const beatSec = (clock?.beatInterval ?? 0) / 1000;
    const since = (at) =>
      beats === null || at === null ? Infinity : (beats - at) * beatSec;
    const plates = {};
    const plateHit = {};
    const plateBroke = {};
    for (const name of PLATE_NAMES) {
      const pl = this.plates[name];
      plates[name] = pl.destroyed || pl.max <= 0 ? 0 : pl.hp / pl.max;
      plateHit[name] = env(since(this.plateHitAt[name]), HIT_TAU_SEC);
      plateBroke[name] = since(this.plateBrokeAt[name]);
    }
    const charging = this.chargingShot && beats !== null;
    const intoCharge = charging ? beats - this.chargeStartBeat : 0;
    const turnAge = since(this.turn.at);
    return {
      t: beats === null ? 0 : beats * beatSec,
      beatSec,
      beat: beats === null ? 0 : Math.floor(beats) % BEATS_PER_BAR,
      beatPhase: beats === null ? 0 : beats - Math.floor(beats),
      kick:
        beats === null
          ? 0
          : Math.exp(-((beats % BEATS_PER_BAR) * beatSec) / KICK_TAU_SEC),
      facing: this.facing,
      turn: {
        from: this.turn.from,
        to: this.turn.to,
        k: smooth(clamp01(turnAge / CONFIG.TANK.TURN_SEC)),
        age: turnAge,
      },
      turnSec: CONFIG.TANK.TURN_SEC,
      gunRel: this.gunRel,
      lurch: this.lurchNow,
      shove: env(since(this.shovedAt), SHOVE_TAU_SEC),
      charge: charging ? clamp01(intoCharge / this.chargeDurationBeats) : -1,
      chargeBeats: Math.max(0, Math.floor(intoCharge)),
      fire: env(since(this.firedAt), FIRE_TAU_SEC),
      fireAge: since(this.firedAt),
      plates,
      plateHit,
      plateBroke,
      hit: env(since(this.hitAt), HIT_TAU_SEC),
      backHit: env(since(this.backHitAt), HIT_TAU_SEC),
      angry: this.isAngry ? 1 : 0,
      seed: this.lookSeed,
    };
  }

  /**
   * Create tank's devastating energy ball
   */
  createBullet() {
    // From the cannon's muzzle, along his gun (TankRenderer.js)
    const s = this.size * CONFIG.TANK_LOOK.ART_SCALE;
    const { x, y } = tankMuzzle(this.x, this.y, s, this.facing, this.gunRel);
    const bullet = Bullet.acquire(
      x,
      y,
      this.facing + this.gunRel,
      2,
      'enemy-tank'
    );
    if (!bullet) return null;
    // Its first sweep (Bullet.checkCollision) starts at the cannon's pivot in
    // his fists, so a hero pressed against the barrel is hit too
    const { pivotX } = tankCannon(s, this.gunRel);
    bullet.prevX = this.x + pivotX * cos(this.facing);
    bullet.prevY = this.y + pivotX * sin(this.facing);
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
