/**
 * The bang of the hero's bomb: the Comic blast. Ported from `comic` in
 * docs/superpowers/specs/2026-10-08-explosion-studies/bangs.js and what it
 * uses in bang-parts.js (git-ignored; the page is
 * https://claude.ai/artifact/GHjWCySGwv8cVCtWDoE6nV); the spec is
 * docs/superpowers/specs/2026-10-09-bomb-kill-design.md. From the port on,
 * these constants are the authority.
 *
 * A billowing fireball inked like the cast, white-hot cooling through mustard
 * to soot as it collapses; a fat white-hot shock ring bursts out (past the
 * nearest aliens within two frames) and slams to a stop at the bomb's reach,
 * then breaks into dashes and a few small puffs, gone within a second. The
 * fireball and ring are drawn over everyone (draw), the dashes and puffs
 * under everyone, with the cloud (drawUnder).
 *
 * It ages by the game's frame time, as the rusher's blast does, so it holds
 * still while the game does. It keeps the reach and linger it was made with.
 */
import { CONFIG } from '../../config.js';
import { clamp01, smooth, env, mulberry32 } from '../../mathUtils.js';

const TAU = Math.PI * 2;
const MS_PER_SEC = 1000;
// A bang's first frame already shows its first sixtieth of a second: at age 0
// exactly, something that grows from nothing would show nothing
const LEAD = 1 / 60;

// [r, g, b]: the cast's ink and colours a little off, beside the sky's teal,
// rust and ochre; no amber or hot pink (the rusher's), no coral or orange
// (the cloud's), no pale cyan (the hero's shield)
const COL = {
  ink: [38, 26, 48],
  hot: [255, 250, 234], // white-hot
  cream: [255, 244, 214],
  mustard: [238, 198, 84],
  soot: [70, 58, 72],
  smoke: [128, 118, 134], // grey smoke, a touch of mauve
  smokeHi: [182, 172, 182],
};
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const CSS = Object.fromEntries(
  Object.entries(COL).map(([k, v]) => [k, css(v)])
);
const HEAT_MUSTARD = 0.45; // where white-hot has cooled to mustard
/** Fire cooling, x 0..1: white-hot, then mustard, then soot */
const heat = (x) =>
  x < HEAT_MUSTARD
    ? mix(COL.hot, COL.mustard, clamp01(x / HEAT_MUSTARD))
    : mix(
        COL.mustard,
        COL.soot,
        clamp01((x - HEAT_MUSTARD) / (1 - HEAT_MUSTARD))
      );

/**
 * The edge of a blast wave, R at `sec` and held there: fast at first and
 * still moving when it gets there (radius grows as time to the power k, a
 * real blast's 0.4 to 0.5; less is faster at first), so it stops hard
 */
export const front = (age, sec, R, k) => R * clamp01(age / sec) ** k;

/** Circles [x, y, r] as one path, each grown by `grow` px (an ink copy behind) */
function circles(ctx, list, grow = 0) {
  ctx.beginPath();
  for (const c of list) {
    const r = c[2] + grow;
    if (r <= 0) continue;
    ctx.moveTo(c[0] + r, c[1]);
    ctx.arc(c[0], c[1], r, 0, TAU);
  }
  ctx.fill();
}

/**
 * A ring at r, w px wide, with an ink copy `ink` px wider behind it. With
 * `bits`, only the arcs [from, to] in radians (a broken ring)
 */
function ring(ctx, r, w, style, ink = 0, a = 1, bits = [[0, TAU]]) {
  if (r <= 0 || a <= 0) return;
  ctx.globalAlpha = a;
  ctx.lineCap = 'round'; // a broken ring's ends get their ink too
  ctx.beginPath();
  for (const [s, e] of bits) {
    ctx.moveTo(r * Math.cos(s), r * Math.sin(s));
    ctx.arc(0, 0, r, s, e);
  }
  if (ink > 0) {
    ctx.strokeStyle = CSS.ink;
    ctx.lineWidth = w + ink;
    ctx.stroke();
  }
  ctx.strokeStyle = style;
  ctx.lineWidth = w;
  ctx.stroke();
}

