import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  stab,
  screech,
  pluck,
  tremolo,
  STRINGS_NOISE_SEC,
} from '../../js/audio/StabberStrings.js';
import { hz } from '../../js/audio/Harmony.js';
import { CONFIG } from '../../js/config.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { Audio } from '../../js/Audio.js';
import {
  calculatePanForPosition,
  calculateVolumeForPosition,
} from '../../js/audio/SpatialAudio.js';

const STABBER = { ...CONFIG.STABBER };
afterEach(() => {
  Object.assign(CONFIG.STABBER, STABBER);
  vi.restoreAllMocks();
});

// A Web Audio stand-in that records the nodes it makes and what is set on
// their params
function fakeAudio() {
  const made = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
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
    currentTime: 2,
    sampleRate: 8000,
    state: 'running',
    createStereoPanner: () => node('pan', { pan: param() }),
    createBiquadFilter: () =>
      node('filter', { frequency: param(), Q: param(), gain: param() }),
    createGain: () => node('gain', { gain: param() }),
    createOscillator: () => node('osc', { frequency: param() }),
    createBufferSource: () => node('source'),
    createBuffer: vi.fn((channels, length, rate) => {
      const data = new Float32Array(length);
      return { duration: length / rate, getChannelData: () => data };
    }),
  };
  return { ctx, made };
}
const noise = { duration: 1.6 };
const o = (extra = {}) => ({
  at: 3,
  volume: 1,
  pan: 0,
  noise,
  offset: 0.4,
  ...extra,
});
const saws = (made) =>
  made.filter((n) => n.kind === 'osc' && n.type === 'sawtooth');
// Where an oscillator's pitch settles: its first ramp's target
const settled = (osc) =>
  osc.frequency.exponentialRampToValueAtTime.mock.calls[0][0];
const cents = (c) => 2 ** (c / 1200);

