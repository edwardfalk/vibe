import { BaseEnemy } from './BaseEnemy.js';
import { CONFIG } from '../config.js';
import {
  clamp01,
  smooth,
  easeOut,
  env,
  lerp,
  normalizeAngle,
} from '../mathUtils.js';
import { stalkWant } from './Stabber.js';
import { volleyGain } from '../systems/GruntSwarm.js';
import { mod } from './GruntRenderer.js';
import { Bullet } from './bullet.js';
import { NOTE_OWNER, NoteFlash } from './BassNote.js';
import { DAMAGE_RESULT } from '../shared/DamageResult.js';
import { drawBassist, BASSIST_MUZZLE_PX } from './BassistRenderer.js';
import { HEALTH_BAR_HEIGHT_PX, HEALTH_BAR_GAP_PX } from './BaseEnemyHelpers.js';

const FRAMES_PER_SEC = 60; // BaseEnemy's velocity is px per 60 Hz frame
const STRINGS = 4;
const LETS_PER_BAR = 4;
/** The let of 3, where his aim locks */
export const LOCK_LET = 2;
/** The let of 4, his slap */
export const SLAP_LET = 3;
/** His line, one degree a let: walking up b3, 4, 5 into the slap's b7 */
export const LINE = ['b3', '4', '5', 'b7'];
const EPS = 1e-6; // slack on beat positions, for floating-point error
// px from his centre to the furthest of him, at ART_SCALE 1: his health bar
// clears it whichever way he faces
const REACH_PX = 40;
// His telegraph goes white-hot for this last share of a beat before the slap
const HOT_BEATS = 1 / 3;
// His look's envelopes, s (the studies page's)
const KICK_TAU_SEC = 0.12;
const HIT_TAU_SEC = 0.08;
const UNCURL_SEC = 0.15; // his scroll opens with the turn on let 3
const RECURL_BEATS = 0.8; // and curls back this long after the slap's beat

/** Whether a bassist is about: the hero's grid swings while one is (BeatClock.wantSwing) */
export const bassistAbout = (enemies) =>
  enemies.some((e) => e.type === 'bassist' && !e.markedForRemoval);

/**
 * Bassist: an alien that resembles an upright bass, a pure creature with no
 * words. He hangs back from the hero as the stabber does, and plays the let
 * before every beat (the bassist spec, docs/superpowers/specs).
 */
export class Bassist extends BaseEnemy {
  constructor(x, y, type, config, p, audio) {
    const B = CONFIG.BASSIST;
    super(
      x,
      y,
      'bassist',
      {
        ...config,
        size: B.SIZE,
        health: STRINGS * B.HITS_PER_STRING,
        speed: B.APPROACH_PX_S / FRAMES_PER_SEC,
      },
      p,
      audio
    );
    this.hitFlashAlpha = 255; // he stays solid when hit: his own white flash shows it
    this.circle = this.lookSeed < 0.5 ? 1 : -1; // which way he circles the hero
    const hero = this.getContextValue('player');
    // His own facing: BaseEnemy aims every enemy at the hero each update,
    // but he holds his between his turns on let 3
    this.aim = hero ? Math.atan2(hero.y - y, hero.x - x) : 0;
    this.aimAngle = this.aim;
    this.turn = null; // { from, to, at (beats) }: his turn on the last let 3
    this.knock = { x: 0, y: 0 }; // a shot's push, px/s
    this.distance = Infinity; // to the hero, at his last update
    this.toHero = 0;
    this.walk = { x: 0, y: 0 }; // his drift, px/s
    this.push = { x: 0, y: 0 }; // a puff's push, px/s
    // The beat he is at, kept by update(); the lets before he came are past
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition() ?? null;
    this.lastLet =
      this.poseBeats === null
        ? null
        : Math.floor(this.poseBeats - CONFIG.SWING.AND_AT + EPS);
    this.lockBar = null; // the bar whose let 3 locked his aim
    this.lockAt = null; // the hero's spot at that let 3: his slap aims there
    this.heroAt = { x, y }; // the hero's spot at his last update
    // When things happened to him, in beat positions, for drawing (pose)
    this.puffAt = null; // his last puff, a let he played
    this.puffDir = 0; // the way it lurched him
    this.plucked = Array(STRINGS).fill(null); // each sinew's last play
    this.snapped = Array(STRINGS).fill(null); // and when it snapped
    this.hitAt = null;
    this.hitDir = 0;
  }

