// Sounds on the beat: a sound played in the frame after its eighth starts on
// it, because the game runs a lead ahead of the audio (the beat-lead spec,
// section 2)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Audio } from '../../js/Audio.js';
import { BeatClock, SNAP_SEC } from '../../js/audio/BeatClock.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { CONFIG } from '../../js/config.js';
import { hz } from '../../js/audio/Harmony.js';

const DEFAULT_AHEAD_MS = CONFIG.BEAT_CLOCK.AHEAD_MS;
const AHEAD = 0.025;
const SPREAD = 0.005; // MAX_START_OFFSET_SEC: copies start up to this late

afterEach(() => {
  CONFIG.BEAT_CLOCK.AHEAD_MS = DEFAULT_AHEAD_MS;
  vi.restoreAllMocks();
});

// A Web Audio stand-in at 48 kHz (a render quantum is 2.7 ms) that records
// the nodes a sound makes
function fakeContext() {
  const made = [];
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = (kind, extra = {}) => {
    const n = {
      kind,
      connect: vi.fn((d) => d),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      ...extra,
    };
    made.push(n);
    return n;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    state: 'running',
    createStereoPanner: () => node('pan', { pan: param() }),
    createBiquadFilter: () =>
      node('filter', { frequency: param(), Q: param(), gain: param() }),
    createGain: () => node('gain', { gain: param() }),
    createOscillator: () =>
      node('osc', { frequency: param(), detune: param() }),
    createBufferSource: () =>
      node('source', { playbackRate: param(), detune: param() }),
    createConstantSource: () => node('constant', { offset: param() }),
    createWaveShaper: () => node('shaper'),
    createBuffer: vi.fn((_channels, length) => {
      const data = new Float32Array(length);
      return { duration: length / 48000, getChannelData: () => data };
    }),
  };
  return { ctx, made };
}

// The game's Audio on the stand-in, the hero at (0, 0), with a real beat
// clock on the same context running AHEAD ahead of it: its eighths are at
// clock times k × 0.25 s. `game(t)` sets the game's now to t
function ledAudio({ ahead = AHEAD, otherClock = false } = {}) {
  CONFIG.BEAT_CLOCK.AHEAD_MS = ahead * 1000;
  const { ctx, made } = fakeContext();
  const clock = new BeatClock(120, otherClock ? { currentTime: 0 } : ctx);
  clock.startTime = 0;
  const audio = Object.assign(Object.create(Audio.prototype), {
    audioContext: ctx,
    initialized: true,
    enabled: true,
    initialize() {},
    sounds: { ...SOUND_CONFIG },
    player: { x: 0, y: 0 },
    masterGain: { kind: 'effects bus' },
    effects: { reverb: null },
    getContextValue: (key) => (key === 'beatClock' ? clock : undefined),
    _pausedByGame: false,
    _resuming: false,
  });
  const game = (t) => {
    ctx.currentTime = t - ahead;
    return audio;
  };
  return { audio, ctx, made, clock, game };
}

describe('a sound played now starts on its eighth when it can', () => {
  it('in the frame after its eighth: on it, told that eighth', () => {
    const { game } = ledAudio();
    const t = game(3.01).beatTiming(); // 10 ms after eighth 12, at 3 s
    expect(t.at).toBe(3);
    expect(t.eighth).toBe(12);
    expect(t.now).toBeCloseTo(2.985, 9);
  });

  it('up to one lead, less a render quantum, after it: still on it', () => {
    const { game } = ledAudio();
    expect(game(3.022).beatTiming().at).toBe(3); // 3 ms ahead of the audio
    const late = game(3.023).beatTiming(); // 2 ms: inside one quantum
    expect(late.at).toBeCloseTo(2.998, 9);
  });

  it('a later one plays now, told the nearest eighth', () => {
    const { game } = ledAudio();
    const t = game(3.2).beatTiming(); // after eighth 12, nearer 13
    expect(t.at).toBeCloseTo(3.175, 9);
    expect(t.eighth).toBe(13);
  });

  it('one 230 ms late plays now, not on the next eighth', () => {
    const { game } = ledAudio();
    // The next eighth, 3.25 s, is 45 ms ahead of the audio: it isn't his
    expect(game(3.23).beatTiming().at).toBeCloseTo(3.205, 9);
  });

  it('a timer aimed at an eighth that wakes just before it books it, given an early window', () => {
    const { game } = ledAudio();
    expect(game(2.995).beatTiming({ early: SNAP_SEC }).at).toBe(3);
    expect(game(2.995).beatTiming().at).toBeCloseTo(2.97, 9);
  });

  it('at lead 0 nothing books; the early window books as the hero did', () => {
    const { game } = ledAudio({ ahead: 0 });
    expect(game(3.001).beatTiming().at).toBe(3.001);
    expect(game(2.999).beatTiming().at).toBe(2.999);
    expect(game(2.99).beatTiming({ early: SNAP_SEC }).at).toBe(3);
    expect(game(2.96).beatTiming({ early: SNAP_SEC }).at).toBe(2.96);
  });

  it('a beat clock on another AudioContext books nothing', () => {
    const { game } = ledAudio({ otherClock: true });
    expect(game(3.01).beatTiming().at).toBeCloseTo(2.985, 9);
  });
});

