/**
 * The stabber, the shiv: a gold-armoured thing from a strange world, built
 * round one bone spike. Seen from above (it turns freely to any aim, never
 * upside down): a pointed gold shell over soft magenta flesh that ripples
 * out round its edge, one slit-pupilled eye that watches the hero, two
 * jointed claws it rows with, and curling tendrils behind. Its spike grows
 * out of its nose: always out a little, longer a notch an eighth through the
 * wind-up (claws raised), and on the lock the claws fold flat and it is a
 * dart, the spike white-hot. Also his lane, where his lunge will go.
 *
 * Ported from the prototype `dir-mystery.js` in
 * docs/superpowers/specs/2026-10-07-stabber-studies/ (git-ignored); the spec
 * is docs/superpowers/specs/2026-10-08-shiv-stabber-design.md. Drawn from
 * Stabber#pose(), the harness's look (its README lists every field).
 *
 * Frames: the spike in game px, +x along `aim`, y down; the body in units
 * (K px each) round the same centre; all of it times ART_SCALE. The shell
 * and the claws' two segments are sprites (spriteCache.js), plus white
 * copies for the hit flash, rebuilt for each ART_SCALE at the cache's
 * resolution; the spike, the eye, the frill, the tendrils and the effects
 * are live paths on the raw context. Shapes are traced by functions, not
 * Path2D: the unit tests run in Node, which has none.
 */
import { clamp01, smooth, env } from '../mathUtils.js';
import { hash01 } from './RusherRenderer.js';
import { spriteParts } from './spriteCache.js';

const PI = Math.PI;
const TAU = 2 * PI;
const K = 1.2; // body units to game px
/** px, his centre to his spike's tip at the lunge, at ART_SCALE 1 */
export const STABBER_REACH_PX = 42;
const REST = 25; // px, its tip while he stalks: always out
const RAISED = 34; // px, its tip at the end of the wind-up
const COCKED = 37; // px, its tip from the lock
const BLADE_W = 3.4; // px, the blade's half-width where it leaves him
const NOSE = 12; // units: the shell's point, where the blade comes out
const SHOULDER = [2.5, 5.8]; // units: the right claw's shoulder (the left mirrors)
const UPPER = 7.5; // units: shoulder to elbow
const EYE = [-0.4, 0]; // units: the eye's centre
const EYE_RX = 4.8; // its half-length along him
const EYE_RY = 3.7; // its half-width, wide open
const O = 1.1 / K; // the ink round each part (the grunt's 1.1 px), in units

const RGB = {
  ink: [38, 26, 48],
  gold: [244, 190, 46],
  goldHi: [255, 240, 156],
  goldLo: [198, 124, 40],
  flesh: [186, 74, 156], // magenta flesh, a little off against the gold
  bone: [246, 240, 224],
  boneHi: [255, 253, 246],
  red: [255, 58, 44],
  white_: [246, 236, 186], // the white of his eye: a sickly cream
  iris: [255, 69, 0], // today's eye colour
  hot: [255, 248, 225],
  white: [255, 255, 255],
  star: [255, 236, 150],
};
const CS = Object.fromEntries(
  Object.entries(RGB).map(([k, v]) => [k, `rgb(${v})`])
);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOut = (k) => 1 - (1 - k) ** 3;