  /** @override He keeps the beat he is at, and his own facing */
  update(playerX, playerY, deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS) {
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition() ?? null;
    const result = super.update(playerX, playerY, deltaTimeMs);
    this.aimAngle = this.aim;
    return result;
  }

  /** He plays the lets this update reached, then drifts in his band round the hero, puffed on by them */
  updateSpecificBehavior(
    playerX,
    playerY,
    deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS
  ) {
    this.keepInWorld();
    this.heroAt = { x: playerX, y: playerY };
    this.distance = Math.hypot(playerX - this.x, playerY - this.y);
    this.toHero = Math.atan2(playerY - this.y, playerX - this.x);
    const result = this.poseBeats === null ? null : this.playLets();
    this.turnOn();
    this.steer(deltaTimeMs / 1000);
    const { x, y } = this.moving();
    this.velocity.x = x / FRAMES_PER_SEC;
    this.velocity.y = y / FRAMES_PER_SEC;
    const B = CONFIG.BASSIST;
    const frames = deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS;
    const puffKeep = B.PUFF_KEEP ** frames;
    this.push.x *= puffKeep;
    this.push.y *= puffKeep;
    const knockKeep = B.KNOCK_DECAY ** frames;
    this.knock.x *= knockKeep;
    this.knock.y *= knockKeep;
    return result;
  }

  /** His velocity, px/s: his drift, his puffs and recoil, and the shots' knocks */
  moving() {
    return {
      x: this.walk.x + this.push.x + this.knock.x,
      y: this.walk.y + this.push.y + this.knock.y,
    };
  }

  /** His quick turn to the hero on let 3, eased over TURN_SEC; else he holds his facing */
  turnOn() {
    if (!this.turn || this.poseBeats === null) return;
    const beatSec =
      (this.getContextValue('beatClock')?.beatInterval ?? 0) / 1000;
    const k = clamp01(
      ((this.poseBeats - this.turn.at) * beatSec) / CONFIG.BASSIST.TURN_SEC
    );
    this.aim = lerp(this.turn.from, this.turn.to, easeOut(k));
  }

  /**
   * @override One sound a hit: his hit, climbing from his health before it,
   * or, when it snaps one string or more, one twang. A lethal hit plays
   * none: his death's twang is its sound
   */
  takeDamage(amount, bulletAngle = null, damageSource = null) {
    const health = this.health;
    const strings = this.strings();
    const result = super.takeDamage(amount, bulletAngle, damageSource);
    if (result === DAMAGE_RESULT.DIED) return result;
    this.hitAt = this.poseBeats;
    if (bulletAngle !== null) this.knockAlong(bulletAngle);
    const audio = this.getContextValue('audio');
    if (this.strings() < strings) {
      // Let 1's sinew goes first: sinew k plays let k
      for (let k = STRINGS - strings; k < STRINGS - this.strings(); k++) {
        this.snapped[k] = this.poseBeats;
      }
      audio?.playSound('bassistTwang', this.x, this.y);
    } else {
      audio?.playSound('bassistHit', this.x, this.y, {
        health,
        maxHealth: this.maxHealth,
      });
    }
    return result;
  }

  /** A shot's push along its line, KNOCK_PX_S, the whole capped at KNOCK_MAX_PX_S */
  knockAlong(dir) {
    const { KNOCK_PX_S, KNOCK_MAX_PX_S } = CONFIG.BASSIST;
    this.hitDir = dir;
    this.knock.x += Math.cos(dir) * KNOCK_PX_S;
    this.knock.y += Math.sin(dir) * KNOCK_PX_S;
    const speed = Math.hypot(this.knock.x, this.knock.y);
    if (speed > KNOCK_MAX_PX_S) {
      this.knock.x *= KNOCK_MAX_PX_S / speed;
      this.knock.y *= KNOCK_MAX_PX_S / speed;
    }
  }

  /** His strings left: one goes with each quarter of his health */
  strings() {
    return Math.max(0, Math.ceil((STRINGS * this.health) / this.maxHealth));
  }

