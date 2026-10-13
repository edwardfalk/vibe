/**
 * How the bassist dies, Ink cloud (docs/superpowers/specs/2026-10-13-bassist-death-design.md),
 * ported from the bassist death studies page's death-ink.js
 * (docs/superpowers/specs/2026-10-12-bassist-death-studies/, git-ignored).
 * From the port on, the numbers here are the authority.
 *
 * Like a startled squid, on his death's start he blurts two jets of dark,
 * faintly glowing ink out of his slits, back toward the hero, and the blurt
 * pops his scroll off his neck. He shrinks away in the ink; its puffs roll,
 * swell, spread apart and thin from the edges. His scroll escapes the other
 * way like a squid: it tumbles out, then jets on his lets (jet, glide, jet),
 * its lure blinking on each, a little puff of ink behind it. On its last jet
 * it fizzles: its lure sputters out with his last note, it goes limp and
 * fades.
 *
 * Frames: the cloud and the scroll's flight are in screen px from where he
 * died; his parts are in his frame (+x along his aim, y down = his right),
 * from BassistRenderer.js's shape, times his scale. Everything is worked
 * out from the death's age and his seed; `d.state` caches the puffs and the
 * way he flees (fixed at its first frame of ink, so his path doesn't swing
 * as the hero moves).
 */
import {
  clamp01,
  smooth,
  easeOut,
  env,
  drift,
  mulberry32,
} from '../mathUtils.js';
import {
  drawBassist,
  traceScroll,
  paintScroll,
  newScrollCoil,
  SCROLL_N,
  BASSIST_SHAPE as G,
  BASSIST_COLORS as C,
  NOTE_COLORS,
  rgb,
} from './BassistRenderer.js';

const PI = Math.PI;
const TAU = 2 * PI;
const wrapPi = (a) => a - TAU * Math.round(a / TAU);
const HIT_TAU_SEC = 0.08; // the killing hit's flash, as his pose's hit fades

// The blurt and his body (s)
const BODY = {
  FADE_FROM: 0.03, // he shows through the first puffs, then he's gone
  FADE_SEC: 0.1,
  PUFFED: 0.1, // swollen as he blurts...
  PUFF_TAU: 0.05,
  SQUEEZE: 0.3, // ...then squeezed small as the ink leaves him
  SQUEEZE_SEC: 0.18,
  CLIP_BACK: 60, // his frame, px: the box he is drawn in, cut at his neck's end
  CLIP_HALF: 40,
  CLIP_EDGE: 0.3,
};

