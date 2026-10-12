import { BaseEnemy } from './BaseEnemy.js';
import { Bullet } from './bullet.js';
import {
  random,
  cos,
  sin,
  PI,
  smooth,
  clamp01,
  env,
  normalizeAngle,
} from '../mathUtils.js';
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
  tankMuzzle,
  tankCannon,
  turnStep,
  turnAt,
  nextGunRel,
  tankSide,
  drawTank,
  TANK_REACH,
  TANK_SIZE,
  HEAD,
} from './TankRenderer.js';
import { tankFlinch, UH } from './TankFlinch.js';
import { vein, easeOutBack } from './PlayerRenderer.js';
import { heardKickOf } from '../audio/BeatTrack.js';
import { HEALTH_BAR_HEIGHT_PX, HEALTH_BAR_GAP_PX } from './BaseEnemyHelpers.js';

const BEATS_PER_BAR = 4;
const FRAMES_PER_SEC = 60; // BaseEnemy's velocity is px per 60 Hz frame
const DEG = PI / 180;

// The beat a hero was last struck on, by any tank. A blow lands only on a
// beat's first update, so this keeps it to one a frame from all tanks
const shovedOnBeat = new WeakMap();

// His blows, by the side of him the hero touches (tankSide): the shove in
// front, the elbow at either side; his back takes the bomb. CONFIG.PLAYER keys
const ELBOW = {
  sound: 'tankElbow',
  damage: 'DAMAGE_TANK_ELBOW',
  knock: 'KNOCKBACK_TANK_ELBOW',
  source: 'tank-elbow',
};
const BLOWS = {
  front: {
    sound: 'tankShove',
    damage: 'DAMAGE_TANK_SHOVE',
    knock: 'KNOCKBACK_TANK_SHOVE',
    source: 'tank-shove',
  },
  left: ELBOW,
  right: ELBOW,
};

