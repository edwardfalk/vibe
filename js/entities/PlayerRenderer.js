/**
 * The hero's look: the Dude, a long-haired, bearded slacker in a bathrobe
 * and jelly sandals, a White Russian in his other hand and black shades on,
 * walking through space on rage. Ported from dir-dude.js and dir-upgraded.js
 * in docs/superpowers/specs/2026-10-03-hero-studies/ (git-ignored); the spec
 * is docs/superpowers/specs/2026-10-03-dude-hero-design.md.
 *
 * Seen from the side, upright, mirrored to face his aim; only his gun arm
 * swings round, from the shoulder. His steps land on the eighth notes and he
 * walks at one speed, so his stride repeats every two eighths: everything
 * below his head that moves with it (off arm and drink, legs, robe, sash,
 * the hair down his back) is a flipbook, drawn once. His head, shades and
 * gun arm are sprites; his mouth, vein, steam, glint, muzzle flash, cracks,
 * bubble and health bar are drawn live.
 *
 * Coordinates are the prototype's px at his size 32 (PROTO_SIZE); the drawn
 * size scales them. Everything goes straight to the canvas context, because
 * p5's fill() makes a colour object per call, which costs more than the
 * shapes.
 */
import { clamp01, smooth, env, PI, TWO_PI } from '../mathUtils.js';
import { spriteParts } from './spriteCache.js';
import { GRUNT_COLORS, mix } from './GruntRenderer.js';
import { hash01 } from './RusherRenderer.js';
import { drawGlow } from '../effects/glowUtils.js';

// His geometry, in the prototype's px at his size 32 (PROTO_SIZE), facing
// right. player.js uses it too: his shots leave the drawn gun, and his
// stomps' cracks land under him
export const PROTO_SIZE = 32;
export const SHOULDER = Object.freeze([2.4, -7]); // his gun arm's shoulder
export const MUZZLE = Object.freeze([24, -1]); // the muzzle, in the gun arm's frame
export const FEET_Y = 20.6; // his soles, below his centre
export const CRACK_AHEAD = 4; // a stomp's crack, ahead of his centre

/** His gun shoulder at (x, y), facing 1 (right) or -1, drawn at size s */
export function heroShoulder(x, y, facing, s) {
  const k = s / PROTO_SIZE;
  return { x: x + facing * SHOULDER[0] * k, y: y + SHOULDER[1] * k };
}

/**
 * Where his shot leaves: the muzzle in his rest pose, his gun arm along
 * aimAngle from the shoulder. In his mirrored frame MUZZLE's second number
 * is toward the top of the gun, so it flips with his facing.
 */
export function heroMuzzle(x, y, aimAngle, facing, s) {
  const k = s / PROTO_SIZE;
  const sh = heroShoulder(x, y, facing, s);
  const c = Math.cos(aimAngle);
  const sn = Math.sin(aimAngle);
  return {
    x: sh.x + (MUZZLE[0] * c - MUZZLE[1] * facing * sn) * k,
    y: sh.y + (MUZZLE[0] * sn + MUZZLE[1] * facing * c) * k,
  };
}

// His palette, [r, g, b], frozen. Ink is the cast's
export const HERO_COLORS = Object.freeze(
  Object.fromEntries(
    Object.entries({
      ink: GRUNT_COLORS.ink,
      robe: [208, 182, 146], // oatmeal terry
      robeShade: [166, 138, 106],
      trim: [132, 94, 72], // the shawl collar, the cuffs, the hem
      // The woven band on the hem and cuffs: the sky's own rust, teal, ochre
      bandRust: [196, 96, 64],
      bandTeal: [64, 150, 150],
      bandOchre: [226, 176, 70],
      sash: [112, 78, 60],
      tee: [70, 128, 188], // his old steel blue, now his T-shirt
      hair: [120, 86, 58],
      hairShade: [88, 62, 44],
      skin: [250, 206, 162],
      skinFar: [222, 168, 128],
      angry: [236, 88, 76],
      legHair: [150, 104, 78],
      jelly: [150, 214, 222], // jelly sandals
      jellyDark: [96, 164, 178],
      glass: [176, 222, 240], // a little blue against the robe
      drink: [250, 242, 226], // milky
      white: [255, 255, 255],
      shades: [16, 14, 24],
      mouth: [96, 34, 40],
      teeth: [250, 246, 236],
      gun: [176, 176, 190],
      gunDark: [72, 70, 86],
      gunHi: [220, 220, 230],
      flash: [255, 236, 128],
      shield: [124, 214, 255],
      shieldHi: [236, 250, 255],
      crack: [198, 236, 255],
      vein: [236, 46, 58],
      steam: [238, 238, 246],
      ghost: [120, 196, 255], // the dash's afterimages
      hpBack: [56, 52, 66],
      hpHigh: [120, 210, 110],
      hpMid: [250, 220, 90],
      hpLow: [240, 92, 92],
    }).map(([k, v]) => [k, Object.freeze([...v])])
  )
);
const C = HERO_COLORS;
export const BAND = Object.freeze([C.bandRust, C.bandTeal, C.bandOchre]);

