import { BaseEnemy } from './BaseEnemy.js';
import {
  random,
  env,
  clamp01,
  constrain,
  normalizeAngle,
} from '../mathUtils.js';
import { CONFIG } from '../config.js';
import { STABBER_LINES, STAB_WARNINGS } from '../audio/DialogueLines.js';
import {
  drawStabber,
  drawLane,
  STABBER_REACH_PX,
  RING_R_PX,
  RING_GOLD,
} from './StabberRenderer.js';
import { drawCountRing, COUNT_RING_EDGE_PX } from './RusherRenderer.js';
import { HEALTH_BAR_HEIGHT_PX, HEALTH_BAR_GAP_PX } from './BaseEnemyHelpers.js';

// Per attempt once the speech timer is up (= today's effective rate)
const STABBER_SPEECH_CHANCE = 0.025;
const FRAMES_PER_SEC = 60; // BaseEnemy's velocity is px per 60 Hz frame
const BEATS_PER_BAR = 4;
/** His phrase, in beats from its bar's start: wind up on beat 2 */
export const WINDUP_AT = 1;
/** His aim locks on beat 3 */
export const LOCK_AT = 2;
/** He lunges on the "and" of 3; the phrase ends on the next bar's beat 1 */
export const LUNGE_AT = 2.5;
/**
 * A step this many beats late or more drops the phrase: from a quarter beat
 * on it would sound nearer the next eighth than its own
 */
export const LATE_BEATS = 0.25;
const AIM_HOLD_BEATS = 0.5; // his aim stays locked this long after the lunge
const EPS = 1e-6; // slack on beat positions, for floating-point error
// From the prototype's simulate()
const MID_PULL_PX_S = 30; // at the band's edge, his pull toward its middle
const BUSY_STEER_SEC = 0.12; // his locomotion eases this fast when not stalking
const DAZED_AIM_SEC = 0.3; // his aim eases this slowly while dazed
// His count ring: one arc goes out each eighth from beat 2, amber from two left
const RING_ARCS = 3;
const RING_AMBER_AT = 2;
// How fast his drawn envelopes fade (s)
const HIT_TAU_SEC = 0.08;
const KICK_TAU_SEC = 0.12;
const TICK_TAU_SEC = 0.1; // the flash as an arc of his ring goes out

const barOf = (beats) => Math.floor(beats / BEATS_PER_BAR + EPS);
const easeOut = (k) => 1 - (1 - k) ** 3;

/**
 * Where a tip sweeping from (ax, ay) to (bx, by) first touches a circle of
 * radius r round (cx, cy): the share of the sweep (0..1) at which it
 * enters, 0 if it starts inside, or null if it never does. A sweep of zero
 * length checks its point
 */
