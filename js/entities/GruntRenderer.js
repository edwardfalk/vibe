/**
 * How a grunt looks and moves: a wobbling droplet of jelly in a helmet far too
 * small, eyes pointing two ways, one booster jet under its bottom. Aliens live
 * in space and never walk (docs/DESIGN.md, "The cast").
 *
 * It never turns with its aim: it mirrors to face its target, and only its gun
 * swings. Its moves follow BeatClock's grid: the jet puffs on 2 and 4 (its
 * snare) and it hops; through the beat before a shot it winds up.
 *
 * gruntPose() is pure: beat position, seed, aim and recent events in, numbers
 * out. drawGrunt() only draws a pose. Neither uses the game's random numbers;
 * anything that looks random is sin/cos of time and seed, or mulberry32 used
 * as a hash.
 */
import { CONFIG } from '../config.js';
import { mulberry32 } from '../mathUtils.js';

const PI = Math.PI;
const TWO_PI = 2 * PI;

// The grunt's palette, [r, g, b]. Its glow, death fragments, KILL! text and
// shots use it too, so it is frozen.
export const GRUNT_COLORS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      ink: [38, 26, 48],
      body: [172, 206, 142],
      belly: [214, 232, 190],
      lid: [150, 186, 124],
      helmet: [232, 112, 92],
      brim: [176, 72, 64],
      badge: [238, 182, 64],
      eye: [250, 244, 226],
      gun: [236, 226, 200],
      stalk: [238, 242, 218],
      bobble: [232, 112, 92],
      nozzle: [120, 112, 138],
      flame: [150, 235, 220],
      tear: [190, 230, 255],
      plate: [232, 112, 92],
      glow: [130, 170, 110],
      shot: [240, 110, 80],
      shotCore: [255, 170, 130],
      flash: [255, 220, 140],
      white: [255, 255, 255],
    }).map(([name, rgb]) => [name, Object.freeze(rgb)])
  )
);
// Wind-up: amber for the first half of the warning beat, white-hot after
const AMBER = Object.freeze([255, 170, 40]);
const HOT = Object.freeze([255, 248, 225]);
const SULK_GREY = Object.freeze([125, 135, 125]);

// The dance's shape: seconds from its snare (beats 2 and 4) unless named otherwise
const DANCE = {
  CROUCH_SEC: 0.12, // it crouches this long before the snare
  CROUCH_SQUASH: 0.16,
  AIR_SEC: 0.18, // and is in the air this long after it
  AIR_STRETCH: 0.14,
  LAND_SQUASH: 0.18,
  LAND_DECAY_SEC: 0.08,
  LAND_WOBBLE_SEC: 0.2,
  NOD_SQUASH: 0.07, // its nod on 1 and 3
  NOD_DECAY_SEC: 0.07,
  TIP_LAG_BEATS: 0.35, // the antenna tips trail the lean by this much
  TIP_REACH: 0.85, // of its size: how far the lean swings the tips
  TIP_BOUNCE_PX: 2.2, // and how far the hop bounces them
  TIP_BOUNCE_DECAY_SEC: 0.12,
  TIP_BOUNCE_PERIOD_SEC: 0.16,
  TIP_BOUNCE_END_SEC: 0.6,
  BLINK_FROM: 0.5, // it blinks through this part of one beat a bar
  BLINK_TO: 0.64,
};
// The jet: thrust 0..1
const JET = {
  IDLE: 0.35, // between puffs
  PUFF_DECAY_SEC: 0.12,
  COUGH_ROLLS_PER_SEC: 9,
  COUGH_THRUST: 0.15,
  COUGH_SAG_PX: 1.5,
  FLICKER: 0.3, // the flame flickers by this much, every frame
  FLICKER_PER_SEC: 60,
};
// Free motion, in radians per second
const RATE = {
  HOVER: 2.2,
  WANDER_SLOW: 1.3,
  WANDER_FAST: 2.9,
  JIGGLE: 28,
  GUN_WOBBLE: 3.3,
};
// Each motion's phase is offset by the seed times this, so grunts don't move as one
const SEED_PHASE = { HOVER: 6, WANDER_SLOW: 7, WANDER_FAST: 3, GUN_WOBBLE: 4 };
const WANDER_MIX = [0.6, 0.4]; // the slow and fast drift's shares
const JIGGLE_DECAY_SEC = 0.2;
const GUN_WOBBLE_RAD = 0.08;
// The hash's dice: a time step times a prime, plus the seed as a whole number
const HASH_PRIME = 7919;
const SEED_STEPS = 1e6;
// Wind-up, shot and sulk
const WINDUP = { LEAN_RAD: 0.16, PUFF: 0.08, AMBER_GLOW: 0.4, BOB_GROW: 0.5 };
const SHOT = {
  KICK_SEC: 0.08, // its flash and knock-back fade this fast
  MIN: 0.05, // below this the shot no longer shows
  SQUASH_X: 0.08,
  SQUASH_Y: 0.1,
  RECOIL_PX: 4,
};
const SULK_TILT_RAD = 0.3;
const SULK_FADE = 0.15; // of the beat: it perks up just before the next one

