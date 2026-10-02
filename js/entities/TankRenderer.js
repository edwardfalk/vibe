/**
 * How the tank looks: the Bouncer, a nightclub bouncer from space seen from
 * directly above. A very wide bar of shoulders with a small shiny bald head
 * sunk between them, sunglasses, an earpiece and a gold chain; thick
 * forearms run forward to a stubby bone cannon. Plum armour on his chest
 * (front plate) and shoulders (left and right plates); his back is bare and
 * pale. Aliens live in space and never walk (docs/DESIGN.md, "The cast").
 *
 * The geometry here is shared by his behaviour (Tank.js) and his drawing:
 * which side an angle falls on, his turn, his gun, his cannon and muzzle,
 * and his back. Local frame: +x is where he faces, +y is his right (y points
 * down). Sizes are in units of s, his drawn size (size × TANK_LOOK.ART_SCALE).
 * Ported from the prototype dir-bouncer.js in
 * docs/superpowers/specs/2026-10-01-tank-studies/ (main checkout only).
 */
import { CONFIG } from '../config.js';
import { normalizeAngle, clamp01, smooth, env } from '../mathUtils.js';
import { GRUNT_COLORS, AMBER, HOT } from './GruntRenderer.js';
import { spriteParts, stamp } from './spriteCache.js';

const PI = Math.PI;

// His palette, [r, g, b]. His glow, death fragments, KILL! text and shot
// use it too, so it is frozen. Ink and the warning colours are the cast's.
export const TANK_COLORS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      ink: GRUNT_COLORS.ink,
      skin: [118, 162, 98], // muscle: a deeper pistachio than the grunts
      skinMid: [148, 190, 124],
      skinHi: [178, 212, 148],
      scalp: [234, 250, 210], // his shiny bald head: brightest at rest
      pale: [212, 228, 188], // his bare back: his tan stops at his shoulders
      paleShade: [186, 206, 162],
      armour: [112, 94, 148], // riot plum
      armourHi: [146, 128, 184],
      rim: [236, 226, 200],
      shades: [30, 24, 40],
      gold: [248, 228, 128], // brass, yellow not orange: no amber at rest
      cannon: [236, 226, 200],
      band: [120, 112, 138],
      pack: [104, 86, 124],
      flame: [150, 235, 220],
      flush: [238, 108, 136],
      steam: [176, 178, 188], // grey, darker than white-hot
      coil: [214, 236, 240],
      bomb: [46, 40, 62],
      bombHalo: [170, 230, 250],
      bombUnlit: [110, 70, 60],
      heroBand: [90, 205, 255], // the hero's colour on his bomb
      white: [255, 255, 255],
      amber: AMBER, // about to strike, as on the grunt
      hot: HOT, // the last half-beat: white-hot
    }).map(([k, v]) => [k, Object.freeze([...v])])
  )
);

export const CANNON_AT = 0.9; // the cannon's pivot ahead of his centre, in his fists
export const MUZZLE = 0.62; // from that pivot to the muzzle
export const BOMB_AT = 0.42; // where a bomb sits behind his centre
// How far his body, shoulders and cannon reach from his centre at most: the
// muzzle's glow on the charge's last half-beat, or his shoulders at full
// swell. His health bar sits above it
export const TANK_REACH = 1.95;

/**
 * Which of his sides an angle from his facing falls on: front within 45°,
 * back from 135°, left (y up) or right between. The plates take shots by
 * it, and contact goes by it (the shove in front, the bomb behind).
 */
export function tankSide(rel) {
  const a = normalizeAngle(rel);
  if (Math.abs(a) <= PI / 4) return 'front';
  if (Math.abs(a) >= (3 * PI) / 4) return 'back';
  return a < 0 ? 'left' : 'right';
}

/**
 * The turn he makes on a beat 1: toward the target by at most the step,
 * none inside the dead zone. A target exactly behind turns him clockwise.
 */
export function turnStep(facing, toTarget, stepRad, deadRad) {
  let want = normalizeAngle(toTarget - facing);
  if (Math.abs(want) >= PI - 1e-9) want = PI;
  if (Math.abs(want) < deadRad) return 0;
  return Math.max(-stepRad, Math.min(stepRad, want));
}

/**
 * His gun's angle from his facing after an update of dtSec: it eases toward
 * the target (time constant tauSec) and never leaves its arc. A target
 * outside the arc holds the gun at the nearer edge.
 */
export function nextGunRel(gunRel, facing, toTarget, arcRad, dtSec, tauSec) {
  const clampArc = (a) => Math.max(-arcRad, Math.min(arcRad, a));
  const want = clampArc(normalizeAngle(toTarget - facing));
  const k = tauSec > 0 ? 1 - Math.exp(-dtSec / tauSec) : 1;
  return clampArc(gunRel + (want - gunRel) * k);
}

/**
 * His cannon in its rest pose, in his local frame: its pivot in his fists,
 * its angle (the gun's) and its muzzle. Firing and drawing both build on it.
 */
export function tankCannon(s, gunRel) {
  const pivotX = s * CANNON_AT;
  return {
    pivotX,
    pivotY: 0,
    angle: gunRel,
    muzzleX: pivotX + s * MUZZLE * Math.cos(gunRel),
    muzzleY: s * MUZZLE * Math.sin(gunRel),
  };
}