// ---- his numbers ------------------------------------------------------------
// Exported ones are shared with his death (DudeDeath.js): one drawing of him
export const O = 2.2; // the ink round each part, px: the cast's
const HEAD_K = 0.9; // his head, scaled about his neck
const NECK = [1.2, -10]; // that pivot
export const HIP_Y = 4; // he leans from here
// The stride: a foot lands on every eighth note, two eighths to a loop
const WALK_FRAMES = 12; // 24 a second at 120 BPM
const DASH_FRAMES = 3;
const STRIDE_RAD = 0.62; // his legs' swing at walking speed
const WALK_BOB_PX = 2.2;
const WALK_LEAN_RAD = 0.1;
const DASH_BOB_PX = 3;
const DASH_LEAN_RAD = 0.38;
const DASH_PEAK = 1.2; // the leap peaks a little before the dash ends
const BACK_COS = 0.25; // dashing this much against his facing, he leaps back
// His body's pictures, round his centre: the dash's leap reaches 19.4 px
// ahead and the sandals 22.7 px down, plus ink (PlayerLook.test.js checks)
const FLIPBOOK_BOX = [-21, -24, 21, 24];
export const OFF_SHOULDER = Object.freeze([-3.6, -6.6]); // his drink arm's shoulder
// His hips, [x, y]: far and near; his legs swing from them
export const HIPS = Object.freeze([
  Object.freeze([-2.4, 3.6]),
  Object.freeze([1.6, 3.6]),
]);
export const HAIR_PIVOT = Object.freeze([-2.2, -19.5]); // his hair swings from here, in his head's frame
export const DRINK_ARM_RAD = 0.9; // the glass by his belly, below his gun arm
const DRINK_ARM_DASH_RAD = 0.5;
// His shots
const RECOIL_TAU_SEC = 0.06;
const RECOIL_RAD = 0.16;
const RECOIL_PX = 2;
const RECOIL_LEAN_RAD = 0.06;
// His nod on the beat, standing; smaller while he walks or fires
const NOD_IDLE_PX = 1.1;
const NOD_BUSY_PX = 0.4;
// A hit to his health
const HURT_TAU_SEC = 0.15;
const FLASH_FROM = 0.3; // he brightens while the hurt envelope is above this
const FLASH_K = 0.75;
export const FLINCH_PX = 3;
const DUCK_PX = 0.8;
const GRIT_SEC = 0.35;
const ASKEW_HOLD_SEC = 0.18; // his shades, knocked crooked, are held
const ASKEW_SLIDE_SEC = 0.5; // then slide back
const ASKEW_RAD = 0.42;
const SPILL_SEC = 0.4;
// His anger, from his health: full at 15% health
const ANGER_FULL = 0.85;
const RED_K = 0.8;
const VEIN_ANGER = 0.35;
const STEAM_ANGER = 0.55;
const GLOW_ANGER = 0.6;
const TREMBLE_ANGER = 0.75;
const GLARE_STEPS = 5;
const GLARE_PX = 1.7; // his shades' top edge dips this far, at full anger
const TREMBLE_PX = 4.4;
const TREMBLE_HZ = 30;
export const STEAM_SEC = 1; // a puff rises this long
// Under him
const CRACK_SEC = 0.32;
const CRACK_ANGER_K = 0.7; // cracks this much bigger at full anger
// The shield, a bubble
const BUBBLE_R = 28;
const BUBBLE_SWELL = 0.04; // on each kick
const POP_SEC = 0.3; // it swells back in
const RIM_SEC = 0.4; // its rim stays bright
const SHATTER_SEC = 0.45;
const SHARDS = 12;
// The dash's afterimages: alpha each, GHOST_GAP px apart
const GHOSTS = [0.42, 0.26, 0.13];
const GHOST_GAP = 8;
// The health bar, 26 px wide at any size, between his head and the rim
const HP_W = 26;
const HP_H = 3.6;

const easeOutBack = (k) =>
  1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2);

// ---- drawing on the raw context ---------------------------------------------
// Exported, with the helpers below, for his death's parts: begin() or a
// sprite's build sets it
export let ctx = null;
let SP = null; // his sprites, built at K
let K = 1; // drawn px per prototype px
let ghost = false; // drawing an afterimage: one flat colour, no details

const style = (c, a = 1) => {
  const k = ghost ? C.ghost : c;
  return `rgba(${k[0] | 0},${k[1] | 0},${k[2] | 0},${a})`;
};
export const fillC = (c, a) => (ctx.fillStyle = style(c, a));
export const strokeC = (c, w, a) => {
  ctx.strokeStyle = style(c, a);
  ctx.lineWidth = w;
};
export const ell = (x, y, w, h) => {
  ctx.beginPath();
  ctx.ellipse(x, y, w / 2, h / 2, 0, 0, TWO_PI);
};
// A rounded rectangle path (no ctx.roundRect: it froze old Firefox and Safari)
export function rr(x, y, w, h, r1, r2 = r1, r3 = r1, r4 = r1) {
  const m = Math.min(w, h) / 2;
  [r1, r2, r3, r4] = [r1, r2, r3, r4].map((r) => Math.max(0, Math.min(m, r)));
  ctx.beginPath();
  ctx.moveTo(x + r1, y);
  ctx.lineTo(x + w - r2, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r2);
  ctx.lineTo(x + w, y + h - r3);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r3, y + h);
  ctx.lineTo(x + r4, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r4);
  ctx.lineTo(x, y + r1);
  ctx.quadraticCurveTo(x, y, x + r1, y);
}
const path = (pts) => {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
};
// Each part on an ink copy of itself, O px larger: an outline without strokes
const ov = (x, y, w, h, c) => {
  fillC(C.ink);
  ell(x, y, w + O, h + O);
  ctx.fill();
  fillC(c);
  ell(x, y, w, h);
  ctx.fill();
};
export const bx = (x, y, w, h, r, c, r2 = r, r3 = r, r4 = r) => {
  const o = O / 2;
  fillC(C.ink);
  rr(x - o, y - o, w + O, h + O, r + o, r2 + o, r3 + o, r4 + o);
  ctx.fill();
  fillC(c);
  rr(x, y, w, h, r, r2, r3, r4);
  ctx.fill();
};
// A polygon with its ink edge
const poly = (pts, c) => {
  path(pts);
  fillC(C.ink);
  strokeC(C.ink, O);
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
  fillC(c);
  ctx.fill();
};

