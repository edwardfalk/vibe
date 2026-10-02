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

afterEach(() => {
  vi.restoreAllMocks();
  Object.assign(CONFIG.RUSHER, DEFAULTS);
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
});
