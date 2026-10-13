import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import {
  drawBassist,
  traceScroll,
  newScrollCoil,
  SCROLL_N,
  BASSIST_SHAPE,
} from '../../js/entities/BassistRenderer.js';
import { NoteFlash, NOTE_OWNER, hangNote } from '../../js/entities/BassNote.js';
import { Bullet } from '../../js/entities/bullet.js';
import { bassistWorld } from './helpers/bassistWorld.js';
import { transformP5 } from './helpers/transformP5.js';

// His look, Abyssal, ported from the studies page: it draws from his pose
// alone and leaves the canvas as it found it
const letMs = (n) => (n + CONFIG.SWING.AND_AT) * 500;
const LOOK = { ...CONFIG.BASSIST_LOOK };
afterEach(() => {
  Object.assign(CONFIG.BASSIST_LOOK, LOOK);
  vi.restoreAllMocks();
});

// Every state at once he can be drawn in
function poses() {
  const w = bassistWorld({ ms0: 1990 });
  w.run(2000, letMs(4) + 20);
  const plucked = w.b.pose();
  w.run(letMs(4) + 36, letMs(7) - 80);
  w.b.takeDamage(4, 0); // two strings gone, and a hit's jolt
  const hotHurt = w.b.pose();
  return [
    plucked,
    hotHurt,
    { ...hotHurt, tell: null, dying: { age: 0.1 } },
    { ...hotHurt, tell: null, slack: { age: 0.3, k: 0.4 } },
  ];
}

// The canvas as the draw left it: nothing open, nothing moved, plain
function expectRestored(p) {
  const ctx = p.drawingContext;
  expect(ctx.depth).toBe(0);
  expect(ctx.moved).toBe(0);
  expect(ctx.globalAlpha).toBe(1);
  expect(ctx.globalCompositeOperation).toBe('source-over');
}

describe('his look', () => {
  it('draws whole, plucking, hurt and white-hot, dying and slack, without the game’s random numbers, and restores the canvas', () => {
    for (const L of poses()) {
      const { p } = transformP5();
      const spy = vi.spyOn(Math, 'random');
      drawBassist(p, 1, L);
      expect(spy).not.toHaveBeenCalled();
      expect(p.drawingContext.alphasDrawn.length).toBeGreaterThan(0);
      expectRestored(p);
      spy.mockRestore();
    }
  });

  it('draws at both ends of the size slider', () => {
    const [L] = poses();
    for (const scale of [0.5, 2]) {
      CONFIG.BASSIST_LOOK.ART_SCALE = scale;
      const { p } = transformP5();
      expect(() => drawBassist(p, scale, L)).not.toThrow();
      expectRestored(p);
    }
  });

  it('his health bar clears him, at any size', () => {
    const { b } = bassistWorld();
    const rise = b.healthBarRise;
    CONFIG.BASSIST_LOOK.ART_SCALE = 2;
    expect(b.healthBarRise).toBeGreaterThan(rise * 1.5);
  });
});

describe('his note', () => {
  it('draws itself, pushed, gliding or hanging, and restores the canvas', () => {
    const note = Bullet.acquire(100, 100, 0.4, 0, NOTE_OWNER);
    for (const set of [
      () => (note.push = 1),
      () => (note.push = 0),
      () => {
        hangNote(note, 4.2);
        note.swell = 0.6;
      },
    ]) {
      set();
      const { p } = transformP5();
      note.draw(p);
      expect(p.drawingContext.alphasDrawn.length).toBeGreaterThan(0);
      expectRestored(p);
    }
    Bullet.release(note);
  });

  it('its burst and its pop draw for their time, then are gone', () => {
    for (const kind of ['burst', 'pop']) {
      let now = 0;
      const f = new NoteFlash({
        x: 5,
        y: 5,
        kind,
        seed: 0.2,
        startsAt: 0,
        now: () => now,
      });
      const { p } = transformP5();
      now = 0.1;
      f.draw(p);
      expect(f.active).toBe(true);
      expectRestored(p);
      now = 1;
      f.draw(p);
      expect(f.active).toBe(false);
    }
  });
});

// His scroll's coil, traced by one function that his look and his death
// both call, each into its own arrays
describe('his scroll’s coil', () => {
  const coil = () => newScrollCoil();

  it('starts at its root along +x, and tapers to its tip', () => {
    const c = traceScroll(0.7, 27, coil());
    const { len, w0 } = BASSIST_SHAPE.scroll;
    expect([c.x[0], c.y[0], c.a[0]]).toEqual([27, 0, 0]);
    expect(c.w[0]).toBeCloseTo(w0, 6);
    expect(c.w[SCROLL_N]).toBeLessThan(c.w[0] / 3);
    const straight = traceScroll(0, 5, coil());
    expect(straight.x[SCROLL_N]).toBeCloseTo(5 + len, 6);
    expect(straight.y[SCROLL_N]).toBeCloseTo(0, 6);
  });

  it('curls his way (toward -y), more for a larger coil', () => {
    const loose = traceScroll(0.3, 0, coil());
    const tight = traceScroll(1, 0, coil());
    expect(loose.y[SCROLL_N]).toBeLessThan(0);
    expect(tight.a[SCROLL_N]).toBeLessThan(loose.a[SCROLL_N]);
  });

  it('writes only into the arrays it is given', () => {
    const mine = traceScroll(1, 27, coil());
    const tip = mine.x[SCROLL_N];
    traceScroll(0.2, 0, coil());
    expect(mine.x[SCROLL_N]).toBe(tip);
  });

  it('is what his look draws: drawing him leaves another coil as it was', () => {
    const mine = traceScroll(0.5, 0, coil());
    const before = Array.from(mine.x);
    const { p } = transformP5();
    drawBassist(p, 1, poses()[0]);
    expect(Array.from(mine.x)).toEqual(before);
  });
});
