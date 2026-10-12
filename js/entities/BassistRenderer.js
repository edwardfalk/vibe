/**
 * The bassist's look: Abyssal, Edward's pick on the studies page
 * (2026-10-12; docs/superpowers/specs/2026-10-12-bassist-studies/, its
 * dir-abyssal.js on dir-body.js, ported). An alien that resembles an
 * upright bass, from the deep: a plump glassy shell you can see into (a
 * pale keel, ribs, two gill chambers under his slits that flare when he
 * puffs), a rim of photophores pulsing on the kick, four sinews that glow
 * on their own and flare when plucked, a nautilus coil for a scroll with a
 * lure lit at its tip, fingers of glass with lit tips, and two filaments
 * trailing from his tail spike. He puffs bubbles.
 *
 * His frame: +x along his aim (toward his scroll), y down = his right; px
 * at ART_SCALE 1. Seen from above, lying flat. The shell, neck, bridge and
 * spike, a white copy for a hit's flash, and his photophores are sprites
 * (spriteCache.js); the sinews, fingers, slits, scroll, filaments and
 * puffs are live paths on the raw context. Shapes are traced by functions,
 * not Path2D: the unit tests run in Node, which has none. Everything moves
 * by his pose (Bassist#pose()), the studies page's L.
 */
import { clamp01, smooth, easeOut, env } from '../mathUtils.js';
import { spriteParts } from './spriteCache.js';
import { AMBER, HOT } from './GruntRenderer.js'; // the cast's: about to strike

const PI = Math.PI;
const TAU = 2 * PI;
/** px, his centre to his scroll's end, where his note leaves, at ART_SCALE 1 */
export const BASSIST_MUZZLE_PX = 45;
/** His note's colours (BassNote.js draws it) */
export const NOTE_COLORS = { head: [222, 255, 250], glow: [70, 232, 214] };
/** His glow, BaseEnemy's: his photophores' */
export const BASSIST_GLOW_RGB = [120, 255, 220];

const INK = [38, 26, 48]; // the cast's ink
const NAVY = [16, 22, 52];
export const rgb = (c, a = 1) =>
  a >= 1
    ? `rgb(${c[0]},${c[1]},${c[2]})`
    : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a, b, k) =>
  [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));

const C = {
  glassIn: [40, 64, 130],
  glassOut: [86, 140, 214],
  keel: [170, 236, 255],
  gill: [90, 220, 240],
  rim: [156, 228, 255],
  bone: [196, 226, 244],
  neck: [24, 34, 74],
  sinew: [150, 255, 224],
  lit: [210, 255, 246], // his voice: cyan-green, brighter
  baseGlow: 0.32, // his sinews always glow a little
  stub: [100, 200, 190],
  finger: [150, 196, 232],
  fingerA: 0.75,
  fingerInkA: 0.7,
  knee: [196, 236, 255],
  tip: [170, 255, 230],
  fholeIn: [150, 255, 236],
  scroll: [60, 96, 170],
  scrollHi: [150, 255, 230],
  photo: [120, 255, 220],
  bubble: [176, 232, 255],
};

const G = {
  outline: [
    [-28, 0],
    [-27.4, 6],
    [-24.2, 11],
    [-18.6, 13.4],
    [-12.5, 12.8],
    [-8.6, 10.2],
    [-6.4, 7.6],
    [-4, 7], // a soft waist
    [-1.2, 8],
    [2.5, 10],
    [7, 10],
    [10.8, 8],
    [13.2, 5],
    [14.2, 2.8],
  ],
  box: [-38, -16, 32, 16],
  tailpiece: -22,
  bridge: -14,
  nut: 27,
  spreadTail: 1.4,
  spreadBridge: 3,
  spreadNut: 1.3,
  sinewW: 0.9,
  sinewInk: 0.5,
  stubLen: 7,
  pullX: 4,
  pullStep: 1.7,
  fhole: { x: -14, y: 6.4, len: 7.5 },
  fingerW: 0.95,
  fingers: [
    { root: [-6, -7.4], tipX: 8, l1: 11, l2: 10.5 },
    { root: [-3.2, -7.2], tipX: 12, l1: 11.5, l2: 11 },
    { root: [-3.2, 7.2], tipX: 12, l1: 11.5, l2: 11 },
    { root: [-6, 7.4], tipX: 4, l1: 11, l2: 10.5 },
  ],
  scroll: { len: 16, w0: 3.6, turn: 6.4, curl: -1 },
};