// ---- parts that keep their shape ----------------------------------------------
// A robe sleeve from the shoulder, its cuff with the woven band, a bare
// forearm
const sleeve = (skin) => {
  bx(-2.8, -3.0, 8.0, 6.0, 3.0, C.robe);
  if (!ghost) {
    fillC(C.trim);
    rr(4.0, -3.0, 2.2, 6.0, 0.6);
    ctx.fill();
    BAND.forEach((c, i) => {
      fillC(c);
      ctx.fillRect(4.3 + i * 0.6, -3.0, 0.45, 6.0);
    });
  }
  bx(6.0, -2.1, 4.0, 4.2, 1.6, skin);
};
// The blaster and its grip, in the gun arm's frame
export const blaster = () => {
  bx(8.0, -3.4, 11.4, 4.8, 1.2, C.gun, 1.2, 1.2, 0.6);
  if (!ghost) {
    fillC(C.gunHi);
    rr(9.0, -3.4, 8.6, 1.2, 0.6);
    ctx.fill();
  }
  bx(18.9, -2.4, 4.6, 2.8, 0.6, C.gunDark);
  bx(9.6, 0.4, 3.2, 4.2, 1.0, C.gunDark);
};
// The gun arm from the shoulder: the sleeve, the blaster, his fist on its grip
const gunArm = () => {
  sleeve(C.skin);
  blaster();
  ov(9.6, 0.4, 5.2, 5.2, C.skin);
};
// A bare, hairy shin and a jelly sandal, down from the hip; the robe hides
// the rest
export const leg = (skin) => {
  bx(-2.4, -1.2, 4.8, 14.6, 2.2, skin);
  bx(-2.6, 12.6, 8.0, 2.6, 1.3, skin, 1.0, 1.3, 1.0);
  if (!ghost) {
    strokeC(C.legHair, 0.6);
    ctx.beginPath();
    for (const [x, y] of [
      [-1.2, 8.6],
      [0.6, 9.8],
      [-0.4, 11.2],
    ]) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.9, y - 0.5);
    }
    ctx.stroke();
  }
  bx(-3.0, 15.0, 8.8, 1.7, 0.8, C.jelly);
  if (!ghost) {
    fillC(C.jellyDark);
    rr(-1.6, 12.4, 1.2, 2.8, 0.4);
    ctx.fill();
    rr(1.8, 12.5, 1.2, 2.7, 0.4);
    ctx.fill();
  }
};
// The head: the face, stubble, a moustache and a scruffy goatee, long hair
// over the crown with a lock in front of his ear, his nose
const head = (face) => () => {
  bx(-5.0, -22.6, 12.4, 12.8, 6.0, face, 5.4, 3.4, 4.2);
  if (ghost) return;
  fillC(C.hair, 0.38);
  path([
    [-1.8, -14.6],
    [-1.4, -11.0],
    [1.8, -9.4],
    [5.0, -9.2],
    [5.0, -12.6],
    [1.6, -13.4],
  ]);
  ctx.fill();
  fillC(C.hair);
  path([
    [4.0, -13.2],
    [6.2, -13.6],
    [8.4, -13.3],
    [8.3, -12.2],
    [7.0, -12.6],
    [5.4, -12.2],
    [4.2, -12.0],
  ]);
  ctx.fill();
  path([
    [4.6, -11.0],
    [6.0, -11.4],
    [7.8, -11.0],
    [7.9, -9.8],
    [6.8, -8.6],
    [5.4, -8.4],
    [4.4, -9.4],
  ]);
  ctx.fill();
  fillC(C.hair);
  path([
    [-5.6, -16.6],
    [-5.6, -20.6],
    [-3.2, -23.4],
    [0.8, -24.2],
    [4.4, -23.4],
    [6.4, -21.4],
    [5.4, -19.8],
    [3.0, -20.8],
    [1.0, -19.4],
    [-0.4, -19.0],
    [-1.2, -16.6],
    [-1.8, -14.6],
    [-3.0, -14.0],
    [-4.4, -14.8],
  ]);
  ctx.fill();
  strokeC(C.hairShade, 0.7);
  ctx.beginPath();
  ctx.moveTo(-3.8, -21.4);
  ctx.quadraticCurveTo(-2.0, -18.0, -2.8, -13.6);
  ctx.moveTo(-0.8, -22.8);
  ctx.quadraticCurveTo(0.6, -21.0, 0.2, -19.6);
  ctx.stroke();
  ov(7.6, -14.2, 2.4, 2.8, face);
};
// The long hair down his back to his shoulders
export const hairBack = () => {
  poly(
    [
      [-1.0, -23.6],
      [-4.8, -22.8],
      [-7.2, -20.2],
      [-8.4, -16.4],
      [-8.8, -12.4],
      [-9.6, -8.4],
      [-8.0, -7.2],
      [-6.6, -8.4],
      [-5.2, -7.0],
      [-3.8, -8.6],
      [-2.8, -7.8],
      [-1.6, -10.4],
      [-0.8, -13.2],
      [0.6, -18.0],
    ],
    C.hair
  );
  if (ghost) return;
  strokeC(C.hairShade, 0.8);
  ctx.beginPath();
  ctx.moveTo(-6.0, -20.0);
  ctx.quadraticCurveTo(-7.6, -14.0, -7.4, -9.2);
  ctx.moveTo(-3.6, -20.6);
  ctx.quadraticCurveTo(-5.0, -14.6, -4.6, -9.0);
  ctx.stroke();
};
// A rocks glass of White Russian, ice and all
export const glass = () => {
  bx(-2.3, -3.0, 4.6, 5.2, 0.8, C.glass);
  if (ghost) return;
  fillC(C.drink);
  rr(-2.0, -1.4, 3.9, 3.3, 0.6);
  ctx.fill();
  fillC(C.white, 0.9);
  rr(-1.2, -1.9, 1.5, 1.4, 0.3);
  ctx.fill();
};
// Shades: a black wraparound band whose top dips into a glare (g px), a
// highlight, and the arm back to his ear
const shades = (g) => () => {
  fillC(C.ink);
  path([
    [-0.8, -18.8],
    [8.6, -18.8 + g],
    [8.6, -14.6],
    [5.6, -13.9],
    [1.4, -14.6],
    [-0.8, -15.3],
  ]);
  ctx.fill();
  fillC(C.shades);
  path([
    [-0.3, -18.3],
    [8.1, -18.3 + g],
    [8.1, -15.0],
    [5.6, -14.4],
    [1.5, -15.1],
    [-0.3, -15.7],
  ]);
  ctx.fill();
  if (!ghost) {
    fillC(C.white, 0.85);
    path([
      [3.6, -17.6 + g * 0.45],
      [6.0, -17.6 + g * 0.7],
      [5.6, -16.9 + g * 0.7],
      [3.2, -16.9 + g * 0.45],
    ]);
    ctx.fill();
  }
  strokeC(C.shades, 1.2);
  ctx.beginPath();
  ctx.moveTo(-0.3, -16.9);
  ctx.lineTo(-3.4, -16.4);
  ctx.stroke();
};