// The ink. Two puffs over his body roll back off him; from each slit a jet
// of puffs, fired one after another, back toward the hero and out to its
// side (px, s, rad)
const CLOUD = {
  OUTER: [44, 32, 82], // thin ink: dark violet, lifted so it shows on deep space
  CORE: [22, 15, 40], // dense ink, in the middle of each puff
  FRINGE: NOTE_COLORS.glow, // a faint glow round it: his light, in the ink
  OUTER_A: 0.8,
  CORE_A: 0.7,
  FRINGE_A: 0.3,
  FRINGE_PX: 2,
  BODY: [
    { x: -10, R: 12.5, v: 70, thinAt: 0.2 },
    { x: 7, R: 9.5, v: 85, thinAt: 0.25 },
  ],
  BODY_TAU: 0.35,
  BODY_TURN: 0.3, // rad: the body's puffs leave a little off straight back
  JET_N: 5,
  JET_EVERY: 0.022, // s between a jet's puffs
  JET_V: 440, // px/s, its head; each next puff slower by
  JET_V_STEP: 50,
  JET_V_SPREAD: 0.1, // and each a little faster or slower than that
  JET_TAU: 0.13, // they slow
  JET_SIDE: 0.12, // a jet leaves its slit this much sideways, the rest back
  JET_SPLAY: 0.08, // rad: the two jets apart, so they merge in one plume
  JET_R: [8.5, 6], // its head's size to its tail's
  JET_THIN: [0.3, 0.55], // s: its head thins first
  JET_THIN_SPREAD: 0.08,
  JITTER: 0.12,
  REACH: 0.35, // of the way to the hero: the jets' glide is scaled to it...
  REACH_MIN: 0.3, // ...between these shares of their full glide
  START_R: 0.3, // of its size, out of the slit
  MIN_LOBE_PX: 0.3, // a lobe smaller than this isn't drawn
  GROW_SEC: 0.18,
  SWELL: [0.15, 0.6], // per s: they keep swelling as they roll, each its own
  ROLL_ON: [8, 22], // px/s: and keep rolling on outward, each its own, slowing
  ROLL_ON_TAU: 1,
  LAT_V: [3, 10], // px/s: each drifts off its line, its own way
  LAT_TAU: 0.6,
  ROLL: [4, 7], // rad/s: the two lobes of each puff roll round
  ROLL_TAU: 0.6,
  LOBE: [0.72, 0.6], // the lobes' sizes, of the puff's
  LOBE_AT: 0.32, // the lobes' distance from its middle, of its size...
  LOBE_APART: 0.25, // ...and this much more as it thins: it comes apart
  EDGE_PX: 2.5, // the thin ink round the dense, while it's thick...
  EDGE_GROW: 4, // ...growing by this as it thins
  THIN_SEC: 0.45, // times linger: each puff's thinning (the dense goes)
  OUT_AT: 0.45, // s, times linger: then the thin ink fades...
  OUT_SEC: 0.8, // ...over this
  SEED: 77, // his seed's stream for the puffs
};
// A few specks of his light, carried round by the ink's roll
const SPECK = {
  ON: [0, 3, 8, 11],
  R: 0.8,
  HALO: 2.4,
  HALO_A: 0.3,
  A: 0.8,
  TWINKLE: 9,
  OUT: 1.3, // of the lobes' distance from its puff's middle
};

// His scroll, escaping away from the hero: a jet as it pops off, one on
// each of his lets, the last a fizzle (px/s, s)
const FLY = {
  SIZE: 1.3, // a cartoon of his scroll, so it reads at game size
  GROW_SEC: 0.15,
  JETS: [320, 150, 70], // the pop (across and out of the ink), his lets, the fizzle
  TAU: 0.16, // each glides to a stop
  TURN_SEC: 0.4, // it tumbles round once to head away
  STRETCH: 0.3, // a jet stretches it along its way...
  SQUASH: 0.18, // ...and thins it
  JET_TAU: 0.12,
  COIL: 0.7, // gliding, its coil
  PUMP: 0.3, // curled tighter on a jet
  LIMP: 0.2, // and after its fizzle, unrolled
  LIMP_SEC: 0.35,
  LURE: 0.45, // gliding
  KICK: 0.2, // pulsing on the heard kick
  BLINK: 1.1, // on each jet
  BLINK_TAU: 0.09,
  SPUTTER_SEC: 0.2, // its fizzle: the lure sputters out
  SPUTTER_HZ: 14,
  SPUTTER_ON: 1.2,
  SPUTTER_OFF: 0.15,
  EDGE: 0.6, // its lit edge brightens with its lure: this times...
  EDGE_FROM: 0.4, // ...this plus the lure, to 1
  HALO_GROW: 0.3, // its lure's halo grows by this past full
  FADE_AFTER: 0.12, // s after the fizzle, it fades...
  FADE_SEC: 0.4, // ...over this, times linger
  PUFF_R: [1.5, 5], // the puff each jet leaves, px
  PUFF_LAST: 0.7, // the fizzle's smaller
  PUFF_GROW: 0.25,
  PUFF_SEC: 0.45,
  PUFF_FADE_FROM: 0.1,
  ROOT: 7, // px behind its middle, where the puff leaves
  SEED: 5, // his seed's stream for which way it tumbles
  UNCURL: 0.4, // his scroll at the kill: opened by his aim...
  DYING: 0.3, // ...and curled by his trembling
  DYING_SEC: 0.25,
};
// The way he flees (away from the hero) and how far his ink may reach: the
// hero's place is kept from the death's first frame of ink; with none, or
// within 20 px, the scroll flees along the blow and the ink takes its
// shortest reach
const NEAR_PX = 20;
function escape(d) {
  const h = d.hero ? Math.hypot(d.hero.x, d.hero.y) : 0;
  return {
    E: h > NEAR_PX ? Math.atan2(-d.hero.y, -d.hero.x) : d.dir,
    hero: h,
  };
}

