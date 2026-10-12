/**
 * The stabber's death, Gold shatter (on ?tune; StabberDeath.js). Frozen on
 * the kill, ink cracks run across his shell from where the shot struck; on
 * the eighth his shell shatters into curved gold plates (his ink edge, his
 * goldHi rim) and a few bits of magenta flesh, tumbling out in a ragged ring
 * thrown along the blow, their rims catching the light on the next eighths
 * till they go. His bone spike is left spinning alone in the middle
 * (white-hot if he was, cooling through ember to bone); it swings round to
 * the hero, jabs at him once, and crumbles to bone. Its sound is
 * DeathSounds.js's stabberShatter.
 *
 * Ported from `death-shatter.js` on the stabber death studies page
 * (StabberDeath.js names it); from the port on, these constants are the
 * authority. His shapes and colours are StabberRenderer.js's; his body at
 * the kill is its stabberBody, kept in the death's record. Everything is
 * worked out from its age and seed; d.state only caches.
 */
import {
  env,
  smooth,
  clamp01,
  easeOut,
  drift,
  mulberry32,
  normalizeAngle,
} from '../mathUtils.js';
import {
  K,
  RGB,
  NOSE,
  SHELL,
  BLADE_W,
  BLADE_ROOT,
  drawStabber,
} from './StabberRenderer.js';

const PI = Math.PI;
const TAU = 2 * PI;
const SHELL_RX = 12; // units: his shell as an ellipse, for where a plate starts
const SHELL_RY = 8;
const COL = {
  ...RGB,
  ember: [255, 96, 52], // the spike, cooling: between white-hot and bone
};
COL.inside = COL.gold.map((v, i) => v + (COL.goldLo[i] - v) * 0.55); // a plate's inside
const INK = `rgb(${COL.ink})`;
const mix = (a, b, k) =>
  `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`;