export const COMIC = {
  ARRIVE: 0.15, // s: the ring reaches the edge
  SHAPE: 0.3, // its speed (front's k): half the reach in a frame, still fast at the edge
  PUNCH: 0.07, // s: the fireball at full size
  FIRE: 100, // px: its size, about the tank's twice
  BURN: [0.1, 0.42], // s: it collapses over this, cooling to soot
  SOOT_SEC: 0.3, // it has cooled to soot by this
  SLAM: 0.1, // s: the ring's impact at the edge, drawn on top
  SLAM_W: [4, 8], // px: the ring's width, and how much fatter at the impact
  SLAM_TAU: 0.035,
  ECHO_PX: 70, // the echo bounces back this far
  RING_W: 7, // px, as it goes out
  RING_INK: 4,
  BREAK: 0.5, // s after the slam: it breaks into dashes that shrink away (times linger)
  DASHES: 18,
  PUFFS: 12,
  PUFF_HOLD: 0.35, // s after the slam, then they shrink away over PUFF_GO (times linger)
  PUFF_GO: 0.4,
  SHAKE: [32, 42], // the camera's shake at the bang: amplitude px, frames
};

/** When the ring is seen to land at the edge, from the bang (its sound's slam) */
export const RING_LANDS_SEC = COMIC.ARRIVE - LEAD;

const SEED_STEPS = 1e6;
const SEED_SALT = 11;
function comicLayout(seed) {
  const r = mulberry32(Math.floor(seed * SEED_STEPS) + SEED_SALT);
  const lumps = [[0, 0, 0.6]];
  for (let k = 0; k < 11; k++) {
    const th = (k / 11) * TAU + (r() - 0.5) * 0.45;
    const d = 0.46 + 0.24 * r();
    lumps.push([Math.cos(th) * d, Math.sin(th) * d, 0.3 + 0.2 * r()]);
  }
  const off = [(r() - 0.5) * 0.2, -0.08 - 0.1 * r()]; // the hot middle sits off-centre
  const puffs = [];
  for (let i = 0; i < COMIC.PUFFS; i++) {
    puffs.push({
      th: ((i + r() * 0.8) / COMIC.PUFFS) * TAU,
      m: 4.5 + 3 * r(),
      at: r() * 0.06,
      go: r(),
    });
  }
  return { lumps, off, puffs, turn: r() * TAU };
}

// One layer of the fireball, [x, y, r] in px: the lumps spread by `spread`,
// scaled by k as a whole (so a shrinking layer stays one blob), shifted by off
function fireLayer(L, F, spread, radK, k, off) {
  return L.lumps.map(([x, y, rr]) => [
    (x * spread + off[0]) * F * k,
    (y * spread + off[1]) * F * k,
    rr * F * radK * k,
  ]);
}

export class BombBlast {
  /**
   * @param {number} x where the bomb blew
   * @param {number} y
   * @param {number} seed 0..1, its own
   */
  constructor(x, y, seed) {
    this.x = x;
    this.y = y;
    this.seed = seed;
    this.reach = CONFIG.BOMB.RADIUS_PX; // the reach it hurt to, kept
    this.linger = CONFIG.DEATHS.LINGER;
    this.layout = comicLayout(seed);
    this.ageMs = 0;
    this.overDone = false; // the fireball and ring are gone
    this.underDone = false; // the dashes and puffs are gone
  }

  get active() {
    return !(this.overDone && this.underDone);
  }

  update(deltaTimeMs = CONFIG.GAME_SETTINGS.FRAME_TIME_MS) {
    this.ageMs += deltaTimeMs;
  }

  get age() {
    return this.ageMs / MS_PER_SEC + LEAD;
  }