// ---- his shapes, traced ----

// A closed Catmull-Rom spline through points [[x, y], ...]
function closedSpline(c, pts) {
  const n = pts.length;
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[(i - 1 + n) % n];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % n];
    const [x3, y3] = pts[(i + 2) % n];
    c.bezierCurveTo(
      x1 + (x2 - x0) / 6,
      y1 + (y2 - y0) / 6,
      x2 - (x3 - x1) / 6,
      y2 - (y3 - y1) / 6,
      x2,
      y2
    );
  }
  c.closePath();
}
// His outline from its right half (tail to neck root, y >= 0), mirrored
const OUTLINE = [
  ...G.outline,
  ...G.outline
    .slice()
    .reverse()
    .filter(([, y]) => y > 0.01)
    .map(([x, y]) => [x, -y]),
];
const traceShell = (c) => closedSpline(c, OUTLINE);
function traceEndpin(c) {
  c.moveTo(-26, -1.5);
  c.lineTo(-36, 0);
  c.lineTo(-26, 1.5);
  c.closePath();
}
function traceNeck(c) {
  c.moveTo(8, -2.8);
  c.lineTo(G.nut + 0.8, -2.2);
  c.quadraticCurveTo(G.nut + 2, 0, G.nut + 0.8, 2.2);
  c.lineTo(8, 2.8);
  c.closePath();
}
function traceBridge(c) {
  c.moveTo(G.bridge - 0.4, -4.6);
  c.quadraticCurveTo(G.bridge + 1.4, 0, G.bridge - 0.4, 4.6);
  c.lineTo(G.bridge - 1.6, 4);
  c.quadraticCurveTo(G.bridge, 0, G.bridge - 1.6, -4);
  c.closePath();
}
// Photophores round his lower bout and his shoulders, in his frame
const PHOTO = [
  [-25, 8.6],
  [-20.5, 11.6],
  [-15, 12.2],
  [-10, 9.6],
  [4, 8.8],
  [9.6, 7.2],
].flatMap(([x, y]) => [
  [x, y],
  [x, -y],
]);
const PHOTO_BOX = [-28, -15, 13, 15];

// The cast's ink: an ink-filled copy a little larger behind the part
function inked(c, trace, fill, o = 1.1) {
  c.fillStyle = c.strokeStyle = rgb(INK);
  c.lineWidth = 2 * o;
  c.lineJoin = 'round';
  c.beginPath();
  trace(c);
  c.fill();
  c.stroke();
  c.fillStyle = fill;
  c.fill();
}

