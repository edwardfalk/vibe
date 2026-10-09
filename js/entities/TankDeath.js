/**
 * How the tank dies: All air. Ported from the `air` variant of
 * docs/superpowers/specs/2026-10-08-explosion-studies/deaths-tank-oct5.js
 * (git-ignored; first drawn on the death studies page of 2026-10-05, shown
 * again at https://claude.ai/artifact/GHjWCySGwv8cVCtWDoE6nV); the spec is
 * docs/superpowers/specs/2026-10-09-bomb-kill-design.md. From the port on,
 * these constants are the authority.
 *
 * His shades and gold chain are blown off and tumble away, glinting on the
 * kick; then the air rushes out of the hole in his back and he darts about
 * like a let-go balloon, his skin going slack: arms flapping like noodles,
 * shoulders flopping, creasing as it empties (the muscles were air all
 * along). He drifts away, a big sad face on a small wrinkled skin, and fades.
 *
 * Everything runs on the audio clock, read when drawn, so the picture stays
 * with its sound (DeathSounds.js tankAir) through hitstop, and a pause holds
 * both. Until it starts he holds his last pose. His first moments are the
 * living tank's own drawing (drawTank with a reaction); then his slack skin.
 * His frame is the renderer's: +x where he faces, +y his right, sizes in
 * units of s (his drawn size).
 */
import { CONFIG } from '../config.js';
import { clamp01, smooth, env, mulberry32, lerp } from '../mathUtils.js';
import { spriteParts, stamp } from './spriteCache.js';
import {
  TANK_COLORS as C,
  BOMB_AT,
  CANNON_AT,
  GRIP,
  HEAD,
  HEAD_D,
  ARM_L,
  ARM_T,
  SHOULDER,
  BALL,
  BALL_SHINE,
  SLAB_ELLIPSES,
  tankParts,
  tankRaisedParts,
  drawTank,
  union,
  lines,
  bareHead,
  shades,
  fist,
  TANK_SIZE,
} from './TankRenderer.js';

const PI = Math.PI;
// His geometry is the living tank's (TankRenderer.js)
const HEAD_X = HEAD[0];
const PAD_Y = BALL[1]; // the shoulder domes, where the pads sit
const FIST = [CANNON_AT, GRIP]; // his fists on the cannon, at rest
const CHAIN_C = 0.3; // the middle of his chain, ahead of his centre
// His shades and chain, flung ahead of him: from (units of s), at an angle
// (rad) and a speed (px/s) slowing with a time constant (s); each spins up
// to SPIN rad, flips FLIPS times and drifts (px/s); a glint of size GLINT
// (s) after GLINT_AT s, GLINT_SEC long
const FLING = {
  shades: {
    AT: [0.32, -0.1],
    A: -1.05,
    V: 400,
    TAU: 0.2,
    SPIN: 4.5,
    SPIN_TAU: 0.5,
    FLIPS: 3,
    FLIP_TAU: 0.45,
    DRIFT: [10, -4],
    MID: 0.15,
    GLINT: 0.24,
    GLINT_AT: 0.04,
    GLINT_OFF: [0, 0],
  },
  chain: {
    AT: [CHAIN_C, 0.1],
    A: 1.15,
    V: 360,
    TAU: 0.21,
    SPIN: 5.5,
    SPIN_TAU: 0.5,
    FLIPS: 2,
    FLIP_TAU: 0.4,
    DRIFT: [8, 5],
    MID: CHAIN_C,
    GLINT: 0.26,
    GLINT_AT: 0.1,
    GLINT_OFF: [3, -2],
  },
  GLINT_SEC: 0.25,
};
// A trail puff is pushed back from the hole: PUSH px, easing with PUSH_TAU
// (s), then drifting DRIFT px/s
const TRAIL_PUSH = { PUSH: 40, PUSH_TAU: 0.1, DRIFT: 14 };
const PLATES = ['front', 'left', 'right'];
const ease = (t, tau) => 1 - Math.exp(-Math.max(0, t) / tau); // 0 → 1, fast then slow

