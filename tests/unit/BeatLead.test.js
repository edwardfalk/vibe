import { describe, it, expect, vi, afterEach } from 'vitest';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { heardKickOf, heardLatencySec } from '../../js/audio/BeatTrack.js';
import { CONFIG } from '../../js/config.js';
import { EnemyDeathHandler } from '../../js/systems/combat/EnemyDeathHandler.js';
import { Tank } from '../../js/entities/Tank.js';
import { gruntPose, nextFacing } from '../../js/entities/GruntRenderer.js';
import { createMockP5 } from './helpers/enemyMocks.js';

// The game runs CONFIG.BEAT_CLOCK.AHEAD_MS ahead of what you hear: BeatClock
// reads the AudioContext's time plus that lead (the beat-lead spec, section 1)

const ctxAt = (currentTime) => ({ currentTime });
const DEFAULT_AHEAD_MS = CONFIG.BEAT_CLOCK.AHEAD_MS;

afterEach(() => {
  CONFIG.BEAT_CLOCK.AHEAD_MS = DEFAULT_AHEAD_MS;
  vi.useRealTimers();
});

describe('the beat clock runs ahead of what you hear', () => {
  it('reads the audio clock plus the lead', () => {
    CONFIG.BEAT_CLOCK.AHEAD_MS = 25;
    const clock = new BeatClock(120, ctxAt(1));
    expect(clock.nowSec()).toBeCloseTo(1.025, 9);
    expect(clock.aheadSec).toBeCloseTo(0.025, 9);
  });

  it('is the audio clock itself at lead 0', () => {
    CONFIG.BEAT_CLOCK.AHEAD_MS = 0;
    const clock = new BeatClock(120, ctxAt(1.234));
    expect(clock.nowSec()).toBe(1.234);
    expect(clock.aheadSec).toBe(0);
  });

  it('has no lead before audio starts', () => {
    CONFIG.BEAT_CLOCK.AHEAD_MS = 25;
    vi.useFakeTimers({ now: 100_000 });
    const clock = new BeatClock(120);
    expect(clock.aheadSec).toBe(0);
    expect(clock.nowSec()).toBe(100);
  });

  it('keeps the beat position across a live change; the grid moves instead', () => {
    CONFIG.BEAT_CLOCK.AHEAD_MS = 0;
    const ctx = ctxAt(0);
    const clock = new BeatClock(120, ctx);
    ctx.currentTime = 1.3;
    const before = clock.getBeatPosition();
    const origin = clock.startTime;
    CONFIG.BEAT_CLOCK.AHEAD_MS = 25;
    clock.update(true);
    expect(clock.getBeatPosition()).toBeCloseTo(before, 9);
    expect(clock.startTime).toBeCloseTo(origin + 25, 9);
    expect(clock.nowSec()).toBeCloseTo(1.325, 9);
    // and back down, with no jump either
    CONFIG.BEAT_CLOCK.AHEAD_MS = 10;
    clock.update(true);
    expect(clock.getBeatPosition()).toBeCloseTo(before, 9);
    expect(clock.startTime).toBeCloseTo(origin + 10, 9);
  });

  it("reads the new lead first thing after a live change, the game's time carried on", () => {
    CONFIG.BEAT_CLOCK.AHEAD_MS = 0;
    const clock = new BeatClock(120, ctxAt(1.3));
    clock.startTime = 0;
    CONFIG.BEAT_CLOCK.AHEAD_MS = 25;
    expect(clock.nowSec()).toBeCloseTo(1.325, 9);
    clock.update(true);
    expect(clock.cache.elapsed).toBeCloseTo(1300, 6);
  });

  // No _now() in between: BeatTrack's timer or a speech line reads these,
  // either one first
  it('hands a reader the new origin after a change, read first', () => {
    CONFIG.BEAT_CLOCK.AHEAD_MS = 0;
    const clock = new BeatClock(120, ctxAt(2));
    const origin = clock.startTime;
    CONFIG.BEAT_CLOCK.AHEAD_MS = 40;
    expect(clock.startTime).toBeCloseTo(origin + 40, 9);
    expect(clock.aheadSec).toBeCloseTo(0.04, 9);
  });

  it('hands a reader the new lead after a change, read first', () => {
    CONFIG.BEAT_CLOCK.AHEAD_MS = 0;
    const clock = new BeatClock(120, ctxAt(2));
    const origin = clock.startTime;
    CONFIG.BEAT_CLOCK.AHEAD_MS = 40;
    expect(clock.aheadSec).toBeCloseTo(0.04, 9);
    expect(clock.startTime).toBeCloseTo(origin + 40, 9);
  });

  it('keeps the elapsed time across the switch to the led audio clock', () => {
    CONFIG.BEAT_CLOCK.AHEAD_MS = 25;
    vi.useFakeTimers({ now: 100_000 });
    const clock = new BeatClock(120);
    vi.setSystemTime(101_300); // 2.6 beats on Date.now()
    const ctx = ctxAt(42);
    clock.useAudioClock(ctx);
    expect(clock.cache.elapsed).toBe(1300);
    expect(clock.nowSec()).toBeCloseTo(42.025, 9);
    expect(clock.aheadSec).toBeCloseTo(0.025, 9);
    // The beat it is in is heard one lead later on the audio clock
    expect(clock.startTime / 1000).toBeCloseTo(42.025 - 1.3, 9);
  });
});

