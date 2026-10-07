/**
 * How a grunt dies: it bursts like a water balloon. Ported from the `balloon`
 * variant of docs/superpowers/specs/2026-10-05-death-studies/deaths-grunt.js
 * (git-ignored); the spec is
 * docs/superpowers/specs/2026-10-07-deaths-design.md.
 *
 * From the kill until its pop it hangs frozen where it died, swelling, its
 * eyes going wide. On the pop (the next eighth note, as heard) its jelly
 * flashes out in a ring of pop dashes and breaks into a few blobs and drops;
 * its helmet spins off, and its two eyes float off still looking two ways,
 * blink once each, and shrink away.
 *
 * Everything runs on the audio clock, read when drawn, so the picture stays
 * with its sound through hitstop, and a pause (which suspends the clock)
 * holds both. Pieces drift in space: no gravity, only drag, worked out from
 * time alone. Its parts are the living grunt's (GruntRenderer.js).
 */
import { CONFIG } from '../config.js';
import { mulberry32, smooth, clamp01, PI, TWO_PI } from '../mathUtils.js';
import { stamp } from './spriteCache.js';
import {
  GRUNT_COLORS,
  HEAD_AT,
  JELLY,
  OUTLINE_PX,
  GLINT_ALPHA,
  SHOULDER,
  mix,
  gruntParts,
  placeBody,
  bodyPoint,
  jelly,
  eye,
  antennae,
  drawGrunt,
} from './GruntRenderer.js';

const C = GRUNT_COLORS;
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const GLINT_STYLE = `rgba(255,255,255,${GLINT_ALPHA / 255})`;
// Drifting in space: no gravity, only drag. Distance after t for speed v.
const drift = (v, tau, t) => v * tau * (1 - Math.exp(-t / tau));

// The frozen moment before the pop: it swells, its eyes go wide with
// shrinking pupils, and the hit's white flash fades off it
const WAIT = {
  SWELL: 0.1,
  EYE: 0.3,
  PUPIL: 0.45,
  PALE: 0.6,
  PALE_SEC: 0.07,
  WOBBLE: 0.08,
  WOBBLE_RATE: 9,
};
// The pop: the jelly's shape flashes out in added light as it lets go
const SPLASH = { SEC: 0.06, SWELL: 1.1, GROW: 0.35, JIGGLE: 0.12, ALPHA: 0.8 };
const SPLASH_WHITE = 0.4;
// ...inside a ring of short white dashes, from and to these shares of its size
const POP = { SEC: 0.13, LINES: 7, FROM: 0.5, TO: 0.95, LEN: 0.45, PX: 1.6 };
// The helmet spins round its middle, from the helmet's origin (in s)
const HELMET_MID = [0, -0.08];
const FLOP = { PX: 0.06, RATE: 19, SEC: 0.5 }; // its stalks wobble as it flies

