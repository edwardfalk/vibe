import { BaseEnemy } from './BaseEnemy.js';
import { random, env, clamp01, PI } from '../mathUtils.js';
import { nextFacing } from './GruntRenderer.js';
import {
  RUSHER_COLORS,
  BOOST_ENV_SEC,
  drawRusher,
  drawCountRing,
  rusherTilt,
} from './RusherRenderer.js';
import { CONFIG } from '../config.js';
import { DAMAGE_RESULT } from '../shared/DamageResult.js';
import { RUSHER_LINES, RUSHER_BATTLE_CRIES } from '../audio/DialogueLines.js';
import { turnStep, turnAt } from './TankRenderer.js';

// Per attempt once the speech timer is up (= today's effective rate)
const RUSHER_SPEECH_CHANCE = 0.03;
const FRAMES_PER_SEC = 60; // BaseEnemy's velocity is px per 60 Hz frame
const DEG = PI / 180;
const STRONG_EVERY = 2; // beats 1 and 3: every second beat from a bar's start
const LATE_BEATS = 0.5; // a blast this late moves on to the next 1 or 3
const EPS = 1e-6; // slack on beat positions, for floating-point error

// How fast his drawn envelopes fade (s)
const CRY_TAU_SEC = 0.6;
const WHOA_TAU_SEC = 0.5;
const HIT_TAU_SEC = 0.08;
const PUSH_TAU_SEC = 0.3;
const TICK_TAU_SEC = 0.1; // the flash on each beat of his fuse

/** The first beat 1 or 3 (an even beat position) at least `beats` after `from` */
export function strongBeatAfter(from, beats) {
  return Math.ceil((from + beats - EPS) / STRONG_EVERY) * STRONG_EVERY;
}

// Whole beats from `beats` to `blastBeat`, rounded up
const beatsTo = (blastBeat, beats) => Math.ceil(blastBeat - beats - EPS);

/**
 * Rusher: the family's reckless little cousin, a stuntman on a rocket. He
 * steers only on the beat and flies straight between, so a hero who dashes
 * aside sees him shoot past. Shot, or close, he lights: he brakes and blows
 * on the first beat 1 or 3 at least FUSE_MIN_BEATS on (CONFIG.RUSHER).
 */
class Rusher extends BaseEnemy {
  constructor(x, y, type, config, p, audio) {
    const rusherConfig = {
      ...config,
      size: 22,
      health: 1,
      speed: CONFIG.RUSHER.CRUISE_PX_S / FRAMES_PER_SEC,
      color: p.color(...RUSHER_COLORS.bike),
    };
    super(x, y, 'rusher', rusherConfig, p, audio);

    // He flies along his heading and turns only on the beat. He spawns
    // facing the hero
    const hero = this.getContextValue('player');
    this.heading = hero ? Math.atan2(hero.y - y, hero.x - x) : 0;
    this.turn = { from: this.heading, to: this.heading, at: null };
    this.aimAngle = this.heading;
    this.side = Math.cos(this.heading) >= 0 ? 1 : -1; // drawn facing right (1) or left
    this.speedNow = CONFIG.RUSHER.CRUISE_PX_S; // px/s
    this.toHero = this.heading;
    this.ahead = true; // the hero in front of him, to tell shooting past
    this.seenBeats = null; // his last update's beat position, to tell a new beat and a stall
    this.cried = false;
    this.chargeSoundDue = false;
    this.lit = null; // { at, by, blastBeat, beatsTotal } once lit
    this.pushed = false;
    this.pushDir = 0;
    // When things happened to him, in beat positions (poseBeats), for drawing
    this.boostAt = null;
    this.cryAt = null;
    this.whoaAt = null;
    this.hitAt = null;
    this.pushAt = null;
    this.hitFlashAlpha = 255; // he stays solid when hit: his own POW shows it
    this.lookSeed = this.animFrame / p.TWO_PI; // his flicker's phase
    // The beat he is drawn at, kept by update(). Kept from here on, so a hit
    // before his first update stamps a real beat
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition() ?? null;
  }

  /** @override He keeps the beat he is drawn at, aims along his flight and stays in the world */
  update(playerX, playerY, deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS) {
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition() ?? null;
    const result = super.update(playerX, playerY, deltaTimeMs);
    // Lit, he brakes on every update, his spawn's included: BaseEnemy moves
    // him then too [review-added 2026-10-02: Codex]
    if (this.lit) this.brake(deltaTimeMs);
    this.aimAngle = this.heading;
    this.side = nextFacing(this.side, this.heading, CONFIG.RUSHER.FLIP_COS);
    this.keepInWorld();
    return result;
  }

  /** Lit: his velocity keeps BRAKE (PUSH_BRAKE once pushed) of itself per 60 Hz frame */
  brake(deltaTimeMs) {
    const R = CONFIG.RUSHER;
    const keep =
      (this.pushed ? R.PUSH_BRAKE : R.BRAKE) **
      (deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS);
    this.velocity.x *= keep;
    this.velocity.y *= keep;
  }