  /** Whether he still plays let `k` of a bar (0 to 3): a snapped string drops let 1, then 2, then 3; the slap's goes last */
  plays(k) {
    return k >= STRINGS - this.strings();
  }

  /**
   * The let at or before now, if this update is the first to reach it: at
   * beat n + SWING.AND_AT for each beat n. Each acts once, even if AND_AT
   * moves; one reached more than half its gap to the next beat late is
   * dropped, so nothing he plays sounds off its let. Let 3 locks his aim on the hero's spot,
   * and only a bar whose let 3 he reached slaps
   */
  playLets() {
    const and = CONFIG.SWING.AND_AT;
    const n = Math.floor(this.poseBeats - and + EPS);
    if (this.lastLet !== null && n <= this.lastLet) return null;
    this.lastLet = n;
    if (this.poseBeats - (n + and) > (1 - and) / 2) return null;
    const k = mod(n, LETS_PER_BAR);
    const bar = Math.floor(n / LETS_PER_BAR);
    if (k === LOCK_LET) {
      this.lockBar = bar;
      this.lockAt = { ...this.heroAt };
      const to = this.aim + normalizeAngle(this.toHero - this.aim);
      this.turn = { from: this.aim, to, at: this.poseBeats };
    }
    if (!this.plays(k)) return null;
    if (k === SLAP_LET && this.lockBar !== bar) return null;
    this.pluck(n, k);
    if (k !== SLAP_LET) {
      this.puffAlong(this.driftDir(), CONFIG.BASSIST.LURCH_PX_S);
      return null;
    }
    return this.slap();
  }

  /** The way he drifts; still, round the hero, the way he circles */
  driftDir() {
    return Math.hypot(this.walk.x, this.walk.y) > EPS
      ? Math.atan2(this.walk.y, this.walk.x)
      : this.toHero + (this.circle * Math.PI) / 2;
  }

  /** A let's puff, pushing him `speed` px/s along `dir` */
  puffAlong(dir, speed) {
    this.puffAt = this.poseBeats;
    this.puffDir = dir;
    this.push.x += Math.cos(dir) * speed;
    this.push.y += Math.sin(dir) * speed;
  }

  /** The slap: he faces the hero's spot let 3 locked, fires at it, and recoils off it */
  slap() {
    this.aim = Math.atan2(this.lockAt.y - this.y, this.lockAt.x - this.x);
    this.turn = null;
    this.puffAlong(this.aim + Math.PI, CONFIG.BASSIST.RECOIL_PX_S);
    return this.fireNote();
  }

  /**
   * The slap's note, from him at the hero's spot let 3 locked: he drifts
   * through the beat between, so an aim kept as an angle would miss a hero
   * standing still. The enemy loop takes it into the enemy bullets
   */
  fireNote() {
    const muzzle = BASSIST_MUZZLE_PX * CONFIG.BASSIST_LOOK.ART_SCALE;
    const x = this.x + Math.cos(this.aim) * muzzle;
    const y = this.y + Math.sin(this.aim) * muzzle;
    const note = Bullet.acquire(x, y, this.aim, 0, NOTE_OWNER);
    note.ownerId = this.id;
    return note;
  }

  /** Let n, the k-th of its bar, played: its sinew, and its sound on its grid time */
  pluck(n, k) {
    this.plucked[k] = this.poseBeats;
    const audio = this.getContextValue('audio');
    const clock = this.getContextValue('beatClock');
    if (!audio || !clock) return;
    const crowd = (this.getContextValue('enemies') ?? []).filter(
      (e) => e.type === 'bassist' && !e.markedForRemoval && !e.isSpawning
    ).length;
    audio.playSound(k === SLAP_LET ? 'bassSlap' : 'bassPluck', this.x, this.y, {
      at: letTime(clock, n),
      exact: true,
      seed: this.lookSeed,
      note: [LINE[k], CONFIG.BASSIST.OCTAVE],
      gain: volleyGain(Math.max(1, crowd)),
    });
  }

  /** His drift eases toward the stabber's stalk, on his own band and speeds */
  steer(dtSec) {
    const B = CONFIG.BASSIST;
    const want = stalkWant(
      B,
      this.distance,
      this.circle,
      Math.cos(this.toHero),
      Math.sin(this.toHero)
    );
    const k = 1 - Math.exp(-dtSec / B.STEER_SEC);
    this.walk.x += (want.x - this.walk.x) * k;
    this.walk.y += (want.y - this.walk.y) * k;
  }