// What it flings, all drifting in space
const BURST = {
  // Jelly: three or four real blobs (sizes of its drawn size) in a fan round
  // the blow, and a few small drops sprayed wider. At 1:1 smaller ones read as dust.
  BLOBS: [3, 4],
  BLOB_R: [0.16, 0.21],
  BLOB_V: [35, 70], // px/s: heavy, they don't go far
  BLOB_FAN: 1.25, // radians either side of the blow
  BLOB_JITTER: 0.25, // radians, each
  BLOB_OFF: [0.12, 0.22], // where each starts, from its centre (of s)
  BLOB_LIFE: [0.75, 0.95], // s, times linger
  BLOB_HOLD: 0.45, // they keep their size through this share of their life, then shrink
  DROPS: 3,
  DROP_R: [0.06, 0.09],
  DROP_V: [70, 120],
  DROP_OFF: 0.3, // of s, at most
  DROP_SLOW: 0.45, // the ones sprayed furthest off the blow are this much slower
  DROP_LIFE: [0.35, 0.6],
  DROP_TAU: 0.3, // drag: they slow with this time constant
  WOBBLE: 0.12, // they wobble as they fly, dying away
  WOBBLE_RATE: 26,
  GONE_PX: 0.3, // a drop this small is gone
  GLINT_MIN_PX: 2.5, // blobs this big get a glint, like the body's
  STRETCH_PER_V: 1 / 180, // fast drops stretch along their way
  SPREAD: 2.2, // the drops' spray round the blow: higher keeps them nearer it
  HELMET_V: 105,
  HELMET_V_K: [0.85, 1.1],
  HELMET_UP: 0.9, // it flies off toward the body's top this much
  HELMET_TAU: 0.55,
  HELMET_SPIN: [10, 16], // rad/s
  HELMET_SPIN_TAU: 1.4,
  HELMET_LIFE: 1.1,
  EYE_V: [60, 95], // the big eye is the heavier
  EYE_SPLIT: [0.85, 1.25], // radians either side of the blow
  EYE_SPLIT_K: [0.8, 1.2],
  EYE_ROLL: [3, 5], // rad/s: the small one's pupil rolls round
  EYE_TAU: 0.5,
  EYE_LIFE: [1.25, 1.4], // so they blink out of step
  // One slow blink each, a last look round, then they shrink away
  BLINK_BEFORE: 0.7, // s before the end, but never before the pop
  BLINK: [0.14, 0.08, 0.14], // closing, closed, opening
  EYE_GONE_SEC: 0.12,
  EYE_GONE_PX: 1,
  EYE_PUPIL: 0.62, // on the dark sky a full-size pupil reads as a crescent
  EYE_GROW: 1.1, // popped-out eyes, a little bigger
  GUN_V: 30,
  GUN_TAU: 0.4,
  GUN_TURN: 0.8, // it drifts off this far round from the blow
  GUN_SPIN: 4,
  GUN_LIFE: 0.4, // its fade isn't stretched by linger
  BLAST: 1.3, // a blast flings everything this much harder
  SHRINK_SEC: 0.22, // the helmet shrinks away over this, at the end
};
const SEED_STEPS = 1e6;

/**
 * Everything it flings, worked out once from its last pose. d: { size, pose,
 * dir, blast, seed, linger }. Coordinates are px from where it died.
 */