const PLATE_NAMES = ['front', 'left', 'right'];
// How fast his drawn envelopes fade (s)
const KICK_TAU_SEC = 0.1;
const HIT_TAU_SEC = 0.08;
const FIRE_TAU_SEC = 0.25;
const SHOVE_TAU_SEC = 0.2;
// A glance at a hit: his head snaps to it, holds, and comes back (s)
const GLANCE_IN_SEC = 0.05;
const GLANCE_HOLD_SEC = 0.3;
const GLANCE_OUT_SEC = 0.2;
// His anger mark: its pop, its throb on the heard kick and its shrink (s),
// and where it sits, up and right of his head on screen (units of his size)
const MARK_POP_SEC = 0.15;
const MARK_THROB_TAU_SEC = 0.12;
const MARK_OUT_SEC = 0.25;
const MARK_AT = [0.3, -0.35];

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
    // The beat position update() last kept; kept from here on, so a hit
    // before his first update stamps a real beat
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition() ?? null;
    this.seenBeats = null; // his last update's, to tell a stall

    // His charge, on his bar clock (beat positions)
    this.chargingShot = false;
    this.chargeStartBeat = -1;
    this.chargeDurationBeats = CONFIG.TANK.CHARGE_BEATS;
    this._lastTankFireBeat = -Infinity;
    this.firedAt = null;
    this.callsOut = false; // this charge says CHARGING! and FIRE!
    this.lastBeat = null; // the last beat he saw, for his blows and plucks
    this.lastShoveBeat = -Infinity; // his last blow, a shove or an elbow
    this.shovedAt = null;
    // His last elbow: from when its thwack is heard, and his side (-1 left)
    this.elbowAt = null;
    this.elbowSide = 0;

    // Tank anger system - tracks who damages it
    this.damageTracker = new Map(); // Track damage sources: enemyType -> count
    this.angerThreshold = 3; // Get angry after 3 hits from same enemy type
    this.isAngry = false;
    this.angerTarget = null; // Which enemy type to target when angry
    this.angerCooldown = 0; // Cooldown before returning to normal behavior
    this.maxAngerCooldown = 600; // 10 seconds of anger
    this.calmLinePending = false;
    // His head turned to a hit (glanceNow); the third holds until his whip:
    // the first bar action after he's angered turns him all the way round
    this.glance = null;
    this.whipPending = false;
    this.whipAt = null; // when that bar action came (a beat position)
    this.angerAt = null; // when he tipped, for his anger mark

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
    // While a bomb on his back is about to blow, BombSystem sets when (the
    // bang's beat) and for how many beats before it he flinches
    this.flinch = null;
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

    // A whole bar or more since his last update (a hidden tab, ?tune's
    // "Sound while paused") ends his charge with no shot: he starts again on
    // the grid, from its first pluck, so the hero always gets the whole
    // warning. A hitstop never lasts a bar
    if (
      beats !== null &&
      this.seenBeats !== null &&
      this.chargingShot &&
      beats - this.seenBeats >= BEATS_PER_BAR
    ) {
      this.chargingShot = false;
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
        fire = this.onKick(
          bar * BEATS_PER_BAR,
          toTarget,
          distance,
          target.type !== undefined
        );
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

    // Any new beat: a hero touching his front gets shoved, at his side
    // elbowed, and his charge plucks its next note (on his first update
    // ever, too)
    if (beats !== null) {
      const beat = Math.floor(beats);
      if (beat !== this.lastBeat) {
        if (this.lastBeat !== null) this.tryShove(beat, beats);
        if (this.chargingShot) this.chargeNote(beat);
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
   * toward the target (all the way, if it's his whip and his target an
   * alien), then start a charge (on an even bar, within its first beat),
   * power it up or call the shot. Returns true when the charged shot is due.
   */
  onKick(kickBeat, toTarget, distance, atAlien = false) {
    const T = CONFIG.TANK;
    let most = T.TURN_STEP_DEG * DEG;
    if (this.whipPending) {
      this.whipPending = false;
      this.whipAt = this.kickAt;
      if (atAlien) most = PI;
    }
    const step = turnStep(
      this.facing,
      toTarget,
      most,
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
    // "CHARGING!" and "FIRE!" 4 s apart both clear the gap between enemies'
    // lines (VOICE_GAP_SEC); between them his charge's plucks carry it
    if (this.chargingShot) {
      const since = kickBeat - this.chargeStartBeat;
      if (since >= this.chargeDurationBeats) {
        this._lastTankFireBeat = kickBeat;
        return true;
      }
      return false;
    }
    // A charge starts on its own length's grid (every other bar), so two
    // tanks' plucks climb together or apart, never a bar apart; and only on
    // time, so it always starts on its first pluck
    if (
      distance < T.CHARGE_RANGE_PX &&
      kickBeat - this._lastTankFireBeat >= T.RECHARGE_BEATS &&
      kickBeat % this.chargeDurationBeats === 0 &&
      this.kickAt - kickBeat < 1
    ) {
      this.chargingShot = true;
      this.chargeStartBeat = kickBeat;
      this.callsOut = random() < CONFIG.SPEECH_SETTINGS.TANK.CALLOUT_CHANCE;
      if (this.callsOut) audio?.speak(this, TANK_CHARGING, 'tank');
    }
    return false;
  }

  /**
   * His charge's note on whole beat `beat`: step 0 on the beat it started,
   * one step up a beat, none on the beat his shot is due
   */
  chargeNote(beat) {
    const step = beat - this.chargeStartBeat;
    const steps = this.chargeDurationBeats;
    if (step >= steps) return;
    this.getContextValue('audio')?.playSound('tankCharge', this.x, this.y, {
      step,
      steps,
      seed: this.lookSeed,
    });
  }

  /**
   * The bouncer's blows, on the beat: a hero within reach is shoved if he is
   * at his front, elbowed if at his side, at most once per
   * SHOVE_COOLDOWN_BEATS from him, either blow, and once a frame from all
   * tanks. A real hit, so the shield takes it whole; the knockback happens
   * either way, as the rusher's blast does.
   */
  tryShove(beatIndex, beats) {
    if (beatIndex - this.lastShoveBeat < CONFIG.TANK.SHOVE_COOLDOWN_BEATS) {
      return;
    }
    const hero = this.getContextValue('player');
    if (!hero || !this.checkCollision(hero)) return;
    const toHero = Math.atan2(hero.y - this.y, hero.x - this.x);
    const side = tankSide(toHero - this.facing);
    const blow = BLOWS[side];
    if (!blow) return;
    if (shovedOnBeat.get(hero) === beatIndex) return;
    shovedOnBeat.set(hero, beatIndex);
    this.lastShoveBeat = beatIndex;
    if (side === 'front') this.shovedAt = beats;
    else {
      this.elbowAt = this.getContextValue('beatClock').heardFrom(beatIndex);
      this.elbowSide = side === 'left' ? -1 : 1;
    }
    this.getContextValue('audio')?.playSound(blow.sound, hero.x, hero.y);
    const P = CONFIG.PLAYER;
    if (hero.hurt(P[blow.damage], blow.source)) return;
    hero.knockBack(this.x, this.y, P[blow.knock]);
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
        // A whip left over would stamp whipAt, holding his head on the old hit
        this.whipPending = false;
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

  /**
   * @override He turns with his facing; drawn from his pose (TankRenderer.js),
   * flinching while a bomb on him is about to blow (TankFlinch.js)
   */
  drawFigure(p, s) {
    this.applyHitShake(p);
    const size = s * CONFIG.TANK_LOOK.ART_SCALE;
    const flinch = this.flinchNow(size);
    drawTank(p, size, this.pose(), flinch?.react);
    flinch?.sweat(p);
    this.drawAngerMark(p, size);
  }

  /**
   * The mark on his head when aliens anger him: the Dude's vein, upright on
   * screen, popping in, throbbing on the heard kick for ANGER_MARK_BEATS,
   * then shrinking away. Drawn here, not by drawTank, so his death (drawn
   * from his last pose) never shows it
   */
  drawAngerMark(p, size) {
    const beats = this.poseBeats;
    if (this.angerAt === null || beats === null) return;
    const L = CONFIG.TANK_LOOK;
    const beatSec =
      (this.getContextValue('beatClock')?.beatInterval ?? 0) / 1000;
    const sec = (beats - this.angerAt) * beatSec;
    const out = sec - L.ANGER_MARK_BEATS * beatSec;
    if (sec < 0 || out >= MARK_OUT_SEC) return;
    const kick = heardKickOf(
      this.getContextValue('beatTrack'),
      beats,
      beatSec,
      !!this.getContextValue('audio')?.soundPaused
    );
    const ctx = p.drawingContext;
    const k = L.ANGER_MARK_SIZE * easeOutBack(clamp01(sec / MARK_POP_SEC));
    ctx.save();
    ctx.translate(
      size * (HEAD[0] * cos(this.facing) + MARK_AT[0]),
      size * (HEAD[0] * sin(this.facing) + MARK_AT[1])
    );
    ctx.scale(k, k);
    vein(
      env(kick.kickAge, MARK_THROB_TAU_SEC),
      1,
      0,
      0,
      1 - smooth(clamp01(out / MARK_OUT_SEC)),
      ctx
    );
    ctx.restore();
  }

  /** His "uh oh" at the beat update() last kept, while BombSystem has set one */
  flinchNow(size) {
    if (!this.flinch || this.poseBeats === null) return null;
    const clock = this.getContextValue('beatClock');
    const beatSec = (clock?.beatInterval ?? 0) / 1000;
    return tankFlinch(
      (this.poseBeats - this.flinch.bang) * beatSec,
      this.flinch.beats * beatSec,
      beatSec,
      size,
      this.facing
    );
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
      elbow: env(since(this.elbowAt), SHOVE_TAU_SEC),
      elbowSide: this.elbowSide,
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
      glance: this.glanceNow(beats, beatSec),
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
    this.getContextValue('audio')?.playSound('tankShot', this.x, this.y, {
      seed: this.lookSeed,
    });
    bullet.ownerId = this.id; // Track which tank fired this
    return bullet;
  }

  /** Plates by his facing; his bare back, or a broken plate, lets it through */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    const audio = this.getContextValue('audio');
    this.hitAt = this.poseBeats;
    // His own hit climbs from his health before it (Audio.playTone); a
    // plate's never does: three steps up is the hero's tick
    const before = { health: this.health, maxHealth: this.maxHealth };
    if (bulletAngle === null) {
      audio?.playSound('tankHit', this.x, this.y, before);
      return super.takeDamage(amount, bulletAngle, damageSource);
    }

    // Where the shot came from, against his facing: the game's impact angle
    const side = tankSide(bulletAngle - this.facing + PI);
    const armor = this.plates[side]; // undefined for his back
    if (armor && !armor.destroyed) {
      armor.hp -= amount;
      this.plateHitAt[side] = this.poseBeats;
      this.hitFlash = 8;
      if (armor.hp > 0) {
        audio?.playSound('tankPlateHit', this.x, this.y);
        return DAMAGE_RESULT.DAMAGED; // the plate took it all
      }

      const overflow = -armor.hp;
      armor.hp = 0;
      armor.destroyed = true;
      this.plateBrokeAt[side] = this.poseBeats;
      audio?.playPlateClang?.(this.x, this.y);
      this.breakArmor(side);
      // One impact sound besides the clang: his, if damage is left over
      if (overflow > 0) audio?.playSound('tankHit', this.x, this.y, before);
      else audio?.playSound('tankPlateHit', this.x, this.y);
      if (overflow > 0) return this.wound(overflow, bulletAngle, damageSource);
      this.trackAnger(damageSource, bulletAngle + PI);
      return DAMAGE_RESULT.DAMAGED;
    }

    this.backHitAt = this.poseBeats; // his bare back, or skin under a broken plate
    audio?.playSound('tankHit', this.x, this.y, before);
    return this.wound(amount, bulletAngle, damageSource);
  }

  /** Damage through to him; one he lives through counts toward his anger */
  wound(amount, bulletAngle, damageSource) {
    const result = super.takeDamage(amount, bulletAngle, damageSource);
    if (result !== DAMAGE_RESULT.DIED) {
      this.trackAnger(damageSource, bulletAngle + PI); // where it came from
    }
    return result;
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

  /**
   * Hits from other enemies make the tank angry at their type. Calm, each
   * turns his head toward where it came from (`bearing`); the one that tips
   * him holds it there until his whip, and his line is forced past the gap
   * between enemy lines
   */
  trackAnger(source, bearing) {
    if (!source || source === 'player' || this.isAngry) return;
    // A stab is named for the attack; the grudge is against the stabber
    const damageSource = ANGER_SOURCE_TYPE[source] ?? source;
    const count = (this.damageTracker.get(damageSource) || 0) + 1;
    this.damageTracker.set(damageSource, count);
    const tipped = count >= this.angerThreshold;
    // On his body, the side it picks kept; dead behind is over his left
    // shoulder, as his "uh oh" looks
    const rel = normalizeAngle(bearing - this.facing);
    this.glance = {
      rel0: rel === PI ? -PI : rel,
      facing0: this.facing,
      at: this.poseBeats,
      hold: tipped,
    };
    if (!tipped) return;
    this.isAngry = true;
    this.calmLinePending = false;
    this.angerTarget = damageSource;
    this.angerCooldown = this.maxAngerCooldown;
    this.whipPending = true;
    this.whipAt = null;
    this.angerAt = this.poseBeats;
    this.getContextValue('audio')?.speak(
      this,
      random(TANK_ANGER_LINES),
      'tank',
      true
    );
  }

  /**
   * His glance now: where it turns his head, on his body and no further than
   * his "uh oh" looks, and how far in (k, 0 to 1), or null. It keeps its
   * bearing in the world as he turns (his facing never wraps), and the hold
   * lets go TURN_SEC after his whip, or as he calms without one
   */
  glanceNow(beats, beatSec) {
    const g = this.glance;
    if (!g || g.at === null || beats === null) return null;
    const age = (beats - g.at) * beatSec;
    let until = GLANCE_IN_SEC + GLANCE_HOLD_SEC;
    if (g.hold) {
      if (this.whipAt !== null) {
        until = (this.whipAt - g.at) * beatSec + CONFIG.TANK.TURN_SEC;
      } else until = this.isAngry ? Infinity : 0;
    }
    const k =
      smooth(clamp01(age / GLANCE_IN_SEC)) *
      (1 - smooth(clamp01((age - until) / GLANCE_OUT_SEC)));
    if (!(k > 0)) return null;
    const lim = Math.abs(UH.LOOK);
    const rel = g.rel0 - (this.facing - g.facing0);
    return { rel: Math.max(-lim, Math.min(lim, rel)), k };
  }
}

export { Tank };
