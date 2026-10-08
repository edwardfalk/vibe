/**
 * The rusher's look: a daredevil from space riding a hot-pink rocket like a
 * motorbike. Ported from dir-stunt.js in
 * docs/superpowers/specs/2026-10-02-rusher-studies/ (git-ignored).
 *
 * Seen from the side, he is mirrored to face left or right and pitched along
 * his flight, never upside down. Each beat he boosts and leaves a puff. Lit,
 * he pops a wheelie and waves while the ring at his reach counts the beats;
 * his blast is the show's big finish.
 *
 * Coordinates are the prototype's px at his size 22 (PROTO_SIZE); the drawn
 * size scales them. The live parts go straight to the canvas context,
 * because p5's fill() makes a colour object per call, which costs more than
 * the shapes.
 */
import { CONFIG } from '../config.js';
import {
  clamp01,
  smooth,
  env,
  normalizeAngle,
  PI,
  TWO_PI,
} from '../mathUtils.js';
import { spriteParts } from './spriteCache.js';
import { GRUNT_COLORS, AMBER, HOT } from './GruntRenderer.js';
import { union } from './TankRenderer.js'; // one ink edge round a union of shapes, 2.2 px

export const PROTO_SIZE = 22; // his size, at which the prototype's px are drawn px
export const BOOST_ENV_SEC = 0.12; // his boost's envelope (Rusher.js pose)
export const BLAST_SEC = 2.3; // his blast's stars are gone by then
const O = 2.2; // the ink round each part, px (union's, the tank's): the grunt's 1.1 each side

// His palette, [r, g, b]. His glow and death fragments use it too, so it is
// frozen. Ink, eye whites and the warning colours are the cast's
export const RUSHER_COLORS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      ink: GRUNT_COLORS.ink,
      bike: [238, 84, 148], // hot pink, a little off toward raspberry
      bikeShade: [182, 54, 116],
      bikeHi: [255, 166, 206],
      stud: [116, 60, 120], // plum stars along his rocket
      nose: [84, 196, 188], // teal nose cone and fins: they point the way
      noseHi: [156, 230, 222],
      nozzle: [120, 112, 138],
      seat: [104, 80, 118],
      suit: [240, 232, 214], // his jumpsuit
      skin: [240, 156, 200], // a candy-pink alien
      helmet: [104, 120, 226], // periwinkle blue, a pink stripe, bone stars
      helmetHi: [156, 172, 250],
      star: [246, 240, 226],
      cape: [128, 144, 244],
      capeIn: [214, 64, 128],
      eye: GRUNT_COLORS.eye,
      flame: [192, 128, 255], // lilac exhaust: no amber, no white-hot
      flameCore: [255, 186, 238],
      puff: [214, 198, 246],
      socket: [92, 72, 104],
      count: [255, 112, 196], // the ring while more than one beat is left
      bulb: [120, 236, 222], // the starting tree's bulbs: teal, against his pink
      amber: AMBER, // the last beat
      hot: HOT, // the last half-beat
      soot: [40, 30, 40],
      smoke: [196, 188, 206],
      sweat: [170, 225, 255],
    }).map(([k, v]) => [k, Object.freeze([...v])])
  )
);
const CS = Object.fromEntries(
  Object.entries(RUSHER_COLORS).map(([k, v]) => [k, `rgb(${v.join(',')})`])
);

// His geometry, in the prototype's px
const AXIS = 7; // the rocket's axis, below his centre
const NOZZLE = -20; // the exhaust's exit, along x
const SLOTS = [-9.5, -4, 1.5, 7]; // the four stars along the rocket (x)
const SLOT_Y = 1.4; // and their height off the axis
const TREE_X = -21; // the starting tree, lit: it rises from his tail
const TREE_Y = -10;
const TREE_STEP = 8; // px a bulb
const HIP = [-5, -6.5]; // where he sits, off the axis
const NECK = 9; // hip to neck
const HEAD_R = 6.2;
const EYE = [3.2, -0.6];
const MOUTH = [4.2, 3.2];
const GAP = 0.24; // rad between the count ring's arcs: about 36 px at 150 px
// The flash as an arc of the count ring goes out: this wide, plus POP at its peak
const RING_FLASH_W = 4;
const RING_FLASH_POP_W = 8;
/** px the count ring reaches past its radius: half its widest stroke, the flash */
export const COUNT_RING_EDGE_PX = (RING_FLASH_W + RING_FLASH_POP_W) / 2;

/** His pitch in his own mirrored frame: drawn facing right, never upside down */
export const rusherTilt = (heading, side) =>
  normalizeAngle(side > 0 ? heading : PI - heading);