export function makeBurst(d) {
  const s = d.size;
  const pose = d.pose;
  const rand = mulberry32(Math.floor(d.seed * SEED_STEPS));
  const r = (lo, hi) => lo + (hi - lo) * rand();
  const hard = d.blast ? BURST.BLAST : 1;
  const L = d.linger;
  const centre = bodyPoint(s, pose, 0, JELLY.Y);
  const drops = [];
  const blobs = rand() < 0.5 ? BURST.BLOBS[0] : BURST.BLOBS[1];
  for (let i = 0; i < blobs; i++) {
    // fanned evenly round the blow, so they don't sit on one another
    const a =
      d.dir +
      BURST.BLOB_FAN * ((2 * i) / (blobs - 1) - 1) +
      r(-BURST.BLOB_JITTER, BURST.BLOB_JITTER);
    const off = s * r(...BURST.BLOB_OFF);
    drops.push({
      x: centre[0] + Math.cos(a) * off,
      y: centre[1] + Math.sin(a) * off,
      a,
      v: r(...BURST.BLOB_V) * hard,
      r: s * r(...BURST.BLOB_R),
      life: r(...BURST.BLOB_LIFE) * L,
      hold: BURST.BLOB_HOLD,
      fill: css(i === 1 ? C.belly : C.body),
      wob: r(0, TWO_PI),
    });
  }
  for (let i = 0; i < BURST.DROPS; i++) {
    const u = r(-1, 1);
    const a = d.dir + PI * Math.sign(u) * Math.abs(u) ** BURST.SPREAD;
    const off = s * BURST.DROP_OFF * r(0.3, 1);
    drops.push({
      x: centre[0] + Math.cos(a) * off,
      y: centre[1] + Math.sin(a) * off,
      a,
      v: r(...BURST.DROP_V) * (1 - BURST.DROP_SLOW * Math.abs(u)) * hard,
      r: s * r(...BURST.DROP_R),
      life: r(...BURST.DROP_LIFE) * L,
      hold: 0,
      fill: css(C.body),
      wob: r(0, TWO_PI),
    });
  }
  const up = pose.lean - PI / 2; // the body's top
  const hAt = bodyPoint(s, pose, ...HEAD_AT.HELMET, true);
  const hDir = Math.atan2(
    Math.sin(d.dir) + BURST.HELMET_UP * Math.sin(up),
    Math.cos(d.dir) + BURST.HELMET_UP * Math.cos(up)
  );
  const side = rand() < 0.5 ? -1 : 1;
  const out = {
    drops,
    helmet: {
      x: hAt[0],
      y: hAt[1],
      a: hDir,
      v: BURST.HELMET_V * hard * r(...BURST.HELMET_V_K),
      // How far round the living drawing had it: lean, then mirrored back and tilt
      turn: pose.lean + pose.face * (pose.back + pose.headTilt),
      spin: side * r(...BURST.HELMET_SPIN),
      face: pose.face,
      life: BURST.HELMET_LIFE * L,
      bob: pose.bob,
    },
    eyes: [],
    gun: null,
  };
  const split = r(...BURST.EYE_SPLIT);
  HEAD_AT.EYES.forEach(([x, y, dd], i) => {
    const [ex, ey] = bodyPoint(s, pose, x, y, true);
    const life = BURST.EYE_LIFE[i] * L;
    out.eyes.push({
      x: ex,
      y: ey,
      d: s * dd * BURST.EYE_GROW,
      a: d.dir + (i ? -side : side) * split * r(...BURST.EYE_SPLIT_K),
      v: BURST.EYE_V[i] * hard,
      life,
      blinkAt: Math.max(0, life - BURST.BLINK_BEFORE),
      // two ways still: the big one keeps staring where it aimed, the small
      // one looks the other way and rolls round
      look:
        Math.atan2(Math.sin(pose.aim), Math.cos(pose.aim) * pose.face) +
        (i ? PI : 0),
      roll: i ? r(...BURST.EYE_ROLL) * -side : 0,
    });
  });
  const [gx, gy] = bodyPoint(s, pose, SHOULDER[0], SHOULDER[1]);
  out.gun = {
    x: gx,
    y: gy,
    a: d.dir + side * BURST.GUN_TURN,
    v: BURST.GUN_V * hard,
    face: pose.face,
    aim: pose.aim + pose.gunWobble,
    spin: -side * BURST.GUN_SPIN,
    life: BURST.GUN_LIFE,
  };
  return out;
}

// Drops as plain canvas ellipses: all the ink first, then all the jelly, so
// drops that touch merge into one splash; big ones get a glint. Returns
// whether any are left.
function drawDrops(p, drops, t) {
  const ctx = p.drawingContext;
  const live = [];
  for (const q of drops) {
    if (t >= q.life) continue;
    const u = t / q.life;
    const rr = q.r * (1 - smooth(clamp01((u - q.hold) / (1 - q.hold)))) ** 0.8;
    if (rr < BURST.GONE_PX) continue;
    const v = q.v * Math.exp(-t / BURST.DROP_TAU);
    const go = drift(q.v, BURST.DROP_TAU, t);
    const wob =
      BURST.WOBBLE * Math.sin(t * BURST.WOBBLE_RATE + q.wob) * (1 - u);
    const stretch = 1 + v * BURST.STRETCH_PER_V;
    live.push([
      q.x + Math.cos(q.a) * go,
      q.y + Math.sin(q.a) * go,
      rr * stretch * (1 + wob),
      (rr * (1 - wob)) / Math.sqrt(stretch),
      q.a,
      q.fill,
    ]);
  }
  if (!live.length) return false;
  ctx.save();
  ctx.fillStyle = css(C.ink);
  for (const [x, y, rx, ry, a] of live) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx + OUTLINE_PX, ry + OUTLINE_PX, a, 0, TWO_PI);
    ctx.fill();
  }
  for (const [x, y, rx, ry, a, fill] of live) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, a, 0, TWO_PI);
    ctx.fill();
  }
  // The glint sits up and to the left, where the body's does: the light is on screen
  ctx.fillStyle = GLINT_STYLE;
  for (const [x, y, rx, ry] of live) {
    const rr = Math.min(rx, ry);
    if (rr < BURST.GLINT_MIN_PX) continue;
    ctx.beginPath();
    ctx.ellipse(
      x - rr * 0.38,
      y - rr * 0.42,
      rr * 0.34,
      rr * 0.22,
      -0.5,
      0,
      TWO_PI
    );
    ctx.fill();
  }
  ctx.restore();
  return true;
}

