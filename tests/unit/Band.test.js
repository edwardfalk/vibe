// The band's instruments: each enemy's own synth, from the 9 October
// listening page (docs/superpowers/specs/2026-10-10-band-instruments-design.md)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SYNTHS } from '../../js/audio/Instruments.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { CONFIG } from '../../js/config.js';
import { Audio } from '../../js/Audio.js';

// A Web Audio stand-in that records the nodes a sound makes
function fakeContext() {
  const made = [];
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
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
    state: 'running',
    createStereoPanner: () => node('pan', { pan: param() }),
    createBiquadFilter: () =>
      node('filter', { frequency: param(), Q: param() }),
    createGain: () => node('gain', { gain: param() }),
    createOscillator: () =>
      node('osc', { frequency: param(), detune: param() }),
    createBufferSource: () => node('source'),
    createWaveShaper: () => node('shaper'),
    createBuffer: vi.fn((_channels, length) => {
      const data = new Float32Array(length);
      return { duration: length / 8000, getChannelData: () => data };
    }),
  };
  return { ctx, made };
}

// The game's Audio on the stand-in, the hero at (0, 0), its beat clock at
// `beats` (120 BPM)
function gameAudio(beats = 1) {
  const { ctx, made } = fakeContext();
  const clock = { beatInterval: 500, getBeatPosition: () => beats };
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
  return { audio, ctx, made, clock };
}

// What a probe synth is told when `opts` reach it through playSound
function told(opts) {
  const { audio } = gameAudio(3.6); // eighth 7.2: the nearest is 7
  const got = [];
  SYNTHS.probe = (_ctx, _out, _cfg, o) => got.push(o);
  audio.sounds.probe = { synth: 'probe' };
  try {
    audio.playSound('probe', 0, 0, opts);
  } finally {
    delete SYNTHS.probe;
  }
  return got[0];
}

afterEach(() => vi.restoreAllMocks());

describe("playSynth passes the caller's options through", () => {
  it("a synth gets the caller's options beside the ones playSynth computes", () => {
    expect(told({ note: ['b3', 5], step: 2, steps: 8 })).toEqual({
      note: ['b3', 5],
      step: 2,
      steps: 8,
      volume: 1,
      pan: 0,
      at: 2,
      eighth: 7,
    });
  });

  it("its own volume, pan, start and eighth win over the caller's", () => {
    const got = told({ volume: 9, pan: 9, at: 9, eighth: 9 });
    expect(got).toMatchObject({ volume: 1, pan: 0, at: 2, eighth: 7 });
  });

  it("creatures' seeds start their copies up to 5 ms late and detune them up to DETUNE_CENTS either way, over the whole range", () => {
    const saved = CONFIG.TONES.DETUNE_CENTS;
    try {
      CONFIG.TONES.DETUNE_CENTS = 5;
      // Seeds from one half only: the grunts on one note (Grunt.shotNote)
      const got = Array.from({ length: 200 }, (_, i) =>
        told({ seed: (i + 0.5) / 400 })
      );
      const late = got.map((o) => o.at - 2);
      const cents = got.map((o) => o.detuneCents);
      expect(Math.min(...late)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...late)).toBeLessThanOrEqual(0.005);
      expect(Math.min(...late)).toBeLessThan(0.0005);
      expect(Math.max(...late)).toBeGreaterThan(0.0045);
      expect(Math.min(...cents)).toBeGreaterThanOrEqual(-5);
      expect(Math.max(...cents)).toBeLessThanOrEqual(5);
      expect(Math.min(...cents)).toBeLessThan(-4);
      expect(Math.max(...cents)).toBeGreaterThan(4);
      // One seed, one copy: the same start and detune every time
      expect(told({ seed: 0.3 })).toEqual(told({ seed: 0.3 }));
    } finally {
      CONFIG.TONES.DETUNE_CENTS = saved;
    }
  });

  it("no seed (the crash, the hero's shot) moves nothing", () => {
    const got = told({});
    expect(got.at).toBe(2);
    expect(got).not.toHaveProperty('detuneCents');
  });
});
