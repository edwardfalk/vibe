/**
 * The bomb's cloud as one picture: Smoke. Ported from `smoke` in
 * docs/superpowers/specs/2026-10-08-explosion-studies/clouds.js (git-ignored;
 * the page is https://claude.ai/artifact/GHjWCySGwv8cVCtWDoE6nV); the spec is
 * docs/superpowers/specs/2026-10-09-bomb-kill-design.md. From the port on,
 * these constants are the authority.
 *
 * Its damage is two HazardClouds' (PLASMA, then the longer DEBRIS); this
 * draws them as one cloud: a lumpy band of shaded puffs on the edge of where
 * it hurts, one ink line round its outside, a thin see-through haze in the
 * middle and a small hot core; wisps break off the edge, embers rise and
 * flare on the eighths, the edge puffs swell on the kick. When the plasma
 * ends its outer puffs drift off and it steps in to the smaller edge,
 * cooling from a dirty rust-orange to an ash smoulder, and it fades after
 * the last of the damage.
 *
 * Its age is a frame count stepped with the clouds' own, so in hitstop the
 * picture and the damage hold together. It is drawn under everyone.
 */
import { CONFIG } from '../../config.js';
import { mulberry32, clamp01, lerp, smooth as ease } from '../../mathUtils.js';
import { GRUNT_COLORS } from '../../entities/GruntRenderer.js';

const PI = Math.PI;
const TAU = 2 * PI;
const INK = GRUNT_COLORS.ink;
const FRAME_SEC = 1 / 60; // the clouds tick once a frame, at 60 Hz
const BLOOM_SEC = 0.07; // the edge reaches its radius in about 0.25 s
const STEP_SEC = 0.3; // the step in from 80 to 60 px at the end of the plasma
const OUT_SEC = 0.8; // after the last of the damage, times linger
// How hot it is: 1 at the bang, HEAT_PLASMA_END as the plasma ends,
// HEAT_STEPPED once it has stepped in, cooling to 0 at the end by this power
const HEAT_PLASMA_END = 0.6;
const HEAT_STEPPED = 0.4;
const HEAT_COOL_POW = 0.8;

const smooth = (x) => ease(clamp01(x));
const mix = (c0, c1, k) => c0.map((v, j) => v + (c1[j] - v) * k);
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
// A colour along stops [[at, [r,g,b]], ...] sorted by at
function ramp(stops, k) {
  if (k <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [a1, c1] = stops[i];
    if (k <= a1) {
      const [a0, c0] = stops[i - 1];
      return mix(c0, c1, (k - a0) / (a1 - a0));
    }
  }
  return stops.at(-1)[1];
}

/**
 * The cloud's clock at `age` (s): where it hurts (R, px), how hot it is
 * (heat, 1 at the bang to 0 at the end), how far it has faded (fade, 1 until
 * the last of the damage), and the beat. c: { plasma: {radius, sec}, debris:
 * {radius, sec}, linger, beats, beatSec }.
 */
export function smokeClock(c, age) {
  const P = c.plasma.sec;
  const D = c.debris.sec;
  const step = smooth((age - P) / STEP_SEC); // 0 → 1 as the edge steps in
  const R =
    lerp(c.plasma.radius, c.debris.radius, step) *
    (1 - Math.exp(-age / BLOOM_SEC));
  const heat =
    age < P
      ? 1 - ((1 - HEAT_PLASMA_END) * age) / P
      : lerp(HEAT_PLASMA_END, HEAT_STEPPED, step) *
        Math.pow(clamp01(1 - (age - P) / (D - P)), HEAT_COOL_POW);
  const fade = age < D ? 1 : 1 - (age - D) / (OUT_SEC * c.linger);
  const beatPos = c.beats - Math.floor(c.beats);
  const eighthAge = (((beatPos * 2) % 1) * c.beatSec) / 2;
  return {
    age,
    P,
    D,
    R,
    step,
    heat,
    fade,
    kick: Math.exp(-(beatPos * c.beatSec) / 0.12),
    eighthAge,
    eighth: Math.exp(-eighthAge / 0.05),
    eighthN: Math.floor(c.beats * 2),
  };
}