// ---- sprites: in a sprite, strokes are free ----
function star(g, x, y, r, rot = -PI / 2, inner = 0.45) {
  g.beginShape();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * PI) / 5;
    const rr = i % 2 ? r * inner : r;
    g.vertex(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.endShape(g.CLOSE);
}
const poly = (pts) => (g) => {
  g.beginShape();
  for (const [x, y] of pts) g.vertex(x, y);
  g.endShape(g.CLOSE);
};
// The nose cone, an ogive from the body's front (x0) to its tip (x1)
const ogive = (x0, x1, h) => {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    pts.push([x0 + (x1 - x0) * (i / 8), -h * (1 - (i / 8) ** 1.7)]);
  }
  for (let i = 8; i >= 0; i--) {
    pts.push([x0 + (x1 - x0) * (i / 8), h * (1 - (i / 8) ** 1.7)]);
  }
  return poly(pts);
};
const helmetShell = (g) => {
  union(g, RUSHER_COLORS.helmet, [
    (g) => g.ellipse(0, 0, HEAD_R * 2, HEAD_R * 2),
  ]);
  g.noFill();
  g.stroke(...RUSHER_COLORS.bike);
  g.strokeWeight(2.2);
  g.arc(0, 0, HEAD_R * 1.3, HEAD_R * 1.3, PI * 1.02, PI * 1.9); // the racing stripe
  g.noStroke();
  g.fill(...RUSHER_COLORS.helmetHi);
  g.ellipse(-1.4, -4.4, 2.6, 1.3);
  g.fill(...RUSHER_COLORS.star);
  star(g, -3.6, -0.4, 1.9);
  star(g, -2.2, 3.6, 1.5, -PI / 2 + 0.4);
};

// Parts that never change shape: [box in the prototype's px, draw(g)]
const C = RUSHER_COLORS;
const PARTS_PX = {
  // The rocket, his motorbike, round its axis
  bike: [
    [-25, -14, 25, 12],
    (g) => {
      union(g, C.nose, [
        poly([
          [-12, -4],
          [-20, -12],
          [-23.5, -11.5],
          [-17, -3],
        ]),
      ]); // top fin
      union(g, C.nose, [
        poly([
          [-12, 4],
          [-19, 10],
          [-22.5, 9.5],
          [-17, 3],
        ]),
      ]); // bottom fin
      union(g, C.nozzle, [
        poly([
          [-15, -4],
          [NOZZLE, -5.5],
          [NOZZLE, 5.5],
          [-15, 4],
        ]),
      ]);
      union(g, C.bike, [(g) => g.rect(-16, -6.5, 29, 13, 6)]);
      g.fill(...C.bikeShade);
      g.rect(-15, 2.8, 27, 3.2, 3);
      g.fill(...C.bikeHi);
      g.rect(-11, -5.2, 20, 1.5, 1);
      union(g, C.nose, [ogive(11, 23, 6.5)]);
      g.fill(...C.noseHi);
      g.ellipse(15.5, -3, 5, 1.5);
      g.fill(...C.stud);
      for (const x of SLOTS) star(g, x, SLOT_Y + 0.2, 2.5);
      // The handlebar: a stalk up from the front, a grip at the top
      g.stroke(...C.ink);
      g.strokeWeight(2.6);
      g.line(7.5, -6, 5.5, -11.5);
      g.stroke(...C.nozzle);
      g.strokeWeight(1.3);
      g.line(7.5, -6, 5.5, -11.5);
      g.noStroke();
      union(g, C.seat, [(g) => g.rect(-10, -8.4, 9, 3, 1.5)]);
    },
  ],
  // His body in the jumpsuit, up from the hip (0, 0)
  torso: [
    [-5, -11, 5, 2],
    (g) => {
      union(g, C.suit, [(g) => g.ellipse(0, -4.2, 6.4, 9.6)]);
      g.fill(...C.capeIn);
      g.rect(-3.1, -1.4, 6.2, 1.6, 0.8); // the belt
    },
  ],
  // His head in an open-face helmet, his face and his one wild eye
  head: [
    [-8, -8, 8, 8],
    (g) => {
      helmetShell(g);
      union(g, C.skin, [(g) => g.ellipse(2.6, 1.2, 7.6, 7.8)]);
      union(g, C.eye, [(g) => g.ellipse(EYE[0], EYE[1], 4.6, 4.6)]);
    },
  ],
  // Mouths: a grin, a yell and an O
  grin: [
    [-3, -2, 3, 2],
    (g) => {
      g.fill(...C.ink);
      g.arc(0, -0.5, 4.8, 3.8, 0, PI, g.CHORD);
      g.fill(...C.star);
      g.rect(-1.9, -0.5, 3.8, 0.8);
    },
  ],
  yell: [
    [-3, -3, 3, 3],
    (g) => {
      g.fill(...C.ink);
      g.ellipse(0, 0, 4.4, 5);
      g.fill(...C.count);
      g.ellipse(0, 1.2, 2.6, 1.8);
    },
  ],
  oh: [
    [-2, -2, 2, 2],
    (g) => {
      g.fill(...C.ink);
      g.ellipse(0, 0, 2.6, 3);
    },
  ],
  // An arm from the shoulder (0, 0) to the hand (8, 0); drawn stretched
  arm: [
    [-2, -2.5, 10.5, 2.5],
    (g) => {
      union(g, C.suit, [(g) => g.rect(-1.2, -1.3, 8.4, 2.6, 1.3)]);
      union(g, C.skin, [(g) => g.ellipse(8, 0, 3.4, 3.4)]);
    },
  ],
  // A star for the blast, in each colour
  starPink: [
    [-7, -7, 7, 7],
    (g) => union(g, C.bike, [(g) => star(g, 0, 0, 6)]),
  ],
  starBone: [
    [-7, -7, 7, 7],
    (g) => union(g, C.star, [(g) => star(g, 0, 0, 6)]),
  ],
  starTeal: [
    [-7, -7, 7, 7],
    (g) => union(g, C.nose, [(g) => star(g, 0, 0, 6)]),
  ],
  starBlue: [
    [-7, -7, 7, 7],
    (g) => union(g, C.cape, [(g) => star(g, 0, 0, 6)]),
  ],
  // His helmet alone, for the blast
  helmetOff: [
    [-8, -8, 8, 8],
    (g) => {
      helmetShell(g);
      g.fill(...C.ink);
      g.ellipse(2.6, 1.2, 6.6, 6.8);
    },
  ],
};
// spriteParts scales each box by the drawn scale; the parts draw in the
// prototype's px under it
export const RUSHER_PARTS = Object.fromEntries(
  Object.entries(PARTS_PX).map(([name, [box, draw]]) => [
    name,
    [
      box,
      (g, s) => {
        g.scale(s);
        draw(g);
      },
    ],
  ])
);
const STARS = ['starPink', 'starBone', 'starTeal', 'starPink', 'starBlue'];

