/**
 * The stabber's death, Empty shell (on ?tune; StabberDeath.js): his gold
 * shell cracks down his spine and the halves drift apart, each with its claw
 * and half his spike. Inside there is nothing but a puff of magenta mist, so
 * what he was stays a mystery. His one eye floats out last, glaring at the
 * hero wherever he goes, and shuts on an eighth. Its sound is
 * DeathSounds.js's stabberShell.
 *
 * Ported from `death-shell.js` on the stabber death studies page
 * (StabberDeath.js names it); from the port on, these constants are the
 * authority. His shapes and colours are StabberRenderer.js's; his body at
 * the kill is its stabberBody, kept in the death's record.
 *
 * Frames: px, +x along his aim, y down; his body in units (K px each); all of
 * it times his scale at the kill. The halves and his claws are sprites
 * (spriteCache.js) at that scale; the blade, the mist and the eye are live
 * paths.
 */
import {
  clamp01,
  smooth,
  env,
  easeOut,
  drift,
  mulberry32,
  normalizeAngle,
  PI,
  TWO_PI,
} from '../mathUtils.js';
import { mix } from './GruntRenderer.js';
import { spriteParts } from './spriteCache.js';
import {
  K,
  O,
  RGB,
  NOSE,
  EYE,
  EYE_RX,
  EYE_RY,
  SHOULDER,
  UPPER,
  BLADE_W,
  BLADE_ROOT,
  ARM_BOX,
  FORE_BOX,
  HUSK,
  COWL,
  almond,
  inked,
  inUnits,
  drawArm,
  drawFore,
  drawStabber,
} from './StabberRenderer.js';

const SEED_STEPS = 1e6;

// His colours, and the shell's: its hollow inside, its edge while white-hot,
// and the mist (his flesh as vapour), its light side, and white-hot at first
const COL = {
  ...RGB,
  hollow: [92, 38, 84],
  lipHot: [255, 170, 70],
  mistHi: [238, 150, 216],
  mistHot: [255, 222, 240],
};
const CS = Object.fromEntries(
  Object.entries(COL).map(([k, v]) => [k, `rgb(${v})`])
);
const mixCss = (a, b, k) => `rgb(${mix(a, b, k).map(Math.round)})`;