describe("the stabber's strings", () => {
  it('stab: six saws, three on b5 in octave 6 and three a semitone above at 0.55 of the level', () => {
    const { ctx, made } = fakeAudio();
    stab(ctx, {}, o());
    const f = hz(['b5', 6], 3);
    const pitches = saws(made).map(settled);
    const want = [1, 16 / 15].flatMap((r) =>
      [-7, 0, 6].map((c) => f * r * cents(c))
    );
    expect(pitches).toHaveLength(6);
    pitches.forEach((p, i) => expect(p).toBeCloseTo(want[i], 6));
    // Each saw's share: 1/3 on the note, 0.55/3 on the semitone above
    const shares = made
      .filter((n) => n.kind === 'gain')
      .map((g) => g.gain.setValueAtTime.mock.calls[0]?.[0]);
    expect(shares.filter((v) => Math.abs(v - 1 / 3) < 1e-9)).toHaveLength(3);
    expect(shares.filter((v) => Math.abs(v - 0.55 / 3) < 1e-9)).toHaveLength(3);
  });

  it('all four parts play b5 in octave 6 (FrequencyRedistribution pins its band)', () => {
    const f = hz(['b5', 6], 0);
    for (const part of [stab, screech, pluck, tremolo]) {
      const { ctx, made } = fakeAudio();
      part(ctx, {}, o({ at: 0, beatSec: 0.5, untilSec: 0.5 }));
      // Every saw starts within a semitone and a scoop of the note
      for (const s of saws(made)) {
        const start = s.frequency.setValueAtTime.mock.calls[0][0];
        expect(start).toBeGreaterThan(f * 0.9);
        expect(start).toBeLessThan(f * 1.1);
      }
    }
  });

  it('screech: the stab bent up 6% over 0.2 s, and a softer echo a sixteenth later', () => {
    const { ctx, made } = fakeAudio();
    screech(ctx, {}, o({ beatSec: 0.5 }));
    const all = saws(made);
    expect(all).toHaveLength(12);
    const starts = all.map((s) => s.start.mock.calls[0][0]);
    expect(starts.slice(0, 6).every((t) => t === 3)).toBe(true);
    expect(starts.slice(6).every((t) => t === 3 + 0.5 * 0.25)).toBe(true);
    const bend = all[1].frequency.exponentialRampToValueAtTime.mock.calls;
    expect(bend[1][0] / bend[0][0]).toBeCloseTo(1.06, 9);
    expect(bend[1][1]).toBeCloseTo(3.2, 9);
  });

  it('pluck: a saw on the note closing to a low-pass of 700 Hz, and a tick of noise from its offset', () => {
    const { ctx, made } = fakeAudio();
    pluck(ctx, {}, o());
    expect(saws(made)[0].frequency.setValueAtTime).toHaveBeenCalledWith(
      hz(['b5', 6], 3),
      3
    );
    const lp = made.find((n) => n.type === 'lowpass');
    expect(lp.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      700,
      expect.any(Number)
    );
    const src = made.find((n) => n.kind === 'source');
    expect(src.buffer).toBe(noise);
    expect(src.start).toHaveBeenCalledWith(3, 0.4);
  });

  it('every part puts its volume on its output gain, so a volume of 0 is silence, never a ramp to 0', () => {
    for (const part of [stab, screech, pluck, tremolo]) {
      const { ctx, made } = fakeAudio();
      part(ctx, {}, o({ volume: 0, beatSec: 0.5, untilSec: 0.5 }));
      const out = made.find((n) => n.kind === 'gain');
      expect(out.gain.setValueAtTime).toHaveBeenCalledWith(0, 3);
      for (const n of made) {
        for (const p of [n.gain, n.frequency, n.Q].filter(Boolean)) {
          for (const [v] of p.exponentialRampToValueAtTime.mock.calls) {
            expect(v).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('frees every node once its last source ends', () => {
    for (const part of [stab, pluck, tremolo]) {
      const { ctx, made } = fakeAudio();
      part(ctx, {}, o({ untilSec: 0.5 }));
      const last = made.find((n) => typeof n.onended === 'function');
      last.onended();
      for (const n of made) expect(n.disconnect).toHaveBeenCalled();
    }
  });

  it('draws none of the game random numbers', () => {
    const spy = vi.spyOn(Math, 'random');
    for (const part of [stab, screech, pluck, tremolo]) {
      const { ctx } = fakeAudio();
      part(ctx, {}, o({ beatSec: 0.5, untilSec: 0.5 }));
    }
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("the stabber's tremolo", () => {
  it('fades out at the lock by itself, and its sources stop just after', () => {
    const { ctx, made } = fakeAudio();
    tremolo(ctx, {}, o({ untilSec: 0.75 }));
    const amp = made.find(
      (n) =>
        n.kind === 'gain' &&
        n.gain.linearRampToValueAtTime.mock.calls.length === 2
    );
    const [, [end, at]] = amp.gain.linearRampToValueAtTime.mock.calls;
    expect(end).toBeLessThan(0.001);
    expect(at).toBeCloseTo(3 + 0.75 + 0.015, 9);
    for (const s of made.filter((n) => n.kind === 'osc')) {
      expect(s.stop).toHaveBeenCalledWith(3 + 0.75 + 0.03);
    }
  });

  it('stop() cuts it at once on a gain of its own, and a second stop() does nothing', () => {
    const { ctx, made } = fakeAudio();
    const handle = tremolo(ctx, {}, o({ untilSec: 0.75 }));
    ctx.currentTime = 3.2;
    handle.stop();
    const cut = made.find(
      (n) =>
        n.kind === 'gain' &&
        n.gain.linearRampToValueAtTime.mock.calls.length === 1
    );
    const [[to, when]] = cut.gain.linearRampToValueAtTime.mock.calls;
    expect(to).toBe(0);
    expect(when).toBeCloseTo(3.215, 9);
    for (const s of made.filter((n) => n.kind === 'osc')) {
      expect(s.stop).toHaveBeenLastCalledWith(3.2 + 0.015 + 0.02);
    }
    const calls = made.map((n) => n.stop.mock.calls.length);
    handle.stop();
    expect(made.map((n) => n.stop.mock.calls.length)).toEqual(calls);
  });

  it('stop() after it has ended does nothing', () => {
    const { ctx, made } = fakeAudio();
    const handle = tremolo(ctx, {}, o({ untilSec: 0.75 }));
    ctx.currentTime = 3.75;
    const calls = made.map((n) => n.stop.mock.calls.length);
    handle.stop();
    expect(made.map((n) => n.stop.mock.calls.length)).toEqual(calls);
  });
});

// The game's Audio on the stand-in, sound on, the hero at (0, 0)
function gameAudio() {
  const { ctx, made } = fakeAudio();
  const audio = Object.assign(Object.create(Audio.prototype), {
    audioContext: ctx,
    initialized: true,
    enabled: true,
    initialize() {},
    sounds: { ...SOUND_CONFIG },
    player: { x: 0, y: 0 },
    masterGain: { kind: 'effects bus' },
    getContextValue: () => undefined, // no beat clock: now
    _pausedByGame: false,
    _resuming: false,
  });
  return { audio, ctx, made };
}

describe('Audio.playStabberStrings', () => {
  it('plays a part now, at its volume times nearness, panned, into the effects bus, from its seed in the noise', () => {
    const { audio, ctx, made } = gameAudio();
    CONFIG.STABBER.PLUCK_VOLUME = 0.5;
    audio.playStabberStrings('pluck', 300, 0, { seed: 1 }); // the hero is at (0, 0)
    const out = made.find((n) => n.kind === 'gain');
    expect(out.gain.setValueAtTime).toHaveBeenCalledWith(
      0.5 * calculateVolumeForPosition(300, 0, 0, 0),
      ctx.currentTime
    );
    const pan = made.find((n) => n.kind === 'pan');
    expect(pan.pan.setValueAtTime).toHaveBeenCalledWith(
      calculatePanForPosition(300, 0),
      ctx.currentTime
    );
    expect(calculatePanForPosition(300, 0)).not.toBe(0);
    expect(pan.connect).toHaveBeenCalledWith(audio.masterGain);
    const src = made.find((n) => n.kind === 'source');
    const buffer = src.buffer;
    expect(src.start).toHaveBeenCalledWith(
      ctx.currentTime,
      buffer.duration - STRINGS_NOISE_SEC
    );
  });

  it("gives the stab and the screech STAB_VOLUME, the tremolo TREMOLO_VOLUME, and hands back the tremolo's handle", () => {
    const { audio, made } = gameAudio();
    Object.assign(CONFIG.STABBER, {
      STAB_VOLUME: 0.3,
      TREMOLO_VOLUME: 0.7,
    });
    const level = () =>
      made.find((n) => n.kind === 'gain').gain.setValueAtTime.mock.calls[0][0];
    audio.playStabberStrings('screech', 0, 0, { beatSec: 0.5 });
    expect(level()).toBe(0.3);
    made.length = 0;
    const handle = audio.playStabberStrings('tremolo', 0, 0, { untilSec: 0.5 });
    expect(level()).toBe(0.7);
    expect(typeof handle.stop).toBe('function');
    made.length = 0;
    expect(audio.playStabberStrings('stab', 0, 0)).toBeNull();
    expect(level()).toBe(0.3);
  });

  it('plays nothing and hands back null while muted or paused', () => {
    for (const quiet of [{ enabled: false }, { _pausedByGame: true }]) {
      const { audio, made } = gameAudio();
      Object.assign(audio, quiet);
      expect(
        audio.playStabberStrings('tremolo', 0, 0, { untilSec: 0.5 })
      ).toBeNull();
      expect(made.filter((n) => n.kind === 'osc')).toHaveLength(0);
    }
  });
});
