import { BaseEnemy } from './BaseEnemy.js';
import { CONFIG } from '../config.js';
import { clamp01 } from '../mathUtils.js';
import { stalkWant } from './Stabber.js';
import { volleyGain } from '../systems/GruntSwarm.js';
import { mod } from './GruntRenderer.js';
import { Bullet } from './bullet.js';
import { NOTE_OWNER } from './BassNote.js';
import { DAMAGE_RESULT } from '../shared/DamageResult.js';

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

// shortcut: a stand-in figure until Edward picks his look on the studies
// page (the bassist spec, The creature); the picked one replaces it
const SHELL_RGB = [150, 95, 55];
const SINEW_RGB = [235, 225, 200];

/**
 * His figure at the origin, facing `aim`; `slack` (0..1) curls his sinews
 * as in his death, and `alpha` (0..1) fades him. shortcut: the stand-in
 * figure, until his look is picked
 */
export function drawBassistFigure(p, s, aim, slack = 0, alpha = 1) {
  const a = 255 * alpha;
  p.push();
  p.rotate(aim + Math.PI / 2);
  p.noStroke();
  p.fill(...SHELL_RGB, a);
  p.ellipse(0, s * 0.25, s * 0.9, s * 0.7);
  p.ellipse(0, -s * 0.15, s * 0.7, s * 0.55);
  p.stroke(...SINEW_RGB, a);
  p.strokeWeight(1);
  p.noFill();
  for (let i = 0; i < STRINGS; i++) {
    const x = (i - (STRINGS - 1) / 2) * s * 0.08;
    // Slack, each curls back up from the bridge
    const top = -s * 0.6 + slack * s * 0.7;
    const curl = slack * s * 0.25 * (i % 2 ? 1 : -1);
    p.bezier(x, s * 0.4, x + curl, s * 0.1, x - curl, top, x + curl, top);
  }
  p.pop();
}

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
    this.circle = this.lookSeed < 0.5 ? 1 : -1; // which way he circles the hero
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
    this.puffAt = null; // the beat position of the last let he played
    this.snapAt = null; // and of the last hit that snapped a string
  }

  /** @override He keeps the beat he is at */
  update(playerX, playerY, deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS) {
    this.poseBeats =
      this.getContextValue('beatClock')?.getBeatPosition() ?? null;
    return super.update(playerX, playerY, deltaTimeMs);
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
    this.steer(deltaTimeMs / 1000);
    this.velocity.x = (this.walk.x + this.push.x) / FRAMES_PER_SEC;
    this.velocity.y = (this.walk.y + this.push.y) / FRAMES_PER_SEC;
    const keep =
      CONFIG.BASSIST.PUFF_KEEP **
      (deltaTimeMs / CONFIG.GAME_SETTINGS.FRAME_TIME_MS);
    this.push.x *= keep;
    this.push.y *= keep;
    return result;
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
    const audio = this.getContextValue('audio');
    if (this.strings() < strings) {
      this.snapAt = this.poseBeats;
      audio?.playSound('bassistTwang', this.x, this.y);
    } else {
      audio?.playSound('bassistHit', this.x, this.y, {
        health,
        maxHealth: this.maxHealth,
      });
    }
    return result;
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
    }
    if (!this.plays(k)) return null;
    if (k === SLAP_LET && this.lockBar !== bar) return null;
    this.pluck(n, k);
    return k === SLAP_LET ? this.fireNote() : null;
  }

  /**
   * The slap's note, from him at the hero's spot let 3 locked: he drifts
   * through the beat between, so an aim kept as an angle would miss a hero
   * standing still. The enemy loop takes it into the enemy bullets
   */
  fireNote() {
    const aim = Math.atan2(this.lockAt.y - this.y, this.lockAt.x - this.x);
    const note = Bullet.acquire(this.x, this.y, aim, 0, NOTE_OWNER);
    note.ownerId = this.id;
    return note;
  }

  /** Let n, the k-th of its bar: its sound, on its grid time, and a puff along his drift */
  pluck(n, k) {
    this.puffAt = this.poseBeats;
    const speed = Math.hypot(this.walk.x, this.walk.y);
    // Still, he puffs round the hero, the way he circles
    const dir =
      speed > EPS
        ? Math.atan2(this.walk.y, this.walk.x)
        : this.toHero + (this.circle * Math.PI) / 2;
    const lurch = CONFIG.BASSIST.LURCH_PX_S;
    this.push.x += Math.cos(dir) * lurch;
    this.push.y += Math.sin(dir) * lurch;
    const audio = this.getContextValue('audio');
    const clock = this.getContextValue('beatClock');
    if (!audio || !clock) return;
    const crowd = (this.getContextValue('enemies') ?? []).filter(
      (e) => e.type === 'bassist' && !e.markedForRemoval && !e.isSpawning
    ).length;
    audio.playSound(k === SLAP_LET ? 'bassSlap' : 'bassPluck', this.x, this.y, {
      at: letTime(clock, n),
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

  drawFigure(p, s) {
    this.applyHitShake(p);
    drawBassistFigure(p, s, this.aimAngle);
  }
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
  const B = CONFIG.BASSIST;
  const and = CONFIG.SWING.AND_AT;
  const n = Math.floor(beats - and + EPS);
  const gap = 1 - and; // from the let to the next beat, beats
  const since = beats - (n + and);
  if (since < 0 || since >= gap || !bassist.plays(mod(n, LETS_PER_BAR))) {
    return B.NOTE_GLIDE_PX_S;
  }
  const fade = 1 - since / gap;
  return B.NOTE_GLIDE_PX_S + (2 * B.NOTE_LURCH_PX * fade) / (gap * beatSec);
}

/**
 * One pass a frame over the enemy bullets, before the collisions: each note
 * finds its bassist by its ownerId among the enemies not marked for
 * removal and takes its velocity from him (noteSpeed, along its own line);
 * a note whose bassist is gone pops, silently (his death covers it). The
 * only rule that pops them, so no death needs to know about notes
 */
export function driveBassNotes(bullets, enemies, clock) {
  if (!clock) return;
  const beats = clock.getBeatPosition();
  const beatSec = clock.beatInterval / 1000;
  for (const note of bullets) {
    if (note.owner !== NOTE_OWNER || note._remove) continue;
    const bassist = enemies.find(
      (e) => e.id === note.ownerId && !e.markedForRemoval
    );
    if (!bassist) {
      Bullet.release(note);
      note._remove = true;
      continue;
    }
    if (note.hung) {
      hangOn(note, bassist, clock, beats);
      continue;
    }
    const perFrame = noteSpeed(bassist, beats, beatSec) / FRAMES_PER_SEC;
    note.velocity.x = Math.cos(note.angle) * perFrame;
    note.velocity.y = Math.sin(note.angle) * perFrame;
  }
}

/**
 * A note the hero shot (BassNote.hangNote) holds still, swelling, until
 * its let; then it bursts with its b7, booked at that let's grid time as
 * his own lets are
 */
function hangOn(note, bassist, clock, beats) {
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
    seed: bassist.lookSeed,
    note: [LINE[SLAP_LET], CONFIG.BASSIST.OCTAVE],
  });
  Bullet.release(note);
  note._remove = true;
}