describe("the hero's shot", () => {
  // 45 ms before the heard eighth at 3 s: 20 ms before it on the game's clock
  it('held fire books its eighth up to SNAP_SEC ahead of the game', () => {
    const { audio, game } = ledAudio();
    audio._heroRun = { at: 2.73, n: 1 }; // his last shot, an eighth before
    expect(game(2.98).heroShotTiming().at).toBe(3);
  });

  it("the first shot of a run never waits more than SNAP_SEC from the audio's now", () => {
    const { game } = ledAudio();
    expect(game(2.98).heroShotTiming().at).toBeCloseTo(2.955, 9);
    // 20 ms before the heard eighth: within SNAP_SEC, so on it
    expect(game(3.005).heroShotTiming().at).toBe(3);
  });

  it('a shot long after the last starts a new run', () => {
    const { audio, game } = ledAudio();
    audio._heroRun = { at: 2.5, n: 3 }; // 455 ms before: over RUN_GAP_BEATS
    expect(game(2.98).heroShotTiming().at).toBeCloseTo(2.955, 9);
  });
});

describe('every beat sound books on its eighth through playSound', () => {
  // Each with what its creature passes (the spec's table)
  it.each([
    ['alienShoot', { note: ['b3', 5], seed: 0.3 }],
    ['gruntChatter', { voice: 'whine', seed: 0.3 }],
    ['gruntAdvance', {}],
    ['gruntRetreat', {}],
    ['tankShot', { seed: 0.3 }],
    ['tankCharge', { step: 0, steps: 8, seed: 0.3 }],
    ['tankShove', {}],
    ['rusherCharge', {}],
    ['rusherFuse', { left: 2, seed: 0.3 }],
    ['rusherCrash', {}],
    ['gruntResponse', { early: SNAP_SEC }],
    ['tankResponse', { early: SNAP_SEC }],
    ['stabberResponse', { early: SNAP_SEC }],
    ['rusherResponse', { early: SNAP_SEC }],
    ['shieldUp', {}],
    ['gameOver', {}],
  ])('%s', (name, opts) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { made, game } = ledAudio();
    game(3.01).playSound(name, 100, 0, opts);
    expect(error).not.toHaveBeenCalled();
    // Not the 2 Hz wobble of a tone's tremolo, which stays on now
    const lfo = (n) =>
      n.kind === 'osc' && n.frequency.setValueAtTime.mock.calls[0]?.[0] < 20;
    const starts = made
      .filter((n) => n.start.mock.calls.length && !lfo(n))
      .map((n) => n.start.mock.calls[0][0]);
    expect(starts.length).toBeGreaterThan(0);
    for (const t of starts) {
      expect(t).toBeGreaterThanOrEqual(3);
      expect(t).toBeLessThanOrEqual(3 + SPREAD);
    }
  });

  it('a sound later than the lead after its eighth plays now', () => {
    const { made, game } = ledAudio();
    game(3.05).playSound('gruntAdvance', 100, 0);
    const [osc] = made.filter((n) => n.kind === 'osc');
    const start = osc.start.mock.calls[0][0];
    expect(start).toBeGreaterThanOrEqual(3.025);
    expect(start).toBeLessThanOrEqual(3.025 + SPREAD);
  });

  it("a tone's pitch is read at its booked start, before its spread", () => {
    // The hum's drift moves every pitch: it is read where the tone starts
    const { made, game } = ledAudio();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5); // no detune
    game(3.01).playSound('gruntAdvance', 100, 0);
    random.mockRestore();
    const [osc] = made.filter((n) => n.kind === 'osc');
    const [f, at] = osc.frequency.setValueAtTime.mock.calls[0];
    expect(f).toBe(hz(['b3', 4], 3));
    expect(hz(['b3', 4], 3)).not.toBe(hz(['b3', 4], 2.985));
    expect(at).toBeCloseTo(3 + SPREAD / 2, 9);
  });

  it("a neighbour's answer whose timer wakes just before its eighth still lands on it", () => {
    const { made, game } = ledAudio();
    game(2.995).playSound('gruntResponse', 100, 0, { early: SNAP_SEC });
    const [osc] = made.filter((n) => n.kind === 'osc');
    const start = osc.start.mock.calls[0][0];
    expect(start).toBeGreaterThanOrEqual(3);
    expect(start).toBeLessThanOrEqual(3 + SPREAD);
  });
});