const disc = (g, x, y, r) => {
  g.beginPath();
  g.arc(x, y, Math.max(0.1, r), 0, TAU);
  g.fill();
};
const HEAT_STEPS = 32; // sprites are kept per heat step
const heatStep = (heat) => Math.round(clamp01(heat) * HEAT_STEPS);

// An offscreen canvas at 1 px per px: its element (to draw from) and its 2D context
function canvas(p, w, h) {
  const g = p.createGraphics(w, h);
  g.pixelDensity(1);
  return g;
}

// The hot core, a soft glow added to what is under it: amber when fresh, a
// dull rust as it cools. One sprite per heat step, in one sheet.
const CORE = [
  [0, [96, 60, 40]],
  [0.4, [170, 92, 48]],
  [0.6, [214, 120, 56]],
  [1, [255, 168, 76]],
];
const GLOW_CELL = 64;

// The smoke: a lumpy pile of shaded puffs of very mixed sizes, dense on the
// hurting edge and thinning to a haze in the middle, one ink line round its
// outside; wisps breaking off the edge and drifting away; a small hot core.
// Dirty rust-orange when fresh, cooling to an ash smoulder.
const SMOKE = {
  PUFF_R: 80, // px: the cloud's radius its puffs' sizes are drawn for; they scale with its real one
  EDGE_N: 26,
  EDGE_PR: [9, 25], // puff radius, px, most of them small
  EDGE_SINK: 0.95, // an edge puff's centre sits this many radii inside the edge
  EDGE_JITTER: 3.5, // px in or out, so the outline is broken
  MID_N: 6,
  MID_PR: [14, 26],
  WISPS: 8, // puffs breaking off the edge and drifting out
  WISP_PX: 26,
  INK_PX: 1.8,
  BILLOW: 0.09, // an edge puff swells this much on the kick
  WANDER: 0.06, // rad, how far a puff sways round the cloud
  SIZE: 184, // px, the layer it is composed on
  RECOMPOSE_SEC: 1 / 30,
  ALPHA: [0.62, 0.85], // the whole, cold → hot: more see-through as it cools
  THIN: [0.7, 0.6], // how much of the middle is taken away, cold → hot
  SHED_SEC: 1.0, // the plasma's edge puffs drift off this long after it ends
  SHED_PX: 24,
  EMBERS: 16,
  SHADE: [
    [0, [58, 62, 64]],
    [0.4, [84, 66, 58]],
    [0.6, [102, 62, 50]],
    [1, [116, 62, 46]],
  ],
  FILL: [
    [0, [104, 104, 94]], // ash
    [0.4, [142, 114, 84]], // ochre-brown
    [0.6, [164, 108, 74]],
    [1, [184, 108, 66]], // dirty rust-orange
  ],
  HI: [
    [0, [122, 122, 108]],
    [0.4, [160, 134, 100]],
    [0.6, [182, 128, 90]],
    [1, [202, 132, 86]],
  ],
  EMBER: [255, 186, 96],
};
const PUFF_REF = 26; // px, a puff's radius in the sheet
const CELL = 2 * PUFF_REF + 2;