  /**
   * His look at the beat update() kept: what a version on the studies page
   * draws from (its L), so the picked one draws in the game unchanged
   */
  pose() {
    const B = CONFIG.BASSIST;
    const and = CONFIG.SWING.AND_AT;
    const beats = this.poseBeats ?? 0;
    const beatSec =
      (this.getContextValue('beatClock')?.beatInterval ?? 500) / 1000;
    const age = (at) => (at === null ? Infinity : (beats - at) * beatSec);
    const n = Math.floor(beats);
    // The telegraph, from the position in the bar: a notch at each let,
    // played or not, amber from let 3, white-hot just before the slap
    const u = mod(beats - (SLAP_LET + and), LETS_PER_BAR);
    const notch = Math.min(SLAP_LET, Math.floor(u + EPS));
    const next = Math.floor(beats - and + EPS) + 1;
    const turnAge = this.turn ? age(this.turn.at) : Infinity;
    const { x: vx, y: vy } = this.moving();
    const hitAge = age(this.hitAt);
    return {
      t: beats * beatSec,
      beatSec,
      beats,
      beat: mod(n, LETS_PER_BAR),
      beatPhase: beats - n,
      kick: env((beats - n) * beatSec, KICK_TAU_SEC),
      andAt: and,
      aim: this.aim,
      toHero: this.toHero,
      turn: this.turn ? clamp01(turnAge / B.TURN_SEC) : 1,
      uncurl: uncurl(
        age(this.turn?.at ?? null),
        age(this.plucked[SLAP_LET]),
        beatSec
      ),
      vx,
      vy,
      speed: Math.hypot(vx, vy),
      strings: this.strings(),
      plays: [0, 1, 2, 3].map((k) => this.plays(k)),
      sinews: [0, 1, 2, 3].map((k) => ({
        snapped: this.snapped[k] === null ? -1 : age(this.snapped[k]),
        pluck: age(this.plucked[k]),
      })),
      letK: mod(next, LETS_PER_BAR),
      letIn: (next + and - beats) * beatSec,
      puff: age(this.puffAt),
      puffDir: this.puffDir,
      slap: age(this.plucked[SLAP_LET]),
      tell: {
        notch,
        notchAge: (u - notch) * beatSec,
        amber: notch >= SLAP_LET,
        hot: u >= LETS_PER_BAR - HOT_BEATS - EPS,
      },
      hit: hitAge < Infinity ? env(hitAge, HIT_TAU_SEC) : 0,
      hitAge,
      hitDir: this.hitDir,
      push: clamp01(Math.hypot(this.knock.x, this.knock.y) / B.KNOCK_PX_S),
      hp: this.health / this.maxHealth,
      spawn: this.isSpawning ? this.spawnTimer / this.spawnDuration : 1,
      dying: null,
      slack: null,
      seed: this.lookSeed,
      muzzle: BASSIST_MUZZLE_PX * CONFIG.BASSIST_LOOK.ART_SCALE,
    };
  }

  /** His look (BassistRenderer.js), from his pose */
  drawFigure(p) {
    drawBassist(p, CONFIG.BASSIST_LOOK.ART_SCALE, this.pose());
  }

  /** His health bar sits clear of him, whichever way he faces */
  get healthBarRise() {
    return (
      REACH_PX * CONFIG.BASSIST_LOOK.ART_SCALE +
      HEALTH_BAR_GAP_PX +
      HEALTH_BAR_HEIGHT_PX
    );
  }
}

/**
 * How far his scroll is open (0..1): it opens with his turn on let 3
 * (`turnAge`, s), holds, and curls back after the slap (`slapAge`, s)
 */
function uncurl(turnAge, slapAge, beatSec) {
  if (slapAge < turnAge) {
    return 1 - smooth(clamp01(slapAge / (RECURL_BEATS * beatSec)));
  }
  return turnAge < Infinity ? smooth(clamp01(turnAge / UNCURL_SEC)) : 0;
}

/** Let n's grid time on the audio clock, s: beat n + SWING.AND_AT */
function letTime(clock, n) {
  const beatSec = clock.beatInterval / 1000;
  return clock.startTime / 1000 + (n + CONFIG.SWING.AND_AT) * beatSec;
}