describe('the heard latency includes the lead', () => {
  const ctx = { currentTime: 0, baseLatency: 0.01, outputLatency: 0.03 };

  it('adds the lead of a clock that runs on that context', () => {
    CONFIG.BEAT_CLOCK.AHEAD_MS = 25;
    const clock = new BeatClock(120, ctx);
    const base = 0.01 + 0.03 + CONFIG.SKY.OFFSET_MS / 1000;
    expect(heardLatencySec(ctx, clock)).toBeCloseTo(base + 0.025, 9);
    expect(heardLatencySec(ctx)).toBeCloseTo(base, 9);
  });

  it('adds none for a clock on another context, or without a context', () => {
    CONFIG.BEAT_CLOCK.AHEAD_MS = 25;
    const clock = new BeatClock(120, ctxAt(0));
    const base = 0.01 + 0.03 + CONFIG.SKY.OFFSET_MS / 1000;
    expect(heardLatencySec(ctx, clock)).toBeCloseTo(base, 9);
    expect(heardLatencySec(null, clock)).toBeCloseTo(
      CONFIG.SKY.OFFSET_MS / 1000,
      9
    );
  });
});

describe('what waits for the heard kick waits one lead more', () => {
  const LATENCY = 0.03; // the fake context's base + output latency
  const ledWorld = (t) => {
    CONFIG.BEAT_CLOCK.AHEAD_MS = 25;
    const ctx = {
      currentTime: t - 0.025,
      baseLatency: 0.01,
      outputLatency: 0.02,
    };
    const clock = new BeatClock(120, ctx);
    clock.startTime = 0; // the grid from clock time 0
    return { ctx, clock };
  };
  const extra = () => LATENCY + CONFIG.SKY.OFFSET_MS / 1000 + 0.025;

  it("the sky's and the Dude's kick", () => {
    const { ctx, clock } = ledWorld(1.1);
    const track = {
      ctx: Object.assign(ctx, { state: 'running' }),
      isPlaying: true,
      getContextValue: (k) => (k === 'beatClock' ? clock : undefined),
    };
    const beats = clock.getBeatPosition();
    const { t } = heardKickOf(track, beats, 0.5);
    expect(t).toBeCloseTo(beats * 0.5 - extra(), 9);
  });

  const world = (t) => {
    const { ctx, clock } = ledWorld(t);
    const audio = {
      audioContext: ctx,
      playGruntPop: vi.fn(),
      playTankDeath: vi.fn(),
      playSound: vi.fn(),
      ensureAudioContext: vi.fn(),
    };
    const explosionManager = {
      fragmentExplosions: [],
      addFragmentExplosion: vi.fn(),
    };
    const values = {
      beatClock: clock,
      audio,
      explosionManager,
      cameraSystem: { addShake: vi.fn() },
      enemies: [],
    };
    const handler = new EnemyDeathHandler({ get: (k) => values[k] });
    return { handler, explosionManager };
  };

  it("a grunt's pop shows when it is heard", () => {
    const w = world(1.1);
    const size = 26 * CONFIG.GRUNT_LOOK.ART_SCALE;
    const grunt = {
      type: 'grunt',
      x: 0,
      y: 0,
      size: 26,
      facing: 1,
      lookSeed: 0.3,
      pose: () =>
        gruntPose({
          beats: 2.2,
          beatSec: 0.5,
          seed: 0.3,
          aimAngle: 0.4,
          facing: nextFacing(1, 0.4),
          size,
        }),
    };
    w.handler.handleEnemyDeath(grunt, 'grunt', 0, 0, null);
    const [death] = w.explosionManager.fragmentExplosions;
    expect(death.popsAt).toBeCloseTo(1.25 + extra(), 9);
  });

  it("a tank's death shows when it is heard", () => {
    const w = world(1.1);
    const clock = { getBeatPosition: () => 2.2, beatInterval: 500 };
    const context = { get: (k) => (k === 'beatClock' ? clock : undefined) };
    const tank = new Tank(0, 0, 'tank', { context }, createMockP5(), null);
    tank.isSpawning = false;
    tank.turn = { from: 0, to: 0, at: null };
    tank.poseBeats = 2.2;
    w.handler.handleEnemyDeath(tank, 'tank', 0, 0, null);
    const [death] = w.explosionManager.fragmentExplosions;
    expect(death.startsAt).toBeCloseTo(1.25 + extra(), 9);
  });
});