// ---- the frozen moment: cracks run across his shell from the hit ----
const WAIT = {
  SWELL: 0.07, // he swells this much toward the shatter
  SHAKE_PX: 0.9, // and trembles this much
  FLASH: 0.7, // the hit's white on his shell
  FLASH_TAU: 0.05,
  // [rad off straight across him, segments, segment units, ink px from..to]:
  // two cracks right across him, widening toward the shatter, and short ones
  CRACKS: [
    [-0.3, 5, [4.4, 6], [1.5, 2.6]],
    [0.34, 5, [4, 5.6], [1.5, 2.6]],
    [-1.25, 2, [2.6, 3.6], [1, 1.5]],
    [1.3, 2, [2.4, 3.4], [1, 1.5]],
  ],
  FAN_JITTER: 0.12,
  KINK: [0.45, 0.85], // rad, alternating: a zigzag, not a seam
  GROW_SEC: 0.07, // they run their length over this (or the wait, if shorter)
  HOT_CORE_PX: 0.8, // white-hot: light through the big ones
  CHIP_PX: 2.8, // a plate chips off where the shot struck
  CHIP_OUT_PX: 3,
};
// ---- the shatter: his silhouette flashes, then its outline flies off ----
const FLASH = {
  FILL_SEC: 0.017, // solid for a frame (a fading fill reads as a dim blob)
  ALPHA: 0.9,
  SEC: 0.05, // the outline, growing and thinning
  HOT_SEC: 0.06,
  GROW: 1,
  PX: [2.4, 0.6],
};
// ---- the plates of his shell and bits of his flesh ----
const SHARDS = {
  // [count, radius px, kind]: big plates, small plates, flesh
  KINDS: [
    [6, [4.2, 5.2], 'gold'],
    [6, [2.9, 3.7], 'gold'],
    [4, [1.9, 2.5], 'flesh'],
  ],
  JITTER: 0.4, // rad off even spacing round him
  R: 34, // px: how far out they end, on average
  R_K: [0.7, 1.2], // each, times that
  BIAS: 0.5, // further along the blow (1 + BIAS), less against it
  FLESH_R: 0.7, // flesh is heavy: it goes this much less far
  HOT: 1.15, // a white-hot death flings them further
  HARD: 1.25, // a blast, further still
  TAU: 0.11, // s: out fast, then slow
  CREEP: 7, // px/s outward after
  PUSH_PX: 12, // the blow carries them all this far
  PUSH_TAU: 0.15,
  SWIRL: 0.25, // rad: they turn this far with the spike's spin
  SWIRL_TAU: 0.35,
  SPIN: [5, 12], // rad/s, each tumbling round
  FLIP: [2, 6], // rad/s, each flipping over (its inside shows)
  FLIP_FROM: 1, // rad either side of face up, at first
  TUMBLE_TAU: 0.6,
  FLAT: 0.35, // edge-on they still show this much of their width
  POP: 0.4, // this much bigger at first
  POP_TAU: 0.07,
  OUT: [2, 3], // eighths after the shatter (× linger) they go on, in two halves
  GONE_SEC: 0.1, // they shrink away over this
  SHRINK: 0.2, // over their life
  INK_PX: 1.1,
  WHITE_SEC: 0.06, // they come out pale and turn gold over this
  HOT_WHITE_SEC: 0.16, // white-hot, over this
  // Their rims catch the light on each eighth: the rim's width (of the plate's
  // bulge) and how white it goes
  RIM: 1.2,
  RIM_CATCH: 2.3,
  CATCH_WHITE: 0.7,
  CATCH_TAU: 0.06,
  GLINTS: 3, // white-hot: tiny glints on the first plates, for a moment
  GLINT_PX: 2.4,
  GLINT_TAU: 0.07,
};
const SPIKE = {
  SPIN: [17, 23], // rad/s at first
  SPIN_TAU: 0.55,
  HOME_TAU: 0.1, // it settles into the ring's middle
  COOL_TAU: 0.3, // white-hot fades through ember to bone
  SWEEP_SEC: 0.06, // its tip's whoosh line: this far back in its spin
  SWEEP_MAX: 1.4, // rad
  SWEEP_AT: 1.12, // of the tip's reach
  SWEEP_PX: 1.3,
  SWEEP_ALPHA: 0.8, // at SWEEP_FULL rad/s
  SWEEP_FULL: 15,
  GLINT_PX: 3.6, // white-hot: the lock's glint, still on its tip
  // Built to stab, it still wants the hero: it swings round to him over
  // AIM_SEC, jabs at him (a pathetic JAB_PX) on the eighth before it
  // crumbles, flushing hot, and shakes with rage until it does
  CRUMBLE: 4, // eighths after the shatter (× linger)
  AIM_SEC: 0.3,
  JAB_PX: 6,
  JAB_IN_SEC: 0.035,
  JAB_TAU: 0.07,
  JAB_HEAT: 0.7,
  SHAKE_PX: 1.1,
  FLASH_SEC: 0.05,
  // It crumbles: [count, size px, speed px/s off the blade]: chunks, then dust
  BITS: [
    [4, [2.4, 3.1], [45, 85]],
    [6, [1.3, 1.9], [30, 70]],
  ],
  DUST_TAU: 0.15,
  DUST_LIFE: 0.32, // s, × linger
};
const SEED_STEPS = 1e6;

/**
 * When the spike jabs and when it crumbles, s after the shatter: on the
 * song's eighths, CRUMBLE of them times the linger on (the sound's too)
 */
export function shatterTimes(r) {
  const n = Math.max(2, Math.round(SPIKE.CRUMBLE * r.linger));
  return { jab: r.eighthAfter(n - 1), crumble: r.eighthAfter(n) };
}

// His frame (body units), from his body at the kill: turned, shifted back
// (and trembling) along him, squashed, as drawStabber has him
function toFrame(c, B, sc) {
  c.scale(sc, sc);
  c.rotate(B.turn);
  c.translate(-B.back + B.tremble, 0);
  c.scale(K * B.sx, K * B.sy);
}