/**
 * His note's speed, px/s, at beat position `beats`: NOTE_GLIDE_PX_S, plus,
 * from each let its bassist still plays (the slap's too) to the next beat,
 * a push that fades to nothing by that beat and carries it NOTE_LURCH_PX in
 * all: long-short, the shuffle seen
 */
export function noteSpeed(bassist, beats, beatSec) {
  return CONFIG.BASSIST.NOTE_GLIDE_PX_S + notePush(bassist, beats, beatSec);
}

// The push part of noteSpeed, px/s. shortcut: read at the frame's beat
// position, so a long frame loses a little of it; integrate it if that shows
function notePush(bassist, beats, beatSec) {
  const and = CONFIG.SWING.AND_AT;
  const n = Math.floor(beats - and + EPS);
  const gap = 1 - and; // from the let to the next beat, beats
  const since = beats - (n + and);
  if (since < 0 || since >= gap || !bassist.plays(mod(n, LETS_PER_BAR))) {
    return 0;
  }
  return pushPeak(beatSec) * (1 - since / gap);
}

// A push's speed at its let, px/s: it fades to 0 by the next beat, so it
// carries the note NOTE_LURCH_PX in all
const pushPeak = (beatSec) =>
  (2 * CONFIG.BASSIST.NOTE_LURCH_PX) / ((1 - CONFIG.SWING.AND_AT) * beatSec);

/**
 * One pass a frame over the enemy bullets, before the collisions: each note
 * finds its bassist by its ownerId among the enemies not marked for
 * removal and takes its velocity from him (noteSpeed, along its own line);
 * and how hard it is pushed, for its look; a note whose bassist is gone
 * pops, silently (his death covers it). The only rule that pops them, so no
 * death needs to know about notes. `effects` (the explosion manager) takes
 * the pops' and the bursts' flashes
 */
export function driveBassNotes(bullets, enemies, clock, effects = null) {
  if (!clock) return;
  const beats = clock.getBeatPosition();
  const beatSec = clock.beatInterval / 1000;
  for (const note of bullets) {
    if (note.owner !== NOTE_OWNER || note._remove) continue;
    const bassist = enemies.find(
      (e) => e.id === note.ownerId && !e.markedForRemoval
    );
    if (!bassist) {
      flash(effects, note, 'pop', clock);
      Bullet.release(note);
      note._remove = true;
      continue;
    }
    if (note.hung) {
      hangOn(note, bassist, clock, beats, effects);
      continue;
    }
    const push = notePush(bassist, beats, beatSec);
    note.push = push / pushPeak(beatSec);
    const perFrame = (CONFIG.BASSIST.NOTE_GLIDE_PX_S + push) / FRAMES_PER_SEC;
    note.velocity.x = Math.cos(note.angle) * perFrame;
    note.velocity.y = Math.sin(note.angle) * perFrame;
  }
}

/**
 * A note the hero shot (BassNote.hangNote) holds still, swelling, until
 * its let; then it bursts with its b7, booked at that let's grid time as
 * his own lets are
 */
function hangOn(note, bassist, clock, beats, effects) {
  note.velocity.x = 0;
  note.velocity.y = 0;
  const { at, let: n } = note.hung;
  if (n === null) return;
  const letBeats = n + CONFIG.SWING.AND_AT;
  if (beats < letBeats - EPS) {
    note.swell = at === null ? 0 : clamp01((beats - at) / (letBeats - at));
    return;
  }
  bassist.getContextValue('audio')?.playSound('bassPluck', note.x, note.y, {
    at: letTime(clock, n),
    exact: true,
    seed: bassist.lookSeed,
    note: [LINE[SLAP_LET], CONFIG.BASSIST.OCTAVE],
  });
  flash(effects, note, 'burst', clock);
  Bullet.release(note);
  note._remove = true;
}

// A note's end, drawn where it was (BassNote.NoteFlash)
function flash(effects, note, kind, clock) {
  effects?.fragmentExplosions?.push(
    new NoteFlash({
      x: note.x,
      y: note.y,
      kind,
      seed: (note.x * 0.37 + note.y * 0.11) % 1,
      startsAt: clock.nowSec(),
      now: () => clock.nowSec(),
    })
  );
}
