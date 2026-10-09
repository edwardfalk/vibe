/**
 * The tank's "uh oh": the beat before the hero's bomb blows on his back, he
 * realises. Ported from `uhOh` in
 * docs/superpowers/specs/2026-10-08-explosion-studies/deaths-tank.js (the
 * `pieces` variant's, without the shades popping off; git-ignored; the page
 * is https://claude.ai/artifact/GHjWCySGwv8cVCtWDoE6nV); the spec is
 * docs/superpowers/specs/2026-10-09-bomb-kill-design.md. From the port on,
 * these constants are the authority.
 *
 * As his line starts he looks round over his shoulder at the bomb on his
 * back, his eyes popping up over his shades; on the eighth before the bang,
 * the take: all of him jumps bigger and holds, braced; his hands fly off the
 * cannon, up and out, open; the cannon sags; his head snaps front, eyes
 * wide; a big drop of sweat pops out on his head. It is the living tank's
 * drawing with a reaction (drawTank), so it follows a lurch, a turn or a
 * charge.
 */
import { clamp01, smooth, env } from '../mathUtils.js';
import { TANK_COLORS as C, HEAD, HEAD_D } from './TankRenderer.js';

const TWO_PI = 2 * Math.PI;
const HEAD_X = HEAD[0]; // his head on the slab
const INK_PX = 1.1; // the ink edge outside a live shape
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const INK = css(C.ink);
const WHITE = css(C.white);

export const UH = {
  LOOK: -2.0, // rad: his head turns this far, over his left shoulder, toward his back
  TURN_SEC: 0.07,
  BACK_SEC: 0.05,
  TURN_DELAY_SEC: 0.02,
  EYE: 0.16, // of s: an eye, popped
  EYE_POP_DELAY_SEC: 0.03,
  EYE_POP_SEC: 0.06,
  EYE_OVERSHOOT: 0.35,
  EYE_OVERSHOOT_TAU: 0.05,
  WIDE: 1.3, // after the take, wider still
  WIDE_SEC: 0.04,
  WIDE_WOBBLE: [0.25, 0.07, 55], // its wobble: size, decay s, rad/s
  GAZE: 0.32, // the pupils toward the bomb, then at us
  POP: 0.1, // the take: all of him jumps this much bigger
  HOLD: 0.05, // and settles to this, braced, until the bang
  JUMP_SEC: 0.04,
  JUMP_TAU: 0.07,
  HANDS_SEC: 0.07, // his hands fly off the cannon
  DROP_DELAY_SEC: 0.04,
  DROP_SEC: 0.2,
  SHIVER: 1.2,
  SWEAT: 2.4, // the big drop: this times the little ones
  SWEAT_POP_SEC: 0.05,
  SWEAT_SLIDE_PX: 4,
  SWEAT_SLIDE_SEC: 0.2,
};

// A drop of sweat at the origin, its tip toward -x: a ball and a point,
// ink-edged, with a highlight
const SWEAT = 'rgb(150,214,240)';
function sweatDrop(ctx, s) {
  const r = s * 0.05;
  const tip = (grow) => {
    ctx.beginPath();
    ctx.ellipse(0, 0, r + grow, r + grow, 0, 0, TWO_PI);
    ctx.moveTo(-s * 0.12 - grow * 1.5, 0);
    ctx.lineTo(-s * 0.01, -s * 0.048 - grow);
    ctx.lineTo(-s * 0.01, s * 0.048 + grow);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = INK;
  tip(INK_PX);
  ctx.fillStyle = SWEAT;
  tip(0);
  ctx.fillStyle = 'rgb(240,252,255)';
  ctx.beginPath();
  ctx.ellipse(s * 0.012, -s * 0.014, s * 0.018, s * 0.015, 0, 0, TWO_PI);
  ctx.fill();
}

/**
 * His flinch at `age` seconds before the bang (negative), over a window of
 * `dur` seconds that ends at the bang, `beatSec` a beat: the reaction for
 * drawTank, and the sweat drop to draw after him (in his centre's frame,
 * unturned). Null outside the window.
 */
export function tankFlinch(age, dur, beatSec, s, facing) {
  if (age < -dur || age >= 0) return null;
  const t = age + dur; // 0 as it starts
  const take = dur - beatSec / 2; // the eighth before the bang
  const after = t - take;
  const r = (s * HEAD_D) / 2;
  const look =
    UH.LOOK *
    (smooth(clamp01((t - UH.TURN_DELAY_SEC) / UH.TURN_SEC)) -
      smooth(clamp01(after / UH.BACK_SEC)));
  const pop =
    smooth(clamp01((t - UH.EYE_POP_DELAY_SEC) / UH.EYE_POP_SEC)) *
    (1 +
      UH.EYE_OVERSHOOT *
        env(t - UH.EYE_POP_DELAY_SEC - UH.EYE_POP_SEC, UH.EYE_OVERSHOOT_TAU));
  const [wob, wobTau, wobRate] = UH.WIDE_WOBBLE;
  const wide =
    1 +
    (UH.WIDE - 1) * smooth(clamp01(after / UH.WIDE_SEC)) +
    wob * env(after, wobTau) * Math.cos(after * wobRate);
  const eye = s * UH.EYE * pop * (after > 0 ? wide : 1);
  const gaze = after > 0 ? 0 : UH.GAZE; // the pupils: at the bomb, then at us
  const jump =
    after > 0
      ? smooth(clamp01(after / UH.JUMP_SEC)) *
        (UH.HOLD + (UH.POP - UH.HOLD) * env(after - UH.JUMP_SEC, UH.JUMP_TAU))
      : 0;
  const k = 1 + jump;
  const react = {
    k,
    turn: look,
    hands: after > 0 ? smooth(clamp01(after / UH.HANDS_SEC)) : 0,
    drop:
      after > 0
        ? smooth(clamp01((after - UH.DROP_DELAY_SEC) / UH.DROP_SEC))
        : 0,
    shiver: after > 0 ? UH.SHIVER : 0,
    onHead(p, ctx) {
      if (eye < 0.5) return;
      for (const y of [-1, 1]) {
        const ex = r * 0.34;
        const ey = r * 0.44 * y;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(ex, ey, eye / 2 + INK_PX, eye / 2 + INK_PX, 0, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = WHITE;
        ctx.beginPath();
        ctx.ellipse(ex, ey, eye / 2, eye / 2, 0, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(ex + eye * gaze, ey, eye * 0.2, eye * 0.2, 0, 0, TWO_PI);
        ctx.fill();
      }
    },
  };
  // The big drop of sweat pops out on his head, up and to the right on
  // screen, and slides a little
  const sweat = (p) => {
    if (after <= 0) return;
    const hx = Math.cos(facing) * s * HEAD_X * k;
    const hy = Math.sin(facing) * s * HEAD_X * k;
    const grow =
      smooth(clamp01(after / UH.SWEAT_POP_SEC)) *
      (1 + 0.2 * env(after - UH.SWEAT_POP_SEC, UH.SWEAT_POP_SEC));
    p.push();
    p.translate(
      hx + r,
      hy -
        r * 0.75 +
        UH.SWEAT_SLIDE_PX *
          smooth(clamp01((after - UH.SWEAT_POP_SEC) / UH.SWEAT_SLIDE_SEC))
    );
    p.rotate(-Math.PI / 2 + 0.35);
    p.scale(grow);
    sweatDrop(p.drawingContext, s * UH.SWEAT);
    p.pop();
  };
  return { react, sweat };
}
