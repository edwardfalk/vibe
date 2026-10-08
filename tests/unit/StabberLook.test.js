import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  drawStabber,
  drawLane,
  STABBER_REACH_PX,
  RING_R_PX,
} from '../../js/entities/StabberRenderer.js';
import { transformP5 } from './helpers/transformP5.js';

afterEach(() => vi.restoreAllMocks());

// His look between phrases, mid-bar, as Stabber#pose() hands it over
const BASE = {
  t: 8.6,
  beatSec: 0.5,
  beats: 17.2,
  eighth: 0.4,
  kick: 0.3,
  aim: 0.4,
  toHero: 0.5,
  vx: 40,
  vy: -20,
  age: 1,
  windup: null,
  lunge: null,
  recover: null,
  stunned: null,
  hit: 0,
  hitAge: Infinity,
  hitDir: 0,
  push: 0,
  seed: 0.3,
  reach: STABBER_REACH_PX,
};
const windup = (locked) => ({
  k: locked ? 0.8 : 0.4,
  locked,
  lockAge: locked ? 0.1 : -1,
  left: locked ? 1 : 2,
  len: 300,
});
// One look of each state, a hit and a push included
const LOOKS = {
  stalk: BASE,
  shot: { ...BASE, hit: 0.7, hitAge: 0.03, hitDir: 1, push: 0.6 },
  winding: { ...BASE, windup: windup(false) },
  locked: { ...BASE, windup: windup(true) },
  lunge: {
    ...BASE,
    lunge: { k: 0.3 },
  },
  struck: {
    ...BASE,
    recover: { age: 0.2, k: 0.2, struck: 'hero' },
  },
  missed: {
    ...BASE,
    recover: { age: 0.2, k: 0.2, struck: null },
  },
  dazed: { ...BASE, stunned: { age: 0.4 } },
};

describe("the shiv's look", () => {
  it.each(Object.keys(LOOKS))(
    'draws %s without the game random numbers, and leaves the context as it found it',
    (name) => {
      const { p } = transformP5();
      const spy = vi.spyOn(Math, 'random');
      drawStabber(p, 1, LOOKS[name]);
      expect(spy).not.toHaveBeenCalled();
      expect(p.drawingContext.depth).toBe(0);
      expect(p.drawingContext.globalAlpha).toBe(1);
      expect(p.drawingContext.alphasDrawn.length).toBeGreaterThan(0);
    }
  );

  it('multiplies the alpha it is drawn with: nothing comes out more solid', () => {
    for (const look of Object.values(LOOKS)) {
      const { p } = transformP5();
      p.drawingContext.globalAlpha = 0.5;
      drawStabber(p, 1, look);
      for (const a of p.drawingContext.alphasDrawn) {
        expect(a).toBeLessThanOrEqual(0.5 + 1e-9);
      }
      expect(p.drawingContext.globalAlpha).toBe(0.5);
    }
  });

  it('builds his six sprites once a scale; a new scale rebuilds them and drops the old', () => {
    const { p, graphics } = transformP5();
    drawStabber(p, 1, LOOKS.shot);
    drawStabber(p, 1, LOOKS.locked);
    expect(graphics).toHaveLength(6);
    expect(graphics.some((g) => g.removed)).toBe(false);
    drawStabber(p, 1.4, LOOKS.dazed);
    expect(graphics).toHaveLength(12);
    expect(graphics.slice(0, 6).every((g) => g.removed)).toBe(true);
  });
});

// A canvas context that logs the lane's strokes: each stroke's style, width,
// dash and the x its line ends at, and the fills; any other call does nothing
function laneLog() {
  const strokes = [];
  const fills = [];
  const moves = [];
  let dash = [];
  let lastX = null;
  const state = { globalAlpha: 1 };
  const saved = [];
  const ctx = new Proxy(state, {
    get: (t, k) => {
      if (k === 'setLineDash') return (d) => (dash = d);
      if (k === 'moveTo') return (x) => moves.push(x);
      if (k === 'lineTo') return (x) => (lastX = x);
      if (k === 'stroke')
        return () =>
          strokes.push({
            style: t.strokeStyle,
            width: t.lineWidth,
            dash,
            x: lastX,
          });
      if (k === 'fill') return () => fills.push(t.fillStyle);
      if (k === 'save') return () => saved.push({ ...t });
      if (k === 'restore') return () => Object.assign(t, saved.pop());
      if (k in t) return t[k];
      return () => {};
    },
  });
  return { p: { drawingContext: ctx }, strokes, fills, moves };
}

describe('his lane', () => {
  it('draws nothing unless he is winding up', () => {
    const log = laneLog();
    drawLane(log.p, 0, 0, LOOKS.stalk, 1);
    expect(log.strokes).toHaveLength(0);
  });

  it('is dashed and faint while it follows the hero, out to the lunge plus his reach', () => {
    const log = laneLog();
    drawLane(log.p, 0, 0, LOOKS.winding, 1);
    expect(log.strokes).toHaveLength(2);
    for (const s of log.strokes) {
      expect(s.dash.length).toBeGreaterThan(0);
      expect(s.x).toBe(300 + STABBER_REACH_PX);
    }
    expect(log.fills).toHaveLength(0); // no arrowhead yet
  });

  it('is solid from the lock, amber for a sixteenth, then white-hot, with an arrowhead', () => {
    const at = (lockAge) => {
      const log = laneLog();
      const look = {
        ...LOOKS.locked,
        windup: { ...windup(true), lockAge },
      };
      drawLane(log.p, 0, 0, look, 1);
      return log;
    };
    const early = at(0.05);
    const late = at(0.2);
    for (const log of [early, late]) {
      expect(log.strokes.every((s) => s.dash.length === 0)).toBe(true);
      expect(log.fills).toHaveLength(1);
    }
    expect(early.strokes[1].style).not.toBe(late.strokes[1].style);
    expect(early.strokes[1].width).toBeGreaterThan(late.strokes[1].width); // the pop
  });

  it('starts just outside his ring, scaled with him', () => {
    const begins = (scale) => {
      const log = laneLog();
      drawLane(log.p, 0, 0, LOOKS.winding, scale);
      return log.moves[0];
    };
    expect(begins(1)).toBeGreaterThan(RING_R_PX);
    expect(begins(1.5)).toBeGreaterThan(RING_R_PX * 1.5);
    expect(begins(1.5) - begins(1)).toBeCloseTo(RING_R_PX * 0.5, 9);
  });
});