// The robe: its hem swings out with his stride (far: his far leg's swing)
// and flares back on the dash's leap (flare)
export function robe(far, flare) {
  const stride = Math.sin(Math.abs(far));
  const hemY = 10.8 - 2.4 * flare;
  const front = 8.0 + 4.5 * stride - 2 * flare;
  const back = -8.6 - 4.5 * stride - 6 * flare;
  poly(
    [
      [-9.2, -9.2],
      [8.2, -9.4],
      [7.8, -2.0],
      [8.8, 1.4], // a bit of a belly
      [7.4, 3.8],
      [front, hemY],
      [back, hemY + 0.4],
      [-8.2, 3.6],
      [-9.0, -4.0],
    ],
    C.robe
  );
  if (ghost) return;
  // Shade down his back
  fillC(C.robeShade);
  path([
    [-9.2, -9.2],
    [-4.0, -9.3],
    [-3.4, 3.6],
    [back * 0.62 - 1, hemY + 0.3],
    [back, hemY + 0.4],
    [-8.2, 3.6],
    [-9.0, -4.0],
  ]);
  ctx.fill();
  // The T-shirt in the V of the shawl collar, and the collar itself
  fillC(C.tee);
  path([
    [4.8, -9.2],
    [8.0, -9.3],
    [7.6, -3.6],
  ]);
  ctx.fill();
  fillC(C.trim);
  path([
    [2.4, -9.6],
    [4.9, -9.6],
    [7.7, -3.2],
    [7.0, 1.6],
    [5.6, 1.6],
    [6.2, -3.0],
  ]);
  ctx.fill();
  // Terry stripes down the robe
  strokeC(C.robeShade, 0.6, 0.45);
  ctx.beginPath();
  for (const x of [-6.0, -1.0, 3.4]) {
    ctx.moveTo(x, -8.2);
    ctx.lineTo(x + (x < 0 ? back + 8.6 : front - 8.0) * 0.5, hemY - 2.4);
  }
  ctx.stroke();
  // The hem: brown trim with the woven band in it
  const hem = (y0, y1) => {
    const k0 = (y0 - 3.8) / (hemY - 3.8);
    const k1 = (y1 - 3.8) / (hemY - 3.8);
    path([
      [-8.2 + (back + 8.2) * k0, y0],
      [7.4 + (front - 7.4) * k0, y0],
      [7.4 + (front - 7.4) * k1, y1],
      [-8.2 + (back + 8.2) * k1, y1],
    ]);
    ctx.fill();
  };
  fillC(C.trim);
  hem(hemY - 2.4, hemY);
  BAND.forEach((col, i) => {
    fillC(col);
    hem(hemY - 2.1 + i * 0.6, hemY - 1.65 + i * 0.6);
  });
  // A teal line along the collar
  strokeC(C.bandTeal, 0.6);
  ctx.beginPath();
  ctx.moveTo(3.4, -9.4);
  ctx.lineTo(6.6, -3.1);
  ctx.lineTo(6.2, 1.6);
  ctx.stroke();
}
// The sash: tied at the front, its ends swinging back by `swing` rad
export function sash(swing) {
  bx(-8.0, 1.8, 16.4, 2.4, 1.0, C.sash);
  for (const [len, off] of [
    [7.2, 0.15],
    [8.2, -0.12],
  ]) {
    ctx.save();
    ctx.translate(6.4, 3.0);
    ctx.rotate(swing + off);
    bx(-0.8, 0, 1.7, len, 0.8, C.sash);
    ctx.restore();
  }
  ov(6.6, 3.0, 2.8, 2.4, C.sash);
}
// The head's frame: scaled about his neck, nodding (px), ducking a hit and
// tilted by `tilt` rad
export function headFrame(nod, hurt, tilt = 0) {
  ctx.translate(NECK[0], NECK[1] + nod - DUCK_PX * hurt);
  if (tilt) ctx.rotate(tilt);
  ctx.scale(HEAD_K, HEAD_K);
  ctx.translate(-NECK[0], -NECK[1]);
}

/**
 * One flipbook picture: everything below his head that moves with his
 * stride, in his body's frame (lean and bob are applied when it is
 * stamped). b: { far, near } his legs' swing (rad, + forward), w 1 walking
 * (0 standing), ph the step phase, dash 0..1 through the dash.
 */