// ---- live parts, on the raw context ----
let SP = null; // his sprites, built at K
let K = 1; // drawn px per prototype px
let ctx = null;
let A0 = 1; // the alpha he was handed (his spawn fade): his overlays multiply it
// His blast caches its own copy: its scale (ART_SCALE) and his figure's (size
// × ART_SCALE / PROTO_SIZE) can differ by a rounding, and one shared entry
// would rebuild every sprite twice a frame
const BLAST_PARTS = { ...RUSHER_PARTS };
function begin(p, k, parts = RUSHER_PARTS) {
  K = k;
  SP = spriteParts(p, parts, k);
  ctx = p.drawingContext;
  A0 = ctx.globalAlpha;
}
// A sprite, in the prototype's px
const spr = (sp) =>
  ctx.drawImage(sp.g.elt, sp.x / K, sp.y / K, sp.w / K, sp.h / K);
// A repeatable 0..1 from any number: drawing rolls no random numbers. His
// blast seeds itself with it too
export const hash01 = (k) => {
  const v = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
function ell(x, y, w, h, style, a = 1, rot = 0) {
  ctx.globalAlpha = A0 * a;
  ctx.fillStyle = style;
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, rot, 0, TWO_PI);
  ctx.fill();
}
// An arm from (x0, y0) to (x1, y1)
function arm(x0, y0, x1, y1) {
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
  ctx.scale(Math.hypot(x1 - x0, y1 - y0) / 8, 1);
  spr(SP.arm);
  ctx.restore();
}
// The cape, from the shoulders (0, 0) streaming back along -x, waving
const CAPE_N = 5;
const capeTop = new Float32Array((CAPE_N + 1) * 2);
const capeBot = new Float32Array((CAPE_N + 1) * 2);
function cape(t, len, flap, lift) {
  for (let i = 0; i <= CAPE_N; i++) {
    const u = i / CAPE_N;
    const x = -len * u;
    const y = lift * u + Math.sin(t * 18 - u * 4) * flap * u;
    const w = 1.6 + 3.6 * u;
    capeTop[2 * i] = capeBot[2 * i] = x;
    capeTop[2 * i + 1] = y - w;
    capeBot[2 * i + 1] = y + w;
  }
  const path = (grow) => {
    ctx.beginPath();
    ctx.moveTo(capeTop[0], capeTop[1] - grow);
    for (let i = 1; i <= CAPE_N; i++) {
      ctx.lineTo(
        capeTop[2 * i] - (i === CAPE_N ? grow : 0),
        capeTop[2 * i + 1] - grow
      );
    }
    for (let i = CAPE_N; i >= 0; i--) {
      ctx.lineTo(
        capeBot[2 * i] - (i === CAPE_N ? grow : 0),
        capeBot[2 * i + 1] + grow
      );
    }
    ctx.closePath();
    ctx.fill();
  };
  ctx.globalAlpha = A0;
  ctx.fillStyle = CS.ink;
  path(O / 2);
  ctx.fillStyle = CS.cape;
  path(0);
  // Its pink lining shows along the bottom
  ctx.fillStyle = CS.capeIn;
  ctx.beginPath();
  for (let i = 1; i <= CAPE_N; i++) {
    ctx.lineTo(
      capeTop[2 * i],
      (capeTop[2 * i + 1] + 2 * capeBot[2 * i + 1]) / 3
    );
  }
  for (let i = CAPE_N; i >= 1; i--)
    ctx.lineTo(capeBot[2 * i], capeBot[2 * i + 1]);
  ctx.fill();
}
// A starburst of n points, radius r (inner ri), turned by rot
function burst(x, y, n, r, ri, rot, style, a) {
  ctx.globalAlpha = A0 * a;
  ctx.fillStyle = style;
  ctx.beginPath();
  for (let i = 0; i < 2 * n; i++) {
    const th = rot + (i * PI) / n;
    const rr = i % 2 ? ri : r;
    ctx.lineTo(x + Math.cos(th) * rr, y + Math.sin(th) * rr);
  }
  ctx.fill();
}
// A puff of exhaust, d px across
const puff = (x, y, d, a) =>
  a > 0.02 && ell(x, y, d, d * 0.85, CS.puff, 0.65 * a);