const shellPath = (c) => {
  c.beginPath();
  c.moveTo(NOSE, 0);
  for (const [, a, b, e] of SHELL) c.bezierCurveTo(...a, ...b, ...e);
};
// A point on his shell's ellipse at angle a (his frame, units)
function onShell(a) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const r = 1 / Math.sqrt((ca / SHELL_RX) ** 2 + (sa / SHELL_RY) ** 2);
  return [ca * r, sa * r, r];
}
// A four-point star, turned a, added to the path
function star(c, x, y, s, a) {
  const ca = Math.cos(a) * s;
  const sa = Math.sin(a) * s;
  const k = 0.2;
  c.moveTo(x + ca, y + sa);
  c.lineTo(x + k * (ca - sa), y + k * (sa + ca));
  c.lineTo(x - sa, y + ca);
  c.lineTo(x - k * (sa + ca), y + k * (ca - sa));
  c.lineTo(x - ca, y - sa);
  c.lineTo(x + k * (sa - ca), y - k * (sa + ca));
  c.lineTo(x + sa, y - ca);
  c.lineTo(x + k * (sa + ca), y + k * (sa - ca));
  c.closePath();
}

// A plate's shape, in units of its radius round its middle: a curved rim (a
// quadratic from the last point to the first through `rim`) and a broken
// edge back round. Flesh is rounder
function shardShape(r, flesh) {
  const th = r(0.55, 0.95);
  const pts = [Math.cos(th), Math.sin(th)];
  const n = r(0, 1) < 0.5 ? 2 : 3;
  for (let k = 1; k <= n; k++) {
    const a = th + ((TAU - 2 * th) * k) / (n + 1) + r(-0.25, 0.25);
    const d = flesh ? r(0.75, 0.95) : r(0.45, 0.95);
    pts.push(Math.cos(a) * d, Math.sin(a) * d);
  }
  pts.push(Math.cos(th), -Math.sin(th));
  const rim = [r(1.25, 1.45), r(-0.15, 0.15)];
  // Round its middle (its corners and its rim's bulge, averaged), so its
  // ink edge comes out even
  let mx = rim[0];
  let my = rim[1];
  for (let i = 0; i < pts.length; i += 2) {
    mx += pts[i];
    my += pts[i + 1];
  }
  mx /= pts.length / 2 + 1;
  my /= pts.length / 2 + 1;
  for (let i = 0; i < pts.length; i += 2) {
    pts[i] -= mx;
    pts[i + 1] -= my;
  }
  return { pts, rim: [rim[0] - mx, rim[1] - my] };
}
// Plates into the path: each [x, y, size px, cos, sin, flip (-1..1), shape];
// `ink` px bigger all round for the ink copy. Rims (w > 0): a crescent along
// each curved edge, w of the bulge wide. No arrays made per point: it runs
// for every plate, every frame
function shardsPath(c, list, ink, w = 0) {
  c.beginPath();
  for (const [x, y, s0, ca, sa, f, { pts, rim }] of list) {
    const s = s0 + ink;
    const ax = ca * s;
    const ay = sa * s;
    const bx = -f * sa * s;
    const by = f * ca * s;
    const n = pts.length;
    const ex = pts[n - 2];
    const ey = pts[n - 1];
    c.moveTo(x + ex * ax + ey * bx, y + ex * ay + ey * by);
    c.quadraticCurveTo(
      x + rim[0] * ax + rim[1] * bx,
      y + rim[0] * ay + rim[1] * by,
      x + pts[0] * ax + pts[1] * bx,
      y + pts[0] * ay + pts[1] * by
    );
    if (w) {
      const ix = rim[0] + ((pts[0] + ex) / 2 - rim[0]) * w;
      const iy = rim[1] + ((pts[1] + ey) / 2 - rim[1]) * w;
      c.quadraticCurveTo(
        x + ix * ax + iy * bx,
        y + ix * ay + iy * by,
        x + ex * ax + ey * bx,
        y + ex * ay + ey * by
      );
    } else
      for (let k = 2; k < n; k += 2)
        c.lineTo(
          x + pts[k] * ax + pts[k + 1] * bx,
          y + pts[k] * ay + pts[k + 1] * by
        );
    c.closePath();
  }
}

