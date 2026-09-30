import { describe, it, expect, vi } from 'vitest';
import { BackgroundRenderer } from '../../js/systems/BackgroundRenderer.js';
import { NebulaSky } from '../../js/systems/background/NebulaSky.js';
import { CONFIG } from '../../js/config.js';

vi.mock('../../js/systems/background/NebulaSky.js', () => ({
  // A plain function, since it is called with `new`
  NebulaSky: vi.fn(function () {
    throw new Error('no sprites');
  }),
  levelFraction: (level) => Math.min(1, Math.max(0, (level - 1) / 7)),
}));

// A renderer with a fake p5 clock; step() advances it and returns the sky frame
function renderer(level = 1, values = {}) {
  const clock = { ms: 0 };
  const p = {
    millis: () => clock.ms,
    deltaTime: 1000 / 60,
    push() {},
    pop() {},
    background: vi.fn(),
  };
  const gameState = { level };
  const r = new BackgroundRenderer(p, null, null, gameState, {
    get: (key) => values[key],
  });
  const step = (ms = 1000 / 60) => {
    clock.ms += ms;
    p.deltaTime = ms;
    return r.skyFrame(p);
  };
  return { r, p, gameState, step };
}

describe('BackgroundRenderer sky frame', () => {
  it('starts at the level the game is on, and stops growing at 8', () => {
    const { gameState, step } = renderer(3);
    expect(step().level).toBe(3);
    gameState.level = 12;
    let s;
    for (let i = 0; i < 600; i++) s = step();
    expect(s.level).toBeCloseTo(8, 3);
  });

  it('remembers a level rise for the next kick, and forgets it on a fall', () => {
    const { gameState, step } = renderer(2);
    step();
    expect(step().levelAge).toBe(99);
    gameState.level = 3;
    expect(step().levelAge).toBeCloseTo(0, 5);
    expect(step(500).levelAge).toBeCloseTo(0.5, 5);
    gameState.level = 1; // a restart
    expect(step().levelAge).toBe(99);
  });

  it('clamps a long frame, so a hidden tab cannot jump the gas', () => {
    const { step } = renderer(1);
    const before = step().flow;
    expect(step(5000).flow - before).toBeCloseTo(0.1, 5);
  });

  it('has no kick before the beat track plays, as finite values', () => {
    const s = renderer(1).step();
    expect(s).toMatchObject({
      kickAge: 99,
      nextKickIn: 99,
      camX: 575,
      camY: 425,
    });
  });

  it('hears the kick after both latencies plus OFFSET_MS, and only on a running context', () => {
    const beatClock = {
      beatInterval: 500,
      getTotalBeats: () => 8,
      getBeatPhase: () => 0.2,
    };
    const beatTrack = {
      isPlaying: true,
      ctx: { state: 'running', baseLatency: 0.01, outputLatency: 0.02 },
    };
    const { step } = renderer(1, { beatClock, beatTrack });
    const offset = CONFIG.SKY.OFFSET_MS;
    try {
      CONFIG.SKY.OFFSET_MS = 30;
      // Beat 8.2 is 0.1 s after beat 8's kick; heard 0.01 + 0.02 + 0.03 s later
      expect(step().kickAge).toBeCloseTo(0.04);
      beatTrack.ctx.state = 'suspended';
      expect(step().kickAge).toBe(99);
    } finally {
      CONFIG.SKY.OFFSET_MS = offset;
    }
  });

  it('a sky whose constructor throws paints the void, logs once, never retries', () => {
    const { r, p } = renderer(1);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      r.drawSky(p);
      r.drawSky(p);
    }).not.toThrow();
    expect(NebulaSky).toHaveBeenCalledTimes(1);
    expect(p.background).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  it('a sky that throws while drawing paints the void and goes flat', () => {
    const { r, p } = renderer(1);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    r.sky = {
      mode: 'full',
      draw: vi.fn(() => {
        throw new Error('boom');
      }),
    };
    r.drawSky(p);
    r.drawSky(p);
    expect(p.background).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    expect(r.sky.mode).toBe('flat');
    error.mockRestore();
  });
});