/** Where his shot leaves, in the world: the cannon's muzzle, turned with him */
export function tankMuzzle(x, y, s, facing, gunRel) {
  const { muzzleX, muzzleY } = tankCannon(s, gunRel);
  const c = Math.cos(facing);
  const n = Math.sin(facing);
  return { x: x + muzzleX * c - muzzleY * n, y: y + muzzleX * n + muzzleY * c };
}

/** Where a bomb rides on his bare back */
export function tankBackPoint(x, y, s, facing) {
  return {
    x: x - s * BOMB_AT * Math.cos(facing),
    y: y - s * BOMB_AT * Math.sin(facing),
  };
}

// ---- drawing: a port of the prototype's tank() ----

const C = TANK_COLORS; // short, as in the prototype
const O = 2.2; // the ink edge, as the prototype kit's OUTLINE × 2
// The prototype's turn took 0.4 s; its lead, drag and settle are timed for
// that and stretched to TURN_SEC. Long after a turn, its age stops at 9 s
const PROTO_TURN_SEC = 0.4;
const TURN_REST_SEC = 9;

// ---- sprite helpers: in a sprite, strokes are free ----
// A union of shapes with one ink edge: every shape in ink first, then fills
function union(g, c, shapes, ink = true) {
  if (ink) {
    g.fill(...C.ink);
    g.stroke(...C.ink);
    g.strokeWeight(O);
    g.strokeJoin(g.ROUND);
    shapes.forEach((f) => f(g));
    g.noStroke();
  }
  g.fill(...c);
  shapes.forEach((f) => f(g));
}
// A crescent: the band between two ellipse arcs, both centred on (cx, 0)
const crescent = (cx, rxO, ryO, rxI, ryI, a) => (g) => {
  g.beginShape();
  for (let i = 0; i <= 16; i++) {
    const th = -a + (2 * a * i) / 16;
    g.vertex(cx + rxO * Math.cos(th), ryO * Math.sin(th));
  }
  for (let i = 16; i >= 0; i--) {
    const th = -a + (2 * a * i) / 16;
    g.vertex(cx + rxI * Math.cos(th), ryI * Math.sin(th));
  }
  g.endShape(g.CLOSE);
};
const lines = (g, c, w, list) => {
  g.noFill();
  g.stroke(...c);
  g.strokeWeight(w);
  for (const [x0, y0, x1, y1] of list) g.line(x0, y0, x1, y1);
  g.noStroke();
};

// ---- the shapes, in units of s ----
// A band round the origin facing +y, between radii rO and rI, a either side
const cap =
  (rO, rI, a, rxO = rO, rxI = rI) =>
  (g) => {
    g.beginShape();
    for (let i = 0; i <= 16; i++) {
      const th = -a + (2 * a * i) / 16;
      g.vertex(rxO * Math.sin(th), rO * Math.cos(th));
    }
    for (let i = 16; i >= 0; i--) {
      const th = -a + (2 * a * i) / 16;
      g.vertex(rxI * Math.sin(th), rI * Math.cos(th));
    }
    g.endShape(g.CLOSE);
  };
// The slab, a wide bar of shoulders (about 2.5 times as wide as it is
// deep): a huge dome at each end, his chest between them at the front
// (where the guard sits) and his broad back, a smooth curve, behind
const BALL = [0.0, 0.8, 0.9]; // a shoulder dome: x, |y|, diameter
const SLAB = (s) => [
  (g) => g.ellipse(-s * 0.12, 0, s * 1.0, s * 1.8),
  (g) => g.ellipse(s * BALL[0], -s * BALL[1], s * BALL[2], s * BALL[2]),
  (g) => g.ellipse(s * BALL[0], s * BALL[1], s * BALL[2], s * BALL[2]),
  (g) => g.ellipse(s * 0.1, 0, s * 0.6, s * 1.1),
];
const SLAB_BOX = [-0.7, -1.3, 0.5, 1.3];
// His front is muscle, his back is bare: the front is what lies inside this
// ellipse (its back edge bows behind his neck, like a collar line)
const FRONT = [1.2, 0, 1.32, 3.0]; // cx, cy, rx, ry
const clipFront = (g, s, outside = false) => {
  const c = g.drawingContext;
  c.beginPath();
  if (outside) c.rect(-s * 3, -s * 3, s * 6, s * 6);
  c.ellipse(
    s * FRONT[0],
    s * FRONT[1],
    s * FRONT[2],
    s * FRONT[3],
    0,
    0,
    2 * PI
  );
  c.clip(outside ? 'evenodd' : 'nonzero');
};
const GUARD = (s) => crescent(0, s * 0.62, s * 0.66, s * 0.42, s * 0.52, 0.95);
const GUARD_BOX = [0.2, -0.66, 0.66, 0.66];
// The right pad: a cap on the outside of the shoulder dome, centred on the
// dome; the left one is this mirrored
const PAD = (s) => cap(s * 0.54, s * 0.3, 1.0, s * 0.52, s * 0.34);
const PAD_BOX = [-0.58, -0.05, 0.58, 0.58];
const PAD_AT = [BALL[0], BALL[1]];
const HEAD = [0.1, 0]; // where his head sits on the slab
const HEAD_D = 0.44;
const CHAIN_R = 0.36;
const CHAIN_N = 8;
const CHAIN_ARC = 1.35; // the chain hangs round the front of his neck, from his left to his right
const linkAt = (i) => {
  const a = -CHAIN_ARC + (2 * CHAIN_ARC * i) / (CHAIN_N - 1);
  return [HEAD[0] + Math.cos(a) * CHAIN_R, HEAD[1] + Math.sin(a) * CHAIN_R, a];
};
const CANNON = (s) => [
  (g) => g.rect(-s * 0.14, -s * 0.18, s * 0.62, s * 0.36, s * 0.09),
  (g) => g.rect(s * 0.42, -s * 0.23, s * 0.2, s * 0.46, s * 0.07),
];
const CANNON_BOX = [-0.24, -0.44, 0.68, 0.44];
const GRIP = 0.25; // his fists sit this far either side of the cannon
const SHOULDER = [0.3, 0.72]; // where his arms leave his shoulder domes
const ARM_L = 0.8;
const ARM_T = 0.34;