  /**
   * Each update, in order: he is put back inside the world; whole beats the
   * game sat out move his blast on; the charge sound waits for a new beat;
   * lit, he blows on his beat; unlit, he cries when close, boosts and turns
   * on each new beat, notes shooting past and lights closer still. Returns
   * his blast, or null.
   */
  updateSpecificBehavior(
    playerX,
    playerY,
    deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS
  ) {
    const R = CONFIG.RUSHER;
    const clock = this.getContextValue('beatClock');
    // Read the clock again (update() read it before BaseEnemy moved him):
    // this reading is the one he keeps, and tests that call this directly
    // get theirs here
    const beats = clock?.getBeatPosition() ?? null;
    this.poseBeats = beats;
    const beatSec = (clock?.beatInterval ?? 0) / 1000;
    // In the world before anything reads where he is: a blast at the wall
    // goes off where he is [review-added 2026-10-02: Codex]
    this.keepInWorld();
    this.toHero = Math.atan2(playerY - this.y, playerX - this.x);
    const distance = Math.hypot(playerX - this.x, playerY - this.y);

    const prev = this.seenBeats;
    this.holdFuseThroughStall(beats);
    // A new beat: his first update in a beat he hasn't seen, however late in
    // it; a clock that jumps several beats gives one
    const newBeat =
      beats !== null && prev !== null && Math.floor(beats) !== Math.floor(prev);
    if (newBeat && this.chargeSoundDue) {
      this.chargeSoundDue = false;
      this.getContextValue('audio')?.playSound('rusherCharge', this.x, this.y);
    }

    if (this.lit) return this.blowOnBeat(beats);

    if (!this.cried && distance <= R.CRY_DIST_PX) {
      this.cried = true;
      this.cryAt = beats;
      this.chargeSoundDue = true;
      this.getContextValue('audio')?.speak(
        this,
        random(RUSHER_BATTLE_CRIES),
        'rusher'
      );
    }
    // Where his last turn has got to, so a new beat's turn starts from there,
    // however long since his last update [review-added 2026-10-02: Codex]
    if (beats !== null) {
      this.heading = turnAt(this.turn, beats, beatSec, R.TURN_SEC);
    }
    if (newBeat) {
      const step = turnStep(
        this.heading,
        this.toHero,
        R.TURN_STEP_DEG * DEG,
        0
      );
      this.turn = { from: this.heading, to: this.heading + step, at: beats };
      this.boostAt = beats;
    }
    if (beats !== null) {
      this.heading = turnAt(this.turn, beats, beatSec, R.TURN_SEC);
    }
    const sinceBoost =
      this.boostAt === null ? Infinity : (beats - this.boostAt) * beatSec;
    this.speedNow =
      (R.CRUISE_PX_S +
        (R.BOOST_PX_S - R.CRUISE_PX_S) * env(sinceBoost, R.BOOST_TAU_SEC)) *
      (this.cried ? R.CHARGE_BOOST : 1);
    this.velocity.x = (Math.cos(this.heading) * this.speedNow) / FRAMES_PER_SEC;
    this.velocity.y = (Math.sin(this.heading) * this.speedNow) / FRAMES_PER_SEC;

    // Shooting past: the hero went from ahead of him to behind him, close by
    const ahead = Math.cos(this.toHero - this.heading) > 0;
    if (this.ahead && !ahead && distance < R.PASS_DIST_PX) this.whoaAt = beats;
    this.ahead = ahead;

    if (distance <= R.LIGHT_DIST_PX) this.light('hero');
    return null;
  }

  /**
   * Whole beats since his last update that the game sat out (a hidden tab,
   * ?tune's "Sound while paused") move his blast on by as many, then on to
   * the next beat 1 or 3, as the bomb's fuse holds. A fuse that grows past
   * the beats he lit with grows his count too
   */
  holdFuseThroughStall(beats) {
    const lit = this.lit;
    if (lit?.blastBeat != null && beats !== null && this.seenBeats !== null) {
      const missed = Math.floor(beats - this.seenBeats);
      if (missed >= 1) {
        lit.blastBeat = strongBeatAfter(lit.blastBeat + missed, 0);
        lit.beatsTotal = Math.max(
          lit.beatsTotal,
          beatsTo(lit.blastBeat, beats)
        );
      }
    }
    this.seenBeats = beats;
  }

  /**
   * Lit, he blows on his blast beat, never before it (update() brakes him).
   * Half a beat or more after it (a hitstop or a slow frame across the
   * beat), it moves on to the next beat 1 or 3, so every crash's nearest
   * beat is 1 or 3. With no clock he never blows
   */
  blowOnBeat(beats) {
    const R = CONFIG.RUSHER;
    const lit = this.lit;
    if (beats === null || lit.blastBeat === null) return null;
    if (beats < lit.blastBeat - EPS) return null;
    if (beats - lit.blastBeat >= LATE_BEATS) {
      lit.blastBeat = strongBeatAfter(beats, 0);
      lit.beatsTotal = Math.max(lit.beatsTotal, beatsTo(lit.blastBeat, beats));
      return null;
    }
    return {
      type: 'rusher-explosion',
      x: this.x,
      y: this.y,
      radius: R.EXPLOSION_RADIUS,
      damage: R.EXPLOSION_DAMAGE,
      chain: lit.by === 'blast',
    };
  }