// The puffs, once, from his seed (screen px from where he died)
function makeInk(d, esc) {
  const rand = mulberry32(Math.floor(d.seed * 1e6) + CLOUD.SEED);
  const r = (lo, hi) => lo + (hi - lo) * rand();
  const ca = Math.cos(d.aim);
  const sa = Math.sin(d.aim);
  const sc = d.scale;
  const scr = (x, y) => [(x * ca - y * sa) * sc, (x * sa + y * ca) * sc];
  const back = esc.E + PI;
  const reach = Math.max(
    CLOUD.REACH_MIN,
    Math.min(1, (CLOUD.REACH * esc.hero) / (CLOUD.JET_V * CLOUD.JET_TAU))
  );
  const puffs = [];
  const add = (x, y, ang, v, tau, te, R, thinAt) => {
    const [x0, y0] = scr(x, y);
    const side = rand() < 0.5 ? -1 : 1;
    puffs.push({
      x0,
      y0,
      ca: Math.cos(ang),
      sa: Math.sin(ang),
      v,
      tau,
      te,
      R,
      thinAt,
      vl: side * r(...CLOUD.LAT_V),
      phi: r(0, TAU),
      w: -side * r(...CLOUD.ROLL),
      sw: r(...CLOUD.SWELL),
      on: r(...CLOUD.ROLL_ON),
    });
  };
  for (const b of CLOUD.BODY) {
    const turn = r(-CLOUD.BODY_TURN, CLOUD.BODY_TURN);
    add(b.x, 0, back + turn, b.v * reach, CLOUD.BODY_TAU, 0, b.R, b.thinAt);
  }
  const slit = G.fhole;
  for (const s of [-1, 1]) {
    const n = d.aim + (s * PI) / 2; // out of this slit
    const jet =
      Math.atan2(
        Math.sin(back) + CLOUD.JET_SIDE * Math.sin(n),
        Math.cos(back) + CLOUD.JET_SIDE * Math.cos(n)
      ) +
      s * CLOUD.JET_SPLAY;
    for (let k = 0; k < CLOUD.JET_N; k++) {
      const u = k / (CLOUD.JET_N - 1);
      // drawn in this order, the page's: its way, its speed, its thinning
      const way = jet + r(-CLOUD.JITTER, CLOUD.JITTER);
      const spread = r(1 - CLOUD.JET_V_SPREAD, 1 + CLOUD.JET_V_SPREAD);
      add(
        slit.x,
        s * slit.y,
        way,
        (CLOUD.JET_V - CLOUD.JET_V_STEP * k) * reach * spread,
        CLOUD.JET_TAU,
        k * CLOUD.JET_EVERY,
        CLOUD.JET_R[0] + (CLOUD.JET_R[1] - CLOUD.JET_R[0]) * u,
        CLOUD.JET_THIN[0] +
          (CLOUD.JET_THIN[1] - CLOUD.JET_THIN[0]) * u +
          r(0, CLOUD.JET_THIN_SPREAD)
      );
    }
  }
  return { puffs };
}