// ---- sprites (a stroke is free here: drawn once) ----
// A shape traced onto a context (c) as a new path
const path = (f) => (c) => {
  c.beginPath();
  f(c);
};
function inked(c, shape, fill, o = O) {
  c.fillStyle = c.strokeStyle = CS.ink;
  c.lineWidth = 2 * o;
  shape(c);
  c.fill();
  c.stroke();
  c.fillStyle = fill;
  c.fill();
}
// The shell's outline: four cubics from the nose round the right flank, the
// rear and the left flank. The sprite and the live frill both use it
const SHELL = [
  [
    [NOSE, 0],
    [8.5, 5.4],
    [2, 8],
    [-4, 7.8],
  ],
  [
    [-4, 7.8],
    [-9.5, 7.6],
    [-12, 3.8],
    [-12, 0],
  ],
  [
    [-12, 0],
    [-12, -3.8],
    [-9.5, -7.6],
    [-4, -7.8],
  ],
  [
    [-4, -7.8],
    [2, -8],
    [8.5, -5.4],
    [NOSE, 0],
  ],
];
const HUSK = path((q) => {
  q.moveTo(NOSE, 0);
  for (const [, a, b, c] of SHELL) q.bezierCurveTo(...a, ...b, ...c);
});
// The cowl, his front plate, ends in two sharp corners round a notch
const COWL = path((q) => {
  q.moveTo(NOSE, 0);
  q.bezierCurveTo(8.5, -5.4, 4, -7.4, -0.5, -8.2);
  q.quadraticCurveTo(3, -4, 5.4, 0);
  q.quadraticCurveTo(3, 4, -0.5, 8.2);
  q.bezierCurveTo(4, 7.4, 8.5, 5.4, NOSE, 0);
});
// An almond along him (pointed fore and aft): the eye and its socket
const almond = (q, x, y, rx, ry) => {
  q.moveTo(x - rx, y);
  q.quadraticCurveTo(x, y - 2 * ry, x + rx, y);
  q.quadraticCurveTo(x, y + 2 * ry, x - rx, y);
};
const EYE_PATH = path((q) => almond(q, EYE[0], EYE[1], EYE_RX, EYE_RY));
function drawHusk(c, white) {
  if (white) {
    HUSK(c);
    c.fillStyle = CS.white;
    c.fill();
    return;
  }
  inked(c, HUSK, CS.gold);
  c.save();
  HUSK(c);
  c.clip();
  c.fillStyle = CS.goldLo; // his flanks, in shade
  c.beginPath();
  c.ellipse(-3, 0, 14, 11, 0, 0, TAU);
  c.ellipse(-3.5, 0, 11, 5.4, 0, 0, TAU, true);
  c.fill();
  c.fillStyle = CS.goldHi; // the ridge along his spine
  c.beginPath();
  c.ellipse(-7.5, 0, 3.6, 1.5, 0, 0, TAU);
  c.fill();
  c.restore();
  // One seam across his back: a rear plate, overlapping the front
  c.strokeStyle = CS.ink;
  c.lineWidth = 1.1;
  c.beginPath();
  c.moveTo(-9.5, -7.5);
  c.quadraticCurveTo(-4.6, 0, -9.5, 7.5);
  c.stroke();
  inked(c, COWL, CS.gold, 0.8);
  c.save();
  COWL(c);
  c.clip();
  c.fillStyle = CS.goldHi;
  c.beginPath();
  c.ellipse(8.5, 0, 3.6, 1, 0, 0, TAU);
  c.fill();
  c.restore();
  // The eye's socket: ink, a hair larger than the eye
  c.fillStyle = CS.ink;
  c.beginPath();
  almond(c, EYE[0], EYE[1], EYE_RX + 1, EYE_RY + 1);
  c.fill();
}
// A claw, the right one, in two sprites. The upper arm: a tapered plate from
// the shoulder (0, 0) back along -x to the elbow (-UPPER, 0)
const ARM = path((q) => {
  q.moveTo(1.2, -1.9);
  q.quadraticCurveTo(-4, -2.4, -UPPER, -1.3);
  q.lineTo(-UPPER, 1.3);
  q.quadraticCurveTo(-4, 2.2, 1.2, 1.9);
  q.closePath();
});
// The forearm: from the elbow (0, 0) back along -x to a sickle point that
// hooks in toward him (-y), a barb on its inside, and the elbow's knob of
// soft magenta flesh
const FORE = path((q) => {
  q.moveTo(0.5, -1.6);
  q.bezierCurveTo(-4, -2.4, -9, -2.2, -13, -4.6); // the point hooks in
  q.bezierCurveTo(-10, -0.8, -7, 0.4, -6, 1.2);
  q.lineTo(-7.4, 2); // the barb
  q.quadraticCurveTo(-3, 2.4, 0.5, 1.6);
  q.closePath();
});
function drawArm(c, white) {
  if (white) {
    ARM(c);
    c.fillStyle = CS.white;
    c.fill();
    return;
  }
  inked(c, ARM, CS.gold);
  c.save();
  ARM(c);
  c.clip();
  c.fillStyle = CS.goldLo;
  c.fillRect(-UPPER - 1, 0.5, UPPER + 3, 3);
  c.restore();
}
function drawFore(c, white) {
  if (white) {
    FORE(c);
    c.fillStyle = CS.white;
    c.fill();
    c.beginPath();
    c.arc(0, 0, 2, 0, TAU);
    c.fill();
    return;
  }
  inked(c, FORE, CS.gold);
  c.save();
  FORE(c);
  c.clip();
  c.fillStyle = CS.goldLo;
  c.beginPath();
  c.moveTo(0, 0.6);
  c.bezierCurveTo(-4, 0, -8, -0.2, -13, -3.6);
  c.lineTo(-14, 4);
  c.lineTo(1, 4);
  c.fill();
  c.strokeStyle = CS.goldHi;
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(-1, -0.9);
  c.bezierCurveTo(-4, -1.4, -7.5, -1.4, -10, -2.8);
  c.stroke();
  c.restore();
  const knob = path((q) => q.arc(0, 0, 2, 0, TAU));
  inked(c, knob, CS.flesh);
}