// ---- parts of his the living tank doesn't draw alone -----------------------------
const DEATH_PARTS = {
  // Without his shades his little eyes show, sad: brows up in the middle
  // and a frown. Seen from above, his face looks up at us: its brow toward
  // the back of his head, its chin toward the front (+x)
  headSad: [
    [-0.44, -0.34, 0.34, 0.34],
    (g, s) => {
      bareHead(g, s);
      const r = (s * HEAD_D) / 2;
      for (const y of [-1, 1]) {
        union(g, C.white, [
          (g) => g.ellipse(r * 0.28, r * 0.42 * y, s * 0.11, s * 0.095),
        ]);
        g.fill(...C.ink);
        g.ellipse(r * 0.37, r * 0.38 * y, s * 0.055, s * 0.055);
      }
      lines(g, C.ink, s * 0.032, [
        [-r * 0.12, -r * 0.2, -r * 0.02, -r * 0.68],
        [-r * 0.12, r * 0.2, -r * 0.02, r * 0.68],
      ]);
      g.noFill();
      g.stroke(...C.ink);
      g.strokeWeight(s * 0.048);
      g.beginShape();
      for (let i = 0; i <= 8; i++) {
        const u = i / 4 - 1;
        g.vertex(r * (0.76 - 0.2 * (1 - u * u)), r * 0.36 * u);
      }
      g.endShape();
      g.noStroke();
    },
  ],
  shades: [[-0.08, -0.28, 0.28, 0.28], shades],
  fist: [[-0.16, -0.16, 0.16, 0.16], fist],
};
const deathParts = (p, s) => spriteParts(p, DEATH_PARTS, s);

/**
 * His sprites at his drawn size, built before the first run (setup): his
 * own, his flinch's (open hands, the bare cannon) and his death's
 */
export function prepareTankDeath(p) {
  const s = TANK_SIZE * CONFIG.TANK_LOOK.ART_SCALE;
  tankParts(p, s);
  tankRaisedParts(p, s);
  deathParts(p, s);
}

// A part at (x, y), turned a, scaled k (ky across, for a tumble), about its
// own middle (mx, my)
function piece(g, part, x, y, a, k = 1, ky = 1, mx = 0, my = 0) {
  g.push();
  g.translate(x, y);
  g.rotate(a);
  g.scale(k, k * ky);
  g.translate(-mx, -my);
  stamp(g, part);
  g.pop();
}
// A four-point glint
function glint(p, x, y, r, a) {
  if (a <= 0.02) return;
  p.fill(255, 255, 255, 255 * a);
  p.quad(x - r, y, x, y - r * 0.2, x + r, y, x, y + r * 0.2);
  p.quad(x, y - r, x + r * 0.2, y, x, y + r, x - r * 0.2, y);
}
// Something flung from (x0, y0) along angle a: v0 px/s slowing with tau
function flung(x0, y0, a, v0, tau, t) {
  const d = v0 * tau * ease(t, tau);
  return [x0 + Math.cos(a) * d, y0 + Math.sin(a) * d];
}
const withAlpha = (p, a, fn) => {
  const ctx = p.drawingContext;
  const base = ctx.globalAlpha;
  ctx.globalAlpha = base * a;
  fn();
  ctx.globalAlpha = base;
};
const platesOn = (pose) =>
  Object.fromEntries(PLATES.map((n) => [n, (pose.plates?.[n] ?? 1) > 0]));