function body(b) {
  const flare = b.dash ? Math.sin(PI * clamp01(b.dash * DASH_PEAK)) : 0;
  const leap = b.dash ? Math.sin(PI * b.dash) : 0;
  const armA = DRINK_ARM_RAD + (b.dash ? DRINK_ARM_DASH_RAD : 0);
  // Off arm, behind him, holding the drink by his belly
  ctx.save();
  ctx.translate(OFF_SHOULDER[0], OFF_SHOULDER[1]);
  ctx.rotate(armA);
  sleeve(C.skinFar);
  ctx.restore();
  for (const [[hx, hy], a, skin] of [
    [HIPS[0], b.far, C.skinFar],
    [HIPS[1], b.near, C.skin],
  ]) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(-a);
    leg(skin);
    ctx.restore();
  }
  robe(b.far, flare);
  sash(0.35 * b.w + 0.12 * Math.sin(TWO_PI * b.ph) * b.w + 0.9 * leap);
  // His hand and the glass, in front of his belly, upright in this picture
  ctx.save();
  ctx.translate(OFF_SHOULDER[0], OFF_SHOULDER[1]);
  ctx.rotate(armA);
  ov(9.6, 0, 5.0, 5.0, C.skinFar);
  ctx.translate(9.6, -0.6);
  ctx.rotate(-armA);
  ctx.translate(0, -2.4);
  glass();
  ctx.restore();
  // The hair down his back, swaying with his stride, in his head's frame
  ctx.save();
  headFrame(0, 0);
  ctx.translate(HAIR_PIVOT[0], HAIR_PIVOT[1]);
  ctx.rotate(0.16 * b.w + 0.05 * Math.sin(TWO_PI * b.ph) * b.w + 0.35 * leap);
  ctx.translate(-HAIR_PIVOT[0], -HAIR_PIVOT[1]);
  hairBack();
  ctx.restore();
  neck();
}
// His neck, under his head
export const neck = () => bx(-1.6, -11.6, 5.6, 4.0, 1.6, C.skin);

// The flipbook's poses: the walk's loop over two eighths, standing, the leap
function walkPose(i) {
  const cyc = (2 * i) / WALK_FRAMES;
  const foot = Math.floor(cyc);
  const ph = cyc - foot;
  const far = STRIDE_RAD * Math.cos(PI * (ph + foot));
  return { far, near: -far, w: 1, ph, dash: 0 };
}
function dashPose(i) {
  const dash = (i + 0.5) / DASH_FRAMES;
  const k = Math.sin(PI * clamp01(dash * DASH_PEAK));
  return {
    far: -0.75 * (0.4 + 0.6 * k),
    near: 0.85 * (0.4 + 0.6 * k),
    w: 0,
    ph: 0,
    dash,
  };
}

// Parts in the prototype's px: [box, draw]. A ghost's draw sets ghost
const asGhost = (draw) => () => {
  ghost = true;
  try {
    draw();
  } finally {
    ghost = false;
  }
};
const HEAD_BOX = [-7.6, -25.7, 11.4, -6.9];
const SHADES_BOX = [-4.8, -20.2, 10, -12.6];
const GUN_ARM_BOX = [-5.2, -5.8, 25.9, 7];
const PARTS_PX = {
  head: [HEAD_BOX, head(C.skin)],
  headAngry: [HEAD_BOX, head(C.angry)],
  headGhost: [HEAD_BOX, asGhost(head(C.skin))],
  shadesGhost: [SHADES_BOX, asGhost(shades(0))],
  gunArm: [GUN_ARM_BOX, gunArm],
  gunArmGhost: [GUN_ARM_BOX, asGhost(gunArm)],
  stand: [FLIPBOOK_BOX, () => body({ far: 0, near: 0, w: 0, ph: 0, dash: 0 })],
};
for (let i = 0; i < GLARE_STEPS; i++) {
  PARTS_PX[`shades${i}`] = [
    SHADES_BOX,
    shades((i / (GLARE_STEPS - 1)) * GLARE_PX),
  ];
}
for (let i = 0; i < WALK_FRAMES; i++) {
  PARTS_PX[`walk${i}`] = [FLIPBOOK_BOX, () => body(walkPose(i))];
}
for (let i = 0; i < DASH_FRAMES; i++) {
  PARTS_PX[`dash${i}`] = [FLIPBOOK_BOX, () => body(dashPose(i))];
  PARTS_PX[`dashGhost${i}`] = [FLIPBOOK_BOX, asGhost(() => body(dashPose(i)))];
}
/**
 * A parts table for spriteParts from parts drawn in the prototype's px:
 * spriteParts scales each box by the drawn scale, and the parts draw under
 * it on the sprite's own context
 */
export const heroSprites = (partsPx) =>
  Object.fromEntries(
    Object.entries(partsPx).map(([name, [box, draw]]) => [
      name,
      [
        box,
        (g, s) => {
          g.scale(s);
          const prev = ctx;
          ctx = g.drawingContext;
          try {
            draw();
          } finally {
            ctx = prev;
          }
        },
      ],
    ])
  );
export const HERO_PARTS = heroSprites(PARTS_PX);