// Its gun, in drawn size: the shoulder, and the muzzle's reach from it. The
// drawing and the shot both use these, so shots leave the drawn muzzle.
export const SHOULDER = Object.freeze([0.28, 0.12]);
export const GUN_REACH = 0.56;

const smooth = (k) => k * k * (3 - 2 * k);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const mod = (a, n) => ((a % n) + n) % n;
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
// A repeatable 0..1 for a whole number: dice without random()
const roll = (n) => mulberry32(n)();

/**
 * Which way it faces, 1 (right) or -1 (left), for an aim. It turns round only
 * once its target is FACING_DEADZONE past straight above or below it, so its
 * idle jitter doesn't flip it back and forth.
 */
export function nextFacing(facing, aimAngle) {
  const c = Math.cos(aimAngle);
  const dead = CONFIG.GRUNT_LOOK.FACING_DEADZONE;
  if (c > dead) return 1;
  if (c < -dead) return -1;
  return facing === -1 ? -1 : 1;
}

/**
 * Where its shot leaves: the gun's muzzle in its rest pose, on the side it
 * faces. size is its game size.
 */
export function gruntMuzzle(x, y, size, aimAngle, facing) {
  const s = size * CONFIG.GRUNT_LOOK.ART_SCALE;
  return {
    x: x + facing * SHOULDER[0] * s + Math.cos(aimAngle) * GUN_REACH * s,
    y: y + SHOULDER[1] * s + Math.sin(aimAngle) * GUN_REACH * s,
  };
}

/**
 * The grunt's pose for one frame.
 * @param {object} o
 * @param {?number} o.beats - BeatClock's position, total beats plus phase; null without a clock
 * @param {number} o.beatSec - seconds per beat
 * @param {number} o.seed - 0..1, this grunt's own
 * @param {number} o.aimAngle - radians, toward its target
 * @param {number} o.facing - 1 or -1 (nextFacing)
 * @param {number} o.size - its drawn size, px
 * @param {number} [o.warn] - 0..1 through the warning beat before a shot, or -1
 * @param {number} [o.sinceShot] - beats since it fired
 * @param {number} [o.sulk] - 0..1 through the beat it held its fire on, or -1
 */