// ---- the air ------------------------------------------------------------------------
export const AIR = {
  FLY_FROM: 0.18, // the air starts to go, once his shades and chain are off
  LIMP_SEC: 1.2, // he drifts, empty, this long (× linger)
  FADE_SEC: 0.5,
  SPEED: 260, // px/s on full jet
  TETHER_PX: 55, // past this from where he died, his next dart turns back
  DRIFT: 30, // px/s once empty
  LEFT: 0.3, // what is left of him
  SKIN_IN: 0.1, // s: his drawn body hands over to the slack skin
  JET_ON_SEC: 0.08, // the jet comes on over this
  JET_FULL_SEC: 0.25, // and is full this long before it dies away
  DART_FIRST: 0.05, // s after the air starts: the first dart
  DART_EVERY: [0.09, 0.08], // the next, this plus up to that much later
  DART_FLIP: 0.7, // the odds a dart turns the other way
  DART_TURN: [0.9, 1.4], // rad, a dart's turn, and up to this much more
  DART_BACK: 0.9, // rad either side of straight back, a dart past the tether
  TURN_TAU: 0.035, // how fast he swings onto a dart's heading
  SPEED_TAU: 0.06,
  KNOCK_PX_S: 110, // the blow's shove
  KNOCK_TAU: 0.07,
  SPIN_AFTER: 1.6, // rad/s he turns once empty, dying away over SPIN_TAU
  SPIN_TAU: 2,
  DRIFT_FROM: 0.3, // s after the air starts: he drifts on as well
  PATH_SEC: 7, // his path, worked out this far
  SEED_STEPS: 1e9,
  DART_SALT: 11,
  // The zip, how long he darts about: the jet's fade divides by it less
  // JET_FULL_SEC, and the squeal's slides need it above about 0.45 s
  ZIP_MIN_SEC: 0.5,
  ZIP_MAX_SEC: 2,
};
/** His timing, from the zip at his death: when the air starts, how long it lasts, when it is out */
export function airTiming(zip) {
  const sec = Math.min(AIR.ZIP_MAX_SEC, Math.max(AIR.ZIP_MIN_SEC, zip));
  return { from: AIR.FLY_FROM, sec, done: AIR.FLY_FROM + sec };
}
// How hard the air jets out, 0..1
const airFlow = (T, t) =>
  smooth(clamp01((t - T.from) / AIR.JET_ON_SEC)) *
  (1 -
    smooth(
      clamp01((t - T.from - AIR.JET_FULL_SEC) / (T.sec - AIR.JET_FULL_SEC))
    ));
// How full he still is, 1..AIR.LEFT: fastest at first
const airFull = (T, t) => {
  const u = clamp01((t - T.from) / T.sec);
  return 1 - (1 - AIR.LEFT) * (1 - (1 - u) ** 2);
};
/**
 * When he darts and the dice for each dart. The path and the squeal both
 * read it, from his seed
 */
export function airDarts(T, seed) {
  const r = mulberry32(Math.floor(seed * AIR.SEED_STEPS) + AIR.DART_SALT);
  let sgn = r() < 0.5 ? -1 : 1;
  const out = [];
  for (
    let at = T.from + AIR.DART_FIRST;
    at < T.done;
    at += AIR.DART_EVERY[0] + AIR.DART_EVERY[1] * r()
  ) {
    sgn = r() < AIR.DART_FLIP ? -sgn : sgn;
    out.push({ at, sgn, k: r() });
  }
  return out;
}
// His flight, worked out once at 60 Hz in his facing's frame: [x, y, heading].
// A let-go balloon: a sharp new heading on each dart, turning back toward
// where he died once he is TETHER_PX out; then a slow turning drift
function airPath(T, seed, knock) {
  const darts = airDarts(T, seed);
  const out = [];
  let x = 0;
  let y = 0;
  let h = 0;
  let v = 0;
  let target = 0;
  let spin = 1;
  let k = 0;
  const dt = 1 / 60;
  for (let i = 0; i <= 60 * AIR.PATH_SEC; i++) {
    const t = i * dt;
    out.push([x, y, h]);
    while (k < darts.length && darts[k].at <= t) {
      const dart = darts[k++];
      spin = dart.sgn;
      if (Math.hypot(x, y) > AIR.TETHER_PX) {
        const back = Math.atan2(-y, -x) - h;
        target =
          h +
          Math.atan2(Math.sin(back), Math.cos(back)) +
          (dart.k - 0.5) * AIR.DART_BACK;
      } else {
        target = h + dart.sgn * (AIR.DART_TURN[0] + AIR.DART_TURN[1] * dart.k);
      }
    }
    if (t < T.done) h += (target - h) * (1 - Math.exp(-dt / AIR.TURN_TAU));
    else
      h += spin * AIR.SPIN_AFTER * Math.exp(-(t - T.done) / AIR.SPIN_TAU) * dt;
    const want =
      AIR.SPEED * airFlow(T, t) + (t > T.from + AIR.DRIFT_FROM ? AIR.DRIFT : 0);
    v += (want - v) * (1 - Math.exp(-dt / AIR.SPEED_TAU));
    const vk = AIR.KNOCK_PX_S * Math.exp(-t / AIR.KNOCK_TAU);
    x += (Math.cos(h) * v + Math.cos(knock) * vk) * dt;
    y += (Math.sin(h) * v + Math.sin(knock) * vk) * dt;
  }
  return out;
}
function airAt(path, t) {
  const f = clamp01((t * 60) / (path.length - 1)) * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(f));
  const k = f - i;
  return path[i].map((v, n) => lerp(v, path[i + 1][n], k));
}