// ---- the timing (s from the crack, at linger 1) ----
const SPLIT = {
  SEP_V: 62, // px/s each half flies off sideways, slowing (drag)
  SEP_V_HOT: 88, // the lock's tension let go
  SEP_TAU: 0.22,
  PUSH_V: 34, // px/s both are knocked along the blow
  PUSH_TAU: 0.3,
  SPLAY_V: 3, // rad/s their noses swing apart, slowing
  SPLAY_TAU: 0.16,
  PIVOT: [-5, 2], // units: each half swings about here (toward its tail)
  LIMP_ARM: 0.55, // the claws go limp: shoulder and elbow
  LIMP_ELBOW: -0.25,
  LIMP_SEC: 0.3,
  FADE_FROM: 0.5,
  FADE_SEC: 0.32,
  SHRINK: 0.15, // they shrink this much as they fade
  COOL_SEC: 0.35, // white-hot edges and blade cool over this
};
// The frozen moment: the crack runs from his tail and from his nose to his
// eye's socket (units along him), drawn from FROM of the wait on
const WAIT = {
  FLASH_SEC: 0.08, // the hit's white flash
  FROM: 0.2,
  RUNS: [
    [-12.6, -6],
    [12.6, 5.6],
  ],
  INK_W: 1.5,
  CORE_W: 0.55,
};
// The crack along the seam, units
const FLASH = { SEC: 0.09, OVER: 0.35, W: 2.2, W_HOT: 3.2, NOSE_PAST: 3 };
const MIST = {
  LOBES: 6, // round a middle one: one cloud, bumpy edged
  FROM: 3.5, // px from his centre at the crack
  ALONG: 1.4, // the cloud starts long, as he was
  V: 40, // px/s outward, slowing
  TAU: 0.35,
  R: [4.6, 6.4], // px at the crack
  CORE: 6.5,
  SWELL: 0.75, // it swells by this as it thins
  SWIRL: 0.9, // rad: it turns as it goes, one way or the other
  SOLID_SEC: 0.1, // thick until here, then it thins
  THIN: 0.45, // by this much, by the end
  BREAK: 0.4, // of its life: from here its lobes shrink away
  LIFE: 0.72, // s, times linger: gone
  INK_SEC: 0.32, // its ink rim gone by here: softer as it thins
  INK: 0.5,
  PUSH_V: 22,
  HOT_SEC: 0.22, // white-hot mist goes magenta over this
  PALE: 0.6, // how far toward pale pink it goes as it thins
  PALE_SEC: 0.4,
  HI: 0.55, // its light side: the cloud this small
  HI_PX: 2.4, // and this far up and to the left
};
const EYEF = {
  GROW: 1.6, // the free eye, bigger, so the glare reads
  POP_SEC: 0.2,
  OVERSHOOT: 0.25,
  TURN_SEC: 0.28, // it turns to face the hero
  V: 30, // px/s it creeps toward the hero, slowing
  TAU: 0.35,
  MAX_PX: 12,
  BOB_PX: 0.8,
  BOB_HZ: 1.7,
  GLARE_SEC: 0.24, // wide in shock, then a glare
  GLOWER: 0.6, // units: glaring, its iris tucks under the lid
  SOLO: 1.45, // alone, it swells by this, so the glare reads at 1:1
  SOLO_FROM: 0.4, // s, times linger: as the rest clears
  SOLO_SEC: 0.35,
  SHUT_AT: 1, // s, times linger, on the nearest eighth: shut
  SHUT_MIN: 0.5, // s: never before this
  CLOSE_SEC: 0.13,
  HOLD_SEC: 0.25, // shut, a dark slash, to the next eighth
  GONE_SEC: 0.14, // then it shrinks away
  BROW_W: 1.4, // units: the upper lid's heavy ink edge
  BROW_PAST: 1, // it runs past the back corner by this, a brow
  SHUT_W: 0.6, // shut, the slash this much thicker
};
// Its lids' edges (units off its middle; -y is the top on screen): upper at
// the back and the front, lower at the back and the front
const LIDS = {
  SHOCK: [-EYE_RY - 1, -EYE_RY - 1, EYE_RY + 1, EYE_RY + 1], // wide open
  GLARE: [-3.3, -0.3, 2.8, 2.1], // the upper lid slants down toward the hero; the lower squints
  SHUT: [-1.2, 1.2, -1.2, 1.2], // one slash, down toward him
};

const SLACK = 1e-6; // on beat positions, for floating-point error

/**
 * When the eye shuts, s after the crack: the song's eighth nearest SHUT_AT
 * times the death's linger, never before SHUT_MIN (the sound's pluck too).
 * Counted from the death's first eighth, which is off its start when the
 * start is off the grid (a bomb's late bang)
 */
export function shellShutAt(r) {
  const at = Math.max(EYEF.SHUT_MIN, EYEF.SHUT_AT * r.linger);
  const nearest = Math.round((at - r.offset) / r.eighth);
  const least = Math.ceil((EYEF.SHUT_MIN - r.offset) / r.eighth - SLACK);
  return r.eighthAfter(Math.max(1, nearest, least));
}
/** When the eye is gone, s after the crack: the death is over */
export const shellEnd = (r) => shellShutAt(r) + EYEF.HOLD_SEC + EYEF.GONE_SEC;

// The seam he cracks along: down his spine, a little jagged
const CRACK = [
  [-12.6, 0],
  [-10.2, 0.45],
  [-8, -0.35],
  [-6, 0.3],
  [5.6, -0.2],
  [7.6, 0.35],
  [9.8, -0.25],
  [12.6, 0],
];
const crackLine = (q) => {
  q.beginPath();
  CRACK.forEach(([x, y], i) => (i ? q.lineTo(x, y) : q.moveTo(x, y)));
};