// The helmet and its antennae, tumbling; t from the pop. Returns whether it shows.
function drawHelmet(p, s, h, t) {
  if (t >= h.life) return false;
  const go = drift(h.v, BURST.HELMET_TAU, t);
  const turn = h.turn + drift(h.spin, BURST.HELMET_SPIN_TAU, t);
  const k =
    1 - smooth(clamp01((t - (h.life - BURST.SHRINK_SEC)) / BURST.SHRINK_SEC));
  const flop = Math.sin(t * FLOP.RATE) * s * FLOP.PX * Math.exp(-t / FLOP.SEC);
  const [tipA, tipB] = HEAD_AT.STALK_TIPS;
  p.push();
  p.translate(h.x + Math.cos(h.a) * go, h.y + Math.sin(h.a) * go);
  // Spin round its middle, mirrored as it faced, shrinking at the end
  p.translate(s * HELMET_MID[0], s * HELMET_MID[1]);
  p.rotate(turn);
  p.scale(h.face * k, k);
  p.translate(-s * HELMET_MID[0], -s * HELMET_MID[1]);
  // The living grunt's helmet and antennae, drawn from its origin
  p.translate(-s * HEAD_AT.HELMET[0], -s * HEAD_AT.HELMET[1]);
  antennae(
    p,
    s,
    [
      [s * tipA[0] - flop, s * tipA[1] + flop],
      [s * tipB[0] + flop, s * tipB[1] + flop],
    ],
    h.bob
  );
  stamp(p, gruntParts(p, s).helmet);
  p.pop();
  return true;
}

// How shut an eye is, 0..1, t seconds after its slow blink began
function blinkAt(t) {
  const [close, hold, open] = BURST.BLINK;
  if (t <= 0 || t >= close + hold + open) return 0;
  if (t < close) return smooth(t / close);
  if (t < close + hold) return 1;
  return 1 - smooth((t - close - hold) / open);
}

function drawEyes(p, eyes, t) {
  let any = false;
  for (const e of eyes) {
    if (t >= e.life) continue;
    any = true;
    const go = drift(e.v, BURST.EYE_TAU, t);
    const k =
      1 -
      smooth(clamp01((t - (e.life - BURST.EYE_GONE_SEC)) / BURST.EYE_GONE_SEC));
    if (e.d * k < BURST.EYE_GONE_PX) continue;
    eye(
      p,
      1,
      e.x + Math.cos(e.a) * go,
      e.y + Math.sin(e.a) * go,
      e.d * k,
      e.look + e.roll * t,
      BURST.EYE_PUPIL,
      blinkAt(t - e.blinkAt)
    );
  }
  return any;
}

function drawGun(p, s, g, t) {
  if (t >= g.life) return false;
  const go = drift(g.v, BURST.GUN_TAU, t);
  p.push();
  p.drawingContext.globalAlpha *= 1 - smooth(t / g.life);
  p.translate(g.x + Math.cos(g.a) * go, g.y + Math.sin(g.a) * go);
  p.scale(g.face, 1);
  p.rotate(g.aim + g.spin * t);
  stamp(p, gruntParts(p, s).gun);
  p.pop();
  return true;
}