// Everything worked out once from the record, in d.state
function prep(d) {
  const st = d.state;
  if (st.shards) return st;
  const B = d.body;
  const rand = mulberry32(Math.floor(d.seed * SEED_STEPS) + 1);
  const r = (lo, hi) => lo + (hi - lo) * rand();
  const sc = d.scale;
  const L = Math.max(0.5, d.linger);
  // The cracks, from where the shot struck him (his frame, units)
  const hitAt = d.dir + PI - B.turn;
  const [hx, hy] = onShell(hitAt);
  const cracks = [];
  for (const [fan, segs, seg, px] of WAIT.CRACKS) {
    let a = hitAt + PI + fan + r(-1, 1) * WAIT.FAN_JITTER;
    const pts = [hx * 0.97, hy * 0.97];
    let len = 0;
    for (let k = 0; k < segs; k++) {
      const l = r(...seg);
      a += (k % 2 ? 1 : -1) * r(...WAIT.KINK);
      const n = pts.length;
      pts.push(pts[n - 2] + Math.cos(a) * l, pts[n - 1] + Math.sin(a) * l);
      len += l;
    }
    cracks.push({ pts, len, px, big: segs > 2 });
  }
  // The plates and flesh: round him, starting on his shell, thrown further
  // along the blow, all tumbling their own way
  const hard = d.blast ? SHARDS.HARD : 1;
  const far = (d.hot ? SHARDS.HOT : 1) * hard;
  const kinds = [];
  for (const [n, S, kind] of SHARDS.KINDS)
    for (let i = 0; i < n; i++) kinds.push([S, kind]);
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const shards = [];
  const a0 = r(0, TAU);
  kinds.forEach(([S, kind], i) => {
    const a = a0 + (TAU * i) / kinds.length + r(-1, 1) * SHARDS.JITTER;
    const r0 = onShell(a - B.turn)[2] * K * sc;
    const along = 1 + SHARDS.BIAS * Math.cos(a - d.dir);
    const flesh = kind === 'flesh';
    const R = SHARDS.R * r(...SHARDS.R_K) * along * far;
    shards.push({
      a,
      r0,
      go: Math.max(4, R * (flesh ? SHARDS.FLESH_R : 1) - r0),
      s: r(...S),
      kind,
      shape: shardShape(r, flesh),
      rot: r(0, TAU),
      spin: (rand() < 0.5 ? -1 : 1) * r(...SHARDS.SPIN),
      flip: r(-1, 1) * SHARDS.FLIP_FROM,
      flipV: (rand() < 0.5 ? -1 : 1) * r(...SHARDS.FLIP),
      end: d.eighthAfter(Math.max(1, Math.round(SHARDS.OUT[i % 2] * L))),
    });
  });
  const chip = shardShape(r, false);
  // The spike: from where it was, spun by the blow's sideways push
  const side = Math.sin(d.dir - B.turn);
  const sgn = Math.abs(side) > 0.2 ? Math.sign(side) : d.seed > 0.5 ? 1 : -1;
  const len = B.tip - BLADE_ROOT;
  const mid = (BLADE_ROOT + len / 3 - B.back + B.tremble) * sc; // its centroid, along him
  const { jab, crumble } = shatterTimes(d);
  const dust = [];
  for (const [n, S, V] of SPIKE.BITS) {
    for (let i = 0; i < n; i++) {
      dust.push({
        u: (i + r(0.2, 0.8)) / n, // along the blade, root to tip
        v: r(...V) * (i % 2 ? -1 : 1),
        s: r(...S),
        rot: r(0, TAU),
        shape: shardShape(r, false),
        life: SPIKE.DUST_LIFE * L * r(0.75, 1),
      });
    }
  }
  Object.assign(st, {
    hit: [hx, hy],
    hitAt,
    cracks,
    chip,
    shards,
    pushX: Math.cos(d.dir) * SHARDS.PUSH_PX * hard,
    pushY: Math.sin(d.dir) * SHARDS.PUSH_PX * hard,
    spike: {
      len,
      sx: Math.cos(B.turn) * mid,
      sy: Math.sin(B.turn) * mid,
      spin: sgn * r(...SPIKE.SPIN),
      heat: d.hot ? 1 : 0.45 * B.heat,
      jab,
      crumble,
      dust,
    },
  });
  return st;
}

