import { describe, it, expect, vi, afterEach } from 'vitest';
import { playCrash } from '../../js/audio/CrashSynth.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { Audio } from '../../js/Audio.js';

// A Web Audio stand-in that records the nodes it makes
function fakeAudio() {
  const made = [];
  const param = () => ({
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
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
    currentTime: 2,
    sampleRate: 8000,
    createStereoPanner: () => node('pan', { pan: param() }),
    createBiquadFilter: () => node('filter', { frequency: param() }),
    createGain: () => node('gain', { gain: param() }),
    createOscillator: () => node('osc', { frequency: param() }),
    createBufferSource: () => node('source'),
    createBuffer: vi.fn((channels, length) => {
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    }),
  };
  return { ctx, made };
}

// The game's Audio on that stand-in, sound on, the hero at (0, 0)
function gameAudio() {
  const { ctx, made } = fakeAudio();
  ctx.state = 'running';
  const audio = Object.assign(Object.create(Audio.prototype), {
    audioContext: ctx,
    initialized: true,
    enabled: true,
    initialize() {},
    sounds: { ...SOUND_CONFIG },
    player: { x: 0, y: 0 },
    masterGain: { kind: 'effects bus' },
    getContextValue: () => undefined, // no beat clock
    // As the constructor sets them
    _pausedByGame: false,
    _resuming: false,
  });
  return { audio, made };
}

afterEach(() => vi.restoreAllMocks());

describe("the rusher's crash", () => {
  const cfg = SOUND_CONFIG.rusherCrash;

  it('is six squares and noise, all through one high-pass above the stabbers and the kick click', () => {
    const { ctx, made } = fakeAudio();
    playCrash(ctx, { kind: 'out' }, cfg, 1, 0.5);
    const oscs = made.filter((n) => n.kind === 'osc');
    expect(oscs.map((o) => o.type)).toEqual(Array(6).fill('square'));
    const filters = made.filter((n) => n.kind === 'filter');
    expect(filters).toHaveLength(1);
    expect(filters[0].type).toBe('highpass');
    expect(filters[0].frequency.setValueAtTime).toHaveBeenCalledWith(
      cfg.highpassHz,
      2
    );
    // Every level (the squares' and both noise gains) feeds the high-pass [review-added 2026-10-02]
    for (const g of made.filter((n) => n.kind === 'gain')) {
      expect(g.connect).toHaveBeenCalledWith(filters[0]);
    }
    expect(made.filter((n) => n.kind === 'source')).toHaveLength(2); // the wash and the bang
    for (const n of made.filter((n) => n.start.mock.calls.length)) {
      expect(n.stop).toHaveBeenCalled();
    }
  });

  it("draws none of the game's random numbers, and builds its noise once per context", () => {
    const { ctx } = fakeAudio();
    const spy = vi.spyOn(Math, 'random');
    playCrash(ctx, {}, cfg, 1, 0);
    playCrash(ctx, {}, cfg, 0.5, -1);
    expect(spy).not.toHaveBeenCalled();
    expect(ctx.createBuffer).toHaveBeenCalledTimes(1);
  });
});

// [blind review 2026-10-02] the game plays it through playSound's branch
describe('the crash through playSound', () => {
  it('plays the crash synth into the effects bus, panned toward the blast, quieter far off', () => {
    const near = gameAudio();
    const tone = vi.spyOn(near.audio, 'playTone');
    near.audio.playSound('rusherCrash', 300, 0);
    expect(tone).not.toHaveBeenCalled();
    const squares = near.made.filter((n) => n.kind === 'osc');
    expect(squares.map((o) => o.type)).toEqual(Array(6).fill('square'));
    const pan = near.made.find((n) => n.kind === 'pan');
    expect(pan.pan.setValueAtTime.mock.calls[0][0]).toBeGreaterThan(0);
    expect(pan.connect).toHaveBeenCalledWith(near.audio.masterGain);
    const far = gameAudio();
    far.audio.playSound('rusherCrash', 2000, 0);
    const peak = ({ made }) =>
      made.find((n) => n.kind === 'gain').gain.exponentialRampToValueAtTime.mock
        .calls[0][0];
    expect(peak(far)).toBeLessThan(peak(near));
  });

  it('makes nothing while the game holds the sound', () => {
    const { audio, made } = gameAudio();
    audio._pausedByGame = true;
    audio.playSound('rusherCrash', 300, 0);
    expect(made).toHaveLength(0);
  });
});