// His fists on the cannon, knuckles out
function fists(g, s) {
  for (const side of [-1, 1]) {
    g.push();
    g.translate(0, s * GRIP * side);
    g.scale(1, side);
    union(g, C.skinMid, [
      (g) => g.rect(-s * 0.13, -s * 0.12, s * 0.26, s * 0.24, s * 0.09),
    ]);
    g.fill(...C.skinHi);
    for (const x of [-0.07, 0, 0.07]) {
      g.ellipse(s * x, s * 0.06, s * 0.065, s * 0.08);
    }
    lines(g, C.ink, s * 0.02, [
      [-s * 0.035, s * 0.03, -s * 0.035, s * 0.11],
      [s * 0.035, s * 0.03, s * 0.035, s * 0.11],
    ]);
    g.pop();
  }
}

// The parts that never change shape, cached as sprites (spriteCache.js)
export const TANK_PARTS = {
  slab: [
    SLAB_BOX,
    (g, s) => {
      union(g, C.pale, SLAB(s));
      // His bare back, pale as skin that never sees the sunbed: two shoulder
      // blades and the groove of his spine, soft and unarmoured
      for (const y of [-1, 1]) {
        g.push();
        g.translate(-s * 0.36, s * 0.32 * y);
        g.rotate(-0.45 * y);
        g.fill(...C.paleShade);
        g.ellipse(-s * 0.02, 0, s * 0.4, s * 0.26);
        g.fill(...C.pale);
        g.ellipse(s * 0.025, -s * 0.02 * y, s * 0.32, s * 0.19);
        g.pop();
      }
      g.fill(...C.paleShade);
      g.ellipse(-s * 0.4, 0, s * 0.36, s * 0.045);
      // A little heart tattoo low on his back, where he can't see it
      g.fill(...C.armour);
      g.ellipse(-s * 0.56, -s * 0.022, s * 0.05, s * 0.055);
      g.ellipse(-s * 0.56, s * 0.022, s * 0.05, s * 0.055);
      g.triangle(-s * 0.575, -s * 0.046, -s * 0.575, s * 0.046, -s * 0.615, 0);
      // His front: domes of muscle, tanned
      g.drawingContext.save();
      clipFront(g, s);
      g.fill(...C.skin);
      SLAB(s).forEach((f) => f(g));
      for (const y of [-1, 1]) {
        g.fill(...C.skinMid);
        g.ellipse(
          s * (BALL[0] + 0.08),
          s * (BALL[1] - 0.05) * y,
          s * 0.58,
          s * 0.54
        );
        g.fill(...C.skinHi);
        g.ellipse(
          s * (BALL[0] + 0.12),
          s * (BALL[1] - 0.1) * y,
          s * 0.24,
          s * 0.2
        );
        g.ellipse(s * 0.06, s * 0.36 * y, s * 0.16, s * 0.2); // his traps, either side of his neck
      }
      g.drawingContext.restore();
      // His tan line
      g.noFill();
      g.stroke(...C.ink, 150);
      g.strokeWeight(s * 0.03);
      g.arc(
        s * FRONT[0],
        s * FRONT[1],
        s * FRONT[2] * 2,
        s * FRONT[3] * 2,
        PI - 0.43,
        PI + 0.43
      );
      g.noStroke();
    },
  ],
  // The gold chain round the front of his neck: a bright arc and eight links
  chain: [
    [-0.3, -0.5, 0.56, 0.5],
    (g, s) => {
      g.noFill();
      g.stroke(...C.ink);
      g.strokeWeight(s * 0.065);
      g.arc(
        s * HEAD[0],
        s * HEAD[1],
        s * CHAIN_R * 2,
        s * CHAIN_R * 2,
        -CHAIN_ARC,
        CHAIN_ARC
      );
      g.stroke(...C.gold);
      g.strokeWeight(s * 0.04);
      g.arc(
        s * HEAD[0],
        s * HEAD[1],
        s * CHAIN_R * 2,
        s * CHAIN_R * 2,
        -CHAIN_ARC,
        CHAIN_ARC
      );
      g.noStroke();
      for (let i = 0; i < CHAIN_N; i++) {
        const [x, y, a] = linkAt(i);
        g.push();
        g.translate(x * s, y * s);
        g.rotate(a + PI / 2);
        union(g, C.gold, [(g) => g.ellipse(0, 0, s * 0.13, s * 0.1)]);
        g.fill(255, 255, 240);
        g.ellipse(-s * 0.02, -s * 0.015, s * 0.04, s * 0.03);
        g.pop();
      }
    },
  ],
  backWhite: [
    SLAB_BOX,
    (g, s) => {
      g.drawingContext.save();
      clipFront(g, s, true);
      union(g, C.white, SLAB(s), false);
      g.drawingContext.restore();
    },
  ],
  // Veins that pop on his traps and shoulders when he strains
  veins: [
    SLAB_BOX,
    (g, s) => {
      g.noFill();
      g.stroke(...C.flush);
      g.strokeWeight(s * 0.045);
      for (const y of [-1, 1]) {
        g.beginShape();
        for (const [x, v] of [
          [0.0, 0.3],
          [0.08, 0.4],
          [0.02, 0.5],
          [0.12, 0.6],
          [0.06, 0.72],
          [0.16, 0.82],
        ]) {
          g.vertex(s * x, s * v * y);
        }
        g.endShape();
        g.beginShape();
        for (const [x, v] of [
          [0.3, 0.62],
          [0.22, 0.74],
          [0.32, 0.86],
          [0.24, 0.98],
        ]) {
          g.vertex(s * x, s * v * y);
        }
        g.endShape();
      }
      g.noStroke();
    },
  ],
  pack: [
    [-0.96, -0.3, -0.56, 0.3],
    (g, s) => {
      for (const y of [-0.13, 0.13]) {
        union(g, C.shades, [
          (g) => g.rect(-s * 0.9, s * (y - 0.05), s * 0.13, s * 0.1, s * 0.025),
        ]);
      }
      union(g, C.pack, [(g) => g.ellipse(-s * 0.72, 0, s * 0.22, s * 0.42)]);
      g.fill(...C.armourHi);
      g.ellipse(-s * 0.71, 0, s * 0.07, s * 0.28);
    },
  ],
  guard: [
    GUARD_BOX,
    (g, s) => {
      union(g, C.armour, [GUARD(s)]);
      g.fill(...C.armourHi);
      crescent(0, s * 0.54, s * 0.6, s * 0.47, s * 0.56, 0.85)(g);
      g.fill(...C.rim);
      crescent(0, s * 0.615, s * 0.655, s * 0.575, s * 0.625, 0.9)(g);
    },
  ],
  guardWhite: [GUARD_BOX, (g, s) => union(g, C.white, [GUARD(s)], false)],
  guardBare: [
    GUARD_BOX,
    (g, s) => {
      union(g, C.pale, [
        crescent(0, s * 0.56, s * 0.58, s * 0.42, s * 0.5, 0.85),
      ]);
      lines(g, C.ink, s * 0.035, [
        [s * 0.3, -s * 0.5, s * 0.38, -s * 0.42],
        [s * 0.3, s * 0.5, s * 0.38, s * 0.42],
      ]); // torn straps
    },
  ],
  guardCrack1: [
    GUARD_BOX,
    (g, s) =>
      lines(g, C.ink, s * 0.025, [
        [s * 0.6, -s * 0.12, s * 0.5, -s * 0.04],
        [s * 0.5, -s * 0.04, s * 0.54, s * 0.07],
      ]),
  ],
  guardCrack2: [
    GUARD_BOX,
    (g, s) =>
      lines(g, C.ink, s * 0.025, [
        [s * 0.52, s * 0.32, s * 0.44, s * 0.22],
        [s * 0.44, s * 0.22, s * 0.4, s * 0.28],
        [s * 0.56, -s * 0.28, s * 0.47, -s * 0.33],
      ]),
  ],
  pad: [
    PAD_BOX,
    (g, s) => {
      union(g, C.armour, [PAD(s)]);
      g.fill(...C.armourHi);
      cap(s * 0.46, s * 0.36, 0.8, s * 0.44, s * 0.38)(g);
      g.fill(...C.rim);
      cap(s * 0.535, s * 0.5, 0.95, s * 0.51, s * 0.48)(g);
      for (let i = 0; i < 3; i++) {
        const th = (i - 1) * 0.5;
        const x = Math.sin(th) * s * 0.41;
        const y = Math.cos(th) * s * 0.42;
        g.fill(...C.ink);
        g.ellipse(x, y, s * 0.09);
        g.fill(...C.rim);
        g.ellipse(x, y, s * 0.06);
      }
    },
  ],
  padWhite: [PAD_BOX, (g, s) => union(g, C.white, [PAD(s)], false)],
  padBare: [
    PAD_BOX,
    (g, s) => {
      union(g, C.pale, [cap(s * 0.48, s * 0.3, 0.85, s * 0.44, s * 0.32)]);
      lines(g, C.ink, s * 0.04, [
        [-s * 0.4, s * 0.22, -s * 0.3, s * 0.25],
        [s * 0.4, s * 0.22, s * 0.3, s * 0.25],
      ]); // torn straps
    },
  ],
  padCrack1: [
    PAD_BOX,
    (g, s) =>
      lines(g, C.ink, s * 0.025, [
        [s * 0.06, s * 0.53, s * 0.02, s * 0.42],
        [s * 0.02, s * 0.42, s * 0.09, s * 0.33],
      ]),
  ],
  padCrack2: [
    PAD_BOX,
    (g, s) =>
      lines(g, C.ink, s * 0.025, [
        [-s * 0.26, s * 0.46, -s * 0.2, s * 0.36],
        [-s * 0.2, s * 0.36, -s * 0.26, s * 0.29],
        [s * 0.33, s * 0.42, s * 0.24, s * 0.35],
      ]),
  ],
  head: [
    [-0.44, -0.34, 0.34, 0.34],
    (g, s) => {
      const r = (s * HEAD_D) / 2;
      // The earpiece's coil, from his left ear back into his collar
      g.noFill();
      g.stroke(...C.coil, 230);
      g.strokeWeight(s * 0.025);
      g.beginShape();
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        const x = -s * 0.02 - s * 0.3 * u;
        const y = -r - s * 0.03 + s * 0.08 * u;
        g.vertex(
          x + Math.cos(u * 30) * s * 0.022,
          y + Math.sin(u * 30) * s * 0.022
        );
      }
      g.endShape();
      g.noStroke();
      g.fill(...C.ink, 70);
      g.ellipse(-s * 0.03, 0, 2 * r + s * 0.08, 2 * r + s * 0.06); // sunk between his traps
      union(g, C.scalp, [
        (g) => g.ellipse(-s * 0.01, -r, s * 0.08, s * 0.07),
        (g) => g.ellipse(-s * 0.01, r, s * 0.08, s * 0.07),
        (g) => g.ellipse(0, 0, 2 * r, 2 * r),
      ]);
      // The folds at the back of his neck
      g.noFill();
      g.stroke(...C.ink, 170);
      g.strokeWeight(s * 0.02);
      g.arc(s * 0.0, 0, r * 1.6, r * 1.5, PI * 0.78, PI * 1.22);
      g.noStroke();
      // Sunglasses on the front of his head, their arms back to his ears
      lines(g, C.shades, s * 0.03, [
        [s * 0.1, -r * 0.86, -s * 0.02, -r * 1.02],
        [s * 0.1, r * 0.86, -s * 0.02, r * 1.02],
      ]);
      union(g, C.shades, [
        crescent(0, r * 1.06, r * 1.02, r * 0.76, r * 0.9, 0.8),
      ]);
      g.fill(170, 230, 240);
      g.ellipse(r * 0.9, -r * 0.34, s * 0.05, s * 0.03);
      g.ellipse(r * 0.9, r * 0.34, s * 0.05, s * 0.03);
    },
  ],
  headFlush: [
    [-0.44, -0.34, 0.34, 0.34],
    (g, s) => {
      g.fill(...C.flush);
      g.ellipse(-s * 0.03, 0, s * HEAD_D * 0.84, s * HEAD_D * 0.9);
    },
  ],
  cannon: [
    CANNON_BOX,
    (g, s) => {
      union(g, C.cannon, CANNON(s));
      g.fill(...C.band);
      g.rect(-s * 0.14, -s * 0.18, s * 0.08, s * 0.36);
      g.rect(s * 0.42, -s * 0.23, s * 0.2, s * 0.46, s * 0.07);
      lines(g, C.ink, s * 0.025, [
        [s * 0.2, -s * 0.14, s * 0.2, s * 0.14],
        [s * 0.28, -s * 0.14, s * 0.28, s * 0.14],
        [s * 0.36, -s * 0.14, s * 0.36, s * 0.14],
      ]);
      fists(g, s);
    },
  ],
  cannonAmber: [
    CANNON_BOX,
    (g, s) => {
      union(g, C.amber, CANNON(s), false);
      g.fill(255, 214, 120);
      g.rect(s * 0.0, -s * 0.07, s * 0.56, s * 0.14, s * 0.07);
      fists(g, s);
    },
  ],
  cannonHot: [
    CANNON_BOX,
    (g, s) => {
      union(g, C.hot, CANNON(s), false);
      fists(g, s);
    },
  ],
  // An arm from the shoulder (0, 0) to the fist (ARM_L, 0): an upper arm and
  // a forearm that bulges toward the fist; drawn stretched to fit
  arm: [
    [-0.2, -0.26, ARM_L + 0.2, 0.26],
    (g, s) => {
      const L = s * ARM_L;
      const T = s * ARM_T;
      const parts = [
        (g) => g.ellipse(L * 0.4, 0, L * 0.9, T * 0.78),
        (g) => g.ellipse(L * 0.72, 0, L * 0.72, T * 1.12),
      ];
      union(g, C.skinMid, parts);
      g.fill(...C.skinHi);
      g.ellipse(L * 0.74, -T * 0.1, L * 0.46, T * 0.42);
    },
  ],
};