// The cracks, run out to g (0..1), u through the wait (they widen)
function drawCracks(c, st, g, u, hot) {
  c.save();
  shellPath(c);
  c.clip();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const crack = (big) => {
    c.beginPath();
    for (const { pts, len, big: b } of st.cracks) {
      if (big && !b) continue;
      let left = len * g;
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length && left > 0; i += 2) {
        const dx = pts[i] - pts[i - 2];
        const dy = pts[i + 1] - pts[i - 1];
        const l = Math.hypot(dx, dy);
        const k = Math.min(1, left / l);
        c.lineTo(pts[i - 2] + dx * k, pts[i - 1] + dy * k);
        left -= l;
      }
    }
    c.stroke();
  };
  c.strokeStyle = INK;
  for (const big of [true, false]) {
    const [a, b] = st.cracks.find((q) => q.big === big).px;
    c.lineWidth = (a + (b - a) * smooth(u)) / K;
    crack(big);
  }
  if (hot) {
    c.strokeStyle = `rgb(${COL.white})`;
    c.lineWidth = WAIT.HOT_CORE_PX / K;
    crack(true);
  }
  c.restore();
  // A plate chips off where the shot struck
  const k = smooth(clamp01(g * 1.5));
  if (k > 0.1) {
    const [x, y] = st.hit;
    const out = (WAIT.CHIP_OUT_PX * k) / K;
    const one = [
      [
        x + Math.cos(st.hitAt) * out,
        y + Math.sin(st.hitAt) * out,
        (WAIT.CHIP_PX * k) / K,
        Math.cos(st.hitAt),
        Math.sin(st.hitAt),
        1,
        st.chip,
      ],
    ];
    c.fillStyle = INK;
    shardsPath(c, one, SHARDS.INK_PX / K);
    c.fill();
    c.fillStyle = `rgb(${hot ? COL.hot : COL.gold})`;
    shardsPath(c, one, 0);
    c.fill();
    c.fillStyle = `rgb(${COL.goldHi})`;
    shardsPath(c, one, 0, SHARDS.RIM);
    c.fill();
  }
}

// The middle of the burst: the blow carries it a little
function ringMid(st, t) {
  const k = 1 - Math.exp(-t / SHARDS.PUSH_TAU);
  return [st.pushX * k, st.pushY * k];
}