// His sprites (spriteCache.js): a part's box is in body units, and the
// cache's size s is the drawn px a unit (K × ART_SCALE), so a new ART_SCALE
// rebuilds them at the cache's resolution
const inUnits = (draw) => (g, s) => {
  const c = g.drawingContext;
  c.scale(s, s);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
};
const HUSK_BOX = [-14, -10, 14, 10];
const ARM_BOX = [-UPPER - 2, -3.5, 3, 3.5];
const FORE_BOX = [-15, -6.5, 3, 4];
const PARTS = {
  husk: [HUSK_BOX, inUnits((c) => drawHusk(c, false))],
  huskW: [HUSK_BOX, inUnits((c) => drawHusk(c, true))],
  arm: [ARM_BOX, inUnits((c) => drawArm(c, false))],
  armW: [ARM_BOX, inUnits((c) => drawArm(c, true))],
  fore: [FORE_BOX, inUnits((c) => drawFore(c, false))],
  foreW: [FORE_BOX, inUnits((c) => drawFore(c, true))],
};
let SP = null;
let SP_S = 1; // the sprites' size: drawn px a body unit

// The shell's outline sampled, with outward normals, for the frill
const NH = 40;
const HX = new Float32Array(NH);
const HY = new Float32Array(NH);
const HNX = new Float32Array(NH);
const HNY = new Float32Array(NH);
const HTAPER = new Float32Array(NH);
{
  const bez = (P, t) => {
    const u = 1 - t;
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return [0, 1].map((d) => w.reduce((s, wi, i) => s + wi * P[i][d], 0));
  };
  for (let i = 0; i < NH; i++) {
    const f = (i / NH) * 4;
    [HX[i], HY[i]] = bez(SHELL[Math.floor(f)], f - Math.floor(f));
  }
  for (let i = 0; i < NH; i++) {
    const a = (i + NH - 1) % NH;
    const b = (i + 1) % NH;
    const tx = HX[b] - HX[a];
    const ty = HY[b] - HY[a];
    const l = Math.hypot(tx, ty) || 1;
    HNX[i] = -ty / l; // clockwise on screen (y down): the outward side
    HNY[i] = tx / l;
    HTAPER[i] = smooth(clamp01((NOSE - 0.5 - HX[i]) / 6)); // none at his nose
  }
}

// ---- live parts ----
let ctx = null;
let A0 = 1;
// A sprite, in body units
const stamp = (part) =>
  ctx.drawImage(
    part.g.elt,
    part.x / SP_S,
    part.y / SP_S,
    part.w / SP_S,
    part.h / SP_S
  );