// The cartoon pop: short white dashes flying out round its middle
function popLines(p, s, t, turn) {
  if (t >= POP.SEC) return;
  const u = t / POP.SEC;
  const r0 = s * POP.FROM;
  const r1 = s * POP.TO;
  const ra = r0 + (r1 - r0) * Math.sqrt(u);
  const rb = ra + (r1 - r0) * POP.LEN * (1 - u);
  const y = s * JELLY.Y;
  p.stroke(...C.white, 255 * (1 - u * u));
  p.strokeWeight(POP.PX);
  for (let i = 0; i < POP.LINES; i++) {
    const a = turn + (i / POP.LINES) * TWO_PI;
    p.line(
      Math.cos(a) * ra,
      y + Math.sin(a) * ra,
      Math.cos(a) * rb,
      y + Math.sin(a) * rb
    );
  }
  p.noStroke();
}

/**
 * A grunt's death, for ExplosionManager's fragmentExplosions: its update()
 * and draw(p), and `active` false once it is all gone.
 */
export class GruntDeath {
  /**
   * @param {object} o
   * @param {number} o.x where it died (its centre)
   * @param {number} o.y
   * @param {number} o.size its drawn size, px
   * @param {object} o.pose its last pose (gruntPose)
   * @param {number} o.dir the way the blow sent it, rad
   * @param {boolean} o.blast a blast's blow, which flings it harder
   * @param {number} o.seed 0..1, its own
   * @param {number} o.diedAt the audio clock at the kill, s
   * @param {number} o.popsAt when its pop is heard, on the audio clock, s
   * @param {() => number} o.now the audio clock, s
   */
  constructor({ x, y, size, pose, dir, blast, seed, diedAt, popsAt, now }) {
    Object.assign(this, { x, y, size, pose, dir, blast, seed });
    Object.assign(this, { diedAt, popsAt, now });
    this.linger = CONFIG.DEATHS.LINGER;
    this.burst = null;
    this.active = true;
  }

  // It runs on the audio clock, as it is drawn
  update() {}

  draw(p) {
    if (!this.active) return;
    const t = this.now() - this.popsAt;
    p.push();
    p.translate(this.x, this.y);
    p.noStroke();
    if (t < 0) this.drawWait(p);
    else if (!this.drawPop(p, t)) this.active = false;
    p.pop();
  }

  // Before the pop: frozen where it died, swelling, eyes going wide
  drawWait(p) {
    const since = this.now() - this.diedAt;
    const wait = this.popsAt - this.diedAt;
    const u = wait > 0 ? clamp01(since / wait) : 1;
    const k = smooth(u);
    const pose = {
      ...this.pose,
      t: this.pose.t + since,
      puff: this.pose.puff * (1 + WAIT.SWELL * k),
      jiggle: WAIT.WOBBLE * Math.sin(u * WAIT.WOBBLE_RATE),
    };
    drawGrunt(p, this.size, pose, {
      eye: 1 + WAIT.EYE * k,
      pupil: 1 - WAIT.PUPIL * k,
      pale: WAIT.PALE * Math.exp(-since / WAIT.PALE_SEC),
    });
  }

  // From the pop: the splash, the pieces and the dashes. False once all gone.
  drawPop(p, t) {
    const s = this.size;
    this.burst ??= makeBurst(this);
    if (t < SPLASH.SEC) {
      const u = t / SPLASH.SEC;
      const pose = {
        ...this.pose,
        t: this.pose.t + t,
        puff: this.pose.puff * (SPLASH.SWELL + SPLASH.GROW * u),
        jiggle: SPLASH.JIGGLE,
      };
      p.push();
      // Added light, so as it fades it never darkens the sky behind
      p.drawingContext.globalCompositeOperation = 'lighter';
      p.drawingContext.globalAlpha *= SPLASH.ALPHA * (1 - u) ** 3;
      placeBody(p, s, pose);
      p.fill(...mix(C.body, C.white, SPLASH_WHITE * (1 - u)));
      jelly(p, s, pose, 0);
      p.pop();
    }
    const b = this.burst;
    const drops = drawDrops(p, b.drops, t);
    const gun = drawGun(p, s, b.gun, t);
    const helmet = drawHelmet(p, s, b.helmet, t);
    const eyes = drawEyes(p, b.eyes, t);
    popLines(p, s, t, this.seed * TWO_PI);
    return drops || gun || helmet || eyes;
  }
}
