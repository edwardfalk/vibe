import { describe, it, expect, vi } from 'vitest';
import { BackgroundRenderer } from '../../js/systems/BackgroundRenderer.js';
import { NebulaSky } from '../../js/systems/background/NebulaSky.js';
import { CONFIG } from '../../js/config.js';
import { playedKicks, beatsFrom } from './helpers/playedKicks.js';

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

  it("breathes deeper on the kick on the level-up's beat 1 as heard, and forgets it on a restart", () => {
    // NebulaSky's rule: the first kick since levelAge began breathes deeper
    const deep = (s) => s.kickAge <= s.levelAge && s.levelAge < s.prevKickAge;
    let beats = 23.9;
    // A start whose bar line comes back from the subtraction a hair late,
    // as about 1 in 35 do: without its half-beat margin the kick is missed
    const beatClock = {
      beatInterval: 500,
      startTime: 4715.119,
      getTotalBeats: () => Math.floor(beats),
      getBeatPhase: () => beats % 1,
    };
    const beatTrack = {
      isPlaying: true,
      ctx: { state: 'running', baseLatency: 0.01, outputLatency: 0.02 },
      kicks: playedKicks(beatsFrom(20, 26), 0.5, 4.715119),
      getContextValue: (k) => (k === 'beatClock' ? beatClock : undefined),
    };
    const { gameState, step } = renderer(2, { beatClock, beatTrack });
    expect(step().levelAge).toBe(99);
    gameState.level = 3;
    gameState.lastLevelUpAt = 4.715119 + 6 * 2; // its beat 1: beat 24
    // Beat 24.05 sounds 0.03 s later: heard, it is still beat 23.99
    beats = 24.05;
    expect(deep(step())).toBe(false);
    beats = 24.07; // heard: 24.01, its kick
    expect(deep(step())).toBe(true);
    beats = 25.07; // the next kick breathes as usual
    expect(deep(step())).toBe(false);
    gameState.level = 1;
    gameState.lastLevelUpAt = null; // a restart
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

  it('stands still while the game is paused and its sound held, kick glow and all', () => {
    const beatClock = {
      beatInterval: 500,
      startTime: 370,
      getTotalBeats: () => 8,
      getBeatPhase: () => 0.2,
    };
    const beatTrack = {
      isPlaying: true,
      ctx: { state: 'running' },
      kicks: playedKicks([8], 0.5, 0.37),
      getContextValue: (k) => (k === 'beatClock' ? beatClock : undefined),
    };
    const audio = { soundPaused: false };
    const { gameState, step } = renderer(1, { beatClock, beatTrack, audio });
    const moving = step();
    expect(step().flow).toBeGreaterThan(moving.flow);
    gameState.lastLevelUpAt = 0.37; // a level-up on beat 0
    step();
    // Paused: the context is suspended and the beat clock stands still
    audio.soundPaused = true;
    beatTrack.ctx.state = 'suspended';
    const held = step();
    const later = step(500);
    expect(later.flow).toBe(held.flow);
    expect(later.kickAge).toBe(held.kickAge);
    expect(later.levelAge).toBe(held.levelAge);
    expect(later.level).toBe(held.level);
    expect(held.kickAge).toBeLessThan(99); // the glow it had, not none
    expect(held.levelAge).toBeLessThan(99);
  });

  it('hears the kick after both latencies plus OFFSET_MS, and only on a running context', () => {
    const beatClock = {
      beatInterval: 500,
      startTime: 0,
      getTotalBeats: () => 8,
      getBeatPhase: () => 0.2,
    };
    const beatTrack = {
      isPlaying: true,
      ctx: { state: 'running', baseLatency: 0.01, outputLatency: 0.02 },
      kicks: playedKicks([7, 8]),
      getContextValue: (k) => (k === 'beatClock' ? beatClock : undefined),
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
