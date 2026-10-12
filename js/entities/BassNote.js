// The bassist's note (Bassist.js fires it, bullet.js draws it): a glowing
// note head and flag, drawn upright whichever way it flies

import { CONFIG } from '../config.js';

const EPS = 1e-6; // slack on beat positions, for floating-point error
/** A shot note swells by up to this share of its size as it hangs */
export const SWELL = 0.6;

/** The owner a note's Bullet carries */
export const NOTE_OWNER = 'enemy-bassist';
/** Its glow and its trail */
export const NOTE_GLOW_RGB = [192, 138, 90];
const NOTE_RGB = [241, 227, 198];
const HEAD_TILT = -0.35; // radians: a note head leans
const HEAD_W = 0.62; // of its size
const HEAD_H = 0.44;
const STEM_H = 1.1;
const STEM_W = 0.1;
const FLAG = 0.45;

/** One note of size `s` at the origin, in the canvas's own frame */
export function drawBassNote(p, s) {
  p.noStroke();
  p.fill(...NOTE_RGB);
  p.push();
  p.rotate(HEAD_TILT);
  p.ellipse(0, 0, s * HEAD_W, s * HEAD_H);
  p.pop();
  const x = s * HEAD_W * 0.42;
  p.stroke(...NOTE_RGB);
  p.strokeWeight(Math.max(1, s * STEM_W));
  p.line(x, -s * 0.05, x, -s * STEM_H * 0.6);
  p.noFill();
  p.bezier(
    x,
    -s * STEM_H * 0.6,
    x + s * FLAG * 0.2,
    -s * STEM_H * 0.35,
    x + s * FLAG,
    -s * STEM_H * 0.3,
    x + s * FLAG * 0.6,
    -s * STEM_H * 0.05
  );
}

/**
 * A note the hero shot: it stops and hangs, spent, until the first let after
 * beat position `beats` (null with no clock), when driveBassNotes bursts it
 */
export function hangNote(note, beats) {
  note.velocity.x = 0;
  note.velocity.y = 0;
  note.hung = {
    at: beats,
    let:
      beats === null ? null : Math.floor(beats - CONFIG.SWING.AND_AT + EPS) + 1,
  };
}