// ---- his skin -------------------------------------------------------------------
// His slab's outline seen from his centre, units of s: SKIN_N points round
// the union of the renderer's SLAB ellipses, so the skin starts as his shape
const SLAB_E = SLAB_ELLIPSES.map(([x, y, w, h]) => [x, y, w / 2, h / 2]);
const SKIN_N = 32;
const BALL_HI = BALL_SHINE; // the highlight on each shoulder dome
const SKIN = Array.from({ length: SKIN_N }, (_, i) => {
  const a = (i / SKIN_N) * 2 * PI;
  const c = Math.cos(a);
  const n = Math.sin(a);
  let R = 0;
  for (const [ex, ey, rx, ry] of SLAB_E) {
    const A = (c / rx) ** 2 + (n / ry) ** 2;
    const B = -2 * ((ex * c) / rx ** 2 + (ey * n) / ry ** 2);
    const K = (ex / rx) ** 2 + (ey / ry) ** 2 - 1;
    const disc = B * B - 4 * A * K;
    if (disc >= 0) R = Math.max(R, (-B + Math.sqrt(disc)) / (2 * A));
  }
  return [R * c, R * n];
});
// Which of them are his tanned front, in order round from his left to his
// right. TankRenderer's collar line is near x = -0.1; this starts it a
// little further forward, so his folding shoulder tips stay pale
const SKIN_FRONT = SKIN.map((_, i) => i)
  .filter((i) => SKIN[i][0] > 0.12)
  .sort((i, j) => ((i + SKIN_N / 2) % SKIN_N) - ((j + SKIN_N / 2) % SKIN_N));
const CRUMPLE_SEED = 777;
const CRUMPLE = (() => {
  const r = mulberry32(CRUMPLE_SEED);
  return SKIN.map(() => r() - 0.5);
})();
// Creases, units of s: from the hole in his back out across him, and the
// folds where his shoulders flop
const CREASES = [
  ...[-1.3, -0.75, -0.25, 0.25, 0.75, 1.3].map((a) => [
    -BOMB_AT,
    0,
    -BOMB_AT + Math.cos(a) * 0.75,
    Math.sin(a) * 1.05,
  ]),
  [-0.15, -0.42, 0.18, -0.95],
  [-0.15, 0.42, 0.18, 0.95],
];
// His depth at t, as a share of what it was
const airDepth = (T, t) =>
  lerp(0.62, 1, (airFull(T, t) - AIR.LEFT) / (1 - AIR.LEFT));