function paintShell(c, white) {
  if (white) {
    c.fillStyle = '#fff';
    for (const trace of [traceEndpin, traceShell, traceNeck]) {
      c.beginPath();
      trace(c);
      c.fill();
    }
    return;
  }
  inked(c, traceEndpin, rgb(C.bone, 0.9), 0.7);
  // Glass: thin ink, denser toward the edge like a bell
  c.strokeStyle = rgb(NAVY);
  c.lineWidth = 1.6;
  c.beginPath();
  traceShell(c);
  c.stroke();
  c.save();
  c.beginPath();
  traceShell(c);
  c.clip();
  for (const [cx, rx, ry] of [
    [-18, 12, 14],
    [4, 11, 11],
  ]) {
    const g = c.createRadialGradient(cx, -2, 0, cx, 0, Math.max(rx, ry));
    g.addColorStop(0, rgb(C.glassIn, 0.35));
    g.addColorStop(0.7, rgb(C.glassIn, 0.55));
    g.addColorStop(1, rgb(C.glassOut, 0.85));
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(cx, 0, rx + 3, ry + 1, 0, 0, TAU);
    c.fill();
  }
  // Inside: a keel, ribs, two gill chambers under his slits
  c.strokeStyle = rgb(C.keel, 0.55);
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(-27, 0);
  c.lineTo(12, 0);
  c.stroke();
  c.strokeStyle = rgb(C.keel, 0.22);
  c.lineWidth = 0.6;
  c.beginPath();
  for (const x of [-23, -19, -9, 1, 6]) {
    c.moveTo(x + 2, -11);
    c.quadraticCurveTo(x - 1.5, 0, x + 2, 11);
  }
  c.stroke();
  c.fillStyle = rgb(C.gill, 0.22);
  c.beginPath();
  c.ellipse(G.fhole.x, -G.fhole.y, 5.2, 2.8, 0, 0, TAU);
  c.ellipse(G.fhole.x, G.fhole.y, 5.2, 2.8, 0, 0, TAU);
  c.fill();
  // His rim catches the light
  c.strokeStyle = rgb(C.rim, 0.7);
  c.lineWidth = 1.3;
  c.beginPath();
  traceShell(c);
  c.stroke();
  c.restore();
  // The neck: a glass rod, its own keel showing
  c.fillStyle = rgb(C.neck, 0.85);
  c.beginPath();
  traceNeck(c);
  c.fill();
  c.strokeStyle = rgb(NAVY);
  c.lineWidth = 0.9;
  c.stroke();
  inked(c, traceBridge, rgb(C.bone, 0.9), 0.6);
  // the photophores' sockets
  c.fillStyle = rgb(NAVY);
  for (const [x, y] of PHOTO) {
    c.beginPath();
    c.arc(x, y, 1.15, 0, TAU);
    c.fill();
  }
}

// His photophores, halo and core, baked once: one image a frame
function paintPhotos(c) {
  for (const [x, y] of PHOTO) {
    const r = c.createRadialGradient(x, y, 0, x, y, 2.2);
    r.addColorStop(0, rgb([230, 255, 250]));
    r.addColorStop(0.35, rgb(C.photo, 0.8));
    r.addColorStop(1, rgb(C.photo, 0));
    c.fillStyle = r;
    c.fillRect(x - 2.2, y - 2.2, 4.4, 4.4);
  }
}

// A sprite's draw, in his px at the cache's scale
const inPx = (draw) => (g, s) => {
  const c = g.drawingContext;
  c.scale(s, s);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
};
const PARTS = {
  body: [G.box, inPx((c) => paintShell(c, false))],
  white: [G.box, inPx((c) => paintShell(c, true))],
  photos: [PHOTO_BOX, inPx(paintPhotos)],
};

// ---- live parts ----
let ctx = null;
let A0 = 1;
let SP = null;
let SP_S = 1; // the sprites' size: drawn px a px of his
const stamp = (part) =>
  ctx.drawImage(
    part.g.elt,
    part.x / SP_S,
    part.y / SP_S,
    part.w / SP_S,
    part.h / SP_S
  );
const alpha = (a) => (ctx.globalAlpha = A0 * a);

// Where sinew k (0 the let-1 string on his left .. 3 the slap's on his
// right) runs: tailpiece, bridge, nut
const SIGN = [-1, -1 / 3, 1 / 3, 1];
function sinewY(k, x) {
  const s = SIGN[k];
  if (x <= G.bridge) {
    return (
      s *
      (G.spreadTail +
        ((G.spreadBridge - G.spreadTail) * (x - G.tailpiece)) /
          (G.bridge - G.tailpiece))
    );
  }
  return (
    s *
    (G.spreadBridge +
      ((G.spreadNut - G.spreadBridge) * (x - G.bridge)) / (G.nut - G.bridge))
  );
}