// Each puff's two lobes now, outer and dense radius, into these: two lobes
// for each of the puffs
const MAXL = 2 * (CLOUD.BODY.length + 2 * CLOUD.JET_N);
const LX = new Float32Array(MAXL);
const LY = new Float32Array(MAXL);
const LR = new Float32Array(MAXL);
const LC = new Float32Array(MAXL);
let nL = 0;
let kMean = 1; // how thick the ink still is, all of it
function placeInk(d, ink, age) {
  nL = 0;
  const L = d.linger;
  let kSum = 0;
  let kN = 0;
  for (const q of ink.puffs) {
    const t = age - q.te;
    q.live = t > 0;
    if (!q.live) continue;
    const along = drift(q.v, q.tau, t) + drift(q.on, CLOUD.ROLL_ON_TAU, t);
    const lat = drift(q.vl, CLOUD.LAT_TAU, t);
    const x = q.x0 + q.ca * along - q.sa * lat;
    const y = q.y0 + q.sa * along + q.ca * lat;
    const k = 1 - smooth(clamp01((age - q.thinAt * L) / (CLOUD.THIN_SEC * L)));
    kSum += k;
    kN++;
    const grow = easeOut(clamp01(t / CLOUD.GROW_SEC));
    const R =
      q.R * (CLOUD.START_R + (1 - CLOUD.START_R) * grow) * (1 + q.sw * t);
    const phi = q.phi + q.w * drift(1, CLOUD.ROLL_TAU, t);
    const rho = R * (CLOUD.LOBE_AT + CLOUD.LOBE_APART * (1 - k));
    const cx = Math.cos(phi) * rho;
    const cy = Math.sin(phi) * rho;
    q.sx = x + cx * SPECK.OUT; // its speck, carried round by the roll
    q.sy = y + cy * SPECK.OUT;
    for (let j = 0; j < 2; j++) {
      const sg = j ? -1 : 1;
      LX[nL] = x + sg * cx;
      LY[nL] = y + sg * cy;
      LR[nL] = R * CLOUD.LOBE[j];
      nL++;
    }
  }
  // the dense ink: one shape inside the thin, shrinking from its edge in
  kMean = kN ? kSum / kN : 1;
  const edge = CLOUD.EDGE_PX + CLOUD.EDGE_GROW * (1 - kMean);
  for (let i = 0; i < nL; i++) LC[i] = LR[i] - edge;
}
// All the lobes into one path, each grown by g (or at its dense radius): one
// fill for all, so the ink is one shape, no seams
function lobes(c, dense, g) {
  c.beginPath();
  for (let i = 0; i < nL; i++) {
    const R = (dense ? LC[i] : LR[i]) + g;
    if (R < CLOUD.MIN_LOBE_PX) continue;
    c.moveTo(LX[i] + R, LY[i]);
    c.arc(LX[i], LY[i], R, 0, TAU);
  }
}
function drawCloud(c, d, ink, age) {
  const L = d.linger;
  const k = 1 - smooth(clamp01((age - CLOUD.OUT_AT * L) / (CLOUD.OUT_SEC * L)));
  if (k < 0.01 || !nL) return;
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = rgb(CLOUD.FRINGE, CLOUD.FRINGE_A * k);
  lobes(c, false, CLOUD.FRINGE_PX);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = rgb(CLOUD.OUTER, CLOUD.OUTER_A * k);
  lobes(c, false, 0);
  c.fill();
  c.fillStyle = rgb(CLOUD.CORE, CLOUD.CORE_A * k * kMean);
  lobes(c, true, 0);
  c.fill();
  c.globalCompositeOperation = 'lighter';
  for (const i of SPECK.ON) {
    const q = ink.puffs[i];
    if (!q?.live) continue;
    const twinkle = 0.6 + 0.4 * Math.sin(age * SPECK.TWINKLE + i);
    const a = SPECK.A * k * twinkle;
    c.fillStyle = rgb(CLOUD.FRINGE, SPECK.HALO_A * a);
    c.beginPath();
    c.arc(q.sx, q.sy, SPECK.HALO, 0, TAU);
    c.fill();
    c.fillStyle = rgb(C.lure, a);
    c.beginPath();
    c.arc(q.sx, q.sy, SPECK.R, 0, TAU);
    c.fill();
  }
  c.globalCompositeOperation = 'source-over';
}