  /**
   * Lights his fuse, once: his blast is the first beat 1 or 3 at least
   * FUSE_MIN_BEATS on. Lit by a blast, he counts from the start of the beat
   * it went off on, so a chain goes crash, two beats, crash
   */
  light(by) {
    if (this.lit) return;
    const beats = this.poseBeats;
    let blastBeat = null;
    let beatsTotal = 0;
    if (beats !== null) {
      const from = by === 'blast' ? Math.floor(beats + EPS) : beats;
      blastBeat = strongBeatAfter(from, CONFIG.RUSHER.FUSE_MIN_BEATS);
      beatsTotal = beatsTo(blastBeat, beats);
    }
    this.lit = { at: beats, by, blastBeat, beatsTotal };
  }

  /**
   * A hit along `angle` knocks him that way at PUSH_PX_S, keeping PUSH_KEEP
   * of his own speed; from then on he brakes with PUSH_BRAKE
   */
  push(angle) {
    const R = CONFIG.RUSHER;
    const v = R.PUSH_PX_S / FRAMES_PER_SEC;
    this.velocity.x = Math.cos(angle) * v + this.velocity.x * R.PUSH_KEEP;
    this.velocity.y = Math.sin(angle) * v + this.velocity.y * R.PUSH_KEEP;
    this.pushed = true;
    this.pushAt = this.poseBeats;
    this.pushDir = angle;
  }

  /**
   * Any hit lights him; one with a direction (a bullet, a stab) also pushes
   * him, lit or not. Lit, he ignores damage: he never dies of it, he blows
   */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    this.hitFlash = 8;
    if (bulletAngle !== null && CONFIG.RUSHER.PUSH) this.push(bulletAngle);
    if (this.lit) return DAMAGE_RESULT.EXPLODING;
    this.hitAt = this.poseBeats;
    this.getContextValue('audio')?.playSound('rusherHit', this.x, this.y);
    this.light(damageSource === 'rusher-blast' ? 'blast' : 'hit');
    return DAMAGE_RESULT.EXPLODING;
  }

  /** @override His chatter falls on his crash beats, 1 and 3 */
  getAmbientSpeechConfig() {
    return {
      lines: RUSHER_LINES,
      gate: (beatClock) => !!beatClock?.isOnBeat([1, 3]),
      chance: RUSHER_SPEECH_CHANCE,
    };
  }

  /** @override Drawn from his pose (RusherRenderer.js), mirrored to his side and pitched along his flight */
  drawFigure(p, s) {
    this.applyHitShake(p);
    drawRusher(p, s * CONFIG.RUSHER_LOOK.ART_SCALE, this.pose());
  }

  /** Lit: the ring at his blast's reach counts the beats left */
  drawSpecificIndicators(p) {
    if (!this.lit) return;
    drawCountRing(
      p,
      this.x,
      this.y,
      this.pose().fuse,
      CONFIG.RUSHER.EXPLOSION_RADIUS
    );
  }

  /** His pose, at the beat update() last kept (frozen while paused), and what happened when */
  pose() {
    const R = CONFIG.RUSHER;
    const beats = this.poseBeats;
    const beatSec =
      (this.getContextValue('beatClock')?.beatInterval ?? 0) / 1000;
    const since = (at) =>
      beats === null || at === null ? Infinity : (beats - at) * beatSec;
    const lit = this.lit;
    const speed = lit
      ? Math.hypot(this.velocity.x, this.velocity.y) * FRAMES_PER_SEC
      : this.speedNow;
    let fuse = null;
    if (lit) {
      const timed = beats !== null && lit.blastBeat !== null;
      const left = timed ? lit.blastBeat - beats : lit.beatsTotal;
      fuse = {
        age: since(lit.at),
        beatsTotal: lit.beatsTotal,
        beatsLeft: Math.max(1, Math.ceil(left - EPS)),
        hot: timed && left <= 0.5,
        tick:
          beats === null
            ? 0
            : env((beats - Math.floor(beats)) * beatSec, TICK_TAU_SEC),
        by: lit.by,
      };
    }
    return {
      t: beats === null ? 0 : beats * beatSec,
      side: this.side,
      tilt: rusherTilt(this.heading, this.side),
      boost: lit ? 0 : env(since(this.boostAt), BOOST_ENV_SEC),
      speed,
      // Finite whatever the sliders say (both speeds at 0, or boost under cruise) [review-added 2026-10-02: Codex]
      speed01: clamp01(
        speed / Math.max(R.BOOST_PX_S * R.CHARGE_BOOST, speed, EPS)
      ),
      cry: env(since(this.cryAt), CRY_TAU_SEC),
      charging: this.cried && !lit,
      whoa: env(since(this.whoaAt), WHOA_TAU_SEC),
      toHero: this.toHero,
      hit: env(since(this.hitAt), HIT_TAU_SEC),
      push: env(since(this.pushAt), PUSH_TAU_SEC),
      pushDir: this.pushDir,
      fuse,
      seed: this.lookSeed,
    };
  }
}

export { Rusher };
