import { describe, it, expect, vi, afterEach } from 'vitest';
import { playCrash } from '../../js/audio/CrashSynth.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';

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