function fillPoly(pts, style) {
  ctx.fillStyle = style;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.fill();
}
function circle(x, y, r, style) {
  ctx.fillStyle = style;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
// The claws: s 1 right, -1 left; arm: the shoulder's swing out (rad, 0
// lies back along his flank); elbow: the forearm's bend (rad, negative folds
// it back in toward his tail)
function claw(s, arm, elbow, white) {
  ctx.save();
  ctx.scale(1, s);
  ctx.translate(SHOULDER[0], SHOULDER[1]);
  ctx.rotate(-arm);
  stamp(white ? SP.armW : SP.arm);
  ctx.translate(-UPPER, 0);
  ctx.rotate(-elbow);
  stamp(white ? SP.foreW : SP.fore);
  ctx.restore();
}
// His flesh: a magenta frill all round the shell's edge, a ripple running
// round it (amp: its height, units; speed: rad/s; puff: how far it stands out)
function frill(t, amp, speed, puff) {
  for (const [g, style] of [
    [O, CS.ink],
    [0, CS.flesh],
  ]) {
    ctx.fillStyle = style;
    ctx.beginPath();
    for (let i = 0; i < NH; i++) {
      const out =
        HTAPER[i] *
          (puff +
            amp * (0.5 + 0.5 * Math.sin((i / NH) * TAU * 9 - t * speed))) +
        g;
      ctx.lineTo(HX[i] + HNX[i] * out, HY[i] + HNY[i] * out);
    }
    ctx.fill();
  }
}
// Three tendrils from his rear, each a chain that bends along its length:
// its own wave (phase and speed), a tip that curls and uncurls, and a lag
// that swings them away from where he's going
const TN = 9;
const NT = 3;
const TPX = new Float32Array(NT * (TN + 1));
const TPY = new Float32Array(NT * (TN + 1));
const TPA = new Float32Array(NT * (TN + 1));
const TENDRILS = [
  { x: -10.6, y: -2.6, a: 0.32, len: 10, w: 1.8, speed: 7.3, ph: 0, curl: 1 },
  { x: -11.8, y: 0, a: 0, len: 12, w: 2.1, speed: 5.9, ph: 2.1, curl: -1 },
  { x: -10.6, y: 2.6, a: -0.32, len: 9, w: 1.7, speed: 8.6, ph: 4.4, curl: 1 },
];
function tendrils(t, wave, curl, lag, stretch, spread) {
  for (let j = 0; j < NT; j++) {
    const T = TENDRILS[j];
    const seg = (T.len * stretch) / TN;
    const o = j * (TN + 1);
    let a = PI + T.a * spread;
    TPX[o] = T.x;
    TPY[o] = T.y;
    TPA[o] = a;
    for (let k = 1; k <= TN; k++) {
      const u = k / TN;
      a += wave * 0.3 * Math.sin(t * T.speed - k * 0.75 + T.ph);
      a +=
        T.curl * curl * u * u * 0.55 * (0.7 + 0.3 * Math.sin(t * 1.7 + T.ph));
      a += lag / TN;
      TPX[o + k] = TPX[o + k - 1] + Math.cos(a) * seg;
      TPY[o + k] = TPY[o + k - 1] + Math.sin(a) * seg;
      TPA[o + k] = a;
    }
  }
  // All three in one path a colour: the ink copies, then the flesh
  for (const [g, style] of [
    [O, CS.ink],
    [0, CS.flesh],
  ]) {
    ctx.fillStyle = style;
    ctx.beginPath();
    for (let j = 0; j < NT; j++) {
      const T = TENDRILS[j];
      const o = j * (TN + 1);
      for (let k = 0; k <= TN; k++) {
        const w = T.w * (1 - (0.85 * k) / TN) + g;
        ctx.lineTo(
          TPX[o + k] - Math.sin(TPA[o + k]) * w,
          TPY[o + k] + Math.cos(TPA[o + k]) * w
        );
      }
      const e = o + TN;
      ctx.lineTo(TPX[e] + Math.cos(TPA[e]) * g, TPY[e] + Math.sin(TPA[e]) * g);
      for (let k = TN; k >= 0; k--) {
        const w = T.w * (1 - (0.85 * k) / TN) + g;
        ctx.lineTo(
          TPX[o + k] + Math.sin(TPA[o + k]) * w,
          TPY[o + k] - Math.cos(TPA[o + k]) * w
        );
      }
      ctx.closePath();
    }
    ctx.fill();
  }
}
// The blade (px): bone, a spike from inside his nose to `tip`. heat reddens
// its front; hot is white-hot; wob (rad) swings it about his nose
function blade(tip, heat, hot, wob) {
  const r = 7;
  const w = BLADE_W;
  const nose = NOSE * K;
  if (wob) {
    ctx.save();
    ctx.translate(nose, 0);
    ctx.rotate(wob);
    ctx.translate(-nose, 0);
  }
  fillPoly([r, -w - 1.1, tip + 1.8, 0, r, w + 1.1], CS.ink);
  fillPoly([r, -w, tip, 0, r, w], hot ? CS.hot : CS.bone);
  if (heat > 0.02 && !hot) {
    ctx.globalAlpha = A0 * heat;
    const m = nose + (tip - nose) * 0.3;
    const wm = w * (1 - (m - r) / (tip - r));
    fillPoly([m, -wm, tip, 0, m, wm], CS.red);
    ctx.globalAlpha = A0;
  }
  fillPoly(
    [r, -w * 0.7, tip - 2.5, -0.25, r, -0.25],
    hot ? CS.white : CS.boneHi
  );
  if (wob) ctx.restore();
}
// The eye (units): a cream almond, an orange-red iris with a slit pupil, and
// two lids of shell that close in from his sides. open: 1 wide, 0 shut;
// slant: the lids pinch in toward the front (a scowl; negative, a smirk);
// ix, iy: where the iris sits (units off centre); slit: the pupil's width
function eye(open, slant, ix, iy, slit, hot) {
  const [x, y] = EYE;
  const rx = EYE_RX;
  const ry = EYE_RY;
  ctx.save();
  EYE_PATH(ctx);
  ctx.clip();
  ctx.fillStyle = CS.white_;
  ctx.fill();
  circle(x + ix, y + iy, 2.55, CS.ink);
  circle(x + ix, y + iy, 2.15, CS.iris);
  ctx.fillStyle = CS.ink;
  ctx.beginPath();
  ctx.ellipse(x + ix, y + iy, slit, 2, 0, 0, TAU);
  ctx.fill();
  circle(x + ix - 0.7, y + iy - 0.8, hot ? 0.8 : 0.5, hot ? CS.hot : CS.white);
  // The lids: from each side to an edge at h off his midline, tilted by
  // slant (both in one path a colour)
  const h = ry * open;
  for (const [g, style] of [
    [0.6, CS.ink],
    [0, CS.gold],
  ]) {
    ctx.fillStyle = style;
    ctx.beginPath();
    for (const s of [-1, 1]) {
      const yb = y + s * Math.max(0, h * (1 + slant)) - s * g; // at the back corner
      const yf = y + s * Math.max(0, h * (1 - slant)) - s * g; // at the front corner
      const far = y + s * (ry + 2);
      ctx.moveTo(x - rx - 1, yb);
      ctx.lineTo(x + rx + 1, yf);
      ctx.lineTo(x + rx + 1, far);
      ctx.lineTo(x - rx - 1, far);
      ctx.closePath();
    }
    ctx.fill();
  }
  ctx.restore();
}
function star4(x, y, s, style) {
  const k = s * 0.2;
  fillPoly(
    [
      x + s,
      y,
      x + k,
      y + k,
      x,
      y + s,
      x - k,
      y + k,
      x - s,
      y,
      x - k,
      y - k,
      x,
      y - s,
      x + k,
      y - k,
    ],
    style
  );
}

/**
 * The shiv at (0, 0), from his pose (Stabber#pose()), times `scale` (his
 * ART_SCALE). Multiplies the alpha it is drawn with and leaves the context
 * as it found it
 */
export function drawStabber(p, scale, L) {
  SP_S = K * scale;
  SP = spriteParts(p, PARTS, SP_S);
  ctx = p.drawingContext;
  A0 = ctx.globalAlpha;
  ctx.save();
  ctx.scale(scale, scale);
  const t = L.t;
  const W = L.windup;
  const LU = L.lunge;
  const R = L.recover;
  const SN = L.stunned;
  const locked = !!(W && W.locked);
  const missed = R && !R.struck;
  const e8 = Math.floor(L.beats * 2);
  const bar = Math.floor(L.beats / 4);
  // A jerk on each eighth while he stalks: twitchy
  const twitch = W || LU || SN || R ? 0 : env(L.eighth * L.beatSec * 0.5, 0.04);
  ctx.save();

  // ---- the screen's frame: a shot's slide sheds gold flakes behind him ----
  if (L.push > 0.05 && !LU) {
    const c = Math.cos(L.hitDir);
    const s = Math.sin(L.hitDir);
    for (let i = 0; i < 3; i++) {
      const d = 15 + i * 6 + 14 * (1 - L.push);
      const off = (i - 1) * 6;
      ctx.globalAlpha = A0 * L.push * (1 - i * 0.25);
      star4(-c * d - s * off, -s * d + c * off, 3 - i * 0.4, CS.ink);
      star4(-c * d - s * off, -s * d + c * off, 2 - i * 0.4, CS.star);
    }
    ctx.globalAlpha = A0;
  }

  // ---- jolts, never mid-lunge (there the tip sits exactly at his reach) ----
  if (!LU) {
    const j = 2.4 * L.hit + 1.1 * twitch;
    if (j > 0.05)
      ctx.translate(
        j * (hash01(e8 * 1.7 + t * 31) - 0.5) * 2,
        j * (hash01(e8 * 2.3 + t * 17) - 0.5) * 2
      );
  }
  let turn = L.aim;
  if (missed) {
    // Overshot: he spins out, once round, then wobbles
    const k = clamp01(R.age / 0.45);
    turn +=
      TAU * easeOut(k) * (L.seed > 0.5 ? 1 : -1) +
      0.35 * Math.sin(R.age * 12) * k * (1 - R.k);
  } else if (SN) {
    // Stunned: he drifts round, slowly, lopsided
    turn += 0.6 * Math.sin(SN.age * 2.2) + SN.age * 1.4;
  }
  ctx.rotate(turn);
  // His motion in his own frame: the tendrils lag behind it
  const cs = Math.cos(turn);
  const sn = Math.sin(turn);
  const vf = L.vx * cs + L.vy * sn; // forward
  const vs = -L.vx * sn + L.vy * cs; // to his right
  let lag = clamp(vs / 220, -1.2, 1.2);

  // ---- his pose ----
  // Wind-up: a notch on each eighth, in step with the ring, each one
  // snapping in with a little overshoot
  let coil = 0;
  if (W) {
    const u = Math.min(W.k * 3, 2.999);
    const n = Math.floor(u);
    const age = (u - n) * L.beatSec * 0.5;
    coil = Math.min(1, (n + 1 - env(age, 0.03) * Math.cos(age * 70)) / 3);
  }
  const tremble = W && !locked ? coil * 0.8 * Math.sin(t * 85) : 0;
  let armR;
  let armL;
  let elR;
  let elL;
  let tip = REST + 1.2 * L.kick;
  let back = 0;
  let wave = 1;
  let tcurl = 1;
  let stretch = 1 + clamp(vf / 900, -0.25, 0.3);
  let spread = 1;
  let wob = 0;
  let sx = 1;
  let sy = 1;
  let fAmp = 1.6; // the frill: ripple height, speed, how far out
  let fSpeed = 8;
  let fPuff = 1.9 + 0.7 * L.kick;
  if (W && !locked) {
    // Raising: shoulders out wide, forearms cocked back hard, trembling; the
    // blade grows a notch an eighth
    const tr = 0.07 * Math.sin(t * 60);
    armR = armL = 0.95 + 0.45 * coil + tr;
    elR = elL = -0.9 - 0.65 * coil - tr;
    tip = REST + (RAISED - REST) * coil;
    back = 3 * coil;
    wave = 0.6 + coil;
    tcurl = 1 + coil;
    fAmp = 1.6 + 0.8 * coil; // a shiver of excitement
    fSpeed = 8 + 22 * coil;
    fPuff = 1.9 + 1.2 * coil;
  } else if (locked) {
    // The lock: claws fold flat along him (a dart), the blade jumps to
    // cocked, everything still
    const sn = env(W.lockAge, 0.03) * Math.cos(W.lockAge * 60);
    armR = armL = 0.1 + 0.5 * sn;
    elR = elL = -0.05 - 0.4 * sn;
    tip = COCKED + 2 * sn;
    back = 4;
    wave = 0.2;
    tcurl = 0.4;
    spread = 0.5;
    sy = 0.95;
    fAmp = 0.4;
    fSpeed = 3;
    fPuff = 0.9;
  } else if (LU) {
    armR = armL = 0.05;
    elR = elL = 0;
    tip = STABBER_REACH_PX;
    wave = 0.7;
    tcurl = 0.6;
    stretch = 1.1;
    spread = 0.4;
    lag = 0;
    sx = 1.05;
    sy = 0.9;
    fAmp = 0.5;
    fSpeed = 20;
    fPuff = 0.7;
  } else if (R && R.struck) {
    // Hit something: he yanks his blade out of it (a quick pull, a twang)
    // and shivers with glee, claws fluttering out of step
    const a = R.age;
    const pull = smooth(clamp01(a / 0.16));
    tip = STABBER_REACH_PX + (REST - STABBER_REACH_PX) * pull;
    wob = a > 0.12 ? 0.25 * env(a - 0.12, 0.18) * Math.sin(a * TAU * 9) : 0;
    const glee = env(a, 0.5);
    armR = 0.85 + 0.35 * glee * Math.sin(a * 55);
    armL = 0.85 + 0.35 * glee * Math.sin(a * 55 + 1.3);
    elR = -0.9 + 0.45 * glee * Math.sin(a * 47 + 0.6);
    elL = -0.9 + 0.45 * glee * Math.sin(a * 47 + 2.2);
    wave = 1 + 1.5 * glee;
    fAmp = 1.6 + 1.4 * glee;
    fSpeed = 8 + 30 * glee;
    if (a > 0.12)
      ctx.translate(
        0.9 * glee * Math.sin(a * 70),
        0.9 * glee * Math.cos(a * 63)
      );
  } else if (missed) {
    // Spun out, flailing: claws thrown wide, the blade drawn back in
    armR = 1.3 + 0.25 * Math.sin(R.age * 17);
    armL = 1.3 + 0.25 * Math.sin(R.age * 17 + 2);
    elR = -0.3 + 0.5 * Math.sin(R.age * 13 + 1);
    elL = -0.3 + 0.5 * Math.sin(R.age * 13 + 3);
    tip =
      STABBER_REACH_PX +
      (REST - STABBER_REACH_PX) * smooth(clamp01(R.age / 0.6));
    wave = 1.8;
    tcurl = 1.6;
    spread = 1.6;
    fAmp = 2.2;
    fSpeed = 20;
  } else if (SN) {
    // Stunned: limp and lopsided, one claw dangling, the blade drooping
    armR = 1.25 + 0.1 * Math.sin(t * 3);
    elR = 0.35 + 0.15 * Math.sin(t * 2.1);
    armL = 0.25 + 0.08 * Math.sin(t * 2.3);
    elL = -0.6;
    tip = REST - 3;
    wob = 0.3;
    wave = 0.4;
    tcurl = 2.2;
    spread = 1.4;
    fAmp = 1.2;
    fSpeed = 3;
    fPuff = 2.3;
  } else {
    // Stalking: he rows with his claws, shoulder then elbow, a stroke a
    // beat (pulled in on the kick). Some bars they row out of step; on the
    // off-eighths one claw flexes, impatient
    const ph = L.beats * TAU;
    const off = hash01(bar * 0.71 + L.seed * 13) > 0.55 ? 1.7 : 0;
    const flex = e8 % 2 ? 0.3 * env(L.eighth * L.beatSec * 0.5, 0.05) : 0;
    const which = hash01(e8 * 0.37 + L.seed * 11) > 0.5;
    armR = 0.85 - 0.3 * Math.cos(ph) + (which ? flex : 0);
    armL = 0.85 - 0.3 * Math.cos(ph + off) + (which ? 0 : flex);
    elR = -0.85 + 0.35 * Math.cos(ph - 1.1);
    elL = -0.85 + 0.35 * Math.cos(ph + off - 1.1);
  }
  if (L.hitAge < 0.12) {
    armR += 0.3;
    armL += 0.3;
  }
  ctx.translate(-back + tremble, 0);

  // Lunging: thin speed lines off his flanks
  if (LU) {
    const a = 1 - LU.k;
    ctx.globalAlpha = A0 * 0.7 * a;
    ctx.fillStyle = CS.hot;
    const sl = 14 + 24 * a;
    ctx.fillRect(-12 - sl, -12, sl, 1.2);
    ctx.fillRect(-22 - sl * 0.7, -6.5, sl * 0.7, 1);
    ctx.fillRect(-22 - sl * 0.7, 5.5, sl * 0.7, 1);
    ctx.fillRect(-12 - sl * 0.9, 11, sl * 0.9, 1.2);
    ctx.globalAlpha = A0;
  }

  const heat = W ? coil : 0;
  const hot = locked || !!LU;
  blade(tip, heat, hot, wob);
  ctx.save();
  ctx.scale(K * sx, K * sy);
  tendrils(t, wave, tcurl, lag, stretch, spread);
  frill(t, fAmp, fSpeed, fPuff);
  claw(1, armR, elR, false);
  claw(-1, armL, elL, false);
  stamp(SP.husk);
  if (L.hit > 0.04) {
    ctx.globalAlpha = A0 * Math.min(1, L.hit * 1.1);
    claw(1, armR, elR, true);
    claw(-1, armL, elL, true);
    stamp(SP.huskW);
    ctx.globalAlpha = A0;
  }

  // ---- the eye: it watches the hero ----
  const look = L.toHero - turn;
  let ix = Math.cos(look) * 2.2;
  let iy = Math.sin(look) * 1.2;
  let open = 0.8 - 0.3 * twitch;
  let slant = 0.3;
  let slit = 0.5;
  if (!W && !LU && !R && !SN) {
    // Now and then a glance aside, and a lid that flickers
    const g = hash01(e8 * 0.91 + L.seed * 31);
    if (g > 0.72) {
      const k = env(L.eighth * L.beatSec * 0.5, 0.12);
      ix += (g > 0.86 ? -1 : 1) * 0.8 * k;
      iy += (g > 0.86 ? 1 : -1) * 1.2 * k;
    }
  }
  if (W && !locked) {
    open = 0.85 + 0.25 * coil; // wide, mad
    slant = 0.25 * (1 - coil);
    slit = 0.5 + 0.3 * Math.sin(t * 45);
  } else if (locked) {
    open = 0.4; // a slit
    slant = 0.4;
    slit = 0.35;
  } else if (LU) {
    open = 0.45;
    slant = 0.35;
    slit = 0.35;
  } else if (R && R.struck) {
    open = 0.5; // smug
    slant = -0.45;
  } else if (missed || SN) {
    // Rolling round in his head
    open = 1.1;
    slant = 0;
    ix = Math.cos(t * 8) * 2.2;
    iy = Math.sin(t * 8) * 1.3;
    slit = 0.55;
  }
  if (L.hitAge < 0.14) open = 0; // ow
  eye(open, slant, ix, iy, slit, locked && W.lockAge > 0.06);
  ctx.restore();

  // Locked: a glint runs out along the blade and sits on its tip
  if (locked) {
    const k = smooth(clamp01(W.lockAge / 0.14));
    const gx = NOSE * K + (tip - NOSE * K) * k;
    const s = 3.4 + 1.3 * Math.sin(W.lockAge * 40);
    star4(gx, 0, s + 1.2, CS.ink);
    star4(gx, 0, s, CS.hot);
  }
  ctx.restore();

  // Stunned: stars circling him (the screen's frame)
  if (SN) {
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i * TAU) / 3;
      const x = Math.cos(a) * 13;
      const y = -15 + Math.sin(a) * 3.5;
      star4(x, y, 3.4, CS.ink);
      star4(x, y, 2.4, CS.star);
    }
  }
  ctx.restore();
}