// Two-bone reach: the knee from root to tip, bent out to `side`
function knee(rx, ry, tx, ty, l1, l2, side) {
  let dx = tx - rx;
  let dy = ty - ry;
  let d = Math.hypot(dx, dy) || 0.001;
  const max = l1 + l2 - 0.01;
  if (d > max) {
    dx *= max / d;
    dy *= max / d;
    d = max;
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  let px = -dy / d;
  let py = dx / d;
  if (py * side < 0) {
    px = -px;
    py = -py;
  }
  return [
    rx + (dx / d) * a + px * h,
    ry + (dy / d) * a + py * h,
    rx + dx,
    ry + dy,
  ];
}

// ---- the sinews ----
// Each intact sinew a polyline bridge to nut, displaced by its pluck's
// shiver or (the slap's) its draw-back; the tailpiece run is always there
const SN = 7;
const PX = new Float32Array(4 * (SN + 2));
const PY = new Float32Array(4 * (SN + 2));
function sinewPoints(k, disp) {
  const o = k * (SN + 2);
  PX[o] = G.tailpiece;
  PY[o] = sinewY(k, G.tailpiece);
  for (let j = 0; j <= SN; j++) {
    const x = G.bridge + ((G.nut - G.bridge) * j) / SN;
    PX[o + 1 + j] = x;
    PY[o + 1 + j] = sinewY(k, x) + disp(x, j / SN);
  }
}
const tracePoly = (k) => {
  const o = k * (SN + 2);
  ctx.moveTo(PX[o], PY[o]);
  for (let j = 1; j < SN + 2; j++) ctx.lineTo(PX[o + j], PY[o + j]);
};
// A snapped sinew's stubs: one off the bridge, one off the nut, curling
// outward (c 0 just snapped and whipping, 1 curled tight)
function stub(x, y, dir, side, c, len) {
  let a = dir;
  let px = x;
  let py = y;
  ctx.moveTo(px, py);
  const n = 6;
  const L = len * (1 - 0.45 * c);
  for (let j = 1; j <= n; j++) {
    a += side * (0.15 + 2.2 * c * (j / n) ** 1.4) * (dir === 0 ? 1 : -1);
    px += Math.cos(a) * (L / n);
    py += Math.sin(a) * (L / n);
    ctx.lineTo(px, py);
  }
}
const stubs2 = (k, c) => {
  const side = SIGN[k] < 0 ? -1 : 1;
  stub(G.bridge, sinewY(k, G.bridge), 0, side, c, G.stubLen);
  stub(G.nut, sinewY(k, G.nut), PI, side, c, G.stubLen * 0.8);
};
// Items [key, k] grouped by key: one stroke a colour
function batch(items) {
  const by = new Map();
  for (const [key, k] of items) {
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(k);
  }
  return by;
}
function sinews(L, S) {
  const t = L.t;
  const lit = [0, 0, 0, 0];
  const live = [];
  const stubs = [];
  for (let k = 0; k < 4; k++) {
    const sn = L.sinews[k];
    if (S.slackAll || sn.snapped >= 0) {
      const c = S.slackAll ? 1 : smooth(clamp01(sn.snapped / 0.18));
      stubs.push([k, c]);
      sinewPoints(k, () => 0);
      continue;
    }
    const pa = env(sn.pluck, 0.1);
    lit[k] = env(sn.pluck, 0.16);
    const shiver =
      (k === 3 ? 2.6 * env(L.slap, 0.12) : 1.5 * pa) *
      Math.sin(t * 110 + k * 1.7);
    if (k === 3 && S.pull > 0.01) {
      const xp = G.pullX;
      sinewPoints(
        k,
        (x) =>
          S.pull *
          (x < xp
            ? (x - G.bridge) / (xp - G.bridge)
            : (G.nut - x) / (G.nut - xp))
      );
    } else sinewPoints(k, (x, u) => shiver * Math.sin(PI * u));
    live.push(k);
  }
  // A thin shadow under every sinew and stub at once
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgb(INK, G.sinewInk);
  ctx.lineWidth = G.sinewW + 0.9;
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const o = k * (SN + 2);
    ctx.moveTo(PX[o], PY[o]);
    ctx.lineTo(PX[o + 1], PY[o + 1]); // the tailpiece run of every sinew
  }
  for (const k of live) tracePoly(k);
  for (const [k, c] of stubs) stubs2(k, c);
  ctx.stroke();
  // A glow under each lit sinew (plucked, or the slap's telegraph), then the
  // sinews, each pass batched by colour
  const glows = [];
  for (const k of live) {
    let g = Math.max(lit[k], C.baseGlow);
    let col = C.lit;
    const hot = k === 3 && S.tellHot;
    if (k === 3 && S.tellCol) {
      g = Math.max(g, S.tellGlow);
      col = S.tellCol;
    }
    if (g < 0.05) continue;
    const q = Math.round(g * 10) / 10; // a few levels, so plucks batch too
    glows.push([`${col}|${q}|${hot}`, k]);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const [key, ks] of batch(glows)) {
    const [col, q, hot] = key.split('|');
    const g = +q;
    const isHot = hot === 'true';
    ctx.strokeStyle = rgb(col.split(',').map(Number), (isHot ? 0.8 : 0.55) * g);
    ctx.lineWidth = G.sinewW + (isHot ? 4.6 : 3.2) * g;
    ctx.beginPath();
    for (const k of ks) tracePoly(k);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = G.sinewW;
  const cols = [];
  for (const k of live) {
    let col =
      lit[k] > 0.05 ? mix(C.sinew, C.lit, Math.round(lit[k] * 8) / 8) : C.sinew;
    if (k === 3 && S.tellCol) col = S.tellCol;
    cols.push([String(col), k]);
  }
  for (const [col, ks] of batch(cols)) {
    ctx.strokeStyle = rgb(col.split(',').map(Number));
    ctx.beginPath();
    for (const k of ks) tracePoly(k);
    ctx.stroke();
  }
  if (stubs.length) {
    ctx.strokeStyle = rgb(C.stub);
    ctx.beginPath();
    for (const [k] of stubs) {
      const o = k * (SN + 2);
      ctx.moveTo(PX[o], PY[o]);
      ctx.lineTo(PX[o + 1], PY[o + 1]);
    }
    for (const [k, c] of stubs) stubs2(k, c);
    ctx.stroke();
  }
}

// ---- the fingers: one over each sinew, from his waist ----
const FK = new Float32Array(4 * 6);
function fingers(L, S) {
  const t = L.t;
  for (let k = 0; k < 4; k++) {
    const F = G.fingers[k];
    const side = F.root[1] < 0 ? -1 : 1;
    const sn = L.sinews[k];
    let tx = F.tipX;
    let ty = sinewY(k, tx) + side * 1.1;
    // fidgeting, a little, out of step
    tx += 0.6 * Math.sin(t * 5.3 + k * 2.1);
    ty += side * 0.4 * Math.sin(t * 7.1 + k);
    if (k === 3) {
      // The slap's finger holds his sinew drawn back
      tx = G.pullX;
      ty = sinewY(3, tx) + S.pull + 1;
      if (S.tellHot) ty += 0.35 * Math.sin(t * 70);
      const r = env(L.slap, 0.09);
      ty += 4.5 * r; // released: flung out
      tx -= 2 * r;
    } else {
      // Hooks under its sinew just before its let, flicks across on it
      if (L.letK === k && L.plays[k] && L.letIn < 0.09) {
        ty -= side * 1.8 * (1 - L.letIn / 0.09);
      }
      const f = env(sn.pluck, 0.07);
      ty += side * 3 * f;
      tx -= 1.2 * f;
    }
    // Its sinew gone, it folds back along his flank; slack, they all trail
    const curl = S.slackAll
      ? 1
      : sn.snapped >= 0
        ? smooth(clamp01(sn.snapped / 0.25))
        : 0;
    if (curl > 0) {
      tx += (F.root[0] - 7 - tx) * curl;
      ty += (F.root[1] + side * 3.5 - ty) * curl;
    }
    const [kx, ky, ex, ey] = knee(
      F.root[0],
      F.root[1],
      tx,
      ty,
      F.l1 * (1 + 0.05 * S.splay),
      F.l2,
      side
    );
    FK.set([F.root[0], F.root[1], kx, ky, ex, ey], k * 6);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const segs = (from, to) => {
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const o = k * 6;
      ctx.moveTo(FK[o + from], FK[o + from + 1]);
      ctx.lineTo(FK[o + to], FK[o + to + 1]);
    }
  };
  const w1 = G.fingerW;
  const w2 = G.fingerW * 0.7;
  ctx.strokeStyle = rgb(INK, C.fingerInkA);
  ctx.lineWidth = w1 + 1.2;
  segs(0, 2);
  ctx.stroke();
  ctx.lineWidth = w2 + 1.2;
  segs(2, 4);
  ctx.stroke();
  ctx.strokeStyle = rgb(C.finger, C.fingerA);
  ctx.lineWidth = w1;
  segs(0, 2);
  ctx.stroke();
  ctx.lineWidth = w2;
  segs(2, 4);
  ctx.stroke();
  // knees and tips
  ctx.fillStyle = rgb(C.knee);
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    ctx.moveTo(FK[k * 6 + 2] + w1 * 0.75, FK[k * 6 + 3]);
    ctx.arc(FK[k * 6 + 2], FK[k * 6 + 3], w1 * 0.75, 0, TAU);
  }
  ctx.fill();
  ctx.fillStyle = rgb(C.tip);
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    ctx.moveTo(FK[k * 6 + 4] + w2 * 0.7, FK[k * 6 + 5]);
    ctx.arc(FK[k * 6 + 4], FK[k * 6 + 5], w2 * 0.7, 0, TAU);
  }
  ctx.fill();
}