// How slack he is at t: the skin's stretch, fold, ripple and crumple
function slack(T, t) {
  const full = airFull(T, t);
  const q = (full - AIR.LEFT) / (1 - AIR.LEFT); // 1 full .. 0 empty
  const flow = airFlow(T, t);
  return {
    full,
    flow,
    ax: airDepth(T, t), // his depth goes a little
    ay: lerp(0.36, 1, q), // his shoulders go a lot
    sag: 1 - q, // his shoulders fold back
    amp: 0.09 * flow + 0.05 * (1 - q) * (1 - flow), // a fast flutter, then a slow wallow
    ph: t * (3 + 24 * flow),
    crumple: 0.22 * (1 - q),
  };
}
// A point of him (units of s) where it is on the slack skin, px
const onSkin = (s, k, x, y) => [
  s * (x * k.ax - k.sag * 0.45 * (y / 1.25) ** 2),
  s * y * k.ay,
];
// A smooth closed curve through the midpoints of pts, pushed out by grow px
function blob(ctx, pts, grow = 0) {
  const q = pts.map(([x, y]) => {
    const l = Math.hypot(x, y) || 1;
    return [x + (x / l) * grow, y + (y / l) * grow];
  });
  const n = q.length;
  ctx.beginPath();
  ctx.moveTo((q[n - 1][0] + q[0][0]) / 2, (q[n - 1][1] + q[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const [x, y] = q[i];
    const [nx, ny] = q[(i + 1) % n];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  ctx.closePath();
}
// A ribbon along pts, w0 wide at its root and w1 at its end
function ribbon(ctx, pts, w0, w1) {
  const L = [];
  const R = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[Math.max(0, i - 1)];
    const [bx, by] = pts[Math.min(n - 1, i + 1)];
    const l = Math.hypot(bx - ax, by - ay) || 1;
    const w = lerp(w0, w1, i / (n - 1)) / 2;
    const nx = (-(by - ay) / l) * w;
    const ny = ((bx - ax) / l) * w;
    L.push([pts[i][0] + nx, pts[i][1] + ny]);
    R.unshift([pts[i][0] - nx, pts[i][1] - ny]);
  }
  ctx.beginPath();
  [...L, ...R].forEach(([x, y], i) =>
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  );
  ctx.closePath();
}
// His arm as a slack noodle from the shoulder: rest is the angle it starts
// at, trail the angle it streams out behind at, a wave runs down it
function noodle(s, k, side, t, limp) {
  const [x0, y0] = onSkin(s, k, SHOULDER[0], side * SHOULDER[1]);
  // Streaming out behind him; once empty, not quite evenly
  const base = lerp(side * -0.66, side * (2.45 + 0.25 * side), limp);
  const amp = 0.55 * k.flow + 0.36 * (1 - k.flow) * limp;
  const w = lerp(5, 24, k.flow);
  const seg = (s * ARM_L * (1 + 0.15 * (1 - k.full))) / 5;
  const curl = side * 0.18 * (1 - k.flow) * limp; // empty, it curls up limp
  const pts = [[x0, y0]];
  let a = base;
  for (let i = 1; i <= 5; i++) {
    a += amp * 0.55 * Math.sin(w * t - 1.2 * i + side * 1.7) + curl;
    const [px, py] = pts[i - 1];
    pts.push([px + Math.cos(a) * seg, py + Math.sin(a) * seg]);
  }
  return { pts, end: a };
}
// The skin is drawn on the canvas directly: a p5 fill() builds a colour
// object each time, and this runs about 30 fills a frame
const CSS = Object.fromEntries(
  Object.entries(C).map(([n, c]) => [n, `rgb(${c.join(',')})`])
);
function oval(ctx, css, a, x, y, w, h = w) {
  if (a <= 0.02) return;
  const base = ctx.globalAlpha;
  ctx.globalAlpha = base * Math.min(1, a);
  ctx.fillStyle = css;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, 2 * PI);
  ctx.fill();
  ctx.globalAlpha = base;
}
// A puff of air, as his ear steam is drawn
function airPuff(ctx, x, y, dia, a) {
  oval(ctx, CSS.ink, 0.35 * a, x, y, dia + 2.5);
  oval(ctx, CSS.steam, 0.92 * a, x, y, dia);
}
// Him as a slack skin, in his own frame
function slackSkin(p, s, d, t, T, M, turn) {
  const tp = tankParts(p, s);
  const ctx = p.drawingContext;
  const k = slack(T, t);
  const on = platesOn(d.pose);
  const limp = smooth(clamp01((t - T.from) / 0.3));
  const pts = SKIN.map(([bx, by], i) => {
    const a = (i / SKIN_N) * 2 * PI;
    const r =
      1 +
      k.amp *
        (0.6 * Math.sin(3 * a + k.ph) + 0.4 * Math.sin(5 * a - 1.3 * k.ph)) +
      k.crumple * CRUMPLE[i];
    return onSkin(s, k, bx * r, by * r);
  });
  // The skin: an ink edge, pale, his tanned front (the same curve, closed
  // across at his collar), the last of his muscle, creases and the hole
  ctx.fillStyle = CSS.ink;
  blob(ctx, pts, 2.2);
  ctx.fill();
  ctx.fillStyle = CSS.pale;
  blob(ctx, pts);
  ctx.fill();
  const mid = (i, j) => [
    (pts[i][0] + pts[j][0]) / 2,
    (pts[i][1] + pts[j][1]) / 2,
  ];
  const F = SKIN_FRONT;
  ctx.beginPath();
  ctx.moveTo(...mid((F[0] + SKIN_N - 1) % SKIN_N, F[0]));
  for (const i of F) {
    ctx.quadraticCurveTo(...pts[i], ...mid(i, (i + 1) % SKIN_N));
  }
  ctx.closePath();
  ctx.fillStyle = CSS.skin;
  ctx.fill();
  const muscle = clamp01((k.full - 0.45) / 0.55);
  for (const y of [-1, 1]) {
    const [mx, my] = onSkin(s, k, BALL_HI[0], y * BALL_HI[1]);
    oval(ctx, CSS.skinMid, muscle, mx, my, s * 0.58 * k.ax, s * 0.54 * k.ay);
    oval(
      ctx,
      CSS.skinHi,
      muscle,
      mx + s * 0.04,
      my - y * s * 0.05,
      s * 0.24 * k.ax,
      s * 0.2 * k.ay
    );
  }
  const [sx0, sy0] = onSkin(s, k, -0.4, 0);
  oval(ctx, CSS.paleShade, 1, sx0, sy0, s * 0.36 * k.ax, s * 0.045);
  const crease = clamp01((0.92 - k.full) * 2.2);
  if (crease > 0.02) {
    ctx.beginPath();
    for (const [x0, y0, x1, y1] of CREASES) {
      for (let i = 0; i <= 5; i++) {
        const u = (i / 5) * 0.9;
        const wig = (i % 2 ? 1 : -1) * 0.05 * k.sag * Math.sin((u / 0.9) * PI);
        const [cx, cy] = onSkin(
          s,
          k,
          lerp(x0, x1, u) - (y1 - y0) * wig,
          lerp(y0, y1, u) + (x1 - x0) * wig
        );
        if (i) ctx.lineTo(cx, cy);
        else ctx.moveTo(cx, cy);
      }
    }
    const base = ctx.globalAlpha;
    ctx.globalAlpha = base * 0.75 * crease;
    ctx.strokeStyle = CSS.ink;
    ctx.lineWidth = s * 0.04;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.globalAlpha = base;
  }
  // The hole in his back, and the air jetting out of it
  const [hx, hy] = onSkin(s, k, -BOMB_AT, 0);
  const [ix, iy, px0, py0] = OPEN.HOLE;
  oval(ctx, CSS.ink, 1, hx, hy, s * ix, s * iy);
  oval(ctx, CSS.paleShade, 1, hx, hy, s * px0, s * py0);
  piece(p, tp.pack, 0, 0, 0, lerp(0.7, 1, k.full));
  if (k.flow > 0.03) {
    // A stream of puffs spurting back out of the hole, sputtering
    const len = s * (0.2 + 0.6 * k.flow);
    const wid = s * (0.1 + 0.1 * k.flow);
    for (let j = 3; j >= 0; j--) {
      const u = (j + ((t * 14) % 1)) / 4;
      const jx = hx - len * u;
      const jy = hy + Math.sin(t * 61 + j * 2.3) * wid * 0.3 * u;
      const dia =
        wid * (0.7 + 1.1 * u) * (0.85 + 0.3 * Math.abs(Math.sin(t * 47 + j)));
      airPuff(ctx, jx, jy, dia, (1 - u * 0.8) * k.flow);
      oval(ctx, CSS.white, 0.86 * (1 - u) * k.flow, jx, jy, dia * 0.45);
    }
  }
  // His arms: noodles streaming out behind, flapping; his little fists
  const thick = s * ARM_T * (0.32 + 0.68 * k.full * k.full);
  for (const side of [-1, 1]) {
    const { pts: ap, end } = noodle(s, k, side, t, limp);
    ctx.fillStyle = CSS.ink;
    ribbon(ctx, ap, thick + 2.2, thick * 0.7 + 2.2);
    ctx.fill();
    ctx.fillStyle = CSS.skinMid;
    ribbon(ctx, ap, thick, thick * 0.7);
    ctx.fill();
    const [fx, fy] = ap[ap.length - 1];
    piece(p, M.fist, fx, fy, end - PI / 2, 0.45 + 0.45 * k.full);
  }
  // His plates hang loose and flap on him
  const pk = lerp(0.6, 1, k.full);
  const flap = (ph) =>
    0.3 * k.flow * Math.sin(t * 19 + ph) + 0.12 * k.sag * Math.sin(t * 3 + ph);
  piece(
    p,
    on.front ? tp.guard : tp.guardBare,
    s * 0.1 * (1 - k.full),
    0,
    flap(0.5),
    pk
  );
  for (const [name, side] of [
    ['left', -1],
    ['right', 1],
  ]) {
    const [px, py] = onSkin(s, k, 0, side * PAD_Y);
    piece(
      p,
      on[name] ? tp.pad : tp.padBare,
      px,
      py,
      side * 0.55 * k.sag + flap(side * 2),
      pk,
      side
    );
  }
  // His head: bone, not air, so it hardly shrinks; it bobs on the slack
  // neck, and without his shades his little sad eyes show
  const [nx] = onSkin(s, k, HEAD_X, 0);
  const bob =
    0.35 * k.flow * Math.sin(t * 17) +
    0.18 * limp * (1 - k.flow) * Math.sin(t * 3.1);
  p.push();
  p.translate(nx, 0);
  p.rotate(bob);
  p.scale(lerp(0.9, 1, k.full));
  stamp(p, M.headSad);
  p.rotate(-(turn + bob));
  oval(ctx, CSS.white, 0.9, -s * 0.06, -s * 0.065, s * 0.13, s * 0.08);
  p.pop();
}

// His first moments, as the living tank is drawn: a pump of the bang, the
// back's white flash, his shades and chain off, his sad face from SAD_FROM
const OPEN = {
  PUMP: 0.16,
  PUMP_SEC: 0.14,
  FLASH_TAU: 0.07,
  SAD_FROM: 0.03,
  LAUNCH: 0.02, // s: his shades and chain are blown off
  GLINT_AFTER: 0.4, // they glint on each kick from this long after
  GLINT_SEC: 0.15,
  HOLE: [0.15, 0.12, 0.08, 0.06], // the bomb's hole in his back: ink, then pale, units of s
  CANNON_V: 70, // px/s: his cannon, let go as the air starts
  CANNON_TAU: 0.4,
  CANNON_SPIN: 2.2,
  CANNON_FADE_SEC: 0.7,
};
// The air he leaves behind: a puff every TRAIL_EVERY s, each lasting TRAIL_SEC
const TRAIL_EVERY = 0.03;
const TRAIL_SEC = 0.4;

export class TankDeath {
  /**
   * @param {object} o
   * @param {number} o.x where he died (his centre)
   * @param {number} o.y
   * @param {number} o.size his drawn size, px
   * @param {object} o.pose his last pose (Tank#pose)
   * @param {number} o.dir the way the blow sent him, rad
   * @param {number} o.seed 0..1, his own
   * @param {number} o.diedAt the audio clock at the kill, s
   * @param {number} o.startsAt when his death is heard, on the audio clock, s
   * @param {() => number} o.now the audio clock, s
   * @param {() => number} o.kickAge seconds since the last heard kick
   */
  constructor({ x, y, size, pose, dir, seed, diedAt, startsAt, now, kickAge }) {
    Object.assign(this, { x, y, size, pose, dir, seed });
    Object.assign(this, { diedAt, startsAt, now, kickAge });
    // What he keeps from his start: a ?tune slider moved mid-death changes the next
    this.timing = airTiming(CONFIG.DEATHS.TANK_ZIP_SEC);
    this.linger = CONFIG.DEATHS.LINGER;
    this.path = null;
    this.active = true;
  }

  // He runs on the audio clock, as he is drawn
  update() {}

  draw(p) {
    if (!this.active) return;
    const t = this.now() - this.startsAt;
    p.push();
    p.translate(this.x, this.y);
    p.noStroke();
    if (t < 0) drawTank(p, this.size, this.pose);
    else if (!this.drawAir(p, t)) this.active = false;
    p.pop();
  }

  // From the start: False once all gone.
  drawAir(p, t) {
    const s = this.size;
    const T = this.timing;
    const tp = tankParts(p, s);
    const M = deathParts(p, s);
    const end = T.done + AIR.LIMP_SEC * this.linger;
    const fade = 1 - smooth(clamp01((t - end) / AIR.FADE_SEC));
    if (fade <= 0) return false;
    const facing = this.pose.facing;
    this.path ??= airPath(T, this.seed, this.dir - facing);
    const path = this.path;
    const [x, y, h] = airAt(path, t);
    p.push();
    p.rotate(facing);
    withAlpha(p, fade, () => {
      // The air he leaves behind: puffs from the hole, where it was
      // shortcut: a puff every 0.03 s; the trail was the costliest part (0.27 ms at 0.02 s)
      for (
        let te =
          T.from +
          Math.max(0, Math.ceil((t - TRAIL_SEC - T.from) / TRAIL_EVERY)) *
            TRAIL_EVERY;
        te < Math.min(t, T.done);
        te += TRAIL_EVERY
      ) {
        const a = t - te;
        const [ex, ey, eh] = airAt(path, te);
        const hole = s * BOMB_AT * airDepth(T, te);
        const back = eh + PI + Math.sin(te * 91) * 0.3;
        const dist =
          TRAIL_PUSH.PUSH * ease(a, TRAIL_PUSH.PUSH_TAU) + TRAIL_PUSH.DRIFT * a;
        airPuff(
          p.drawingContext,
          ex - Math.cos(eh) * hole + Math.cos(back) * dist,
          ey - Math.sin(eh) * hole + Math.sin(back) * dist,
          s * (0.09 + 0.42 * (a / TRAIL_SEC)) * (0.4 + 0.6 * airFlow(T, te)),
          (1 - a / TRAIL_SEC) * 0.9
        );
      }
      // His cannon, let go as the air starts
      if (t >= T.from) {
        const [cx, cy, ch] = airAt(path, T.from);
        const u = t - T.from;
        const a = clamp01(1 - u / OPEN.CANNON_FADE_SEC);
        if (a > 0) {
          const [qx, qy] = flung(
            cx + Math.cos(ch) * s * FIST[0],
            cy + Math.sin(ch) * s * FIST[0],
            ch,
            OPEN.CANNON_V,
            OPEN.CANNON_TAU,
            u
          );
          withAlpha(p, a, () =>
            piece(
              p,
              tp.cannon,
              qx,
              qy,
              ch + OPEN.CANNON_SPIN * ease(u, 0.6),
              1 - 0.3 * u,
              1
            )
          );
        }
      }
      // Him: drawn as he was until the air goes, then a slack skin
      p.push();
      p.translate(x, y);
      p.rotate(h);
      const skinIn = clamp01((t - T.from) / AIR.SKIN_IN);
      if (skinIn > 0) slackSkin(p, s, this, t, T, M, facing + h);
      if (skinIn < 1) {
        const pump = 1 + OPEN.PUMP * Math.sin(PI * clamp01(t / OPEN.PUMP_SEC));
        // In his own frame here, so his drawing is turned back by his facing
        p.rotate(-facing);
        withAlpha(p, 1 - skinIn, () =>
          drawTank(
            p,
            s,
            { ...this.pose, backHit: env(t, OPEN.FLASH_TAU), hit: 0 },
            {
              k: pump,
              chain: false,
              cannon: t < T.from,
              head: t < OPEN.SAD_FROM ? undefined : M.headSad,
              back: (g) => {
                const [w0, h0, w1, h1] = OPEN.HOLE;
                g.fill(...C.ink);
                g.ellipse(-s * BOMB_AT, 0, s * w0, s * h0);
                g.fill(...C.paleShade);
                g.ellipse(-s * BOMB_AT, 0, s * w1, s * h1);
              },
            }
          )
        );
      }
      p.pop();
      // His shades and his chain, blown off ahead of him
      if (t >= OPEN.LAUNCH) {
        const u = t - OPEN.LAUNCH;
        // A glint on every heard kick, once they are off
        const kick = this.kickAge();
        const bling =
          t > OPEN.GLINT_AFTER ? Math.max(0, 1 - kick / OPEN.GLINT_SEC) : 0;
        for (const [part, F] of [
          [M.shades, FLING.shades],
          [tp.chain, FLING.chain],
        ]) {
          const [fx, fy] = flung(s * F.AT[0], s * F.AT[1], F.A, F.V, F.TAU, u);
          const spin = F.A + F.SPIN * ease(u, F.SPIN_TAU);
          const flip = Math.cos(2 * PI * F.FLIPS * ease(u, F.FLIP_TAU));
          piece(
            p,
            part,
            fx + F.DRIFT[0] * u,
            fy + F.DRIFT[1] * u,
            spin,
            1,
            flip,
            s * F.MID,
            0
          );
          glint(
            p,
            fx + F.GLINT_OFF[0],
            fy + F.GLINT_OFF[1],
            s * F.GLINT,
            Math.max(
              bling,
              Math.sin(PI * clamp01((u - F.GLINT_AT) / FLING.GLINT_SEC))
            )
          );
        }
      }
    });
    p.pop();
    return true;
  }
}