// ---- his lane (the harness's drawLane) ----
/** px, the radius of his count ring at ART_SCALE 1 (Stabber.js draws it) */
export const RING_R_PX = 34;
/** His count ring's lit arcs: gold */
export const RING_GOLD = 'rgba(255,222,110,0.95)';
const LANE = {
  INK: 'rgba(14,10,22,0.85)',
  FAINT: 'rgba(255,214,120,0.38)',
  LOCK: 'rgba(255,190,60,0.95)',
  HOT: 'rgba(255,248,225,1)',
  GAP_PX: 4, // from the ring's edge
  DASH: [6, 7],
  DASH_PX_S: 40, // the dashes crawl toward the hero
  INK_W: 4,
  FAINT_W: 1.6,
  LOCK_INK_W: 6,
  LOCK_W: 2.5,
  POP_INK_W: 4, // thicker for an instant at the lock
  POP_W: 3,
  POP_TAU_SEC: 0.08,
  AMBER_SEC: 0.125, // amber for a sixteenth, then white-hot
  HEAD_LEN: 10,
  HEAD_W: 6,
};
function laneLine(c, a, b) {
  c.beginPath();
  c.moveTo(a, 0);
  c.lineTo(b, 0);
  c.stroke();
}

/**
 * His lane from (x, y), in the world, while he winds up: from just outside
 * his ring to where his tip will stop (the lunge's length plus his reach).
 * Dashed and faint while it still follows the hero; solid from the lock,
 * popping thicker for an instant, amber for a sixteenth, then white-hot,
 * with an arrowhead. A direction, not wall-aware
 */