// His scroll's coil (BassistRenderer.js's tracer), from its root at the
// origin along +x, coiled by f; returns its middle
const COIL = newScrollCoil();
const { x: SX, y: SY } = COIL;
const NS = SCROLL_N;
const HALO_PX = 3.4; // his lure's halo, as his look paints it
function coil(f) {
  traceScroll(f, 0, COIL);
  let mx = 0;
  let my = 0;
  for (let j = 0; j <= NS; j++) {
    mx += SX[j];
    my += SY[j];
  }
  return [mx / (NS + 1), my / (NS + 1)];
}
// How hard jet j pushes: the pop, his lets, the fizzle
const jetV = (jets, j) =>
  j === 0 ? FLY.JETS[0] : j === jets.length - 1 ? FLY.JETS[2] : FLY.JETS[1];

/**
 * Frozen until his death's start: his last pose, trembling (his look's
 * `dying`), flashing white off the hit. d: the death's frame (BassistDeath)
 */
export function drawInkWait(p, d) {
  const P = d.pose;
  drawBassist(p, d.scale, {
    ...P,
    t: P.t + d.since,
    hit: env(d.since, HIT_TAU_SEC),
    dying: { age: d.since },
  });
}

/**
 * The ink, from his death's start (d.age 0). Returns whether anything still
 * shows. d: the death's frame (BassistDeath): its record (pose, dir, seed,
 * linger, jets, fizzle), its age, how long it waited, his live scale, the
 * hero kept from its first frame of ink (from where he died, or null), the
 * heard kick (0..1) and its state
 */