export const tankParts = (p, s) => spriteParts(p, TANK_PARTS, s);

// ---- live parts ----
// A part with an ink edge on the live canvas: a slightly larger ink copy
// behind it, no stroke
function inkOval(p, x, y, w, h, c) {
  p.fill(...C.ink);
  p.ellipse(x, y, w + O, h + O);
  p.fill(...c);
  p.ellipse(x, y, w, h);
}
// A cool booster flame from (x, y) going backwards along -x; k is thrust
function jet(p, s, x, y, k) {
  if (k < 0.03) return;
  const len = s * (0.12 + 0.65 * k);
  const w = s * (0.13 + 0.08 * k);
  p.fill(...C.flame, 190 * Math.min(1, k + 0.3));
  p.ellipse(x - len * 0.5, y, len, w);
  p.fill(255, 255, 255, 230 * Math.min(1, k + 0.2));
  p.ellipse(x - len * 0.25, y, len * 0.45, w * 0.5);
}
// An arm from the shoulder (x0, y0) to the fist (x1, y1), thick px wide
function arm(p, s, parts, x0, y0, x1, y1, thick) {
  p.push();
  p.translate(x0, y0);
  p.rotate(Math.atan2(y1 - y0, x1 - x0));
  p.scale(Math.hypot(x1 - x0, y1 - y0) / (s * ARM_L), thick / (s * ARM_T));
  stamp(p, parts.arm);
  p.pop();
}
// Plate debris: chunks flung out along the plate's normal (nx, ny) from (x, y)
function debris(p, s, x, y, nx, ny, age) {
  if (age < 0 || age > 1) return;
  const fade = 1 - age;
  const reach = s * 1.6 * (1 - Math.exp(-age / 0.22));
  p.fill(255, 248, 225, 240 * env(age, 0.1));
  p.ellipse(x, y, s * (0.5 + 0.8 * clamp01(age / 0.15)));
  for (let i = 0; i < 5; i++) {
    const spread = (i - 2) * 0.4;
    const c = Math.cos(spread);
    const sn = Math.sin(spread);
    const dx = nx * c - ny * sn;
    const dy = nx * sn + ny * c;
    const d = reach * (0.7 + 0.12 * ((i * 3) % 5));
    p.push();
    p.translate(x + dx * d, y + dy * d);
    p.rotate(age * (i % 2 ? 9 : -7) + i);
    const w = s * (0.22 - 0.025 * i);
    p.fill(...C.ink, 255 * fade);
    p.rect(-w / 2 - 1, -w * 0.35 - 1, w + 2, w * 0.7 + 2, 1.5);
    p.fill(...C.armour, 255 * fade);
    p.rect(-w / 2, -w * 0.35, w, w * 0.7, 1);
    p.pop();
  }
}