export function drawLane(p, x, y, L, scale) {
  const W = L.windup;
  if (!W) return;
  const c = p.drawingContext;
  const start = RING_R_PX * scale + LANE.GAP_PX;
  const end = W.len + L.reach;
  c.save();
  c.translate(x, y);
  c.rotate(L.aim);
  c.lineCap = 'round';
  if (!W.locked) {
    c.setLineDash(LANE.DASH);
    c.lineDashOffset = -L.t * LANE.DASH_PX_S;
    c.strokeStyle = LANE.INK;
    c.lineWidth = LANE.INK_W;
    laneLine(c, start, end);
    c.strokeStyle = LANE.FAINT;
    c.lineWidth = LANE.FAINT_W;
    laneLine(c, start, end);
  } else {
    const pop = env(W.lockAge, LANE.POP_TAU_SEC);
    c.setLineDash([]);
    c.strokeStyle = LANE.INK;
    c.lineWidth = LANE.LOCK_INK_W + LANE.POP_INK_W * pop;
    laneLine(c, start, end);
    c.strokeStyle = W.lockAge > LANE.AMBER_SEC ? LANE.HOT : LANE.LOCK;
    c.lineWidth = LANE.LOCK_W + LANE.POP_W * pop;
    laneLine(c, start, end);
    c.beginPath();
    c.moveTo(end, 0);
    c.lineTo(end - LANE.HEAD_LEN, -LANE.HEAD_W);
    c.lineTo(end - LANE.HEAD_LEN, LANE.HEAD_W);
    c.closePath();
    c.fillStyle = c.strokeStyle;
    c.fill();
  }
  c.restore();
}