/** Draw at k drawn px per prototype px, on p's canvas, with his sprites */
export function begin(p, k) {
  K = k;
  SP = spriteParts(p, HERO_PARTS, k);
  ctx = p.drawingContext;
}
// A sprite (by name), in the prototype's px; a flash stamps it again, added
// on, so he brightens
export function stamp(name, flash = 0) {
  stampSprite(SP[name], flash);
}
/** A sprite from spriteParts at the current K, as stamp() */
export function stampSprite(sp, flash = 0) {
  ctx.drawImage(sp.g.elt, sp.x / K, sp.y / K, sp.w / K, sp.h / K);
  if (flash <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= flash;
  ctx.drawImage(sp.g.elt, sp.x / K, sp.y / K, sp.w / K, sp.h / K);
  ctx.restore();
}

/** His sprites at his drawn size, built before the first run (setup) */
export function prepareHeroLook(p, player) {
  spriteParts(p, HERO_PARTS, player.drawnSize() / PROTO_SIZE);
}

// ---- his pose ------------------------------------------------------------------
/** His anger, 0..1, from his health share */
export const heroAnger = (hp) => clamp01((1 - hp) / ANGER_FULL);

/** The flipbook picture for this moment (Player#pose) */
export function heroFrame(look) {
  if (look.dash > 0) {
    return `dash${Math.min(DASH_FRAMES - 1, Math.floor(look.dash * DASH_FRAMES))}`;
  }
  if (!look.moving) return 'stand';
  // Backing off from his aim, his stride runs the other way: the same loop,
  // half a cycle on
  const foot = (((look.stepFoot + (look.back ? 1 : 0)) % 2) + 2) % 2;
  const i = Math.floor(((foot + look.stepPhase) / 2) * WALK_FRAMES);
  return `walk${((i % WALK_FRAMES) + WALK_FRAMES) % WALK_FRAMES}`;
}

/** A hit's marks, age seconds after it: hurt 0..1, askew shades, grit teeth */
export function heroHurt(age) {
  return {
    hurt: env(age, HURT_TAU_SEC),
    askew:
      age < ASKEW_HOLD_SEC + ASKEW_SLIDE_SEC
        ? 1 - smooth(clamp01((age - ASKEW_HOLD_SEC) / ASKEW_SLIDE_SEC))
        : 0,
    grit: age < GRIT_SEC,
  };
}
/** How much a hit brightens him, from its hurt (heroHurt) */
export const heroFlash = (hurt) => (hurt > FLASH_FROM ? FLASH_K * hurt : 0);
/** Past boiling he trembles, px, at time t (s) */
export const heroTremble = (anger, t) =>
  anger > TREMBLE_ANGER
    ? (hash01(Math.floor(t * TREMBLE_HZ)) - 0.5) *
      TREMBLE_PX *
      (anger - TREMBLE_ANGER)
    : 0;
/** How red his face is, 0..1 */
export const heroRed = (anger) => RED_K * Math.pow(anger, 1.15);

/** What his drawing needs this frame, from his pose (Player#pose) */
export function heroPose(look) {
  const dash = look.dash;
  const moving = look.moving && !dash;
  const dir = look.back ? -1 : 1;
  let bob = moving ? -WALK_BOB_PX * Math.abs(Math.sin(PI * look.stepPhase)) : 0;
  let lean = moving ? WALK_LEAN_RAD * dir : 0;
  if (dash) {
    const dfwd = Math.cos(look.dashDir) * look.side >= -BACK_COS ? 1 : -1;
    const k = Math.sin(PI * clamp01(dash * DASH_PEAK));
    bob = -DASH_BOB_PX * k;
    lean = DASH_LEAN_RAD * dfwd * k;
  }
  const recoil = env(look.shotAge, RECOIL_TAU_SEC);
  lean -= RECOIL_LEAN_RAD * recoil;
  const anger = heroAnger(look.hp);
  const idle = !moving && !dash && !look.firing;
  return {
    frame: heroFrame(look),
    dash,
    bob,
    lean,
    nod: (idle ? NOD_IDLE_PX : NOD_BUSY_PX) * look.beat,
    recoil,
    anger,
    vein: anger > VEIN_ANGER,
    steam: anger > STEAM_ANGER,
    glow: anger > GLOW_ANGER,
    ...heroHurt(look.hurtAge),
    tremble: heroTremble(anger, look.t),
    yell: look.firing,
  };
}

// ---- live parts ----------------------------------------------------------------
// Mouth: the smirk; a yell with teeth while he fires; a grimace when hit.
// P: { grit, yell, anger, recoil }
export function mouth(P) {
  if (P.grit) {
    fillC(C.mouth);
    rr(3.4, -12.5, 4.2, 2.2, 0.8);
    ctx.fill();
    fillC(C.teeth);
    rr(3.6, -12.2, 3.8, 1.5, 0.5);
    ctx.fill();
  } else if (P.yell) {
    fillC(C.mouth);
    ell(5.6, -11.5, 3.0, 2.4 + 0.7 * P.anger + 0.6 * P.recoil);
    ctx.fill();
    fillC(C.teeth);
    rr(4.3, -12.6, 2.7, 0.8, 0.3);
    ctx.fill();
  } else {
    strokeC(C.mouth, 0.9);
    ctx.beginPath();
    ctx.moveTo(3.9, -11.3);
    ctx.lineTo(6.6, -12.1 + 0.8 * P.anger);
    ctx.stroke();
  }
}
// Shades, knocked crooked by a hit, glinting on a heard kick on beat 1.
// look: { downbeatKick }; P: { askew, anger }
export function shadesOn(look, P) {
  ctx.save();
  ctx.translate(3.6, -16.4);
  ctx.rotate(ASKEW_RAD * P.askew);
  ctx.translate(-3.6 - 0.9 * P.askew, 16.4 + 1.8 * P.askew);
  stamp(
    ghost ? 'shadesGhost' : `shades${Math.round(P.anger * (GLARE_STEPS - 1))}`
  );
  const gl = ghost ? 0 : look.downbeatKick;
  if (gl > 0.05) {
    const g = GLARE_PX * P.anger;
    fillC(C.white, gl);
    const r = 3.4 * gl;
    const y = -17.4 + 0.5 * g;
    path([
      [7.4, y - r],
      [7.9, y],
      [7.4, y + r],
      [6.9, y],
    ]);
    ctx.fill();
    path([
      [7.4 - r, y],
      [7.4, y + 0.5],
      [7.4 + r, y],
      [7.4, y - 0.5],
    ]);
    ctx.fill();
  }
  ctx.restore();
}
// The anger vein at (x, y), throbbing on the kick; `fade` (0..1) shrinks and
// fades it away
export function vein(kick, anger, x, y, fade = 1) {
  const v = (2.2 + 1.8 * anger) * (1 + 0.3 * kick) * fade;
  const gp = 0.36 * v;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const [qx, qy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]) {
    ctx.moveTo(qx * gp, qy * v);
    ctx.lineTo(qx * gp, qy * gp);
    ctx.lineTo(qx * v, qy * gp);
  }
  strokeC(C.ink, 2.8, fade);
  ctx.stroke();
  strokeC(C.vein, 1.4, fade);
  ctx.stroke();
  ctx.restore();
}
// Steam from under his hair at (x, y): a puff on each of the last two kicks
function steam(look, P, x, y) {
  const a = (P.anger - STEAM_ANGER) / (1 - STEAM_ANGER);
  steamPuffs(x, y, [
    { u: look.kickAge / STEAM_SEC, a },
    { u: look.prevKickAge / STEAM_SEC, a },
  ]);
}
/**
 * Puffs of steam rising from (x, y): { u 0..1 through its rise, a its alpha,
 * big its size, times }. up: the screen's up, rad, in the frame drawn in.
 */