function smokePuffs(seed) {
  const rnd = mulberry32(Math.floor(seed * 1e9) + 11);
  const r = (a, b) => a + (b - a) * rnd();
  const [p0, p1] = SMOKE.EDGE_PR;
  const puffs = [];
  for (let i = 0; i < SMOKE.MID_N; i++) {
    puffs.push({
      a: r(0, TAU),
      d: r(0, 0.5),
      pr: r(...SMOKE.MID_PR),
      ph: r(0, TAU),
      edge: false,
    });
  }
  for (let i = 0; i < SMOKE.EDGE_N; i++) {
    const u = rnd();
    puffs.push({
      a: ((i + r(-0.4, 0.4)) / SMOKE.EDGE_N) * TAU,
      pr: p0 + (p1 - p0) * u ** 1.6,
      j: r(-1, 1) * SMOKE.EDGE_JITTER,
      ph: r(0, TAU),
      edge: true,
    });
  }
  const wisps = Array.from({ length: SMOKE.WISPS }, () => ({
    a: r(0, TAU),
    pr: r(5, 11),
    T: r(2, 3.6),
    ph: r(0, 1),
    drift: r(-0.25, 0.25),
  }));
  const embers = Array.from({ length: SMOKE.EMBERS }, () => ({
    a: r(0, TAU),
    d: r(0.1, 0.9),
    T: r(1.4, 2.6),
    ph: r(0, 1),
    vx: r(4, 12),
    vy: r(-26, -14),
    k: Math.floor(r(0, 4)),
  }));
  return { puffs, wisps, embers };
}

// Where each puff is this frame, sorted top to bottom (lower ones pile on top)
function smokePlace(puffs, k) {
  const out = [];
  for (const pf of puffs) {
    const a = pf.a + SMOKE.WANDER * Math.sin(k.age * 0.6 + pf.ph);
    let pr;
    let d;
    if (pf.edge) {
      pr =
        pf.pr *
        (1 + SMOKE.BILLOW * k.kick * (0.6 + 0.4 * Math.sin(pf.ph))) *
        (0.8 + 0.2 * (k.R / SMOKE.PUFF_R));
      d = k.R - pr * SMOKE.EDGE_SINK + pf.j;
    } else {
      pr = pf.pr * (k.R / SMOKE.PUFF_R) * (1 + 0.04 * k.kick);
      d = pf.d * k.R;
    }
    out.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, pr });
  }
  return out.sort((p0, p1) => p0.y - p1.y);
}