// The right half of his shell (+y): the living shell, cut along the crack,
// the eye's socket left empty, the hollow inside showing along the cut.
// hot: that edge glowing
function drawHalf(c, hot) {
  inked(c, HUSK, CS.gold);
  c.save();
  HUSK(c);
  c.clip();
  c.fillStyle = CS.goldLo;
  c.beginPath();
  c.ellipse(-3, 0, 14, 11, 0, 0, TWO_PI);
  c.ellipse(-3.5, 0, 11, 5.4, 0, 0, TWO_PI, true);
  c.fill();
  c.fillStyle = CS.goldHi;
  c.beginPath();
  c.ellipse(-7.5, 0, 3.6, 1.5, 0, 0, TWO_PI);
  c.fill();
  c.restore();
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
  c.ellipse(8.5, 0, 3.6, 1, 0, 0, TWO_PI);
  c.fill();
  c.restore();
  // Keep what lies below the crack
  c.globalCompositeOperation = 'destination-in';
  c.beginPath();
  c.moveTo(-16, 0);
  for (const [x, y] of CRACK) c.lineTo(x, y);
  c.lineTo(16, 0);
  c.lineTo(16, 12);
  c.lineTo(-16, 12);
  c.fill();
  // The socket, empty
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  almond(c, EYE[0], EYE[1], EYE_RX + 0.6, EYE_RY + 0.6);
  c.fill();
  // The hollow inside along the cut, then its ink edge
  c.globalCompositeOperation = 'source-atop';
  c.strokeStyle = hot ? CS.lipHot : CS.hollow;
  c.lineWidth = 3;
  crackLine(c);
  c.stroke();
  c.beginPath();
  almond(c, EYE[0], EYE[1], EYE_RX + 0.6, EYE_RY + 0.6);
  c.stroke();
  if (hot) {
    c.strokeStyle = CS.hot;
    c.lineWidth = 1.2;
    crackLine(c);
    c.stroke();
  }
  c.strokeStyle = CS.ink;
  c.lineWidth = 2 * O;
  crackLine(c);
  c.stroke();
  c.beginPath();
  almond(c, EYE[0], EYE[1], EYE_RX + 0.6, EYE_RY + 0.6);
  c.stroke();
  c.globalCompositeOperation = 'source-over';
}

// Its sprites (spriteCache.js): a box in body units, built at K × his scale
// px a unit; its own table, so a death never rebuilds the living stabbers'
const HALF_BOX = [-14, -1.5, 14, 10];
const PARTS = {
  half: [HALF_BOX, inUnits((c) => drawHalf(c, false))],
  halfHot: [HALF_BOX, inUnits((c) => drawHalf(c, true))],
  arm: [ARM_BOX, inUnits((c) => drawArm(c, false))],
  fore: [FORE_BOX, inUnits((c) => drawFore(c, false))],
};
/** Its sprites for a stabber drawn at `scale` (built at setup, and again for a new scale) */
export const shellParts = (p, scale) => spriteParts(p, PARTS, K * scale);
// A sprite, in body units, its px a unit `s`
const stamp = (ctx, part, s) =>
  ctx.drawImage(part.g.elt, part.x / s, part.y / s, part.w / s, part.h / s);

function fillPoly(ctx, pts, style) {
  ctx.fillStyle = style;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.fill();
}

