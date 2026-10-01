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
  SLUMP_RAD: 0.15, // a grunt that doesn't fire on the snare slumps back this far
  // A shot at the very start of the snare counts, despite rounding
  SNARE_SLACK_BEATS: 0.01,
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

  // The dance: every grunt crouches before the snare; on it, one that fires
  // hops, squashes as it lands and puffs its jet in full, the rest do a small
  // hop and slump back. A nod on 1 and 3 for all.
  const pos = mod(beats, 4); // 0..4 through the bar; 1 and 3 are beats 2 and 4
  const sinceSnare = mod(pos - 1, 2) * beatSec;
  const toSnare = 2 * beatSec - sinceSnare;
  const firedThisSnare =
    sinceShot <= sinceSnare / beatSec + DANCE.SNARE_SLACK_BEATS;
  const dance = firedThisSnare ? 1 : L.IDLE_DANCE;
  if (toSnare < DANCE.CROUCH_SEC) {
    pose.squash += DANCE.CROUCH_SQUASH * smooth(1 - toSnare / DANCE.CROUCH_SEC);
  }
  if (sinceSnare < DANCE.AIR_SEC) {
    const air = Math.sin((PI * sinceSnare) / DANCE.AIR_SEC);
    pose.hop = L.HOP_PX * air * dance;
    pose.squash -= DANCE.AIR_STRETCH * air * dance;
    if (!firedThisSnare) pose.back = -DANCE.SLUMP_RAD * air;
  } else {
    const u = sinceSnare - DANCE.AIR_SEC;
    pose.squash +=
      DANCE.LAND_SQUASH *
      dance *
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
        dance *
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
    (JET.IDLE +
      (1 - JET.IDLE) * dance * Math.exp(-sinceSnare / JET.PUFF_DECAY_SEC)) *
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
    dance *
    Math.exp(-sinceSnare / JIGGLE_DECAY_SEC) *
    Math.cos(sinceSnare * RATE.JIGGLE);

  // The wind-up, through the beat before a shot: it leans back and puffs up,
  // and its bobbles go amber, then white-hot (a step in brightness too)
  if (warn >= 0) {
    const k = smooth(warn);
    pose.back -= WINDUP.LEAN_RAD * k;
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

// ---- drawing ---------------------------------------------------------------
// Shape coordinates are fractions of the drawn size s, written inside each
// part's drawing as the other enemy renderers do. Numbers that set behaviour,
// or recur, are named here; _PX ones are pixels.

const OUTLINE_PX = 1.1; // ink round each inked part
const INK = OUTLINE_PX * 2; // added to an inked part's width and height
const PIVOT_Y = 0.05; // it squashes and leans round its middle: nothing to stand on
const SQUASH_WIDEN = 0.8; // a squash widens it by this share of what it loses in height
const NECK_Y = 0.1; // its head tilts round this point when it sulks
const PLATE_SLIP_PX = Object.freeze([-2, 1.6]); // the coral plate's offset, the same on screen for every grunt
const PLATE_ALPHA = 230;
const GLINT_ALPHA = 200;
const GLOW_ALPHA = 120; // the bobbles' glow at its brightest
const GLOW_SIZE = 0.42;
const CHARGE_ALPHA = 200;
const STALK_PX = 1.6;
const SAG_RAD = 0.7; // its gun sags this far when it sulks
const TREMBLE = 0.08; // its frown trembles by this much, more when it sulks
const TREMBLE_RATE = 23; // rad/s
const LAZY_EYE_RATE = 0.8; // rad/s: its small eye wanders round
const DRAW_SEED_PHASE = { JELLY: 9, LAZY_EYE: 9, TREMBLE: 5 };
const FLAME = {
  Y: 0.57, // from its centre, under the nozzle
  LEN: 0.12,
  LEN_PER_THRUST: 0.34,
  W: 0.1,
  W_PER_THRUST: 0.06,
  ALPHA: 190,
  CORE_ALPHA: 230,
  MIN: 0.03, // no flame below this thrust
};
const JELLY = {
  POINTS: 18,
  RX: 0.46,
  RY: 0.42,
  Y: 0.04,
  SAG: 0.12, // heavier at the bottom
  // Ripples round its edge: [lobes, rad/s, amount]
  RIPPLES: [
    [3, 5, 0.045],
    [5, -7, 0.035],
  ],
};
const SPRITE_SCALE = 4; // sprite px per drawn px, so a zoomed grunt stays crisp

// A part with an ink edge: a slightly larger ink copy behind it. Strokes cost
// twice as much on Edward's laptop (measured in the prototype).
function inkOval(g, x, y, w, h, c) {
  g.fill(...GRUNT_COLORS.ink);
  g.ellipse(x, y, w + INK, h + INK);
  g.fill(...c);
  g.ellipse(x, y, w, h);
}
function inkBox(g, x, y, w, h, r, c) {
  g.fill(...GRUNT_COLORS.ink);
  g.rect(x - INK / 2, y - INK / 2, w + INK, h + INK, r + INK / 2);
  g.fill(...c);
  g.rect(x, y, w, h, r);
}

// The parts that never change shape, drawn once into sprites:
// [bounds as [x0, y0, x1, y1] in s, draw(g, s)]
const PARTS = {
  // The coral plate, slipped behind the body like a misaligned print
  plate: [
    [-0.52, -0.46, 0.52, 0.56],
    (g, s) => {
      g.fill(...GRUNT_COLORS.plate, PLATE_ALPHA);
      g.ellipse(0, s * 0.06, s * 0.94, s * 0.9);
    },
  ],
  // The jet's nozzle, under its bottom
  nozzle: [
    [-0.14, 0.4, 0.14, 0.62],
    (g, s) =>
      inkBox(
        g,
        -s * 0.09,
        s * 0.46,
        s * 0.18,
        s * 0.11,
        s * 0.03,
        GRUNT_COLORS.nozzle
      ),
  ],
  // An army helmet far too small, perched on top
  helmet: [
    [-0.34, -0.66, 0.36, -0.3],
    (g, s) => {
      g.translate(s * 0.02, -s * 0.4);
      g.rotate(0.18);
      g.fill(...GRUNT_COLORS.ink);
      g.arc(0, 0, s * 0.44 + INK, s * 0.38 + INK, PI, TWO_PI, g.CHORD);
      g.fill(...GRUNT_COLORS.helmet);
      g.arc(0, 0, s * 0.44, s * 0.38, PI, TWO_PI, g.CHORD);
      inkBox(
        g,
        -s * 0.27,
        -s * 0.03,
        s * 0.56,
        s * 0.07,
        s * 0.03,
        GRUNT_COLORS.brim
      );
      g.fill(...GRUNT_COLORS.badge);
      g.triangle(s * 0.04, -s * 0.15, -s * 0.02, -s * 0.06, s * 0.1, -s * 0.06);
    },
  ],
  // The gun and the nub of a hand holding it, from the shoulder along +x
  gun: [
    [-0.06, -0.16, 0.64, 0.2],
    (g, s) => {
      inkBox(
        g,
        s * 0.06,
        -s * 0.06,
        s * (GUN_REACH - 0.06),
        s * 0.12,
        s * 0.02,
        GRUNT_COLORS.gun
      );
      g.fill(...GRUNT_COLORS.ink);
      g.rect(s * 0.12, s * 0.02, s * 0.08, s * 0.1);
      inkOval(g, s * 0.1, 0, s * 0.19, s * 0.17, GRUNT_COLORS.body);
    },
  ],
};

// p5 instance → { s, parts }: built on the first grunt drawn and shared by
// all. When the drawn size changes (the ?tune slider) they are rebuilt and
// the old ones removed.
const spriteCache = new WeakMap();
function partsFor(p, s) {
  const cached = spriteCache.get(p);
  if (cached?.s === s) return cached.parts;
  for (const part of Object.values(cached?.parts ?? {})) part.g.remove();
  const parts = {};
  for (const [name, [[x0, y0, x1, y1], draw]] of Object.entries(PARTS)) {
    const w = (x1 - x0) * s;
    const h = (y1 - y0) * s;
    const g = p.createGraphics(
      Math.ceil(w * SPRITE_SCALE),
      Math.ceil(h * SPRITE_SCALE)
    );
    g.pixelDensity(1);
    g.noStroke();
    g.scale(SPRITE_SCALE);
    g.translate(-x0 * s, -y0 * s);
    draw(g, s);
    parts[name] = { g, x: x0 * s, y: y0 * s, w, h };
  }
  spriteCache.set(p, { s, parts });
  return parts;
}
const stamp = (p, part) => p.image(part.g, part.x, part.y, part.w, part.h);

// The body's transforms from its centre: float and hop; lean and squash round
// its middle; mirror to face its target; then wind-up and knock-back
function placeBody(p, s, pose) {
  const pivot = s * PIVOT_Y;
  p.translate(0, pose.hover - pose.hop + pivot);
  p.rotate(pose.lean);
  p.scale(1 + pose.squash * SQUASH_WIDEN, 1 - pose.squash);
  p.scale(pose.face, 1);
  p.rotate(pose.back);
  p.scale(pose.puff * pose.kick[0], pose.puff * pose.kick[1]);
  p.translate(0, -pivot);
}

// Where placeBody puts its shoulder: the same transforms applied to that one
// point, innermost first. The gun hangs there but takes none of the body's turns.
function shoulderAt(s, pose) {
  const pivot = s * PIVOT_Y;
  const turn = ([x, y], a) => [
    x * Math.cos(a) - y * Math.sin(a),
    x * Math.sin(a) + y * Math.cos(a),
  ];
  let pt = [
    s * SHOULDER[0] * pose.puff * pose.kick[0],
    (s * SHOULDER[1] - pivot) * pose.puff * pose.kick[1],
  ];
  pt = turn(pt, pose.back);
  pt = [
    pt[0] * pose.face * (1 + pose.squash * SQUASH_WIDEN),
    pt[1] * (1 - pose.squash),
  ];
  pt = turn(pt, pose.lean);
  return [pt[0], pt[1] + pose.hover - pose.hop + pivot];
}

// The jelly's outline: a droplet, heavier at the bottom, always rippling and
// jiggling after each puff; grow pushes it out (for its ink edge)
function jelly(p, s, pose, grow) {
  p.beginShape();
  for (let i = 0; i < JELLY.POINTS; i++) {
    const a = (i / JELLY.POINTS) * TWO_PI;
    let ripple = 1 + pose.jiggle * Math.cos(2 * a);
    for (const [lobes, rate, amount] of JELLY.RIPPLES) {
      ripple +=
        amount *
        Math.sin(lobes * a + pose.t * rate + pose.seed * DRAW_SEED_PHASE.JELLY);
    }
    const r = ripple * (1 + JELLY.SAG * Math.max(0, Math.sin(a)));
    p.vertex(
      Math.cos(a) * (s * JELLY.RX * r + grow),
      s * JELLY.Y + Math.sin(a) * (s * JELLY.RY * r + grow)
    );
  }
  p.endShape(p.CLOSE);
}

// The jet's exhaust, pointing down from (x, y); k is its thrust
function flame(p, x, y, s, k) {
  if (k < FLAME.MIN) return;
  const len = s * (FLAME.LEN + FLAME.LEN_PER_THRUST * k);
  const w = s * (FLAME.W + FLAME.W_PER_THRUST * k);
  p.fill(...GRUNT_COLORS.flame, FLAME.ALPHA * Math.min(1, k + 0.3));
  p.ellipse(x, y + len * 0.5, w, len);
  p.fill(...GRUNT_COLORS.white, FLAME.CORE_ALPHA * Math.min(1, k + 0.2));
  p.ellipse(x, y + len * 0.25, w * 0.5, len * 0.45);
}

// A whiny frown: a dark open mouth turned down, trembling, more when it sulks
function frown(p, s, pose) {
  const tremble =
    1 +
    TREMBLE *
      Math.sin(pose.t * TREMBLE_RATE + pose.seed * DRAW_SEED_PHASE.TREMBLE) *
      (1 + 2 * pose.droop);
  p.fill(...GRUNT_COLORS.ink);
  p.arc(s * 0.2, s * 0.17, s * 0.22 * tremble, s * 0.2, PI, TWO_PI, p.CHORD);
}

// Two eyes of different sizes: the big one looks where it aims, the small
// one wanders off by itself
function eyes(p, s, pose) {
  const lazy = pose.t * LAZY_EYE_RATE + pose.seed * DRAW_SEED_PHASE.LAZY_EYE;
  const list = [
    [0.08, -0.1, 0.26, pose.aim],
    [0.3, -0.04, 0.15, lazy],
  ];
  for (const [x, y, d, look] of list) {
    if (pose.blink) {
      inkOval(
        p,
        s * x,
        s * (y + d * 0.15),
        s * d,
        s * d * 0.3,
        GRUNT_COLORS.lid
      );
      continue;
    }
    inkOval(p, s * x, s * y, s * d, s * d, GRUNT_COLORS.eye);
    p.fill(...GRUNT_COLORS.ink);
    p.ellipse(
      s * (x + Math.cos(look) * d * 0.2),
      s * (y + Math.sin(look) * d * 0.2),
      s * d * 0.45
    );
  }
}

// Antennae from the helmet: the tips lag the dance and splay when it sulks;
// the bobbles carry the wind-up's colours
function antennae(p, s, pose) {
  const splay = pose.droop * s * 0.26;
  const tips = [
    [s * -0.2 + pose.tip[0] - splay, s * -0.78 + pose.tip[1] + splay],
    [s * 0.22 + pose.tip[0] + splay, s * -0.78 + pose.tip[1] + splay],
  ];
  const bases = [
    [s * -0.06, s * -0.56],
    [s * 0.12, s * -0.54],
  ];
  p.stroke(...GRUNT_COLORS.stalk);
  p.strokeWeight(STALK_PX);
  for (let i = 0; i < 2; i++) {
    p.line(bases[i][0], bases[i][1], tips[i][0], tips[i][1]);
  }
  p.noStroke();
  if (pose.bobGlow > 0) {
    p.blendMode(p.ADD);
    p.fill(...pose.bob, GLOW_ALPHA * pose.bobGlow);
    for (const [x, y] of tips) p.ellipse(x, y, s * GLOW_SIZE);
    p.blendMode(p.BLEND);
  }
  const d = s * 0.15 * pose.bobScale;
  for (const [x, y] of tips) inkOval(p, x, y, d, d, pose.bob);
}

// The gun, from the shoulder along its aim; it recoils, charges and flashes
function gunArm(p, s, pose, gun) {
  p.rotate(pose.aim + pose.droop * SAG_RAD + pose.gunWobble);
  p.translate(-pose.recoil, 0);
  stamp(p, gun);
  const muzzle = s * GUN_REACH;
  if (pose.charge <= 0 && pose.flash <= 0) return;
  p.blendMode(p.ADD);
  if (pose.charge > 0) {
    p.fill(...pose.bob, CHARGE_ALPHA);
    p.ellipse(muzzle, 0, s * (0.08 + 0.16 * pose.charge));
  }
  if (pose.flash > 0) {
    const f = pose.flash;
    p.fill(...GRUNT_COLORS.flash, 230 * f);
    p.ellipse(muzzle + s * 0.1, 0, s * 0.7 * f, s * 0.45 * f);
    p.fill(...GRUNT_COLORS.white, 255 * f);
    p.ellipse(muzzle + s * 0.06, 0, s * 0.3 * f);
  }
  p.blendMode(p.BLEND);
}

/**
 * Draw a grunt in a pose (gruntPose), at the current origin, its centre.
 * s is its drawn size, px. Changes p's transform: wrap it in push/pop.
 */
export function drawGrunt(p, s, pose) {
  const parts = partsFor(p, s);
  p.noStroke();
  // The plate's slip is on screen, so it goes before the body's transforms
  p.push();
  p.translate(PLATE_SLIP_PX[0], PLATE_SLIP_PX[1]);
  placeBody(p, s, pose);
  stamp(p, parts.plate);
  p.pop();

  p.push();
  placeBody(p, s, pose);
  flame(p, 0, s * FLAME.Y, s, pose.thrust);
  stamp(p, parts.nozzle);
  p.fill(...GRUNT_COLORS.ink);
  jelly(p, s, pose, OUTLINE_PX);
  p.fill(...GRUNT_COLORS.body);
  jelly(p, s, pose, 0);
  p.fill(...GRUNT_COLORS.belly);
  p.ellipse(s * 0.04, s * 0.18, s * 0.5, s * 0.34);
  p.fill(...GRUNT_COLORS.white, GLINT_ALPHA);
  p.ellipse(-s * 0.22, -s * 0.2, s * 0.11, s * 0.07);
  frown(p, s, pose);

  // Eyes, tear, antennae and helmet tilt together when it sulks
  p.push();
  p.translate(0, -s * NECK_Y);
  p.rotate(pose.headTilt);
  p.translate(0, s * NECK_Y);
  eyes(p, s, pose);
  if (pose.droop > 0) {
    p.fill(...GRUNT_COLORS.tear, 255 * pose.droop);
    p.ellipse(
      s * 0.36,
      s * (0.04 + 0.12 * (1 - pose.droop)),
      s * 0.07,
      s * 0.1
    );
  }
  antennae(p, s, pose);
  stamp(p, parts.helmet);
  p.pop();
  p.pop();

  // The gun hangs from the shoulder but takes none of the body's turns, so it
  // points where its shot goes
  const [sx, sy] = shoulderAt(s, pose);
  p.translate(sx, sy);
  p.scale(pose.face, 1);
  gunArm(p, s, pose, parts.gun);
}