function drawShards(c, st, d, t) {
  const [j, tj] = d.lastEighth(t);
  const tw = j >= 1 ? env(t - tj, SHARDS.CATCH_TAU) : 0;
  const [mx, my] = ringMid(st, t);
  const swirl =
    Math.sign(st.spike.spin) *
    SHARDS.SWIRL *
    (1 - Math.exp(-t / SHARDS.SWIRL_TAU));
  const pop = 1 + SHARDS.POP * env(t, SHARDS.POP_TAU);
  const front = [];
  const back = [];
  const flesh = [];
  for (const q of st.shards) {
    let k = pop * (1 - (SHARDS.SHRINK * Math.min(t, q.end)) / q.end);
    if (t >= q.end) {
      const u = (t - q.end) / SHARDS.GONE_SEC;
      if (u >= 1) continue;
      k *= 1 - smooth(u);
    }
    const a = q.a + swirl;
    const rr = q.r0 + q.go * (1 - Math.exp(-t / SHARDS.TAU)) + SHARDS.CREEP * t;
    const rot = q.rot + drift(q.spin, SHARDS.TUMBLE_TAU, t);
    const f = Math.cos(q.flip + drift(q.flipV, SHARDS.TUMBLE_TAU, t));
    const P = [
      mx + Math.cos(a) * rr,
      my + Math.sin(a) * rr,
      q.s * k,
      Math.cos(rot),
      Math.sin(rot),
      Math.sign(f || 1) * Math.max(SHARDS.FLAT, Math.abs(f)),
      q.shape,
    ];
    (q.kind === 'flesh' ? flesh : f >= 0 ? front : back).push(P);
  }
  const all = [...back, ...flesh, ...front];
  if (!all.length) return false;
  c.fillStyle = INK;
  shardsPath(c, all, SHARDS.INK_PX);
  c.fill();
  // Pale as they fly out (white-hot, longer), then his colours
  const pale = smooth(
    clamp01(t / (d.hot ? SHARDS.HOT_WHITE_SEC : SHARDS.WHITE_SEC))
  );
  const from = d.hot ? COL.hot : COL.goldHi;
  for (const [list, col] of [
    [back, COL.inside],
    [flesh, COL.flesh],
    [front, COL.gold],
  ]) {
    if (!list.length) continue;
    c.fillStyle = mix(from, col, pale);
    shardsPath(c, list, 0);
    c.fill();
  }
  // Their rims, catching the light on the eighths
  if (front.length) {
    c.fillStyle = mix(COL.goldHi, COL.white, SHARDS.CATCH_WHITE * tw);
    shardsPath(c, front, 0, SHARDS.RIM + (SHARDS.RIM_CATCH - SHARDS.RIM) * tw);
    c.fill();
  }
  // White-hot: a few tiny glints as they fly
  const gl = d.hot ? SHARDS.GLINT_PX * env(t, SHARDS.GLINT_TAU) : 0;
  if (gl > 0.5) {
    c.fillStyle = `rgb(${COL.white})`;
    c.beginPath();
    for (const [x, y] of front.slice(0, SHARDS.GLINTS)) star(c, x, y, gl, 0);
    c.fill();
  }
  return true;
}

// The blade, alone: root (broken off ragged) at x0, tip at x1, along +x
function bladePath(c, x0, x1, w, o) {
  c.moveTo(x0 - o, -w - o);
  c.lineTo(x1 + o * 1.6, 0);
  c.lineTo(x0 - o, w + o);
  c.lineTo(x0 - 1.3 - o, w * 0.4);
  c.lineTo(x0 + 0.9 - o, 0.2);
  c.lineTo(x0 - 1.1 - o, -w * 0.45);
  c.closePath();
}
function drawBlade(c, x0, x1, fill, hi, alpha) {
  const w = BLADE_W;
  c.globalAlpha = alpha;
  c.fillStyle = INK;
  c.beginPath();
  bladePath(c, x0, x1, w, 1.1);
  c.fill();
  c.fillStyle = fill;
  c.beginPath();
  bladePath(c, x0, x1, w, 0);
  c.fill();
  c.fillStyle = hi;
  c.beginPath();
  c.moveTo(x0 + 0.5, -w * 0.7);
  c.lineTo(x1 - 2.5, -0.25);
  c.lineTo(x0 + 0.5, -0.25);
  c.fill();
}

// The spike at t: where, its angle, its spin (rad/s), its jab (0..1). It
// turns to the hero where he is now
function spikeAt(st, d, t) {
  const S = st.spike;
  const [mx, my] = ringMid(st, t);
  const home = Math.exp(-t / SPIKE.HOME_TAU);
  let x = S.sx * home + mx * (1 - home);
  let y = S.sy * home + my * (1 - home);
  const spun = (u) => d.body.turn + drift(S.spin, SPIKE.SPIN_TAU, u);
  let a = spun(t);
  let w = S.spin * Math.exp(-t / SPIKE.SPIN_TAU);
  const from = S.jab - SPIKE.AIM_SEC;
  const k = smooth(clamp01((t - from) / SPIKE.AIM_SEC));
  if (k > 0) {
    // Round to the hero, from where its spin had it when it began
    const ref = spun(from);
    const to =
      ref + normalizeAngle(Math.atan2(d.hero.y - y, d.hero.x - x) - ref);
    a += (to - a) * k;
    w *= 1 - k;
  }
  const jt = t - S.jab;
  const jab =
    jt < 0
      ? 0
      : jt < SPIKE.JAB_IN_SEC
        ? jt / SPIKE.JAB_IN_SEC
        : Math.exp(-(jt - SPIKE.JAB_IN_SEC) / SPIKE.JAB_TAU);
  x += Math.cos(a) * SPIKE.JAB_PX * jab;
  y += Math.sin(a) * SPIKE.JAB_PX * jab;
  return [x, y, a, w, jab];
}