// One half, in the right half's frame (the left is mirrored): the half
// blade (px), the claw and the shell (units). side: 0 his right, 1 his left
function drawHalfPiece(ctx, B, t, sp, s, heatK, side) {
  const w = BLADE_W;
  // The blade's half: white-hot cooling through red to bone, or a wind-up's
  // red fading
  let blade = CS.bone;
  if (B.hot) {
    const k = clamp01(t / SPLIT.COOL_SEC);
    blade =
      k < 0.5
        ? mixCss(COL.hot, COL.red, k * 2)
        : mixCss(COL.red, COL.bone, (k - 0.5) * 2);
  } else if (B.heat > 0.02) {
    blade = mixCss(COL.red, COL.bone, 1 - B.heat * env(t, 0.2));
  }
  fillPoly(
    ctx,
    [BLADE_ROOT, -0.7, B.tip + 1.8, 0, BLADE_ROOT, w + 1.1],
    CS.ink
  );
  fillPoly(ctx, [BLADE_ROOT, 0, B.tip, 0, BLADE_ROOT, w], blade);
  fillPoly(
    ctx,
    [BLADE_ROOT, w * 0.35, B.tip - 2.5, 0.25, BLADE_ROOT, w * 0.75],
    B.hot && t < SPLIT.COOL_SEC * 0.5 ? CS.white : CS.boneHi
  );
  ctx.save();
  ctx.scale(K, K);
  // The claw goes limp
  const limp = smooth(clamp01(t / SPLIT.LIMP_SEC));
  const arm0 = side ? B.armL : B.armR;
  const el0 = side ? B.elL : B.elR;
  const arm = arm0 + (SPLIT.LIMP_ARM - arm0) * limp;
  const el = el0 + (SPLIT.LIMP_ELBOW - el0) * limp;
  ctx.save();
  ctx.translate(SHOULDER[0], SHOULDER[1]);
  ctx.rotate(-arm);
  stamp(ctx, sp.arm, s);
  ctx.translate(-UPPER, 0);
  ctx.rotate(-el);
  stamp(ctx, sp.fore, s);
  ctx.restore();
  stamp(ctx, sp.half, s);
  if (heatK > 0.02) {
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * heatK;
    stamp(ctx, sp.halfHot, s);
    ctx.globalAlpha = a;
  }
  ctx.restore();
}

// The mist: lobes of his flesh as vapour, from where his frill and tendrils
// were, puffing out and thinning. Ink, then flesh, then the light side, each
// one path, so touching lobes merge
const LOBE = [];
function drawMist(ctx, d, B, t) {
  const life = MIST.LIFE * d.linger;
  if (t >= life) return;
  const u = t / life;
  const rand = mulberry32(Math.floor(d.seed * SEED_STEPS));
  const cs = Math.cos(B.turn);
  const sn = Math.sin(B.turn);
  const push = drift(MIST.PUSH_V, MIST.TAU, t);
  const px = Math.cos(d.dir) * push - cs * B.back;
  const py = Math.sin(d.dir) * push - sn * B.back;
  const out = MIST.FROM + drift(MIST.V, MIST.TAU, t);
  // It swells, then breaks up: its lobes drift apart and shrink away
  const swell =
    (1 + MIST.SWELL * easeOut(u)) *
    (1 - smooth(clamp01((u - MIST.BREAK) / (1 - MIST.BREAK))));
  const swirl = (d.seed > 0.5 ? 1 : -1) * MIST.SWIRL * easeOut(u);
  LOBE.length = 0;
  LOBE.push(px, py, MIST.CORE * swell);
  for (let j = 0; j < MIST.LOBES; j++) {
    const a = ((j + 0.5 * rand()) / MIST.LOBES) * TWO_PI + swirl;
    const r = (MIST.R[0] + (MIST.R[1] - MIST.R[0]) * rand()) * swell;
    // In his frame, long as he was, then into the screen's
    const bx = Math.cos(a) * out * MIST.ALONG;
    const by = Math.sin(a) * out;
    LOBE.push(px + bx * cs - by * sn, py + bx * sn + by * cs, r);
  }
  const a0 = ctx.globalAlpha;
  const thin =
    1 -
    MIST.THIN * smooth(clamp01((t - MIST.SOLID_SEC) / (life - MIST.SOLID_SEC)));
  // Thinning, it goes pale (a thin magenta on a dark sky reads as a smudge)
  const pale = smooth(
    clamp01((t - MIST.SOLID_SEC) / (MIST.PALE_SEC * d.linger))
  );
  const hot = B.hot && t < MIST.HOT_SEC ? 1 - t / MIST.HOT_SEC : 0;
  const flesh = mixCss(
    mix(COL.flesh, COL.mistHi, pale * MIST.PALE),
    COL.mistHot,
    hot
  );
  const hi = mixCss(
    mix(COL.mistHi, COL.white, pale * MIST.PALE),
    COL.white,
    hot
  );
  // One path a colour: its ink rim, the cloud, and one light side up and to
  // the left (the light is on screen), a smaller copy of the cloud
  for (const [style, alpha, grow, k, ox, oy] of [
    [CS.ink, MIST.INK * (1 - clamp01(t / MIST.INK_SEC)), 1.2, 1, 0, 0],
    [flesh, 0.9 * thin, 0, 1, 0, 0],
    [hi, 0.75 * thin, 0, MIST.HI, -MIST.HI_PX, -MIST.HI_PX],
  ]) {
    if (alpha < 0.01) continue;
    ctx.globalAlpha = a0 * alpha;
    ctx.fillStyle = style;
    ctx.beginPath();
    for (let i = 0; i < LOBE.length; i += 3) {
      const r = LOBE[i + 2] * k + grow;
      const cx = px + (LOBE[i] - px) * k + ox;
      const cy = py + (LOBE[i + 1] - py) * k + oy;
      ctx.moveTo(cx + r, cy);
      ctx.arc(cx, cy, r, 0, TWO_PI);
    }
    ctx.fill();
  }
  ctx.globalAlpha = a0;
}