export function steamPuffs(x, y, puffs, up = 0) {
  if (up) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(up);
    x = 0;
    y = 0;
  }
  for (const { u, a, big = 1 } of puffs) {
    if (!(u >= 0 && u < 1)) continue;
    fillC(C.steam, 0.82 * (1 - u) * a);
    const r = (2.2 + 5 * u) * big;
    ell(x - 2.2 - 7 * u, y - 1.4 - 9 * u * big, r, r);
    ctx.fill();
    ell(x - 1.0 - 5 * u, y - 3.9 - 11 * u * big, r * 0.7, r * 0.7);
    ctx.fill();
  }
  if (up) ctx.restore();
}
// The muzzle flash, in the gun arm's frame
function muzzle(P) {
  const f = P.recoil;
  const r = 4 + 5 * f;
  fillC(C.flash, 0.9 * f);
  path([
    [23.6, -1 - r * 0.45],
    [23.6 + r * 1.3, -1],
    [23.6, -1 + r * 0.45],
    [23.6 - r * 0.2, -1],
  ]);
  ctx.fill();
  path([
    [24.6, -1 - r],
    [25.4, -1],
    [24.6, -1 + r],
    [23.8, -1],
  ]);
  ctx.fill();
  fillC(C.white, f);
  ell(24.4, -1, 2.6 * f + 1, 2.6 * f + 1);
  ctx.fill();
}