  /** The fireball and the ring, over everyone */
  draw(p) {
    if (this.overDone) return;
    const a = this.age;
    const R = this.reach;
    const L = this.layout;
    const { ARRIVE, SLAM, BURN } = COMIC;
    const ctx = p.drawingContext;
    ctx.save();
    ctx.translate(this.x, this.y);
    // The fireball: billows round a hotter middle, inked, opaque to the end
    // (a see-through fire reads grey). It cools from the outside in, and
    // collapses as one blob, its middle going first
    if (a < BURN[1]) {
      const F = COMIC.FIRE * (1 - (1 - clamp01(a / COMIC.PUNCH)) ** 3);
      const u = clamp01((a - BURN[0]) / (BURN[1] - BURN[0]));
      const cool = Math.min(1, a / COMIC.SOOT_SEC);
      const outer = fireLayer(
        L,
        F,
        1 + 0.3 * u,
        1 - 0.3 * u,
        1 - smooth(u),
        [0, 0]
      );
      ctx.globalAlpha = 1;
      ctx.fillStyle = CSS.ink;
      circles(ctx, outer, 2.5);
      ctx.fillStyle = css(heat(0.25 + 0.75 * cool));
      circles(ctx, outer);
      ctx.fillStyle = css(heat(0.05 + 0.85 * cool));
      circles(
        ctx,
        fireLayer(L, F, 0.66, 0.7, 1 - smooth(clamp01(u * 1.4)), L.off)
      );
      ctx.fillStyle = css(heat(0.7 * cool));
      circles(
        ctx,
        fireLayer(L, F, 0.36, 0.48, 1 - smooth(clamp01(u * 2.2)), [
          L.off[0] * 1.6,
          L.off[1] * 1.6,
        ])
      );
    }
    // The shock ring, bursting out, then slamming into the edge: fatter and
    // whiter for an instant, and a thin echo bounces back
    if (a < ARRIVE + SLAM) {
      if (a < ARRIVE) {
        ring(
          ctx,
          front(a, ARRIVE, R, COMIC.SHAPE),
          COMIC.RING_W,
          CSS.hot,
          COMIC.RING_INK,
          1
        );
      } else {
        const k = (a - ARRIVE) / SLAM;
        const w =
          COMIC.SLAM_W[0] + COMIC.SLAM_W[1] * env(a - ARRIVE, COMIC.SLAM_TAU);
        ring(ctx, R - w / 2, w, CSS.hot, COMIC.RING_INK, 1);
        ring(ctx, R - COMIC.ECHO_PX * k, 3, CSS.cream, 0, 0.7 * (1 - k));
      }
    }
    ctx.restore();
    if (a >= Math.max(BURN[1], ARRIVE + SLAM)) this.overDone = true;
  }

  /** Under everyone, once it has stopped: the ring's dashes and a few puffs */
  drawUnder(p) {
    if (this.underDone) return;
    const R = this.reach;
    const L = this.layout;
    const since = this.age - COMIC.ARRIVE - COMIC.SLAM;
    if (since < 0) return;
    const lg = this.linger;
    const ctx = p.drawingContext;
    ctx.save();
    ctx.translate(this.x, this.y);
    const t = since / (COMIC.BREAK * lg);
    if (t < 1) {
      const n = COMIC.DASHES;
      const half = ((1 - smooth(t)) * Math.PI) / n;
      const bits = [];
      for (let i = 0; i < n; i++) {
        const c = ((i + 0.5) / n) * TAU + L.turn;
        bits.push([c - half, c + half]);
      }
      ring(ctx, R - 2.5, 4 - 1.5 * t, CSS.cream, 3, 1, bits);
    }
    const list = [];
    const his = [];
    for (const f of L.puffs) {
      const u = since - f.at;
      if (u <= 0) continue;
      const pop =
        u < 0.06 ? 1.2 * (u / 0.06) : 1 + 0.2 * Math.exp(-(u - 0.06) / 0.05);
      const go =
        1 -
        smooth(
          clamp01(
            (u - COMIC.PUFF_HOLD * lg * (0.8 + 0.4 * f.go)) /
              (COMIC.PUFF_GO * lg)
          )
        );
      const m = f.m * pop * go;
      if (m < 0.5) continue;
      const d = R - 1 - f.m * 1.25; // the puff stays inside the reach
      const c = Math.cos(f.th);
      const s = Math.sin(f.th);
      const x = c * d;
      const y = s * d;
      list.push(
        [x, y, m],
        [x - s * m * 0.9 - c * m * 0.3, y + c * m * 0.9 - s * m * 0.3, m * 0.7]
      );
      his.push([x - m * 0.25, y - m * 0.3, m * 0.5]);
    }
    if (list.length) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = CSS.ink;
      circles(ctx, list, 1.6);
      ctx.fillStyle = CSS.smoke;
      circles(ctx, list);
      ctx.fillStyle = CSS.smokeHi;
      circles(ctx, his);
    }
    ctx.restore();
    if (t >= 1 && list.length === 0 && since > 0) this.underDone = true;
  }
}