export function gruntPose({
  beats,
  beatSec,
  seed,
  aimAngle,
  facing,
  size,
  warn = -1,
  sinceShot = Infinity,
  sulk = -1,
}) {
  const L = CONFIG.GRUNT_LOOK;
  const pose = {
    face: facing,
    // The aim in its mirrored frame: past straight up it still points true
    aim: Math.atan2(Math.sin(aimAngle), Math.cos(aimAngle) * facing),
    seed,
    t: 0,
    hop: 0,
    hover: 0,
    squash: 0,
    lean: 0,
    tip: [0, 0],
    blink: false,
    thrust: JET.IDLE,
    jiggle: 0,
    back: 0,
    puff: 1,
    kick: [1, 1],
    recoil: 0,
    flash: 0,
    charge: 0,
    bob: GRUNT_COLORS.bobble,
    bobGlow: 0,
    bobScale: 1,
    droop: 0,
    headTilt: 0,
    gunWobble: 0,
  };
  if (beats === null) return pose; // no beat clock: its rest pose

  const t = beats * beatSec;
  pose.t = t;

  // The dance: a crouch, a hop on the snare, a squash as it lands; a nod on 1 and 3
  const pos = mod(beats, 4); // 0..4 through the bar; 1 and 3 are beats 2 and 4
  const sinceSnare = mod(pos - 1, 2) * beatSec;
  const toSnare = 2 * beatSec - sinceSnare;
  if (toSnare < DANCE.CROUCH_SEC) {
    pose.squash += DANCE.CROUCH_SQUASH * smooth(1 - toSnare / DANCE.CROUCH_SEC);
  }
  if (sinceSnare < DANCE.AIR_SEC) {
    const air = Math.sin((PI * sinceSnare) / DANCE.AIR_SEC);
    pose.hop = L.HOP_PX * air;
    pose.squash -= DANCE.AIR_STRETCH * air;
  } else {
    const u = sinceSnare - DANCE.AIR_SEC;
    pose.squash +=
      DANCE.LAND_SQUASH *
      Math.exp(-u / DANCE.LAND_DECAY_SEC) *
      Math.cos((TWO_PI * u) / DANCE.LAND_WOBBLE_SEC);
  }
  pose.squash +=
    DANCE.NOD_SQUASH * Math.exp(-(mod(pos, 2) * beatSec) / DANCE.NOD_DECAY_SEC);
  const lean = L.LEAN_RAD * Math.cos((PI * pos) / 2); // right on 1, left on 3
  const lag = L.LEAN_RAD * Math.cos((PI * (pos - DANCE.TIP_LAG_BEATS)) / 2);
  pose.tip = [
    (lag - lean) * size * DANCE.TIP_REACH,
    sinceSnare < DANCE.TIP_BOUNCE_END_SEC
      ? DANCE.TIP_BOUNCE_PX *
        Math.exp(-sinceSnare / DANCE.TIP_BOUNCE_DECAY_SEC) *
        Math.cos((TWO_PI * sinceSnare) / DANCE.TIP_BOUNCE_PERIOD_SEC)
      : 0,
  ];
  const phase = mod(pos, 1);
  pose.blink =
    Math.floor(pos) === Math.floor(seed * 4) &&
    phase > DANCE.BLINK_FROM &&
    phase < DANCE.BLINK_TO;

  // The jet idles, puffs on the snare, and now and then coughs
  const seedInt = Math.floor(seed * SEED_STEPS);
  const cough =
    roll(Math.floor(t * JET.COUGH_ROLLS_PER_SEC) * HASH_PRIME + seedInt) <
    L.COUGH_CHANCE;
  const flicker =
    1 -
    JET.FLICKER / 2 +
    JET.FLICKER *
      roll(Math.floor(t * JET.FLICKER_PER_SEC) * HASH_PRIME + seedInt + 1);
  pose.thrust =
    (JET.IDLE + (1 - JET.IDLE) * Math.exp(-sinceSnare / JET.PUFF_DECAY_SEC)) *
    (cough ? JET.COUGH_THRUST : flicker);
  // It floats, sags when its jet coughs, and is never quite level
  pose.hover =
    Math.sin(t * RATE.HOVER + seed * SEED_PHASE.HOVER) * L.HOVER_PX +
    (cough ? JET.COUGH_SAG_PX : 0);
  pose.lean =
    lean +
    L.WANDER_RAD *
      (WANDER_MIX[0] *
        Math.sin(t * RATE.WANDER_SLOW + seed * SEED_PHASE.WANDER_SLOW) +
        WANDER_MIX[1] *
          Math.sin(t * RATE.WANDER_FAST + seed * SEED_PHASE.WANDER_FAST));
  pose.jiggle =
    L.JIGGLE *
    Math.exp(-sinceSnare / JIGGLE_DECAY_SEC) *
    Math.cos(sinceSnare * RATE.JIGGLE);

  // The wind-up, through the beat before a shot: it leans back and puffs up,
  // and its bobbles go amber, then white-hot (a step in brightness too)
  if (warn >= 0) {
    const k = smooth(warn);
    pose.back = -WINDUP.LEAN_RAD * k;
    pose.puff = 1 + WINDUP.PUFF * k;
    pose.bob = warn < 0.5 ? AMBER : HOT;
    pose.bobGlow = warn < 0.5 ? WINDUP.AMBER_GLOW : 1;
    pose.bobScale = 1 + WINDUP.BOB_GROW * warn;
    pose.charge = warn;
  }
  // Its shot: a flash, the gun recoils, and it is rocked back
  const fire =
    sinceShot >= 0 ? Math.exp(-(sinceShot * beatSec) / SHOT.KICK_SEC) : 0;
  if (fire > SHOT.MIN) {
    pose.back -= L.TUMBLE_RAD * fire;
    pose.kick = [1 + SHOT.SQUASH_X * fire, 1 - SHOT.SQUASH_Y * fire];
    pose.recoil = SHOT.RECOIL_PX * fire;
    pose.flash = fire;
    pose.bob = HOT;
    pose.bobGlow = fire;
  }
  // It held its fire after a warning: it sulks for the rest of that beat. A
  // wind-up always wins over a sulk (in play they never share a beat).
  if (sulk >= 0 && warn < 0) {
    pose.droop = smooth(clamp01((1 - sulk) / SULK_FADE));
    pose.bob = mix(GRUNT_COLORS.bobble, SULK_GREY, pose.droop);
    pose.headTilt = SULK_TILT_RAD * pose.droop;
  }
  // The gun wobbles idly, but points true through the wind-up and the shot
  pose.gunWobble =
    warn >= 0 || fire > SHOT.MIN
      ? 0
      : GUN_WOBBLE_RAD *
        Math.sin(t * RATE.GUN_WOBBLE + seed * SEED_PHASE.GUN_WOBBLE);
  return pose;
}
