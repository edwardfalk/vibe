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
import { normalizeAngle } from '../mathUtils.js';
import { GRUNT_COLORS, AMBER, HOT } from './GruntRenderer.js';

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