// ---- the slits by the bridge: they breathe, and open and puff on a pluck ----
function slit(cx, cy, side) {
  const h = G.fhole.len / 2;
  ctx.moveTo(cx - h, cy + side * 1.3);
  ctx.bezierCurveTo(
    cx - h / 3,
    cy + side * 1.8,
    cx + h / 3,
    cy - side * 1.8,
    cx + h,
    cy - side * 1.3
  );
}
function fholes(S) {
  const { x, y } = G.fhole;
  const open = S.open;
  ctx.lineCap = 'round';
  for (const [col, w] of [
    [INK, 0.75 + 1.1 * open],
    [C.fholeIn, 0.9 * open * open],
  ]) {
    if (w < 0.1) continue;
    ctx.strokeStyle = rgb(col);
    ctx.lineWidth = w;
    ctx.beginPath();
    slit(x, -y, -1);
    slit(x, y, 1);
    ctx.stroke();
  }
  // the slits' curled ends
  ctx.fillStyle = rgb(INK);
  const h = G.fhole.len / 2;
  const r = 0.55 + 0.35 * open;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(x - h + r, s * (y + 1.3));
    ctx.arc(x - h, s * (y + 1.3), r * 1.15, 0, TAU);
    ctx.moveTo(x + h + r, s * (y - 1.3));
    ctx.arc(x + h, s * (y - 1.3), r * 0.9, 0, TAU);
  }
  ctx.fill();
}
// A bubble he puffs
function bubble(x, y, r) {
  ctx.strokeStyle = rgb(C.bubble, 0.9);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.75, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = rgb([255, 255, 255], 0.8);
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, Math.max(0.35, r * 0.18), 0, TAU);
  ctx.fill();
}
function puffs(L) {
  if (L.puff > 0.5) return;
  const k = L.puff / 0.5;
  const rel = L.puffDir + PI - L.aim; // away from where he lurches
  const { x, y } = G.fhole;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const a = rel + (i - 1) * 0.45 + s * 0.25;
      const d = 3 + (10 + 4 * i) * easeOut(k);
      const r = (1.4 + 2.6 * k) * (1 - 0.15 * i);
      alpha(0.75 * (1 - k) * (1 - 0.2 * i));
      bubble(x + Math.cos(a) * d, s * y + Math.sin(a) * d, r);
    }
  }
  alpha(1);
}

