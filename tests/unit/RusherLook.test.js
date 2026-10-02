import { describe, it, expect, vi, afterEach } from 'vitest';
import { Rusher } from '../../js/entities/Rusher.js';
import {
  ringArcs,
  rusherTilt,
  drawRusher,
  drawCountRing,
  drawRusherBlast,
  PROTO_SIZE,
} from '../../js/entities/RusherRenderer.js';
import { nextFacing } from '../../js/entities/GruntRenderer.js';
import { CONFIG } from '../../js/config.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { beatWorld } from './helpers/beatWorld.js';
import { transformP5 } from './helpers/transformP5.js';

const MS_PER_BEAT = 500;
const FRAME_MS = 16;
const DEFAULTS = { ...CONFIG.RUSHER };
const LOOK_DEFAULTS = { ...CONFIG.RUSHER_LOOK };
// A pose in flight, and two fuses: mid-count after a blast, and white-hot
const LOOK = {
  t: 3,
  side: 1,
  tilt: 0.3,
  boost: 0.6,
  speed: 300,
  speed01: 0.7,
  cry: 0.5,
  charging: true,
  whoa: 0.4,
  toHero: 2,
  hit: 0.5,
  push: 0.5,
  pushDir: 1,
  seed: 0.3,
};
const FUSES = [
  null,
  { age: 0.2, beatsTotal: 3, beatsLeft: 2, hot: false, tick: 0.5, by: 'blast' },
  { age: 1, beatsTotal: 3, beatsLeft: 1, hot: true, tick: 0.9, by: 'hit' },
];

// A spawned rusher at (0, 0), the hero far off, updated every frame up to a
// beat position by to(beats)
function fused(startBeats) {
  const w = beatWorld();
  const r = new Rusher(
    0,
    0,
    'rusher',
    { context: w.context },
    createMockP5(),
    w.audio
  );
  r.isSpawning = false;
  let ms = startBeats * MS_PER_BEAT;
  const to = (beats) => {
    for (; ms <= beats * MS_PER_BEAT; ms += FRAME_MS) {
      w.at(ms);
      r.updateSpecificBehavior(1000, 0, FRAME_MS);
    }
    return r.pose().fuse;
  };
  const jump = (beats) => {
    ms = beats * MS_PER_BEAT;
    return to(beats);
  };
  return { r, to, jump };
}

// A canvas context that logs paths: beginPath starts one, and each arc's
// radius and each stroke's lineWidth go into it. Any other call does nothing
function pathLog() {
  const paths = [];
  let path = null;
  const state = { globalAlpha: 1 };
  const saved = [];
  const ctx = new Proxy(state, {
    get: (t, k) => {
      if (k === 'beginPath')
        return () => paths.push((path = { arcs: [], strokes: [] }));
      if (k === 'arc') return (x, y, r) => path?.arcs.push(r);
      if (k === 'stroke') return () => path?.strokes.push(t.lineWidth);
      if (k === 'save') return () => saved.push({ ...t });
      if (k === 'restore') return () => Object.assign(t, saved.pop());
      if (k in t) return t[k];
      return () => {};
    },
  });
  const arcsAt = (r, inPaths = paths) =>
    inPaths.flatMap((pa) => pa.arcs.filter((a) => a === r)).length;
  return {
    ctx,
    arcsAt,
    // The lit arcs are the paths stroked first on the thick ink
    litArcsAt: (r) =>
      arcsAt(
        r,
        paths.filter((pa) => pa.strokes[0] >= 8)
      ),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.assign(CONFIG.RUSHER, DEFAULTS);
  Object.assign(CONFIG.RUSHER_LOOK, LOOK_DEFAULTS);
});