// The free eye at (x, y), turned to `rot`, `sc` its size, in units: the
// cream almond inked round, the iris looking `look` (rad, in its frame),
// its lids at `lid` (LIDS): a light lower one and a heavy shaded upper one
// whose thick ink edge runs out past the back corner, a scowling brow. Its
// top stays the top on screen whichever way it faces
function freeEye(ctx, x, y, rot, sc, lid, look, glower, slit, hot, shut) {
  const rx = EYE_RX;
  const ry = EYE_RY;
  const flip = Math.cos(rot) < 0 ? -1 : 1;
  const [ub, uf] = lid;
  const lb = Math.max(lid[2], ub);
  const lf = Math.max(lid[3], uf);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(K * sc, K * sc * flip);
  ctx.fillStyle = CS.ink;
  ctx.beginPath();
  almond(ctx, 0, 0, rx + 1, ry + 1);
  ctx.fill();
  ctx.beginPath();
  almond(ctx, 0, 0, rx, ry);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = CS.white_;
  ctx.fill();
  const ix = Math.cos(look) * 2.2;
  const iy = flip * Math.sin(look) * 1.2 + glower;
  ctx.fillStyle = CS.ink;
  ctx.beginPath();
  ctx.arc(ix, iy, 2.55, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = CS.iris;
  ctx.beginPath();
  ctx.arc(ix, iy, 2.15, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = CS.ink;
  ctx.beginPath();
  ctx.ellipse(ix, iy, slit, 2, 0, 0, TWO_PI);
  ctx.fill();
  ctx.fillStyle = hot ? CS.hot : CS.white;
  ctx.beginPath();
  ctx.arc(ix - 0.7, iy - 0.8, hot ? 0.8 : 0.55, 0, TWO_PI);
  ctx.fill();
  const far = ry + 2;
  const xb = -rx - 1;
  const xf = rx + 1;
  // The lower lid, inked along its edge
  for (const [g, style] of [
    [0.7, CS.ink],
    [0, CS.gold],
  ]) {
    ctx.fillStyle = style;
    ctx.beginPath();
    ctx.moveTo(xb, lb - g);
    ctx.lineTo(xf, lf - g);
    ctx.lineTo(xf, far);
    ctx.lineTo(xb, far);
    ctx.fill();
  }
  // The upper lid, in shade
  ctx.fillStyle = CS.goldLo;
  ctx.beginPath();
  ctx.moveTo(xb, ub);
  ctx.lineTo(xf, uf);
  ctx.lineTo(xf, -far);
  ctx.lineTo(xb, -far);
  ctx.fill();
  ctx.restore();
  // Its heavy edge, on along the same slant past the back corner: the brow
  const k = (uf - ub) / (xf - xb);
  // Shut, it's a slash inside the eye: no brow past it, a thicker line
  const x0 = xb - EYEF.BROW_PAST * (1 - shut) + 1.5 * shut;
  const x1 = rx - 1.5 * shut;
  ctx.strokeStyle = CS.ink;
  ctx.lineWidth = EYEF.BROW_W + EYEF.SHUT_W * shut;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, ub + k * (x0 - xb));
  ctx.lineTo(x1, ub + k * (x1 - xb));
  ctx.stroke();
  ctx.restore();
}

// The crack: a bright jagged line down his spine, running past both ends
function drawFlash(ctx, B, t) {
  if (t >= FLASH.SEC) return;
  const u = t / FLASH.SEC;
  ctx.save();
  ctx.rotate(B.turn);
  ctx.translate(-B.back, 0);
  ctx.scale(K * (1 + FLASH.OVER * Math.sqrt(u)), K);
  ctx.globalAlpha *= 1 - u * u;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'round';
  ctx.strokeStyle = B.hot ? CS.hot : CS.white;
  ctx.lineWidth = (B.hot ? FLASH.W_HOT : FLASH.W) * (1 - 0.5 * u);
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  for (const [x, y] of CRACK) ctx.lineTo(x, y * 4.5);
  ctx.lineTo(NOSE + FLASH.NOSE_PAST, 0);
  ctx.stroke();
  ctx.restore();
}

/**
 * The frozen moment before the crack: his last pose, flashing white off the
 * hit, while a crack runs down his spine from his tail and his nose toward
 * his eye. d: StabberDeath's frame (its record, age, since, wait, hero)
 */
export function drawShellWait(p, d) {
  drawStabber(p, d.scale, {
    ...d.pose,
    hit: env(d.since, WAIT.FLASH_SEC),
    hitAge: d.since,
    hitDir: d.dir,
  });
  const u = d.wait > 0 ? clamp01(d.since / d.wait) : 1;
  if (u < WAIT.FROM) return;
  const k = smooth((u - WAIT.FROM) / (1 - WAIT.FROM));
  const B = d.body;
  const ctx = p.drawingContext;
  ctx.save();
  ctx.scale(d.scale, d.scale);
  ctx.rotate(B.turn);
  ctx.translate(-B.back, 0);
  ctx.scale(K, K);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [from, to] of WAIT.RUNS) {
    // From one end, k of the way to the other
    const pts = CRACK.filter(
      ([x]) => (x - from) * (to - from) >= 0 && (x - to) * (from - to) >= 0
    );
    if (from > to) pts.reverse();
    const end = from + (to - from) * k;
    ctx.moveTo(...pts[0]);
    for (const [x, y] of pts.slice(1)) {
      if ((x - end) * (to - from) > 0) {
        ctx.lineTo(end, y);
        break;
      }
      ctx.lineTo(x, y);
    }
  }
  for (const [style, w] of [
    [CS.ink, WAIT.INK_W],
    [B.hot ? CS.hot : CS.white, WAIT.CORE_W],
  ]) {
    ctx.strokeStyle = style;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * From the crack: the halves, the mist and the free eye. False once it is
 * all gone. d: StabberDeath's frame, d.age ≥ 0
 */
export function drawShell(p, d) {
  const t = d.age;
  if (t >= shellEnd(d)) return false;
  const L = d.linger;
  const shut = shellShutAt(d);
  const B = d.body;
  const s = K * d.scale;
  const sp = shellParts(p, d.scale);
  const ctx = p.drawingContext;
  ctx.save();
  ctx.scale(d.scale, d.scale);
  const a0 = ctx.globalAlpha;

  // The mist, behind the halves
  drawMist(ctx, d, B, t);

  // The halves
  const fade =
    1 - smooth(clamp01((t - SPLIT.FADE_FROM * L) / (SPLIT.FADE_SEC * L)));
  if (fade > 0.01) {
    const sep = drift(B.hot ? SPLIT.SEP_V_HOT : SPLIT.SEP_V, SPLIT.SEP_TAU, t);
    const push = drift(SPLIT.PUSH_V, SPLIT.PUSH_TAU, t);
    const splay = drift(SPLIT.SPLAY_V, SPLIT.SPLAY_TAU, t);
    const cs = Math.cos(B.turn);
    const sn = Math.sin(B.turn);
    const heatK = B.hot ? 1 - smooth(clamp01(t / SPLIT.COOL_SEC)) : 0;
    const sc = 1 - SPLIT.SHRINK * (1 - fade);
    ctx.globalAlpha = a0 * fade;
    for (const side of [0, 1]) {
      const m = side ? -1 : 1; // 0 his right (+y), 1 his left, mirrored
      ctx.save();
      ctx.translate(
        -sn * m * sep + Math.cos(d.dir) * push,
        cs * m * sep + Math.sin(d.dir) * push
      );
      ctx.rotate(B.turn);
      ctx.scale(sc, sc * m);
      ctx.translate(-B.back, 0);
      const [px, py] = SPLIT.PIVOT;
      ctx.translate(px * K, py * K);
      ctx.rotate(splay);
      ctx.translate(-px * K, -py * K);
      drawHalfPiece(ctx, B, t, sp, s, heatK, side);
      ctx.restore();
    }
    ctx.globalAlpha = a0;
  }

  // The eye, out last, glaring at the hero (in his scaled frame)
  const pop = clamp01(t / EYEF.POP_SEC);
  const solo =
    1 +
    (EYEF.SOLO - 1) *
      smooth(clamp01((t - EYEF.SOLO_FROM * L) / (EYEF.SOLO_SEC * L)));
  const grow =
    (1 +
      (EYEF.GROW - 1) * (easeOut(pop) + EYEF.OVERSHOOT * Math.sin(pop * PI))) *
    solo;
  const gone = 1 - smooth(clamp01((t - shut - EYEF.HOLD_SEC) / EYEF.GONE_SEC));
  const e0x = (EYE[0] * K - B.back) * Math.cos(B.turn);
  const e0y = (EYE[0] * K - B.back) * Math.sin(B.turn);
  const hx = d.hero.x / d.scale - e0x;
  const hy = d.hero.y / d.scale - e0y;
  const hd = Math.hypot(hx, hy) || 1;
  const creep = Math.min(EYEF.MAX_PX, drift(EYEF.V, EYEF.TAU, t), hd * 0.25);
  const bob = EYEF.BOB_PX * Math.sin(t * TWO_PI * EYEF.BOB_HZ) * smooth(pop);
  const ex = e0x + (hx / hd) * creep;
  const ey = e0y + (hy / hd) * creep + bob;
  const toHero = Math.atan2(d.hero.y / d.scale - ey, d.hero.x / d.scale - ex);
  // It turns the short way round to face him (an almond reads the same
  // either way round, so it may start from its back)
  const from =
    Math.abs(normalizeAngle(toHero - B.turn)) > PI / 2 ? B.turn + PI : B.turn;
  const rot =
    from + normalizeAngle(toHero - from) * smooth(clamp01(t / EYEF.TURN_SEC));
  const glare = smooth(clamp01(t / EYEF.GLARE_SEC));
  const closing = smooth(
    clamp01((t - (shut - EYEF.CLOSE_SEC)) / EYEF.CLOSE_SEC)
  );
  const lid = LIDS.SHOCK.map((v, i) => {
    const g = v + (LIDS.GLARE[i] - v) * glare;
    return g + (LIDS.SHUT[i] - g) * closing;
  });
  freeEye(
    ctx,
    ex,
    ey,
    rot,
    grow * gone,
    lid,
    toHero - rot,
    EYEF.GLOWER * glare,
    B.locked ? 0.35 : 0.5,
    B.hot,
    closing
  );

  drawFlash(ctx, B, t);
  ctx.restore();
  return true;
}