// ---- the scroll: a nautilus ribbon coiling from the neck's end ----
const NS = 16;
const SX = new Float32Array(NS + 1);
const SY = new Float32Array(NS + 1);
const SA = new Float32Array(NS + 1);
const SW = new Float32Array(NS + 1);
function scroll(L, S) {
  const { len, w0, turn, curl } = G.scroll;
  const f = S.coil;
  let x = G.nut;
  let y = 0;
  let a = 0;
  const ds = len / NS;
  for (let j = 0; j <= NS; j++) {
    const u = j / NS;
    SX[j] = x;
    SY[j] = y;
    SA[j] = a;
    SW[j] = w0 * (1 - 0.72 * u);
    const kap = (f * turn * (0.15 + 3 * u * u)) / (1.15 * len);
    a += curl * kap * ds;
    x += Math.cos(a) * ds;
    y += Math.sin(a) * ds;
  }
  const ribbon = (grow) => {
    ctx.beginPath();
    for (let j = 0; j <= NS; j++) {
      ctx.lineTo(
        SX[j] - Math.sin(SA[j]) * (SW[j] + grow),
        SY[j] + Math.cos(SA[j]) * (SW[j] + grow)
      );
    }
    for (let j = NS; j >= 0; j--) {
      ctx.lineTo(
        SX[j] + Math.sin(SA[j]) * (SW[j] + grow),
        SY[j] - Math.cos(SA[j]) * (SW[j] + grow)
      );
    }
    ctx.closePath();
  };
  ctx.fillStyle = rgb(INK);
  ribbon(1.1);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(SX[NS], SY[NS], SW[NS] + 1.1, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgb(C.scroll);
  ribbon(0);
  ctx.fill();
  // Chamber lines across it, its outer edge lit, a lure at its tip
  ctx.strokeStyle = rgb(NAVY, 0.7);
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  for (let j = 2; j < NS; j += 2) {
    const w = SW[j] * 0.95;
    ctx.moveTo(SX[j] - Math.sin(SA[j]) * w, SY[j] + Math.cos(SA[j]) * w);
    ctx.quadraticCurveTo(
      SX[j] + Math.cos(SA[j]) * 0.8,
      SY[j] + Math.sin(SA[j]) * 0.8,
      SX[j] + Math.sin(SA[j]) * w,
      SY[j] - Math.cos(SA[j]) * w
    );
  }
  ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgb(C.scrollHi, 0.6);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let j = 0; j <= NS; j++) {
    const w = SW[j] * 0.85;
    ctx.lineTo(
      SX[j] + Math.sin(SA[j]) * w * curl,
      SY[j] - Math.cos(SA[j]) * w * curl
    );
  }
  ctx.stroke();
  // the lure: brighter as he aims
  const lure = (0.55 + 0.45 * L.uncurl + 0.3 * L.kick) * S.dim;
  ctx.fillStyle = rgb(C.photo, 0.35 * lure);
  ctx.beginPath();
  ctx.arc(SX[NS], SY[NS], 3.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgb([230, 255, 250], Math.min(1, lure));
  ctx.beginPath();
  ctx.arc(SX[NS], SY[NS], 1.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---- the deep's extras ----
// Two filaments trailing from his tail, swaying behind his motion
function filaments(L, S) {
  const rel = Math.atan2(L.vy, L.vx) - L.aim;
  const drag = Math.min(1, L.speed / 120);
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    let x = -27;
    let y = s * 2.2;
    let a = PI + s * 0.35 - drag * Math.sin(rel) * 0.4;
    ctx.moveTo(x, y);
    for (let j = 0; j < 8; j++) {
      a +=
        0.22 * Math.sin(L.t * 3.1 - j * 0.8 + s) + (S.slackAll ? 0.12 * s : 0);
      x += Math.cos(a) * 2.6;
      y += Math.sin(a) * 2.6;
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgb(NAVY, 0.6);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.strokeStyle = rgb(C.photo, 0.55);
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
}
// Inside his gills, a flare on each puff
function gills(L) {
  const f = env(L.puff, 0.12);
  if (f <= 0.03) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgb(C.gill, 0.5 * f);
  ctx.beginPath();
  ctx.ellipse(G.fhole.x, -G.fhole.y, 5.5, 3, 0, 0, TAU);
  ctx.ellipse(G.fhole.x, G.fhole.y, 5.5, 3, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}
// His photophores, pulsing on the kick and his puffs, and his lit fingertips
function lights(L, S) {
  const pulse = (0.45 + 0.4 * L.kick + 0.4 * env(L.puff, 0.1)) * S.dim;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  alpha(Math.min(1, pulse));
  stamp(SP.photos);
  alpha(1);
  ctx.fillStyle = rgb(C.tip, 0.4 * S.dim);
  ctx.beginPath();
  for (let k = 0; k < 4; k++) {
    const x = FK[k * 6 + 4];
    const y = FK[k * 6 + 5];
    ctx.moveTo(x + 2, y);
    ctx.arc(x, y, 2, 0, TAU);
  }
  ctx.fill();
  ctx.restore();
}

/**
 * The bassist at (0, 0), from his pose L (Bassist#pose(); his death's adds
 * `dying` or `slack`), times `scale` (BASSIST_LOOK.ART_SCALE). Multiplies
 * the alpha it is drawn with and leaves the context as it found it
 */
export function drawBassist(p, scale, L) {
  SP_S = scale;
  SP = spriteParts(p, PARTS, SP_S);
  ctx = p.drawingContext;
  A0 = ctx.globalAlpha;
  const t = L.t;
  const T = L.tell;
  // Shared per-frame state for the parts
  const slackAll = !!L.slack;
  const pullN = T
    ? T.notch +
      (T.notch > 0
        ? -0.35 * env(T.notchAge, 0.03) * Math.cos(T.notchAge * 80)
        : 0)
    : 0;
  const S = {
    slackAll,
    pull: T ? G.pullStep * pullN : 0,
    tellCol:
      T && T.hot
        ? Math.sin(t * 60) > -0.3
          ? HOT
          : AMBER
        : T && T.amber
          ? AMBER
          : null,
    tellGlow: T && T.hot ? 1 : T && T.amber ? 0.6 : 0,
    tellHot: !!(T && T.hot),
    open: Math.max(
      0.2 + 0.12 * Math.sin(t * 2.6 + L.seed * 9),
      env(L.puff, 0.12)
    ),
    splay: env(L.slap, 0.15),
    swell: env(L.puff, 0.09),
    dim: L.slack ? 1 - L.slack.k : 1,
    coil: 1,
  };
  let coil = 1 - 0.4 * L.uncurl;
  if (L.dying) coil -= 0.3 * smooth(clamp01(L.dying.age / 0.25));
  if (slackAll) coil = 0.6 - 0.52 * smooth(clamp01(L.slack.age / 0.5));
  S.coil = coil * (1 + 0.025 * Math.sin(t * 2.1));
  if (L.dying) S.open = 1;
  if (slackAll) S.open = 0.6 * (1 - L.slack.k);

  ctx.save();
  ctx.scale(scale, scale);
  // a hit jolts him; dying, he trembles
  const j = 2.2 * L.hit + (L.dying ? 1 : 0);
  if (j > 0.05) ctx.translate(j * Math.sin(t * 97), j * Math.cos(t * 83));
  ctx.rotate(L.aim);
  filaments(L, S);
  ctx.save();
  const sw = 1 + 0.035 * S.swell;
  ctx.scale(sw, sw + 0.02 * S.swell);
  stamp(SP.body);
  gills(L);
  fholes(S);
  ctx.restore();
  sinews(L, S);
  scroll(L, S);
  fingers(L, S);
  puffs(L);
  if (L.hit > 0.04) {
    alpha(Math.min(1, L.hit * 1.1));
    stamp(SP.white);
    alpha(1);
  }
  lights(L, S);
  ctx.restore();
}