function drawSpike(c, st, d, t) {
  const S = st.spike;
  const sc = d.scale;
  const x0 = -S.len / 3;
  const x1 = (S.len * 2) / 3;
  if (t < S.crumble) {
    const [px, py, a, w, jab] = spikeAt(st, d, t);
    let x = px;
    let y = py;
    // From its jab it shakes with rage, harder to the end
    const shake = t > S.jab ? (t - S.jab) / (S.crumble - S.jab) : 0;
    if (shake > 0) {
      x += SPIKE.SHAKE_PX * shake * Math.sin(t * 157);
      y += SPIKE.SHAKE_PX * shake * Math.cos(t * 131);
    }
    const h = Math.min(
      1,
      S.heat * Math.exp(-t / SPIKE.COOL_TAU) + SPIKE.JAB_HEAT * jab
    );
    const fill =
      h > 0.5
        ? mix(COL.ember, COL.hot, (h - 0.5) * 2)
        : mix(COL.bone, COL.ember, h * 2);
    const hi = `rgb(${h > 0.5 ? COL.white : COL.boneHi})`;
    const base = c.globalAlpha;
    c.save();
    c.translate(x, y);
    c.scale(sc, sc);
    c.rotate(a);
    // The whoosh its tip leaves as it spins
    const sweep = Math.max(
      -SPIKE.SWEEP_MAX,
      Math.min(SPIKE.SWEEP_MAX, w * SPIKE.SWEEP_SEC)
    );
    const wa = SPIKE.SWEEP_ALPHA * Math.min(1, Math.abs(w) / SPIKE.SWEEP_FULL);
    if (wa > 0.03) {
      c.globalAlpha = base * wa;
      c.strokeStyle = hi;
      c.lineWidth = SPIKE.SWEEP_PX;
      c.lineCap = 'round';
      c.beginPath();
      const r = x1 * SPIKE.SWEEP_AT;
      c.moveTo(Math.cos(sweep) * r, -Math.sin(sweep) * r);
      c.arc(0, 0, r, -sweep, -sweep * 0.15, sweep < 0);
      c.stroke();
    }
    drawBlade(c, x0, x1, fill, hi, base);
    // White-hot: the lock's glint still on its tip, cooling off
    const gs = SPIKE.GLINT_PX * clamp01((h - 0.3) / 0.5);
    if (gs > 0.4) {
      c.rotate(-a);
      const gx = Math.cos(a) * x1;
      const gy = Math.sin(a) * x1;
      c.fillStyle = INK;
      c.beginPath();
      star(c, gx, gy, gs + 1.2, 0);
      c.fill();
      c.fillStyle = `rgb(${COL.hot})`;
      c.beginPath();
      star(c, gx, gy, gs, 0);
      c.fill();
    }
    c.restore();
    c.globalAlpha = base;
    return true;
  }
  // It crumbles: a white blink of it, and bone dust flung off its spin. Where
  // it crumbled is kept: the hero moving after doesn't move its dust
  const tc = t - S.crumble;
  const [x, y, a, w] = (st.crumbledAt ??= spikeAt(st, d, S.crumble));
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  let any = false;
  if (tc < SPIKE.FLASH_SEC) {
    any = true;
    const base = c.globalAlpha;
    c.save();
    c.translate(x, y);
    c.scale(sc, sc);
    c.rotate(a);
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = `rgb(${COL.hot})`;
    c.globalAlpha = base * (1 - tc / SPIKE.FLASH_SEC);
    c.beginPath();
    bladePath(c, x0, x1, BLADE_W, 0.6);
    c.fill();
    c.restore();
  }
  const live = [];
  for (const q of S.dust) {
    if (tc >= q.life) continue;
    const u = tc / q.life;
    const along = (x0 + (x1 - x0) * q.u) * sc;
    // Off the blade sideways, plus what its spin gave it
    const v = q.v + w * along;
    const go = drift(v, SPIKE.DUST_TAU, tc);
    const rot = q.rot + w * tc;
    live.push([
      x + ca * along - sa * go,
      y + sa * along + ca * go,
      q.s * (1 - u * u),
      Math.cos(rot),
      Math.sin(rot),
      1,
      q.shape,
    ]);
  }
  if (!live.length) return any;
  c.fillStyle = INK;
  shardsPath(c, live, 0.9);
  c.fill();
  c.fillStyle = `rgb(${COL.bone})`;
  shardsPath(c, live, 0);
  c.fill();
  return true;
}