/**
 * Him, at (0, 0), drawn at size s (his size times ART_SCALE) from his pose
 * (Rusher#pose). His count ring is drawn apart, by drawCountRing
 */
export function drawRusher(p, s, look) {
  begin(p, s / PROTO_SIZE);
  const t = look.t;
  const f = look.fuse;
  const lit = !!f;
  ctx.save();
  ctx.scale(K, K);

  // ---- in his unturned frame: a shove's trail, smoke ----
  if (look.push > 0.02) {
    const c = Math.cos(look.pushDir);
    const sn = Math.sin(look.pushDir);
    for (let i = 0; i < 3; i++) {
      const d = 12 + i * 9 + 14 * (1 - look.push);
      puff(-c * d, -sn * d, 8 + 3 * i, look.push * (1 - i * 0.25));
    }
  }
  const singe = lit && f.by === 'blast' ? 1 - 0.5 * clamp01(f.age / 1.5) : 0;
  if (singe > 0) {
    for (let i = 0; i < 3; i++) {
      const a = (t * 1.1 + i / 3) % 1;
      const d = 5 + 10 * a;
      ell(
        -6 + 5 * i + 3 * Math.sin(t * 3 + i * 2),
        -12 - 24 * a,
        d,
        d * 0.8,
        CS.smoke,
        0.5 * (1 - a) * singe
      );
    }
  }

  // ---- his pose ----
  const jit = look.hit * 2.5 + (lit && f.hot ? 1.2 : 0);
  if (jit > 0.05)
    ctx.translate(jit * Math.sin(t * 91), jit * Math.sin(t * 73 + 1));
  const lv = lit ? smooth(clamp01(f.age / 0.3)) : 0; // lit: he levels out and stops
  ctx.scale(look.side, 1);
  ctx.rotate(look.tilt * (1 - lv));
  const boost = look.boost * (look.charging ? CONFIG.RUSHER.CHARGE_BOOST : 1);
  const boostAge =
    look.boost > 0.002 ? -BOOST_ENV_SEC * Math.log(look.boost) : 9;

  // The puff his boost left behind, on his line of flight
  if (!lit && boostAge < 0.45) {
    puff(
      NOZZLE - 4 - (look.speed * boostAge) / K,
      AXIS,
      6 + 18 * (boostAge / 0.45),
      1 - boostAge / 0.45
    );
  }

  // Lit, he pops a wheelie (round his nozzle), bouncing on each beat; shot
  // past, his rocket shimmies
  const wheelie = lit ? 0.5 * lv + 0.12 * f.tick : 0;
  const shimmy = look.whoa * 0.16 * Math.sin(t * 38);
  const rock = wheelie - shimmy + 0.05 * look.boost;
  ctx.translate(NOZZLE, AXIS);
  ctx.rotate(-rock);
  ctx.translate(-NOZZLE, -AXIS);

  // Speed lines and his exhaust, behind him
  if (!lit && look.speed01 > 0.2) {
    ctx.globalAlpha = A0 * 0.45 * clamp01((look.speed01 - 0.2) / 0.5);
    ctx.fillStyle = CS.puff;
    ctx.fillRect(
      -24 - 10 * look.speed01,
      AXIS - 10,
      10 + 10 * look.speed01,
      1.2
    );
    ctx.fillRect(
      -20 - 14 * look.speed01,
      AXIS + 10,
      12 + 12 * look.speed01,
      1.2
    );
  }
  if (!lit) {
    const flick = 0.85 + 0.3 * Math.abs(Math.sin(t * 41 + look.seed * 7));
    const th = (0.3 + 0.4 * look.speed01 + 0.9 * boost) * (1 - 0.5 * look.whoa);
    const len = 4 + 16 * th * flick;
    const w = 6 + 4 * Math.min(1, th);
    ell(
      NOZZLE - len * 0.45,
      AXIS,
      len,
      w,
      CS.flame,
      0.8 * Math.min(1, th + 0.35)
    );
    ell(
      NOZZLE - len * 0.2,
      AXIS,
      len * 0.45,
      w * 0.5,
      CS.flameCore,
      0.9 * Math.min(1, th + 0.2)
    );
  } else if (f.tick > 0.1) {
    puff(NOZZLE - 5 - 8 * (1 - f.tick), AXIS, 6 + 6 * (1 - f.tick), f.tick); // he revs on each beat
  }

  // Shot past, he tries to brake: puffs off his nose, but he can't stop
  if (look.whoa > 0.1 && !lit) {
    for (let i = 0; i < 2; i++) {
      const u = (t * 5 + i * 0.5) % 1;
      puff(
        25 + 10 * u,
        AXIS + (i ? 4 : -4) * (0.5 + u),
        6 + 8 * u,
        look.whoa * (1 - u)
      );
    }
  }

  // Where he sits and leans: forward into the wind, tucked in the charge,
  // thrown back by the boost and when he shoots past
  const lean = lit
    ? -0.15
    : look.whoa > 0.05
      ? -0.45 * look.whoa
      : 0.25 + (look.charging ? 0.35 : 0) - 0.25 * look.boost;
  const hx = HIP[0];
  const hy = AXIS + HIP[1];
  const nx = hx + Math.sin(lean) * NECK;
  const ny = hy - Math.cos(lean) * NECK;

  // The cape streams back from his shoulders
  ctx.save();
  ctx.translate(nx - 1, ny + 1);
  cape(
    t + look.seed * 5,
    lit ? 8 : 13 + 4 * look.speed01,
    lit ? 0.6 : 1.2 + 1.5 * boost,
    lit ? 7 : 1.5 - 2 * boost
  );
  ctx.restore();

  // The rocket
  ctx.globalAlpha = A0;
  ctx.translate(0, AXIS);
  spr(SP.bike);
  // Lit, a starting tree pops up from his tail fin: a socket for each beat
  // of the fuse, lit like the ring; the top one goes out each beat. It is
  // decoration: the ring is the count
  if (lit) {
    const { n, left } = ringArcs(f);
    const rise = smooth(clamp01(f.age / 0.15));
    const by = (i) => -(TREE_STEP * (i + 0.5) + 1) * rise;
    const top = (n * TREE_STEP + 2) * rise;
    const bulb = f.hot ? CS.hot : left <= 1 ? CS.amber : CS.bulb;
    ctx.save();
    ctx.translate(TREE_X, TREE_Y);
    ctx.rotate(rock - look.tilt * (1 - lv)); // upright on screen, whatever his wheelie
    ctx.globalAlpha = A0;
    ctx.fillStyle = CS.ink;
    ctx.beginPath();
    // roundRect: Firefox 112+, Safari 16+; square corners before that
    if (ctx.roundRect) ctx.roundRect(-4.6, -top - 1.2, 9.2, top + 3.4, 4.6);
    else ctx.rect(-4.6, -top - 1.2, 9.2, top + 3.4);
    ctx.fill();
    for (let i = 0; i < n; i++) {
      if (i < left) {
        const d = 6.4 + (i === left - 1 ? 1 * f.tick : 0);
        ell(0, by(i), d, d, bulb);
        ell(-1, by(i) - 1, 1.8, 1.8, CS.hot, 0.9);
      } else ell(0, by(i), 4, 4, CS.socket);
    }
    // The one that just went out pops
    if (left < n && f.tick > 0.1) {
      const d = 6 + 9 * (1 - f.tick);
      ell(0, by(left), d, d, CS.hot, 0.8 * f.tick);
    }
    ctx.restore();
  }
  if (singe > 0) {
    ell(-4, 1, 22, 9, CS.soot, 0.6 * singe);
    ell(12, 0, 7, 6, CS.soot, 0.6 * singe);
  }
  ctx.translate(0, -AXIS);

  // His far arm: on the bar, pointing ahead in the charge, waving above his
  // head while lit (a pump on each beat), flailing when he shoots past
  const sx = nx - Math.sin(lean) * 2;
  const sy = ny + Math.cos(lean) * 2;
  ctx.globalAlpha = A0;
  if (lit)
    arm(sx - 1, sy, sx + 2 + 2.5 * Math.sin(t * 10), sy - 10 + 3 * f.tick);
  else if (look.whoa > 0.3)
    arm(sx - 1, sy, sx - 3 + 2 * Math.sin(t * 20), sy - 8);
  else if (look.charging) arm(sx - 1, sy, sx + 9, sy - 2);
  else arm(sx - 1, sy, 5.5, AXIS - 11);

  // Him, on the seat
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(lean);
  spr(SP.torso);
  ctx.restore();

  // His head: looks back when he shoots past; yells his battle cry
  const tuck = look.charging && !lit ? 1.5 : 0;
  const back = look.whoa > 0.3;
  ctx.save();
  ctx.translate(nx + 2.5 + tuck, ny - 4.5 + tuck);
  if (back) ctx.scale(-1, 1);
  ctx.rotate(lit ? -0.2 : 0.15 * look.cry);
  spr(SP.head);
  if (singe > 0) ell(2.6, 1.2, 6.4, 6.4, CS.soot, 0.55 * singe);
  // His one wild eye: on the hero, or on the crowd while lit
  let la =
    Math.atan2(Math.sin(look.toHero), Math.cos(look.toHero) * look.side) -
    look.tilt;
  if (back) la = PI - la;
  if (lit) la = -1.1;
  ell(EYE[0] + Math.cos(la) * 1, EYE[1] + Math.sin(la) * 1, 2.3, 2.3, CS.ink);
  ctx.globalAlpha = A0;
  ctx.translate(MOUTH[0], MOUTH[1]);
  spr(
    back ? SP.oh : look.cry > 0.25 || (lit && f.tick > 0.3) ? SP.yell : SP.grin
  );
  ctx.restore();

  // Lit by a blast, he sees stars
  if (singe > 0.55) {
    ctx.globalAlpha = A0;
    for (let i = 0; i < 3; i++) {
      const th = t * 5 + (i * TWO_PI) / 3;
      ctx.save();
      ctx.translate(nx + 2.5 + Math.cos(th) * 9, ny - 11 + Math.sin(th) * 3);
      ctx.scale(0.42, 0.42);
      spr(SP[i === 1 ? 'starPink' : 'starBone']);
      ctx.restore();
    }
  }

  // His battle cry: shout lines out of his mouth
  if (look.cry > 0.05 && !lit) {
    const mx = nx + 9 + tuck;
    const my = ny - 1.5 + tuck;
    for (const a of [-0.55, 0, 0.55]) {
      const r = 4.5 + 2 * look.cry;
      ell(
        mx + Math.cos(a) * r,
        my + Math.sin(a) * r,
        3 + 4 * look.cry,
        1.4,
        CS.star,
        0.9 * look.cry,
        a
      );
    }
  }
  // Shot past: a drop of sweat flies off his helmet
  if (look.whoa > 0.05) {
    const u = 1 - look.whoa;
    ell(
      nx + 4 + 6 * u,
      ny - 12 - 6 * u + 10 * u * u,
      2.2,
      3,
      CS.sweat,
      look.whoa
    );
  }
  // His near arm, on the handlebar
  ctx.globalAlpha = A0;
  arm(sx + 1, sy + 1, 5.5, AXIS - 11);

  // A shot lights him: a flash
  if (look.hit > 0.05) {
    burst(-2, 0, 8, 12 + 8 * (1 - look.hit), 6, t * 3, CS.hot, look.hit);
  }
  ctx.restore();
  ctx.globalAlpha = A0;
}