// Him, facing right, in his body's frame
function figure(look, P, flash) {
  ctx.save();
  ctx.translate(P.tremble, P.bob);
  ctx.translate(0, HIP_Y);
  ctx.rotate(P.lean);
  ctx.translate(0, -HIP_Y);
  stamp(
    ghost && P.dash ? P.frame.replace('dash', 'dashGhost') : P.frame,
    flash
  );
  // A hit spills some of his drink
  if (!ghost && look.hurtAge < SPILL_SEC) {
    const u = look.hurtAge / SPILL_SEC;
    ctx.save();
    ctx.translate(
      -3.6 + 9.6 * Math.cos(DRINK_ARM_RAD),
      -6.6 + 9.6 * Math.sin(DRINK_ARM_RAD) - 3
    );
    fillC(C.drink, 1 - u);
    for (let i = 0; i < 3; i++) {
      ell((i - 1) * 7 * u, -3 - 9 * u + 14 * u * u, 1.6, 1.6);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.save();
  headFrame(P.nod, P.hurt);
  stamp(ghost ? 'headGhost' : 'head', flash);
  if (!ghost) {
    const red = heroRed(P.anger);
    if (red > 0.02) {
      ctx.save();
      ctx.globalAlpha *= red;
      stamp('headAngry', flash);
      ctx.restore();
    }
    mouth(P);
  }
  shadesOn(look, P);
  if (!ghost) {
    if (P.vein) vein(look.kick, P.anger, 1.6, -24.2);
    if (P.steam) steam(look, P, -4.6, -17.2);
  }
  ctx.restore();
  // Gun arm in its sleeve, kicked up and back by a shot
  ctx.save();
  ctx.translate(SHOULDER[0], SHOULDER[1]);
  ctx.rotate(look.aimRel - RECOIL_RAD * P.recoil);
  ctx.translate(-RECOIL_PX * P.recoil, 0);
  stamp(ghost ? 'gunArmGhost' : 'gunArm', flash);
  if (!ghost && P.recoil > 0.05) muzzle(P);
  ctx.restore();
  ctx.restore();
}

// ---- round him, in drawn px ------------------------------------------------------
// The cracks his stomps leave, where they landed (world points, made
// relative to him), outside his body's transforms
function cracks(look, P, player) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const f of look.footfalls) {
    if (!(f.age >= 0 && f.age < CRACK_SEC)) continue;
    const u = f.age / CRACK_SEC;
    const a = 1 - u * u;
    const x = f.x - player.x;
    const y = f.y - player.y;
    const big = (1 + CRACK_ANGER_K * P.anger) * K;
    const seed = f.foot * 7.3 + Math.round(f.at * 2) * 1.7;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * TWO_PI + hash01(seed + i) * 0.9;
      const L = (6 + 6 * hash01(seed + i * 3.1)) * big;
      const kink = ang + 0.5 * (hash01(seed + i * 5.7) - 0.5);
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(kink) * L * 0.55,
        y + Math.sin(kink) * L * 0.55 * 0.35
      );
      ctx.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L * 0.35);
    }
    strokeC(C.ink, 2.6, 0.6 * a);
    ctx.stroke();
    strokeC(C.crack, 1.1, a);
    ctx.stroke();
  }
}
// His shadow on nothing
function shadow(look) {
  const k = look.dash > 0 ? Math.sin(PI * look.dash) : 0;
  shadowAt(0, FEET_Y * K, 21 * K * (1 - 0.3 * k), 0.42 * (1 - 0.6 * k));
}
/** His shadow at (x, y), w wide (drawn px), alpha a */
export function shadowAt(x, y, w, a) {
  fillC(C.ink, a);
  ell(x, y, w, 4.6 * K);
  ctx.fill();
}
function bubbleR(look) {
  let R = BUBBLE_R * K * (1 + BUBBLE_SWELL * look.kick);
  if (look.shieldBackAge < POP_SEC) {
    R *= 0.55 + 0.45 * easeOutBack(clamp01(look.shieldBackAge / POP_SEC));
  }
  return R;
}
// The bubble's film, behind him
function bubbleBack(look) {
  if (!look.shield) return;
  fillC(C.shield, 0.12);
  const R = bubbleR(look);
  ell(0, -2 * K, 2 * R, 2 * R);
  ctx.fill();
}
// Its rim and highlight, in front of him; or its shards, broken
function bubbleFront(look) {
  const cy = -2 * K;
  if (look.shield) {
    const R = bubbleR(look);
    const pop =
      look.shieldBackAge < RIM_SEC ? 1 - look.shieldBackAge / RIM_SEC : 0;
    ell(0, cy, 2 * R, 2 * R);
    strokeC(C.ink, 3.4, 0.66);
    ctx.stroke();
    strokeC(mix(C.shield, C.shieldHi, pop), 1.8 + 1.6 * pop, 0.92);
    ctx.stroke();
    ell(0, cy, 2 * R - 6, 2 * R - 6);
    strokeC(C.shield, 4, 0.22);
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, cy, R - 3.5, PI * 1.08, PI * 1.36);
    strokeC(C.shieldHi, 1.7, 0.86);
    ctx.stroke();
    fillC(C.shieldHi, 0.9);
    ell(
      Math.cos(PI * 1.45) * (R - 3.5),
      cy + Math.sin(PI * 1.45) * (R - 3.5),
      2.2,
      2.2
    );
    ctx.fill();
    return;
  }
  const age = look.shatterAge;
  if (!(age < SHATTER_SEC)) return;
  const R = BUBBLE_R * K;
  const a = 1 - age / SHATTER_SEC;
  const fl = Math.max(0, 1 - age / 0.18);
  if (fl > 0) {
    ell(0, cy, 2 * R * (1 + 0.9 * age), 2 * R * (1 + 0.9 * age));
    strokeC(C.shieldHi, 3, fl);
    ctx.stroke();
  }
  for (let i = 0; i < SHARDS; i++) {
    const ang = (i / SHARDS) * TWO_PI + hash01(i * 2.1) * 0.4;
    const r = R + (70 + 40 * hash01(i * 4.3)) * age * K;
    const z = (3 + 2 * hash01(i * 7.7)) * K;
    ctx.save();
    ctx.translate(Math.cos(ang) * r, cy + Math.sin(ang) * r);
    ctx.rotate(ang + age * (8 + 6 * hash01(i)));
    path([
      [-z, -z * 0.6],
      [z, 0],
      [-z, z * 0.6],
    ]);
    fillC(C.ink, 0.8 * a);
    strokeC(C.ink, 2, 0.8 * a);
    ctx.fill();
    ctx.stroke();
    fillC(C.shield, a);
    ctx.fill();
    ctx.restore();
  }
}
function healthBar(look) {
  const y = -25.5 * K - 4;
  bx(-HP_W / 2, y, HP_W, HP_H, 1.4, C.hpBack);
  fillC(look.hp > 0.5 ? C.hpHigh : look.hp > 0.25 ? C.hpMid : C.hpLow);
  rr(-HP_W / 2, y, HP_W * look.hp, HP_H, 1.4);
  ctx.fill();
}
// The dash's afterimages, trailing him along it
function ghosts(look, P) {
  const fade = 1 - 0.5 * P.dash;
  GHOSTS.forEach((alpha, i) => {
    const d = (i + 1) * GHOST_GAP * K;
    ctx.save();
    ctx.translate(-Math.cos(look.dashDir) * d, -Math.sin(look.dashDir) * d);
    ctx.scale(K * look.side, K);
    ctx.globalAlpha *= alpha * fade;
    ghost = true;
    try {
      figure(look, P, 0);
    } finally {
      ghost = false;
    }
    ctx.restore();
  });
}

/** The hero, at his position, from his pose (Player#pose) */
export function drawPlayer(p, player) {
  const look = player.pose();
  begin(p, player.drawnSize() / PROTO_SIZE);
  const P = heroPose(look);
  ctx.save();
  ctx.translate(player.x, player.y);
  cracks(look, P, player);
  // A hit flinches the whole of him straight back from the way he faces
  if (P.hurt > 0.02) ctx.translate(-look.side * FLINCH_PX * P.hurt, 0);
  shadow(look);
  // Past boiling he glows with it, throbbing on the kick
  if (P.glow) {
    drawGlow(
      p,
      0,
      -3 * K,
      PROTO_SIZE * 2.1 * K,
      C.angry,
      (P.anger - GLOW_ANGER) * 2.5 * (0.3 + 0.4 * look.kick)
    );
  }
  bubbleBack(look);
  if (P.dash > 0) ghosts(look, P);
  ctx.save();
  ctx.scale(K * look.side, K);
  figure(look, P, heroFlash(P.hurt));
  ctx.restore();
  bubbleFront(look);
  healthBar(look);
  ctx.restore();
}