/**
 * The frozen moment before the shatter: his last pose, his eye shut on the
 * hit, cracks running over his shell while he swells and trembles. d:
 * StabberDeath's frame (its record, age, since, wait, hero)
 */
export function drawShatterWait(p, d) {
  const st = prep(d);
  const u = d.wait > 0 ? clamp01(d.since / d.wait) : 1;
  const c = p.drawingContext;
  const base = c.globalAlpha;
  c.save();
  const j = WAIT.SHAKE_PX * smooth(u);
  c.translate(j * Math.sin(d.since * 137), j * Math.cos(d.since * 113));
  const sw = 1 + WAIT.SWELL * smooth(u);
  c.scale(sw, sw);
  drawStabber(p, d.scale, { ...d.pose, hit: 0, hitAge: d.since });
  toFrame(c, d.body, d.scale);
  const fl = WAIT.FLASH * env(d.since, WAIT.FLASH_TAU);
  if (fl > 0.02) {
    c.globalAlpha = base * fl;
    c.fillStyle = '#fff';
    shellPath(c);
    c.fill();
    c.globalAlpha = base;
  }
  const grow = Math.min(WAIT.GROW_SEC, Math.max(0.02, d.wait));
  drawCracks(c, st, smooth(clamp01(d.since / grow)), u, d.hot);
  c.restore();
}

/**
 * From the shatter: his silhouette's flash, the plates and the spike. False
 * once it is all gone. d: StabberDeath's frame, d.age ≥ 0
 */
export function drawShatter(p, d) {
  const st = prep(d);
  const t = d.age;
  const c = p.drawingContext;
  c.save();
  c.lineJoin = 'round';
  // His silhouette flashes, then its outline flies off, thinning
  const fs = d.hot ? FLASH.HOT_SEC : FLASH.SEC;
  if (t < fs) {
    const u = t / fs;
    const base = c.globalAlpha;
    const g = 1 + FLASH.GROW * easeOut(u);
    c.save();
    toFrame(c, d.body, d.scale);
    c.scale(g, g);
    c.fillStyle = c.strokeStyle = `rgb(${d.hot ? COL.hot : COL.goldHi})`;
    shellPath(c);
    if (t < FLASH.FILL_SEC) {
      c.globalAlpha = base * FLASH.ALPHA;
      c.fill();
    }
    c.globalAlpha = base * (1 - u) ** 2;
    c.lineWidth =
      (FLASH.PX[0] + (FLASH.PX[1] - FLASH.PX[0]) * u) / (K * g * d.scale);
    c.stroke();
    c.restore();
  }
  const shards = drawShards(c, st, d, t);
  const spike = drawSpike(c, st, d, t);
  c.restore();
  return shards || spike || t < fs;
}