// ---- the count ring ----
function arcs(R, n, from, to, grow = 1) {
  const seg = TWO_PI / n;
  ctx.beginPath();
  for (let i = from; i < to; i++) {
    const a0 = -PI / 2 + i * seg + GAP / 2;
    const len = (seg - GAP) * grow;
    ctx.moveTo(Math.cos(a0) * R, Math.sin(a0) * R);
    ctx.arc(0, 0, R, a0, a0 + len);
  }
}

/** His count ring's arcs: n of them as he lit, `left` still lit */
export function ringArcs(fuse) {
  const n = Math.max(1, fuse.beatsTotal);
  return { n, left: Math.min(n, fuse.beatsLeft) };
}

/**
 * The ring at his blast's reach, round (x, y) in the world: the arcs he lit
 * with, one going out with a flash on each beat and leaving a thin ghost,
 * so the whole reach still shows. The arcs are `lit` (his pink) until
 * `amberAt` are left, then amber; the whole ring is white-hot once
 * `fuse.hot`. Each arc sits on ink, so it reads over the rust gas. The
 * stabber's wind-up counts on it too, in his gold
 */
export function drawCountRing(
  p,
  x,
  y,
  fuse,
  radius,
  lit = CS.count,
  amberAt = 1
) {
  ctx = p.drawingContext;
  A0 = ctx.globalAlpha;
  const { n, left } = ringArcs(fuse);
  const style = fuse.hot ? CS.hot : left <= amberAt ? CS.amber : lit;
  const grow = smooth(clamp01(fuse.age / 0.15)); // the arcs snap on when he lights
  const pop = fuse.tick;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  if (fuse.hot) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TWO_PI);
    ctx.globalAlpha = A0;
    ctx.strokeStyle = CS.ink;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = CS.hot;
    ctx.lineWidth = 4.5 + 1.5 * Math.sin(fuse.age * 40);
    ctx.stroke();
  } else {
    if (left < n) {
      arcs(radius, n, left, n);
      ctx.globalAlpha = A0 * 0.55;
      ctx.strokeStyle = CS.ink;
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.strokeStyle = style;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    arcs(radius, n, 0, left, grow);
    ctx.globalAlpha = A0;
    ctx.strokeStyle = CS.ink;
    ctx.lineWidth = 8 + 2 * pop;
    ctx.stroke();
    ctx.strokeStyle = style;
    ctx.lineWidth = 4.5 + 2 * pop;
    ctx.stroke();
    // The one that just went out flashes
    if (left < n && pop > 0.05) {
      arcs(radius, n, left, left + 1);
      ctx.globalAlpha = A0 * pop;
      ctx.strokeStyle = CS.hot;
      ctx.lineWidth = RING_FLASH_W + RING_FLASH_POP_W * pop;
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.globalAlpha = A0;
}

/**
 * His blast, the big finish, at its own position in the world:
 * - a white-hot comic POW on the crash, with rays out to the reach;
 * - a pink starburst shrinking into smoke;
 * - a ring of fire out to the reach in 0.3 s, and a burst of stars;
 * - his helmet spinning off;
 * - a chain blast adds a teal encore ring.
 */
export function drawRusherBlast(p, b) {
  begin(p, CONFIG.RUSHER_LOOK.ART_SCALE, BLAST_PARTS);
  const a = b.ageMs / 1000;
  const out = 1 - (1 - clamp01(a / 0.3)) ** 3; // fast, then easing in to the reach
  const R = b.radius;
  ctx.save();
  ctx.translate(b.x, b.y);
  // The flash: additive, so its tail brightens the sky instead of greying it
  if (a < 0.2) {
    ctx.globalCompositeOperation = 'lighter';
    ell(0, 0, 60 + 120 * out, 60 + 120 * out, CS.hot, env(a, 0.03));
    ctx.globalCompositeOperation = 'source-over';
  }
  // The crash itself: a white-hot comic burst as big as a grunt knot,
  // collapsing into his starburst within a sixth of a second, and rays out
  // to the reach. Opaque all the way (a see-through white reads grey): it
  // collapses instead of fading
  if (a < 0.17) {
    const u = a / 0.17;
    const r =
      (72 + 60 * smooth(clamp01(a / 0.05))) *
      (1 - smooth(clamp01((a - 0.06) / 0.11)));
    burst(0, 0, 12, r + 4, r * 0.6 + 4, b.seed * 3, CS.ink, 1);
    burst(0, 0, 12, r, r * 0.6, b.seed * 3, CS.hot, 1);
    burst(0, 0, 12, r * 0.62, r * 0.36, b.seed * 3 + 0.26, CS.amber, 1);
    ctx.globalAlpha = A0 * (1 - u * u);
    ctx.strokeStyle = CS.hot;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 20; i++) {
      const th = (i / 20) * TWO_PI + b.seed * 5;
      const r0 = r + 6 + 20 * hash01(i + b.seed);
      const r1 = Math.max(r0 + 4, R * out * (0.85 + 0.15 * hash01(i * 3.3)));
      ctx.moveTo(Math.cos(th) * r0, Math.sin(th) * r0);
      ctx.lineTo(Math.cos(th) * r1, Math.sin(th) * r1);
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  // A starburst where he was, spinning and shrinking into smoke
  if (a < 0.7) {
    const fb = 1 - a / 0.7;
    const rot = a * 4 + b.seed * 6;
    for (const [style, r0, al] of [
      [CS.bike, 62, 0.9],
      [CS.amber, 38, 0.9],
      [CS.hot, 20, 1],
    ]) {
      const r = r0 * fb * (0.6 + 0.4 * out);
      burst(0, 0, 8, r, r * 0.45, rot, style, al * Math.min(1, fb * 1.5));
    }
  }
  if (a < 1.8) {
    const sm = 1 - a / 1.8;
    ell(-6, -8 - 24 * a, 24 + 26 * a, 24 + 26 * a, CS.smoke, 0.35 * sm);
  }
  // The ring of fire: out to the reach in 0.3 s, then it burns down
  const burn = a < 0.3 ? 1 : clamp01(1 - (a - 0.3) / 1.1);
  if (burn > 0) {
    const r = R * out;
    ctx.globalAlpha = A0 * 0.9 * burn;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TWO_PI);
    ctx.strokeStyle = CS.bike;
    ctx.lineWidth = 7 * burn + 1;
    ctx.stroke();
    ctx.strokeStyle = CS.amber;
    ctx.lineWidth = 3 * burn;
    ctx.stroke();
    // Tongues of flame round it, flickering
    const n = 28;
    for (const [style, odd] of [
      [CS.amber, 1],
      [CS.bike, 0],
    ]) {
      ctx.fillStyle = style;
      ctx.beginPath();
      for (let i = odd; i < n; i += 2) {
        const th = (i / n) * TWO_PI + b.seed;
        const L =
          (10 + 8 * hash01(i + b.seed * 7)) *
          (0.6 + 0.4 * Math.sin(a * 23 + i * 2.1)) *
          burn;
        const c = Math.cos(th);
        const sn = Math.sin(th);
        ctx.moveTo(c * (r - 2) - sn * 3.5, sn * (r - 2) + c * 3.5);
        ctx.lineTo(c * (r - 2) + sn * 3.5, sn * (r - 2) - c * 3.5);
        ctx.lineTo(c * (r + L), sn * (r + L));
      }
      ctx.fill();
    }
    if (b.chain) {
      // An encore: a second, teal ring inside
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.75, 0, TWO_PI);
      ctx.strokeStyle = CS.nose;
      ctx.lineWidth = 3 * burn;
      ctx.stroke();
    }
  }
  // A burst of stars: out to the reach in 0.3 s, then they drift and twinkle
  const fade = clamp01(1 - (a - 1.2) / 1.1);
  if (fade > 0) {
    ctx.globalAlpha = A0;
    const n = 16;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TWO_PI + 0.3 * hash01(i + b.seed * 3) + b.seed * 2;
      const d = R * (0.5 + 0.5 * hash01(i * 1.7 + b.seed)) * out + 12 * a;
      const sz =
        (1.1 + 0.8 * hash01(i * 2.3)) *
        (0.75 + 0.25 * Math.sin(a * 9 + i * 1.3)) *
        fade;
      ctx.save();
      ctx.translate(Math.cos(th) * d, Math.sin(th) * d + 10 * a * a);
      ctx.rotate(a * (i % 2 ? 3 : -3) + i);
      ctx.scale(sz, sz);
      spr(SP[STARS[(i + (b.chain ? 2 : 0)) % STARS.length]]);
      ctx.restore();
    }
  }
  // His helmet, spinning off: up, then falling
  if (a < 1.5) {
    const dir = b.seed > 0.5 ? 1 : -1;
    ctx.save();
    ctx.translate(40 * a * dir, -170 * a + 80 * a * a);
    ctx.rotate(a * 8 * dir);
    ctx.scale(2, 2);
    ctx.globalAlpha = A0 * clamp01((1.5 - a) / 0.5);
    spr(SP.helmetOff);
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = A0;
}