export function drawInk(p, d) {
  const age = d.age;
  const L = d.linger;
  const c = p.drawingContext;
  const st = d.state;
  st.esc ??= escape(d);
  st.ink ??= makeInk(d, st.esc);
  const jets = d.jets;
  const aLet = d.fizzle;
  const P = d.pose;
  const E = st.esc.E;
  const ex = Math.cos(E);
  const ey = Math.sin(E);
  const sc = d.scale;

  // His body: puffed on the blurt, squeezed small, gone in the ink; his
  // scroll, which flies on its own, clipped off
  const bodyK = 1 - smooth(clamp01((age - BODY.FADE_FROM) / BODY.FADE_SEC));
  if (bodyK > 0.01) {
    const sq =
      1 +
      BODY.PUFFED * env(age, BODY.PUFF_TAU) -
      BODY.SQUEEZE * smooth(clamp01(age / BODY.SQUEEZE_SEC));
    c.save();
    c.globalAlpha *= bodyK;
    c.rotate(d.aim);
    c.beginPath();
    c.rect(
      -BODY.CLIP_BACK * sc,
      -BODY.CLIP_HALF * sc,
      (BODY.CLIP_BACK + G.nut * sq) * sc - BODY.CLIP_EDGE,
      2 * BODY.CLIP_HALF * sc
    );
    c.clip();
    c.rotate(-d.aim);
    c.scale(sq, sq);
    drawBassist(p, sc, {
      ...P,
      t: P.t + d.since,
      hit: 0,
      dying: { age: d.since },
      puff: age,
      puffDir: d.dir + PI,
    });
    c.restore();
  }

  // His scroll: where it started, on his neck, and where it has jetted
  const f0 =
    1 -
    FLY.UNCURL * P.uncurl -
    FLY.DYING * smooth(clamp01(d.wait / FLY.DYING_SEC));
  const [cx0, cy0] = coil(f0);
  const ca = Math.cos(d.aim);
  const sa = Math.sin(d.aim);
  const x0 = ((G.nut + cx0) * ca - cy0 * sa) * sc;
  const y0 = ((G.nut + cx0) * sa + cy0 * ca) * sc;
  const go = (a) => {
    let x = 0;
    for (let j = 0; j < jets.length; j++) {
      if (a > jets[j]) x += drift(jetV(jets, j), FLY.TAU, a - jets[j]);
    }
    return x;
  };
  const sz = (1 + (FLY.SIZE - 1) * smooth(clamp01(age / FLY.GROW_SEC))) * sc;

  // The puff of ink each jet leaves behind it
  c.save();
  for (let j = 1; j < jets.length; j++) {
    const t = age - jets[j];
    if (t <= 0 || t > FLY.PUFF_SEC * L) continue;
    const g = go(jets[j]) - FLY.ROOT * FLY.SIZE;
    const grown = easeOut(clamp01(t / FLY.PUFF_GROW));
    const R =
      (j === jets.length - 1 ? FLY.PUFF_LAST : 1) *
      (FLY.PUFF_R[0] + (FLY.PUFF_R[1] - FLY.PUFF_R[0]) * grown);
    const a =
      1 -
      smooth(
        clamp01(
          (t - FLY.PUFF_FADE_FROM) / (FLY.PUFF_SEC * L - FLY.PUFF_FADE_FROM)
        )
      );
    const x = x0 + ex * g;
    const y = y0 + ey * g;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rgb(CLOUD.FRINGE, CLOUD.FRINGE_A * a);
    c.beginPath();
    c.arc(x, y, R + CLOUD.FRINGE_PX, 0, TAU);
    c.fill();
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = rgb(CLOUD.OUTER, CLOUD.OUTER_A * a);
    c.beginPath();
    c.arc(x, y, R, 0, TAU);
    c.fill();
  }
  c.restore();

  // The ink, over the scroll's puffs
  placeInk(d, st.ink, age);
  drawCloud(c, d, st.ink, age);

  const fade =
    1 - smooth(clamp01((age - aLet - FLY.FADE_AFTER) / (FLY.FADE_SEC * L)));
  if (fade > 0.01) {
    // a jet: stretched along its way, its coil pumped tight, its lure blinking
    let je = 0;
    let last = 0;
    for (let j = 0; j < jets.length; j++) {
      if (age < jets[j]) break;
      last = jets[j];
      je += (jetV(jets, j) / FLY.JETS[0]) * env(age - jets[j], FLY.JET_TAU);
    }
    let f =
      f0 +
      (FLY.COIL - f0) * smooth(clamp01(age / FLY.TURN_SEC)) +
      FLY.PUMP * je;
    let lure =
      FLY.LURE + FLY.BLINK * env(age - last, FLY.BLINK_TAU) + FLY.KICK * d.kick;
    if (age >= aLet) {
      const u = age - aLet;
      f += (FLY.LIMP - f) * smooth(clamp01(u / FLY.LIMP_SEC));
      const on = Math.cos(u * FLY.SPUTTER_HZ * TAU) > 0;
      lure =
        u < FLY.SPUTTER_SEC
          ? (on ? FLY.SPUTTER_ON : FLY.SPUTTER_OFF) * (1 - u / FLY.SPUTTER_SEC)
          : 0;
    }
    const [cx, cy] = coil(f);
    const spin =
      mulberry32(Math.floor(d.seed * 1e6) + FLY.SEED)() < 0.5 ? -1 : 1;
    // it tumbles round once as it pops off, to head away coil first
    const turn = wrapPi(E - d.aim) + spin * TAU;
    const th = d.aim + turn * easeOut(clamp01(age / FLY.TURN_SEC));
    const g = go(age);
    c.save();
    c.globalAlpha *= fade;
    c.translate(x0 + ex * g, y0 + ey * g);
    c.rotate(th);
    c.scale(sz * (1 + FLY.STRETCH * je), sz * (1 - FLY.SQUASH * je));
    c.translate(-cx, -cy);
    c.lineJoin = 'round';
    paintScroll(
      c,
      COIL,
      lure,
      FLY.EDGE * Math.min(1, FLY.EDGE_FROM + lure),
      HALO_PX * (1 + FLY.HALO_GROW * Math.max(0, lure - 1))
    );
    c.restore();
  }

  const inkEnd = (CLOUD.OUT_AT + CLOUD.OUT_SEC) * L;
  return (
    age <
    Math.max(
      inkEnd,
      aLet + FLY.FADE_AFTER + FLY.FADE_SEC * L,
      aLet + FLY.PUFF_SEC * L
    )
  );
}