export function sweepEntry(ax, ay, bx, by, cx, cy, r) {
  const fx = ax - cx;
  const fy = ay - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const dx = bx - ax;
  const dy = by - ay;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

/**
 * Stabber: the shiv, a mysterious alien built round one bone spike, the
 * family's evil psycho. He stalks the hero and attacks in one phrase on the
 * beat: wind up on 2, lock on 3, lunge on the "and" of 3, then recover to
 * the next beat 1 and rest a bar (CONFIG.STABBER). A hit before his lock
 * cancels the stab; from the lock he is committed.
 */
class Stabber extends BaseEnemy {
  constructor(x, y, type, config, p, audio) {
    const S = CONFIG.STABBER;
    const stabberConfig = {
      ...config,
      size: 28,
      health: S.HEALTH,
      speed: S.APPROACH_PX_S / FRAMES_PER_SEC,
      color: p.color(255, 215, 0),
    };
    super(x, y, 'stabber', stabberConfig, p, audio);

    this.hitFlashAlpha = 255; // he stays solid when hit: his own white flash shows it
    this.lookSeed = this.animFrame / p.TWO_PI; // his own, 0..1
    this.circle = this.lookSeed < 0.5 ? 1 : -1; // which way he circles the hero
    const hero = this.getContextValue('player');
    this.aim = hero ? Math.atan2(hero.y - y, hero.x - x) : 0; // his own: BaseEnemy overwrites aimAngle
    this.aimAngle = this.aim;
    this.toHero = this.aim;
    this.distance = Infinity; // to the hero, at his last update
    this.walk = { x: 0, y: 0 }; // his locomotion, px/s
    this.push = { x: 0, y: 0 }; // a hit's or a recoil's push, px/s
    this.state = 'stalk'; // 'stalk' | 'windup' | 'lunge' | 'recover' | 'stunned'
    this.bar = null; // his phrase's bar
    this.locked = false;
    this.lockAim = 0;
    this.lockLen = 0;
    this.lunge = null; // { x, y, dir, len, sec, reach, at } fixed at its start
    this.lastTip = null; // where his tip was tested last
    this.struck = null; // what his lunge hit: 'hero', 'alien' or null
    this.tremolo = null; // the wind-up's tremolo, cut by a hit before the lock
    // When things happened to him, in observed beat positions, for drawing
    this.stateAt = null;
    this.lockAt = null;
    this.hitAt = null;
    this.hitDir = 0;
    // The beat he is drawn at, kept by update(). Kept from here on, so a hit
    // before his first update stamps a real beat
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition() ?? null;
    this.seenBeats = this.poseBeats; // his last behaviour's beat: what a step crossed
    this.restBar = this.poseBeats === null ? 0 : barOf(this.poseBeats);
  }

  /** @override He keeps the beat he is drawn at, aims with his own aim and stays in the world */
  update(playerX, playerY, deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS) {
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition() ?? null;
    const result = super.update(playerX, playerY, deltaTimeMs);
    // While he spawns his behaviour doesn't run, but BaseEnemy still moves
    // him: a shot's push fades then too, or it would carry him on unchecked
    if (this.isSpawning) {
      this.handOn();
      this.fadePush(deltaTimeMs);
    }
    this.aimAngle = this.aim;
    this.keepInWorld();
    return result;
  }

  /**
   * Each update, in order: back inside the world; the phrase's steps whose
   * beats this update crossed, each once and only on time; the lunge and its
   * tip; his locomotion and aim; then his locomotion plus push, handed to
   * BaseEnemy for its next move. Returns a stab's result, or null
   */
  updateSpecificBehavior(
    playerX,
    playerY,
    deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS
  ) {
    const beats = this.poseBeats; // update() read it
    const beatSec =
      (this.getContextValue('beatClock')?.beatInterval ?? 0) / 1000;
    this.keepInWorld();
    this.distance = Math.hypot(playerX - this.x, playerY - this.y);
    this.toHero = Math.atan2(playerY - this.y, playerX - this.x);

    let result = null;
    if (beats !== null) {
      this.phraseSteps(beats, beatSec);
      if (this.state === 'lunge') {
        result = this.lungeOn(beats, beatSec, playerX, playerY);
      }
    }
    this.seenBeats = beats;
    const dtSec = deltaTimeMs / 1000;
    this.steer(dtSec);
    this.turnAim(dtSec, beats);
    this.handOn();
    this.fadePush(deltaTimeMs);
    return result;
  }

  /** The phrase's steps this update reached, in order, each once; a late one drops the phrase */
  phraseSteps(beats, beatSec) {
    const S = CONFIG.STABBER;
    const start = (bar) => bar * BEATS_PER_BAR;
    // Recovering or dazed until the next bar's beat 1
    if (
      (this.state === 'recover' || this.state === 'stunned') &&
      beats >= start(this.bar + 1) - EPS
    ) {
      this.enter('stalk', beats);
    }
    // The wind-up: the last beat 2 at or before now, crossed by this update
    if (this.state === 'stalk' && this.seenBeats !== null) {
      const bar = barOf(beats - WINDUP_AT);
      const at = start(bar) + WINDUP_AT;
      const crossed = this.seenBeats < at - EPS && beats >= at - EPS;
      const range = Math.max(S.STALK_MIN_PX, S.STALK_MAX_PX) * S.REACH_SLACK;
      if (
        crossed &&
        beats - at < LATE_BEATS &&
        bar >= this.restBar &&
        this.distance <= range
      ) {
        this.windUp(bar, beats, beatSec);
      }
    }
    if (this.state !== 'windup') return;
    const lockAt = start(this.bar) + LOCK_AT;
    if (!this.locked && beats >= lockAt - EPS) {
      if (beats - lockAt >= LATE_BEATS) return this.drop(beats);
      this.lock(beats);
    }
    const lungeAt = start(this.bar) + LUNGE_AT;
    if (this.locked && beats >= lungeAt - EPS) {
      if (beats - lungeAt >= LATE_BEATS) return this.drop(beats);
      this.startLunge(beats, beatSec);
    }
  }

  enter(state, beats) {
    this.state = state;
    this.stateAt = beats;
  }

  /** Beat 2: the phrase starts; his next is REST_BARS after this bar's; the tremolo runs to the lock */
  windUp(bar, beats, beatSec) {
    this.enter('windup', beats);
    this.bar = bar;
    this.locked = false;
    this.lockAt = null;
    this.restBar = bar + 1 + CONFIG.STABBER.REST_BARS;
    const untilSec = (bar * BEATS_PER_BAR + LOCK_AT - beats) * beatSec;
    this.tremolo =
      this.getContextValue('audio')?.playStabberStrings(
        'tremolo',
        this.x,
        this.y,
        { untilSec, seed: this.lookSeed }
      ) ?? null;
  }

  /** Beat 3: his aim and his lunge's length freeze; the stab, and a warning */
  lock(beats) {
    this.locked = true;
    this.lockAt = beats;
    this.aim = this.toHero;
    this.lockAim = this.toHero;
    this.lockLen = this.lungeLength();
    this.tremolo = null; // it ends at the lock by itself
    const audio = this.getContextValue('audio');
    audio?.playStabberStrings('stab', this.x, this.y, { seed: this.lookSeed });
    audio?.speak(this, random(STAB_WARNINGS), 'stabber');
  }

  /** A lunge from where he is: past the hero by OVERSHOOT_PX, within its limits */
  lungeLength() {
    const S = CONFIG.STABBER;
    const lo = Math.min(S.LUNGE_MIN_PX, S.LUNGE_MAX_PX);
    const hi = Math.max(S.LUNGE_MIN_PX, S.LUNGE_MAX_PX);
    return constrain(this.distance + S.OVERSHOOT_PX, lo, hi);
  }

  /** The "and" of 3: the lunge, its duration and his reach fixed now; the screech */
  startLunge(beats, beatSec) {
    // His size is kept as it is, not recovered from his reach: a size that
    // differs by a rounding would rebuild his sprites every frame
    const scale = CONFIG.STABBER_LOOK.ART_SCALE;
    const reach = STABBER_REACH_PX * scale;
    this.enter('lunge', beats);
    this.lunge = {
      x: this.x,
      y: this.y,
      dir: this.lockAim,
      len: this.lockLen,
      sec: CONFIG.STABBER.LUNGE_SEC,
      scale,
      reach,
      at: this.bar * BEATS_PER_BAR + LUNGE_AT, // its grid beat: timed from here
    };
    this.lastTip = {
      x: this.x + Math.cos(this.lockAim) * reach,
      y: this.y + Math.sin(this.lockAim) * reach,
    };
    this.walk = { x: 0, y: 0 };
    this.push = { x: 0, y: 0 };
    this.struck = null;
    this.getContextValue('audio')?.playStabberStrings(
      'screech',
      this.x,
      this.y,
      { beatSec, seed: this.lookSeed }
    );
  }

  /** A step too late: the phrase is dropped and he stalks; his rest bar stays */
  drop(beats) {
    this.locked = false;
    this.tremolo = null; // a drop comes after the lock's beat: it has ended
    this.enter('stalk', beats);
  }

  /**
   * The lunge, timed from its grid beat: his centre eases out along the
   * locked aim, and his tip sweeps from where it was tested last. The first
   * contact along the sweep (the hero, or an alien) ends it: his tip sits at
   * the contact and he recoils. Returns the stab's result, or null
   */
  lungeOn(beats, beatSec, heroX, heroY) {
    const S = CONFIG.STABBER;
    const L = this.lunge;
    const k = clamp01(((beats - L.at) * beatSec) / L.sec);
    const ux = Math.cos(L.dir);
    const uy = Math.sin(L.dir);
    this.x = L.x + ux * L.len * easeOut(k);
    this.y = L.y + uy * L.len * easeOut(k);
    this.keepInWorld();
    const from = this.lastTip;
    const tip = { x: this.x + ux * L.reach, y: this.y + uy * L.reach };
    this.lastTip = tip;
    const hit = this.firstContact(from, tip, heroX, heroY);
    if (hit) {
      const cx = from.x + (tip.x - from.x) * hit.t;
      const cy = from.y + (tip.y - from.y) * hit.t;
      this.x = cx - ux * L.reach;
      this.y = cy - uy * L.reach;
      this.lastTip = { x: cx, y: cy };
      const struck = hit.target === 'hero' ? 'hero' : 'alien';
      this.endLunge(beats, struck, -S.RECOIL_PX_S);
      this.getContextValue('audio')?.playStabberStrings('pluck', cx, cy, {
        seed: this.lookSeed,
      });
      const at = { x: this.x, y: this.y };
      return hit.target === 'hero'
        ? {
            type: 'stabber-melee',
            playerHit: true,
            damage: CONFIG.PLAYER.DAMAGE_STAB,
            ...at,
            enemiesHit: [],
          }
        : {
            type: 'stabber-melee',
            playerHit: false,
            ...at,
            enemiesHit: [
              { enemy: hit.target, damage: S.ALIEN_STAB_DAMAGE, angle: L.dir },
            ],
          };
    }
    if (k >= 1) this.endLunge(beats, null, S.COAST_PX_S);
    return null;
  }

  /**
   * The first thing the sweep from `a` to `b` touches: the hero within
   * TIP_HIT_PX of his centre, or an alien within its hit radius, as
   * { target: 'hero' | the alien, t }, or null. A tie goes to the hero
   */
  firstContact(a, b, heroX, heroY) {
    const t = sweepEntry(
      a.x,
      a.y,
      b.x,
      b.y,
      heroX,
      heroY,
      CONFIG.STABBER.TIP_HIT_PX
    );
    let best = t === null ? null : { target: 'hero', t };
    for (const e of this.getContextValue('enemies') ?? []) {
      if (e === this || e.markedForRemoval || e.pendingStabDeath) continue;
      const te = sweepEntry(a.x, a.y, b.x, b.y, e.x, e.y, e.hitRadius);
      if (te !== null && (best === null || te < best.t)) {
        best = { target: e, t: te };
      }
    }
    return best;
  }

  /**
   * The lunge is over: he recovers to the next beat 1, pushed `kickPxS`
   * along his aim (back off what he hit, or on past a miss). One that ends
   * at or after that beat 1 (a stall) skips the recovery: no push, he stalks
   */
  endLunge(beats, struck, kickPxS) {
    this.struck = struck;
    this.walk = { x: 0, y: 0 };
    if (beats >= (this.bar + 1) * BEATS_PER_BAR - EPS) {
      this.push = { x: 0, y: 0 };
      this.enter('stalk', beats);
      return;
    }
    const { dir } = this.lunge;
    this.push = { x: Math.cos(dir) * kickPxS, y: Math.sin(dir) * kickPxS };
    this.enter('recover', beats);
  }

  /** His strings stop with him: EnemyDeathHandler calls this on any death, a tank ball's included */
  silence() {
    this.tremolo?.stop();
    this.tremolo = null;
  }

  /** Any hit before the lock: the stab is off and he is dazed to the next beat 1 */
  daze() {
    this.silence();
    this.enter('stunned', this.poseBeats);
  }

  /**
   * His locomotion eases toward what he wants: stalking, he keeps to the
   * band round the hero and circles him; winding up, he eases back;
   * otherwise he settles. None while he lunges
   */
  steer(dtSec) {
    const S = CONFIG.STABBER;
    if (this.state === 'lunge') return;
    const ux = Math.cos(this.toHero);
    const uy = Math.sin(this.toHero);
    let want = { x: 0, y: 0 };
    if (this.state === 'stalk') want = this.stalkWant(ux, uy);
    else if (this.state === 'windup') {
      want = { x: -ux * S.DRAWBACK_PX_S, y: -uy * S.DRAWBACK_PX_S };
    }
    const tau = this.state === 'stalk' ? S.STEER_SEC : BUSY_STEER_SEC;
    const k = 1 - Math.exp(-dtSec / tau);
    this.walk.x += (want.x - this.walk.x) * k;
    this.walk.y += (want.y - this.walk.y) * k;
  }

  /** Stalking: in from beyond the band, out from inside it, round the hero within it */
  stalkWant(ux, uy) {
    const S = CONFIG.STABBER;
    const lo = Math.min(S.STALK_MIN_PX, S.STALK_MAX_PX);
    const hi = Math.max(S.STALK_MIN_PX, S.STALK_MAX_PX);
    const d = this.distance;
    if (d > hi) return { x: ux * S.APPROACH_PX_S, y: uy * S.APPROACH_PX_S };
    if (d < lo) return { x: -ux * S.BACKOFF_PX_S, y: -uy * S.BACKOFF_PX_S };
    const mid = (lo + hi) / 2;
    const pull = hi > mid ? ((d - mid) / (hi - mid)) * MID_PULL_PX_S : 0;
    const round = S.STALK_PX_S * this.circle;
    return { x: -uy * round + ux * pull, y: ux * round + uy * pull };
  }

  /** His aim: locked from the lock through the lunge and half a beat after; otherwise it follows the hero */
  turnAim(dtSec, beats) {
    const held =
      (this.state === 'windup' && this.locked) ||
      this.state === 'lunge' ||
      (this.state === 'recover' &&
        beats !== null &&
        beats - this.stateAt < AIM_HOLD_BEATS);
    if (held) {
      this.aim = this.lockAim;
      return;
    }
    const tau =
      this.state === 'stunned' ? DAZED_AIM_SEC : CONFIG.STABBER.AIM_SEC;
    this.aim +=
      normalizeAngle(this.toHero - this.aim) * (1 - Math.exp(-dtSec / tau));
  }

  /** BaseEnemy's next move: his locomotion plus his push, px per 60 Hz frame; none while he lunges */
  handOn() {
    const lunging = this.state === 'lunge';
    this.velocity.x = lunging
      ? 0
      : (this.walk.x + this.push.x) / FRAMES_PER_SEC;
    this.velocity.y = lunging
      ? 0
      : (this.walk.y + this.push.y) / FRAMES_PER_SEC;
  }

  /** His push keeps KNOCK_DECAY of itself per 60 Hz frame of game time */
  fadePush(deltaTimeMs) {
    const keep =
      CONFIG.STABBER.KNOCK_DECAY **
      (deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS);
    this.push.x *= keep;
    this.push.y *= keep;
  }

  /** A hit's push along `angle`, capped under steady fire */
  shove(angle) {
    const S = CONFIG.STABBER;
    this.hitDir = angle;
    this.push.x += Math.cos(angle) * S.KNOCK_PX_S;
    this.push.y += Math.sin(angle) * S.KNOCK_PX_S;
    const m = Math.hypot(this.push.x, this.push.y);
    if (m > S.KNOCK_MAX_PX_S) {
      this.push.x *= S.KNOCK_MAX_PX_S / m;
      this.push.y *= S.KNOCK_MAX_PX_S / m;
    }
    this.handOn();
  }

  /**
   * Armour takes ARMOR off each hit, at least 1 gets through. Any hit
   * before his lock step cancels the stab and dazes him; one with a
   * direction pushes him, except mid-lunge. Lethal damage kills him in any
   * state
   */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    this.hitAt = this.poseBeats;
    if (this.state === 'windup' && !this.locked) this.daze();
    if (bulletAngle !== null && this.state !== 'lunge') this.shove(bulletAngle);
    this.getContextValue('audio')?.playSound('stabberHit', this.x, this.y);
    const armour = CONFIG.STABBER.ARMOR;
    return super.takeDamage(
      Math.max(1, amount - armour),
      bulletAngle,
      damageSource
    );
  }

  /** @override */
  getAmbientSpeechConfig() {
    return {
      lines: STABBER_LINES,
      gate: (beatClock) => !!beatClock?.canStabberAttack(),
      chance: STABBER_SPEECH_CHANCE,
    };
  }

  /** His health bar sits clear of his count ring, at any ART_SCALE */
  get healthBarRise() {
    return (
      RING_R_PX * CONFIG.STABBER_LOOK.ART_SCALE +
      COUNT_RING_EDGE_PX +
      HEALTH_BAR_GAP_PX +
      HEALTH_BAR_HEIGHT_PX
    );
  }

  /** His drawn size: ART_SCALE, but a lunge keeps the one it started with, so his drawn tip is where it hits */
  drawScale() {
    return this.state === 'lunge' && this.lunge
      ? this.lunge.scale
      : CONFIG.STABBER_LOOK.ART_SCALE;
  }

  /** @override His lane, under him, while he winds up */
  draw(p = this.p) {
    if (this.state === 'windup') {
      drawLane(p, this.x, this.y, this.pose(), CONFIG.STABBER_LOOK.ART_SCALE);
    }
    super.draw(p);
  }

  /** @override Drawn from his pose (StabberRenderer.js); shaken when hit, but not mid-lunge, where his tip sits where it lands */
  drawFigure(p) {
    if (this.state !== 'lunge') this.applyHitShake(p);
    drawStabber(p, this.drawScale(), this.pose());
  }

  /** His count ring (the rusher's), over him, while he winds up: an arc goes out each eighth */
  drawSpecificIndicators(p) {
    if (this.state !== 'windup') return;
    const look = this.pose();
    drawCountRing(
      p,
      this.x,
      this.y,
      {
        age: look.age,
        beatsTotal: RING_ARCS,
        beatsLeft: look.windup.left,
        hot: look.windup.locked,
        tick: env((look.eighth * look.beatSec) / 2, TICK_TAU_SEC),
      },
      RING_R_PX * CONFIG.STABBER_LOOK.ART_SCALE,
      RING_GOLD,
      RING_AMBER_AT
    );
  }

  /** His look, at the beat update() last kept (frozen while paused): what StabberRenderer.js draws */
  pose() {
    const S = CONFIG.STABBER;
    const beats = this.poseBeats;
    const b = beats ?? 0;
    const beatSec =
      (this.getContextValue('beatClock')?.beatInterval ?? 0) / 1000;
    const since = (at) =>
      beats === null || at === null ? Infinity : (beats - at) * beatSec;
    const n = Math.floor(b);
    const barStart = (this.bar ?? 0) * BEATS_PER_BAR;
    const st = this.state;
    const age = since(this.stateAt);
    // Through the rest of the phrase, 0..1 to its next beat 1
    const toEnd = () => {
      const from = this.stateAt ?? b;
      return clamp01(
        (b - from) / Math.max(EPS, barStart + BEATS_PER_BAR - from)
      );
    };
    const L = this.lunge;
    const lungeK = L ? clamp01(((b - L.at) * beatSec) / L.sec) : 0;
    let vx = this.walk.x + this.push.x;
    let vy = this.walk.y + this.push.y;
    if (st === 'lunge' && L) {
      // The ease-out's speed along its path
      const v = (3 * L.len * (1 - lungeK) ** 2) / L.sec;
      vx = Math.cos(L.dir) * v;
      vy = Math.sin(L.dir) * v;
    }
    const hitAge = since(this.hitAt);
    return {
      t: b * beatSec,
      beatSec,
      beats: b,
      eighth: (b * 2) % 1,
      kick: env((b - n) * beatSec, KICK_TAU_SEC),
      aim: this.aim,
      toHero: this.toHero,
      vx,
      vy,
      age,
      windup:
        st === 'windup'
          ? {
              k: clamp01((b - (barStart + WINDUP_AT)) / (LUNGE_AT - WINDUP_AT)),
              locked: this.locked,
              lockAge: this.locked ? since(this.lockAt) : -1,
              left: Math.max(1, Math.ceil((barStart + LUNGE_AT - b) * 2 - EPS)),
              len: this.locked ? this.lockLen : this.lungeLength(),
            }
          : null,
      lunge: st === 'lunge' && L ? { k: lungeK } : null,
      recover:
        st === 'recover' ? { age, k: toEnd(), struck: this.struck } : null,
      stunned: st === 'stunned' ? { age } : null,
      hit: env(hitAge, HIT_TAU_SEC),
      hitAge: hitAge >= 0 ? hitAge : Infinity,
      hitDir: this.hitDir,
      // Finite whatever the slider says (KNOCK_PX_S at 0)
      push: clamp01(
        Math.hypot(this.push.x, this.push.y) / Math.max(S.KNOCK_PX_S, EPS)
      ),
      seed: this.lookSeed,
      reach: STABBER_REACH_PX * this.drawScale(),
    };
  }
}

export { Stabber };