describe("the rusher's look", () => {
  it('his ring lights one arc per beat left, of the beats he lit with', () => {
    expect(ringArcs({ beatsTotal: 3, beatsLeft: 3 })).toEqual({
      n: 3,
      left: 3,
    });
    expect(ringArcs({ beatsTotal: 3, beatsLeft: 1 })).toEqual({
      n: 3,
      left: 1,
    });
    expect(ringArcs({ beatsTotal: 0, beatsLeft: 1 })).toEqual({
      n: 1,
      left: 1,
    });
  });

  it('his fuse counts down a beat at a time, white-hot for the last half-beat', () => {
    const { r, to } = fused(13);
    to(13);
    r.takeDamage(1, null, 'hit'); // blast on 16, three beats
    expect(to(13.2)).toMatchObject({ beatsTotal: 3, beatsLeft: 3, hot: false });
    expect(to(14.1)).toMatchObject({ beatsLeft: 2, hot: false });
    expect(to(15.2)).toMatchObject({ beatsLeft: 1, hot: false });
    expect(to(15.6)).toMatchObject({ beatsLeft: 1, hot: true });
  });

  it('after a stall the lit arcs equal the beats left', () => {
    const { r, to, jump } = fused(14);
    to(14);
    r.takeDamage(1, null, 'hit'); // blast on 16, two beats
    to(14.05);
    const fuse = jump(15.1); // a beat the game sat out: on to 18
    expect(fuse.beatsLeft).toBe(3);
    expect(ringArcs(fuse)).toEqual({ n: 3, left: 3 });
  });

  it('is never drawn upside down: his pitch stays within FLIP_COS of level', () => {
    let side = 1;
    for (let h = 0; h < 4 * Math.PI; h += 0.01) {
      side = nextFacing(side, h, CONFIG.RUSHER.FLIP_COS);
      expect(Math.cos(rusherTilt(h, side))).toBeGreaterThanOrEqual(
        -CONFIG.RUSHER.FLIP_COS - 1e-9
      );
    }
  });

  it("draws every state and his blast without the game's random numbers, leaving the alpha as it was", () => {
    const { p } = transformP5();
    const spy = vi.spyOn(Math, 'random');
    for (const fuse of FUSES) {
      drawRusher(p, PROTO_SIZE, { ...LOOK, fuse });
      expect(p.drawingContext.globalAlpha).toBe(1);
    }
    for (const ageMs of [0, 50, 150, 400, 1200, 2200]) {
      drawRusherBlast(p, {
        x: 10,
        y: 20,
        ageMs,
        radius: 150,
        chain: ageMs > 1000,
        seed: 0.4,
      });
      expect(p.drawingContext.globalAlpha).toBe(1);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  // [review-added 2026-10-02: Codex]
  it('draws within the alpha he is handed (his spawn fade), never past it', () => {
    const { p } = transformP5();
    p.drawingContext.globalAlpha = 0.35;
    for (const fuse of FUSES) {
      drawRusher(p, PROTO_SIZE, { ...LOOK, fuse });
      if (fuse) drawCountRing(p, 0, 0, fuse, 150);
    }
    const drawn = p.drawingContext.alphasDrawn;
    expect(drawn.length).toBeGreaterThan(0);
    expect(Math.max(...drawn)).toBeLessThanOrEqual(0.35 + 1e-9);
    expect(p.drawingContext.globalAlpha).toBe(0.35);
  });

  // [review-added 2026-10-02: Codex]
  it('his speed share stays finite whatever the speed sliders say', () => {
    for (const [boost, cruise] of [
      [0, 0],
      [0, 150],
    ]) {
      CONFIG.RUSHER.BOOST_PX_S = boost;
      CONFIG.RUSHER.CRUISE_PX_S = cruise;
      const { r, to } = fused(12.8);
      to(13.05); // just past beat 13: the boost instant
      expect(r.boostAt).toBeGreaterThanOrEqual(13);
      expect(Number.isFinite(r.pose().speed01)).toBe(true);
      to(13.4); // and coasting
      expect(Number.isFinite(r.pose().speed01)).toBe(true);
    }
  });

  // [blind review 2026-10-02] the ring is the only warning before his blast
  it('lit, he draws his ring at the blast reach; unlit, nothing there', () => {
    const { r, to } = fused(12.9);
    to(13);
    r.spawnTimer = r.spawnDuration;
    const { p } = transformP5();
    const drawn = () => {
      const log = pathLog();
      p.drawingContext = log.ctx;
      r.draw(p);
      return log.arcsAt(CONFIG.RUSHER.EXPLOSION_RADIUS);
    };
    expect(drawn()).toBe(0);
    r.takeDamage(1, null, 'hit');
    expect(drawn()).toBeGreaterThan(0);
  });

  it.each([3, 2, 1])(
    'with %s of 3 beats left, his ring lights that many arcs',
    (left) => {
      const log = pathLog();
      const fuse = {
        age: 1,
        beatsTotal: 3,
        beatsLeft: left,
        hot: false,
        tick: 0,
      };
      drawCountRing({ drawingContext: log.ctx }, 0, 0, fuse, 150);
      expect(log.litArcsAt(150)).toBe(left);
    }
  );

  // [blind review 2026-10-02] the figure's scale is his size × ART_SCALE / 22,
  // the blast's is ART_SCALE: for some values they differ by a rounding
  it.each([1, 0.74, 0.99])(
    'at ART_SCALE %s, a rusher and a blast on screen build their sprites once',
    (scale) => {
      CONFIG.RUSHER_LOOK.ART_SCALE = scale;
      const { p, graphics } = transformP5();
      const frame = () => {
        drawRusher(p, PROTO_SIZE * scale, { ...LOOK, fuse: null }); // as drawFigure
        drawRusherBlast(p, {
          x: 0,
          y: 0,
          ageMs: 100,
          radius: 150,
          chain: false,
          seed: 0.4,
        });
      };
      frame();
      const built = graphics.length;
      for (let i = 0; i < 5; i++) frame();
      expect(graphics.length).toBe(built);
    }
  );

  // [blind review 2026-10-02] roundRect: Firefox 112+, Safari 16+; the rest of
  // the game runs on Firefox 92 and Safari 15.4
  it('draws his fuse on a canvas without roundRect', () => {
    const { p } = transformP5();
    p.drawingContext.roundRect = undefined;
    for (const fuse of FUSES)
      expect(() => drawRusher(p, PROTO_SIZE, { ...LOOK, fuse })).not.toThrow();
  });
});
