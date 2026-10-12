// The bassist's note (Bassist.js fires and drives it, bullet.js draws it),
// as on the studies page: a glowing note head and flag (♪), drawn as shapes,
// upright whichever way it flies. It leans and stretches on a push; shot,
// it stops, swells and shivers until it bursts on the next let; its bassist
// gone, it pops. The burst and the pop are effects of their own (NoteFlash)

import { CONFIG } from '../config.js';
import { smooth, easeOut } from '../mathUtils.js';
import { NOTE_COLORS, rgb } from './BassistRenderer.js';

const PI = Math.PI;
const EPS = 1e-6; // slack on beat positions, for floating-point error
const NOTE_INK = 'rgb(38,26,48)'; // the cast's ink
const NOTE_PX = 16; // its drawn size at NOTE_SIZE 16
const HANG_SWELL = 0.55; // a shot note swells by this as it hangs
const FLASH_SEC = { burst: 0.35, pop: 0.2 };

/** The owner a note's Bullet carries */
export const NOTE_OWNER = 'enemy-bassist';

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

// A soft glow of radius r round (x, y), added
function glow(ctx, x, y, r, c, a) {
  if (a < 0.02) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgb(c, Math.min(1, a)));
  g.addColorStop(0.45, rgb(c, Math.min(1, a) * 0.35));
  g.addColorStop(1, rgb(c, 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
}

// Head, an oval tilted up to the right; stem up from its right; flag. `g`
// grows it, for its ink
function traceNote(ctx, g) {
  ctx.beginPath();
  ctx.ellipse(-2.2, 4, 5.2 + g, 3.7 + g, -0.45, 0, 2 * PI);
  ctx.moveTo(1.6 - g, 3.2);
  ctx.lineTo(1.6 - g, -9.5 - g);
  ctx.lineTo(4.8 + g, -9.5 - g);
  ctx.bezierCurveTo(5.5 + g, -6 - g, 10.5 + g, -5, 8.5 + g, 1.2 + g);
  ctx.bezierCurveTo(8.2, -2.4 + g, 6.8, -4.2 + g, 4.8 + g, -4.4 + g);
  ctx.lineTo(4.8 + g, 3.2);
  ctx.closePath();
}

/**
 * A note (a Bullet with NOTE_OWNER) where it is: `push` (0..1, how hard a
 * let pushes it now) leans and stretches it and lengthens its trail;
 * hanging, `swell` (0..1, its wait for the let) swells and shivers it
 */
export function drawBassNote(p, note) {
  const ctx = p.drawingContext;
  const C = NOTE_COLORS;
  const hang = note.hung ? note.swell : -1;
  const pushK = note.hung ? 0 : note.push;
  let s = note.size / NOTE_PX;
  let jx = 0;
  let jy = 0;
  let lean = 0.18 * pushK * Math.sign(Math.cos(note.angle) || 1);
  if (hang >= 0) {
    s *= 1 + HANG_SWELL * smooth(hang);
    jx = 1.2 * hang * Math.sin(p.frameCount * 1.5);
    jy = 1.2 * hang * Math.cos(p.frameCount * 1.3);
    lean = 0;
  } else {
    // A short trail along its path, longer on a push
    const c = Math.cos(note.angle);
    const sn = Math.sin(note.angle);
    for (let i = 1; i <= 3; i++) {
      const d = i * (5 + 9 * pushK);
      ctx.fillStyle = rgb(C.glow, (0.35 - i * 0.08) * (0.5 + pushK));
      ctx.beginPath();
      ctx.arc(note.x - c * d, note.y - sn * d, 3.2 - i * 0.6, 0, 2 * PI);
      ctx.fill();
    }
  }
  glow(
    ctx,
    note.x,
    note.y + 1,
    15 * s + 6 * pushK,
    C.glow,
    0.45 + 0.4 * pushK + (hang >= 0 ? 0.4 * hang : 0)
  );
  ctx.save();
  ctx.translate(note.x + jx, note.y + jy);
  ctx.rotate(lean);
  ctx.scale(s * (1 + 0.12 * pushK), s * (1 - 0.06 * pushK));
  ctx.fillStyle = NOTE_INK;
  traceNote(ctx, 1.1);
  ctx.fill();
  ctx.fillStyle = hang >= 0 ? rgb([255, 255, 255]) : rgb(C.head);
  traceNote(ctx, 0);
  ctx.fill();
  // A glint on the head
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(-4, 2.6, 1.6, 0.9, -0.45, 0, 2 * PI);
  ctx.fill();
  ctx.restore();
}

/**
 * A note's end where it was: a shot note's burst on its let (a ring and
 * sparks), or a small silent pop when its bassist is gone. An effect in the
 * explosion manager's list, on the beat clock's time (`now`, s)
 */
export class NoteFlash {
  constructor({ x, y, kind, seed, startsAt, now }) {
    Object.assign(this, { x, y, kind, seed, startsAt, now });
    this.active = true;
  }

  update() {}

  draw(p) {
    if (!this.active) return;
    const sec = FLASH_SEC[this.kind];
    const age = this.now() - this.startsAt;
    if (age >= sec) {
      this.active = false;
      return;
    }
    if (age < 0) return;
    const k = age / sec;
    const ctx = p.drawingContext;
    const C = NOTE_COLORS;
    ctx.save();
    if (this.kind === 'burst') {
      glow(ctx, this.x, this.y, 18 + 22 * k, C.glow, 0.9 * (1 - k));
      ctx.translate(this.x, this.y);
      ctx.strokeStyle = rgb(C.head, 1 - k);
      ctx.lineWidth = 2.5 * (1 - k) + 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, 8 + 22 * easeOut(k), 0, 2 * PI);
      ctx.stroke();
      ctx.fillStyle = rgb(C.head, 1 - k);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 2 * PI + this.seed * 2 * PI;
        const r = 6 + 26 * easeOut(k);
        ctx.fillRect(Math.cos(a) * r - 1.2, Math.sin(a) * r - 1.2, 2.4, 2.4);
      }
    } else {
      ctx.strokeStyle = rgb(C.glow, 0.6 * (1 - k));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 4 + 10 * k, 0, 2 * PI);
      ctx.stroke();
      ctx.translate(this.x, this.y);
      ctx.globalAlpha *= 1 - k;
      ctx.scale(1 - k, 1 - k);
      ctx.fillStyle = rgb(C.head);
      traceNote(ctx, 0);
      ctx.fill();
    }
    ctx.restore();
  }
}