// The sheets, built once per p5 instance (at setup, by prepareBombSmoke):
// per heat step, the core's glow, a shaded puff lit from the top left and a
// soft blob (for the wisps), and a white blob that thins the middle
const sheets = new WeakMap(); // p5 → { core, smoke }
function sheetsOf(p) {
  let built = sheets.get(p);
  if (built) return built;
  const core = canvas(p, GLOW_CELL * (HEAT_STEPS + 1), GLOW_CELL);
  const cg = core.drawingContext;
  for (let s = 0; s <= HEAT_STEPS; s++) {
    const col = ramp(CORE, s / HEAT_STEPS)
      .map(Math.round)
      .join(',');
    const x = s * GLOW_CELL + GLOW_CELL / 2;
    const grad = cg.createRadialGradient(
      x,
      GLOW_CELL / 2,
      0,
      x,
      GLOW_CELL / 2,
      GLOW_CELL / 2
    );
    grad.addColorStop(0, `rgba(${col},1)`);
    grad.addColorStop(0.4, `rgba(${col},0.45)`);
    grad.addColorStop(1, `rgba(${col},0)`);
    cg.fillStyle = grad;
    cg.fillRect(s * GLOW_CELL, 0, GLOW_CELL, GLOW_CELL);
  }
  const smoke = canvas(p, CELL * (HEAT_STEPS + 2), CELL * 2);
  const g = smoke.drawingContext;
  const r = PUFF_REF;
  const soft = (x, y, col) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${col},1)`);
    grad.addColorStop(0.55, `rgba(${col},0.75)`);
    grad.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r - 1, y - r - 1, CELL, CELL);
  };
  for (let s = 0; s <= HEAT_STEPS; s++) {
    const hq = s / HEAT_STEPS;
    const ox = s * CELL + r + 1;
    const oy = r + 1;
    g.fillStyle = rgba(ramp(SMOKE.SHADE, hq), 1);
    disc(g, ox, oy, r);
    g.fillStyle = rgba(ramp(SMOKE.FILL, hq), 1);
    disc(g, ox - r * 0.12, oy - r * 0.15, r * 0.86);
    g.fillStyle = rgba(ramp(SMOKE.HI, hq), 1);
    disc(g, ox - r * 0.3, oy - r * 0.36, r * 0.45);
    soft(ox, CELL + oy, ramp(SMOKE.FILL, hq).map(Math.round).join(','));
  }
  soft((HEAT_STEPS + 1) * CELL + r + 1, r + 1, '255,255,255'); // the thinning mask
  built = { core: core.elt, smoke: smoke.elt };
  sheets.set(p, built);
  return built;
}

/** Build the cloud's sheets now (at setup), so the first bomb doesn't hitch */
export function prepareBombSmoke(p) {
  sheetsOf(p);
}

// A live cloud owns the layer it is composed on until it ends; ended ones'
// layers are handed to the next cloud (a new canvas costs a hitch)
const freeLayers = new WeakMap(); // p5 → layers no cloud holds
function takeLayer(p) {
  const free = freeLayers.get(p) ?? [];
  freeLayers.set(p, free);
  return free.pop() ?? canvas(p, SMOKE.SIZE, SMOKE.SIZE);
}
function giveBack(p, layer) {
  freeLayers.get(p)?.push(layer);
}

function drawCore(ctx, core, heat, r, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(
    core,
    heatStep(heat) * GLOW_CELL,
    0,
    GLOW_CELL,
    GLOW_CELL,
    -r,
    -r,
    2 * r,
    2 * r
  );
  ctx.restore();
}

export class BombSmoke {
  /**
   * @param {number} x where the bomb blew
   * @param {number} y
   * @param {object} o { seed (0..1), beats: () => the beat position, beatSec,
   *   sound: a handle with stop(), or null }
   */
  constructor(x, y, { seed, beats, beatSec, sound = null }) {
    Object.assign(this, { x, y, seed, beats, beatSec, sound });
    // What its damage does, as the two clouds were made with it
    const zone = (k) => ({
      radius: CONFIG[k].RADIUS,
      sec: CONFIG[k].DURATION * FRAME_SEC,
    });
    this.plasma = zone('PLASMA');
    this.debris = zone('DEBRIS');
    this.linger = CONFIG.DEATHS.LINGER;
    this.frames = 0;
    this.active = true;
    this.parts = smokePuffs(seed);
    this.layer = null; // its own, from its first draw to its end
    this.layerOf = null; // the p5 it came from
    this.composedAt = undefined;
  }

  get age() {
    return this.frames * FRAME_SEC;
  }

  /** A frame, with the clouds; its sound stops with the last of the damage */
  update() {
    if (!this.active) return;
    this.frames++;
    if (this.age >= this.debris.sec) this.stopSound();
    if (this.age >= this.debris.sec + OUT_SEC * this.linger) this.end();
  }

  stopSound() {
    this.sound?.stop();
    this.sound = null;
  }

  /** Gone: its sound stops, its layer goes back */
  end() {
    this.stopSound();
    this.active = false;
    if (this.layer) giveBack(this.layerOf, this.layer);
    this.layer = null;
  }

  draw(p) {
    if (!this.active) return;
    const k = smokeClock(
      {
        plasma: this.plasma,
        debris: this.debris,
        linger: this.linger,
        beats: this.beats(),
        beatSec: this.beatSec,
      },
      this.age
    );
    if (k.fade <= 0) return;
    const { smoke: atlas, core } = sheetsOf(p);
    const { puffs, wisps, embers } = this.parts;
    const ctx = p.drawingContext;
    const sx = heatStep(k.heat) * CELL;
    const soft = (g, x, y, pr, a) => {
      const w = CELL * (pr / PUFF_REF);
      g.globalAlpha = a;
      g.drawImage(atlas, sx, CELL, CELL, CELL, x - w / 2, y - w / 2, w, w);
    };
    ctx.save();
    ctx.translate(this.x, this.y);
    // The plasma's edge puffs, shed as the edge steps in: drifting off, fading
    const shedK = (k.age - k.P) / SMOKE.SHED_SEC;
    if (shedK >= 0 && shedK < 1) {
      const a = 0.55 * (1 - shedK) * (1 - shedK) * k.fade;
      for (const pf of puffs) {
        if (!pf.edge) continue;
        const d =
          this.plasma.radius -
          pf.pr * SMOKE.EDGE_SINK +
          pf.j +
          SMOKE.SHED_PX * Math.sqrt(shedK);
        soft(
          ctx,
          Math.cos(pf.a) * d,
          Math.sin(pf.a) * d,
          pf.pr * (1.2 + 0.5 * shedK),
          a
        );
      }
    }
    // Wisps breaking off the edge: soft, shrinking, gone WISP_PX out
    for (const w of wisps) {
      const u = (k.age / w.T + w.ph) % 1;
      const d = k.R + SMOKE.WISP_PX * u - 4;
      const a = w.a + w.drift * u;
      soft(
        ctx,
        Math.cos(a) * d,
        Math.sin(a) * d,
        w.pr * (1.3 - 0.6 * u),
        0.6 * Math.sin(PI * Math.min(1, u * 3)) * (1 - u) * k.fade
      );
    }

    // The pile, composed on its own layer: one ink silhouette, the puffs,
    // then the middle taken away to a haze. Slow smoke: it is recomposed at
    // 30 Hz, and every frame only while a kick billows it.
    const N = SMOKE.SIZE;
    const h = N / 2;
    if (!this.layer) {
      this.layer = takeLayer(p);
      this.layerOf = p;
    }
    if (
      this.composedAt === undefined ||
      Math.abs(k.age - this.composedAt) >= SMOKE.RECOMPOSE_SEC ||
      k.kick > 0.2
    ) {
      this.composedAt = k.age;
      const g = this.layer.drawingContext;
      g.clearRect(0, 0, N, N);
      const placed = smokePlace(puffs, k);
      g.fillStyle = rgba(INK, 1);
      g.beginPath();
      for (const q of placed) {
        g.moveTo(h + q.x + q.pr + SMOKE.INK_PX, h + q.y);
        g.arc(h + q.x, h + q.y, q.pr + SMOKE.INK_PX, 0, TAU);
      }
      g.fill();
      for (const q of placed) {
        const w = CELL * (q.pr / PUFF_REF);
        g.drawImage(
          atlas,
          sx,
          0,
          CELL,
          CELL,
          h + q.x - w / 2,
          h + q.y - w / 2,
          w,
          w
        );
      }
      g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = lerp(SMOKE.THIN[0], SMOKE.THIN[1], k.heat);
      const mr = k.R * 0.95;
      g.drawImage(
        atlas,
        (HEAT_STEPS + 1) * CELL,
        0,
        CELL,
        CELL,
        h - mr,
        h - mr,
        2 * mr,
        2 * mr
      );
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    ctx.globalAlpha = lerp(SMOKE.ALPHA[0], SMOKE.ALPHA[1], k.heat) * k.fade;
    ctx.drawImage(this.layer.elt, -h, -h);
    // A small hot core, brighter on the kick
    drawCore(
      ctx,
      core,
      k.heat,
      k.R * 0.6,
      (0.2 + 0.6 * k.heat * k.heat) * (1 + 0.25 * k.kick) * k.fade
    );

    // Embers: rising off the cloud, a quarter of them flaring on each eighth
    ctx.fillStyle = rgba(SMOKE.EMBER, 1);
    for (const e of embers) {
      const u = (k.age / e.T + e.ph) % 1;
      const d = e.d * k.R;
      const x = Math.cos(e.a) * d + e.vx * u * e.T;
      const y = Math.sin(e.a) * d + e.vy * u * e.T;
      const flare = k.eighthN % 4 === e.k ? k.eighth : 0;
      ctx.globalAlpha =
        Math.min(
          1,
          Math.sin(u * PI) * (0.3 + 0.45 * (1 - k.heat) + 0.5 * flare)
        ) * k.fade;
      disc(ctx, x, y, 1.2 + 0.9 * flare);
    }
    ctx.restore();
  }
}