/**
 * The tank at his centre, drawn at size s from his pose (Tank#pose): seen
 * from above, turned with his facing. BaseEnemy draws his glow, health bar
 * and spawn warp; BombSystem draws a bomb on his back.
 */
export function drawTank(p, s, look) {
  const parts = tankParts(p, s);
  const t = look.t;
  const ctx = p.drawingContext;
  // An overlay at a fraction of the alpha it is drawn at (a spawning tank
  // fades in whole)
  const alpha = (a, fn) => {
    if (a <= 0.02) return;
    const base = ctx.globalAlpha;
    ctx.globalAlpha = base * Math.min(1, a);
    fn();
    ctx.globalAlpha = base;
  };
  const SWAGGER = CONFIG.TANK_LOOK.SWAGGER;

  // ---- the pose ----
  const charging = look.charge >= 0;
  const ch = charging ? look.charge : 0;
  const bar2 = charging && ch >= 0.5;
  const last = charging && ch >= 15 / 16; // the last half-beat: white-hot
  const bulk = charging ? smooth(ch) : 0;
  const fire = look.fire > 0.01 ? look.fire : 0;
  const L = look.lurch;
  const sh = look.shove;
  // Turning, shoulders first: his shoulders get round before his facing
  // does, swing past it and settle back; his head and booster pack drag
  // behind and catch up after. All relative to his facing, so it adds
  // nothing once the turn has settled.
  const dT = look.turn.to - look.turn.from;
  const age =
    Math.min(look.turn.age, TURN_REST_SEC) * (PROTO_TURN_SEC / look.turnSec);
  const fac = look.turn.k; // where his facing is in the turn
  const u = age - 0.3;
  const settle = u > 0 ? 0.16 * Math.exp(-u / 0.2) * Math.sin(u * 15) : 0;
  let yokeA = dT * (smooth(clamp01(age / 0.3)) + settle - fac);
  const packA = dT * (smooth(clamp01((age - 0.12) / 0.55)) - fac);
  let headA = dT * (smooth(clamp01((age - 0.06) / 0.5)) - fac);
  const tw = Math.sin(PI * clamp01(age / 0.6)) * Math.min(1, Math.abs(dT)); // how hard he is turning
  // Idle swagger through the bar (not while charging, angry or just after a shot)
  const idle = charging || look.fireAge < 1 || look.angry ? 0 : 1;
  const ph = look.beatPhase;
  const roll =
    SWAGGER *
    idle *
    (look.beat === 1 ? Math.sin(2 * PI * ph) * Math.sin(PI * ph) : 0); // a shoulder roll on 2
  const neck = SWAGGER * idle * (look.beat === 2 ? Math.sin(PI * ph) : 0); // a neck roll on 3
  const crack =
    SWAGGER *
    idle *
    (look.beat === 3 ? Math.max(0, Math.sin(PI * clamp01(ph * 1.6))) : 0); // knuckles on 4
  yokeA += 0.16 * roll;
  headA += 0.6 * neck * Math.sin(2 * PI * ph);
  // The charge: he strains; bar 2 trembles and steams
  const tremble = charging ? (bar2 ? 1.2 + 3.2 * (ch - 0.5) : 0.4 * ch) : 0;
  const jit = tremble + 2.5 * look.hit + 0.7 * look.angry;
  const swell =
    (bar2 ? 0.08 + 0.2 * (ch - 0.5) : 0.06 * ch) +
    0.05 * look.kick +
    0.05 * look.angry +
    0.06 * fire;
  const veins = Math.max(
    bar2 ? 0.5 + (ch - 0.5) : 0,
    look.angry ? 0.8 : 0,
    0.6 * look.hit
  );
  const flush = Math.max(
    charging ? (bar2 ? 0.7 + 0.6 * (ch - 0.5) : 0.25 * ch) : 0,
    look.angry ? 0.7 + 0.2 * Math.sin(t * 9) : 0
  );
  const backHit = look.backHit;
  // A plate breaking: a fling and a wince away from it
  const pb = look.plateBroke;
  const wince = (n) => (pb[n] >= 0 ? env(pb[n], 0.2) : 0);
  const wF = wince('front');
  const wL = wince('left');
  const wR = wince('right');
  // The slab lunges on the lurch and is knocked back by his shot; on the
  // kick itself he hunches for an instant before the boosters shove him
  const hunch = L > 0.85 ? (L - 0.85) / 0.15 : 0;
  const yokeX =
    s *
    (0.1 * L -
      0.08 * hunch +
      0.1 * sh -
      0.2 * fire -
      0.04 * bulk -
      0.16 * wF +
      0.06 * backHit);
  const yokeY = s * 0.16 * (wL - wR);
  yokeA += 0.22 * (wR - wL);
  const stretch = 0.08 * L * (1 - hunch) - 0.08 * hunch - 0.06 * tw;
  const aimRel = look.gunRel - yokeA;

  p.push();
  p.noStroke();
  p.translate(
    jit * Math.sin(t * 71 + look.seed * 9) * 0.6,
    jit * Math.sin(t * 57 + 1.7) * 0.6
  );
  p.rotate(look.facing);

  // ---- boosters under his back: flare backwards on the lurch ----
  p.push();
  p.rotate(packA);
  const flick = 0.85 + 0.3 * Math.abs(Math.sin(t * 37 + look.seed * 5));
  const sput = bar2 ? 0.45 + 0.55 * Math.abs(Math.sin(t * 23)) : 1;
  const thrust = (0.25 + 1.5 * L + 0.6 * sh) * flick * sput;
  jet(p, s, -s * 0.88, -s * 0.13, thrust + (dT > 0 ? 0.8 * tw : 0));
  jet(p, s, -s * 0.88, s * 0.13, thrust + (dT < 0 ? 0.8 * tw : 0));
  p.pop();

  // ---- the slab ----
  p.push();
  p.translate(yokeX, yokeY);
  p.rotate(yokeA);
  p.scale(1 + swell * 0.4 + stretch, 1 + swell - stretch * 0.5);
  stamp(p, parts.slab);
  alpha(veins, () => stamp(p, parts.veins));
  alpha(0.9 * backHit, () => stamp(p, parts.backWhite));
  p.push();
  p.rotate(packA - yokeA);
  stamp(p, parts.pack);
  p.pop();

  // The cannon swings toward his aim in his arms
  const px =
    tankCannon(s, look.gunRel).pivotX +
    s * (0.24 * sh - 0.08 * bulk - 0.2 * fire);
  const wring = 0.22 * crack * Math.sin(ph * 6 * PI); // cracking his knuckles: he wrings the cannon
  const gunA = aimRel + wring;
  const ca = Math.cos(gunA);
  const sa = Math.sin(gunA);
  const fists = [-1, 1].map((side) => [
    px - sa * s * GRIP * side,
    ca * s * GRIP * side,
  ]);
  // The riot chest guard: his front plate
  const pl = look.plates;
  const hitP = look.plateHit;
  p.push();
  p.translate(-s * 0.04 * hitP.front, 0);
  if (pl.front > 0) {
    stamp(p, parts.guard);
    if (pl.front < 0.67) stamp(p, parts.guardCrack1);
    if (pl.front < 0.34) stamp(p, parts.guardCrack2);
    alpha(0.85 * hitP.front, () => stamp(p, parts.guardWhite));
  } else stamp(p, parts.guardBare);
  p.pop();

  // Arms from his shoulders to his fists, beefier as he tenses
  const thick = s * (ARM_T + 0.06 * bulk + 0.03 * sh + 0.03 * look.angry);
  const rollX = s * 0.14 * roll;
  arm(
    p,
    s,
    parts,
    s * SHOULDER[0] - rollX,
    -s * SHOULDER[1],
    fists[0][0],
    fists[0][1],
    thick
  );
  arm(
    p,
    s,
    parts,
    s * SHOULDER[0] + rollX,
    s * SHOULDER[1],
    fists[1][0],
    fists[1][1],
    thick
  );

  // Shoulder pads: the right one is the sprite, the left it mirrored
  for (const [name, side] of [
    ['left', -1],
    ['right', 1],
  ]) {
    p.push();
    p.translate(
      s * PAD_AT[0] + side * rollX,
      side * s * (PAD_AT[1] - 0.04 * hitP[name])
    );
    p.scale(1, side);
    if (pl[name] > 0) {
      stamp(p, parts.pad);
      if (pl[name] < 0.67) stamp(p, parts.padCrack1);
      if (pl[name] < 0.34) stamp(p, parts.padCrack2);
      alpha(0.85 * hitP[name], () => stamp(p, parts.padWhite));
    } else stamp(p, parts.padBare);
    p.pop();
  }

  // The gold chain counts the charge: a link a beat, from his left round
  // the front of his neck to his right; white-hot on the last half-beat
  stamp(p, parts.chain);
  if (charging) {
    const lit = last ? C.hot : C.amber;
    const pop = env(ph * look.beatSec, 0.08);
    const n = Math.min(CHAIN_N - 1, look.chargeBeats);
    p.fill(...lit, last ? 190 : 120);
    for (let i = 0; i <= n; i++) {
      const [x, y] = linkAt(i);
      p.ellipse(x * s, y * s, s * (last ? 0.42 : 0.34));
    }
    for (let i = 0; i <= n; i++) {
      const [x, y] = linkAt(i);
      const d = s * (0.19 + (i === n ? 0.09 * pop : 0));
      inkOval(p, x * s, y * s, d, d * 0.85, lit);
    }
  }

  // His head, sunk between his traps; it rolls on his neck and looks where he aims
  p.push();
  const gaze = 0.4 * aimRel;
  p.translate(
    s *
      (HEAD[0] -
        0.08 * L * (1 - hunch) -
        0.08 * fire +
        0.05 * backHit +
        0.05 * neck * Math.cos(2 * PI * ph)),
    s * 0.05 * neck * Math.sin(2 * PI * ph)
  );
  p.rotate(headA + gaze);
  p.scale(1 - 0.14 * bulk - 0.12 * Math.max(wF, wL, wR));
  stamp(p, parts.head);
  alpha(flush * 1.1, () => stamp(p, parts.headFlush));
  // A shine that stays put on screen, whichever way he turns
  p.rotate(-(look.facing + yokeA + headA + gaze));
  p.fill(255, 255, 255, 230);
  p.ellipse(-s * 0.06, -s * 0.065, s * 0.13, s * 0.08);
  p.pop();

  // The cannon, his fists on it
  p.push();
  p.translate(px, 0);
  p.rotate(gunA);
  stamp(p, parts.cannon);
  if (crack > 0.5 && Math.floor(ph * 10) % 3 === 0) {
    p.fill(255, 255, 255, 240);
    for (const side of [-1, 1]) {
      for (const [dx, dy] of [
        [-0.06, 0.4],
        [0.03, 0.43],
        [0.12, 0.39],
      ]) {
        p.ellipse(s * dx, s * dy * side, s * 0.06);
      }
    }
  }
  // Heat: amber through the charge, white-hot on its last half-beat, cooling after the shot
  const cool = look.fireAge < 1 ? 1 - look.fireAge : 0;
  alpha(Math.max(charging ? 0.15 + 0.85 * ch : 0, cool), () =>
    stamp(p, parts.cannonAmber)
  );
  alpha(last ? 1 : fire > 0.3 ? fire : 0, () => stamp(p, parts.cannonHot));
  const beatPop = env(ph * look.beatSec, 0.12);
  const glow = Math.max(
    charging
      ? bar2
        ? 0.75 + 0.25 * beatPop
        : 0.25 + 0.6 * ch + 0.2 * beatPop
      : 0,
    last ? 1 : 0,
    fire
  );
  if (glow > 0.02) {
    // A halo round the cannon and his fists only, never over his body
    p.fill(
      ...(last || fire > 0.3 ? C.hot : C.amber),
      (last ? 190 : 140) * glow
    );
    p.ellipse(s * 0.26, 0, s * (0.95 + 0.25 * glow), s * (0.72 + 0.12 * glow));
    p.fill(...(last ? C.hot : C.amber), 200 * glow);
    p.ellipse(s * (MUZZLE + 0.06), 0, s * (0.3 + 0.3 * glow));
    if (fire > 0.05) {
      p.fill(255, 220, 140, 230 * fire);
      p.ellipse(s * (MUZZLE + 0.35), 0, s * 1.1 * fire, s * 0.75 * fire);
      p.fill(255, 255, 255, 255 * fire);
      p.ellipse(s * (MUZZLE + 0.2), 0, s * 0.55 * fire);
    }
  }
  p.pop();

  // Steam from his ears: angry, or straining in bar 2
  const steam = Math.max(look.angry, bar2 ? 0.4 + 1.2 * (ch - 0.5) : 0);
  if (steam > 0.05) {
    for (let i = 0; i < 4; i++) {
      const a = (t * 1.8 + i / 2) % 1;
      const side = i % 2 ? 1 : -1;
      const k = (1 - a) * Math.min(1, steam);
      const x = s * (HEAD[0] - 0.2 * a);
      const y = side * s * (0.26 + 0.4 * a);
      const d = s * (0.13 + 0.3 * a);
      p.fill(...C.ink, 90 * k);
      p.ellipse(x, y, d + 2.5);
      p.fill(...C.steam, 235 * k);
      p.ellipse(x, y, d);
    }
  }
  p.pop(); // slab

  // ---- broken plates fly off ----
  for (const [name, nx, ny, x, y] of [
    ['front', 1, 0, s * 0.58, 0],
    ['left', 0, -1, 0, -s * 1.2],
    ['right', 0, 1, 0, s * 1.2],
  ]) {
    debris(p, s, x, y, nx, ny, pb[name]);
  }
  p.pop();
}

/**
 * His shot: a heavy amber ball with a white-hot core and an ink rim, d
 * across, drawn at the origin; the caller turns it along its flight. spin
 * turns the spark on its rim.
 */
export function drawTankBall(p, d, spin) {
  p.noStroke();
  for (let i = 3; i >= 1; i--) {
    p.fill(...C.amber, 50 + 20 * (3 - i));
    p.ellipse(-d * 0.45 * i, 0, d * (1 - 0.18 * i), d * (0.8 - 0.15 * i));
  }
  p.fill(...C.ink);
  p.ellipse(0, 0, d + O);
  p.fill(...C.amber);
  p.ellipse(0, 0, d);
  p.fill(...C.hot);
  p.ellipse(d * 0.08, 0, d * 0.6);
  p.fill(255, 255, 255);
  p.ellipse(Math.cos(spin) * d * 0.28, Math.sin(spin) * d * 0.28, d * 0.14);
}
