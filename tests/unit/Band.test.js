// The band's instruments: each enemy's own synth, from the 9 October
// listening page (docs/superpowers/specs/2026-10-10-band-instruments-design.md)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SYNTHS, GRUNT_SHOT_SOUNDS } from '../../js/audio/Instruments.js';
import {
  SOUND_CONFIG,
  GRUNT_SHOT_NOTES,
  VOICE_DEGREES,
} from '../../js/audio/SoundConfig.js';
import { hz, stepUp } from '../../js/audio/Harmony.js';
import { CONFIG } from '../../js/config.js';
import { Audio } from '../../js/Audio.js';
import { Grunt } from '../../js/entities/Grunt.js';
import { createMockP5, createMockAudio } from './helpers/enemyMocks.js';

const AT = 2.5;
const dB = (d) => 10 ** (d / 20);

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

// Each of the band's synths, with what its creature passes, and its knob
const BAND = {
  gruntShot: { opts: { note: ['b3', 5] }, knob: 'GRUNT_SHOT_DB' },
  tankShot: { opts: {}, knob: 'TANK_SHOT_DB' },
  tankCharge: { opts: { step: 0, steps: 8 }, knob: 'CHARGE_DB' },
};
const NAMES = Object.keys(BAND);

// One play of a band synth on the stand-in: full volume, centred, at AT
function play(name, opts = {}) {
  const { ctx, made } = fakeContext();
  SYNTHS[name](
    ctx,
    { kind: 'out' },
    {},
    { volume: 1, pan: 0, at: AT, ...BAND[name].opts, ...opts }
  );
  const of = (kind) => made.filter((n) => n.kind === kind);
  return { ctx, made, of };
}

// Every source made, and the level its bus (the first gain) was set to
const sourcesOf = (made) => made.filter((n) => n.start.mock.calls.length);
const busLevel = (of) => of('gain')[0].gain.setValueAtTime.mock.calls[0][0];
// Run `fn` with CONFIG.BAND[key] set to `value`, then put it back
function withBand(key, value, fn) {
  const saved = CONFIG.BAND[key];
  CONFIG.BAND[key] = value;
  try {
    return fn();
  } finally {
    CONFIG.BAND[key] = saved;
  }
}
// A play that must throw, and the nodes it made
function failing(name, opts) {
  const { ctx, made } = fakeContext();
  expect(() =>
    SYNTHS[name](
      ctx,
      {},
      {},
      { volume: 1, pan: 0, at: AT, ...BAND[name].opts, ...opts }
    )
  ).toThrow();
  return made;
}

describe("every one of the band's synths", () => {
  it.each(NAMES)('%s starts every source at `at`', (name) => {
    const sources = sourcesOf(play(name).made);
    expect(sources.length).toBeGreaterThan(0);
    for (const s of sources) expect(s.start.mock.calls[0][0]).toBe(AT);
  });

  it.each(NAMES)(
    '%s lets every node go when its sources end: all stop together',
    (name) => {
      const { made } = play(name);
      const ends = made.filter((n) => n.onended);
      expect(ends).toHaveLength(1);
      const stops = sourcesOf(made).map((n) => n.stop.mock.calls[0][0]);
      expect(new Set(stops).size).toBe(1);
      ends[0].onended();
      for (const n of made) expect(n.disconnect, n.kind).toHaveBeenCalled();
    }
  );

  it.each(NAMES)("%s draws none of the game's random numbers", (name) => {
    const random = vi.spyOn(Math, 'random');
    play(name);
    expect(random).not.toHaveBeenCalled();
  });

  it.each(NAMES)(
    '%s plays at its trim plus its knob, times the volume, panned by `pan`',
    (name) => {
      const { knob } = BAND[name];
      const at0 = withBand(knob, 0, () => busLevel(play(name).of));
      const down = withBand(knob, -6, () => busLevel(play(name).of));
      expect(down / at0).toBeCloseTo(dB(-6), 6);
      const half = withBand(knob, 0, () =>
        busLevel(play(name, { volume: 0.5 }).of)
      );
      expect(half / at0).toBeCloseTo(0.5, 6);
      const { of } = play(name, { pan: -0.4 });
      const [panner] = of('pan');
      expect(panner.pan.setValueAtTime).toHaveBeenCalledWith(-0.4, AT);
      // Everything goes through the bus, the bus through the panner
      expect(of('gain')[0].connect).toHaveBeenCalledWith(panner);
      expect(panner.connect).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'out' })
      );
    }
  );

  it.each(NAMES)('%s adds its detuneCents to every oscillator', (name) => {
    const cents = (made) =>
      made
        .filter((n) => n.kind === 'osc')
        .map((o) => o.detune.setValueAtTime.mock.calls[0][0]);
    const plain = cents(play(name).made);
    const shifted = cents(play(name, { detuneCents: 3 }).made);
    expect(plain.length).toBeGreaterThan(0);
    shifted.forEach((c, i) => expect(c - plain[i]).toBeCloseTo(3, 9));
  });

  it.each(NAMES)(
    '%s throws before any node on a bad root, or a knob or detune that is not a finite number',
    (name) => {
      const root = CONFIG.HUM.ROOT;
      try {
        CONFIG.HUM.ROOT = 'H';
        expect(failing(name)).toHaveLength(0);
      } finally {
        CONFIG.HUM.ROOT = root;
      }
      for (const bad of [NaN, '6', null, -Infinity]) {
        withBand(BAND[name].knob, bad, () =>
          expect(failing(name), String(bad)).toHaveLength(0)
        );
      }
      expect(failing(name, { detuneCents: NaN })).toHaveLength(0);
    }
  );
});

describe("the grunt's shot", () => {
  it('offers the stab and the zap, and plays the stab by default', () => {
    expect(GRUNT_SHOT_SOUNDS).toEqual(['stab', 'zap']);
    expect(CONFIG.BAND.GRUNT_SHOT).toBe('stab');
  });

  it('the stab: two saws either side of his note, 9 cents apart each way', () => {
    withBand('GRUNT_SHOT', 'stab', () => {
      const oscs = play('gruntShot', { note: ['5', 5] }).of('osc');
      expect(oscs.map((o) => o.type)).toEqual(['sawtooth', 'sawtooth']);
      for (const o of oscs) {
        expect(o.frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(
          hz(['5', 5], AT),
          6
        );
      }
      const cents = oscs.map((o) => o.detune.setValueAtTime.mock.calls[0][0]);
      expect(cents).toEqual([-9, 9]);
    });
  });

  it('the zap: a square dropping an octave onto his note', () => {
    withBand('GRUNT_SHOT', 'zap', () => {
      const [o, ...rest] = play('gruntShot', { note: ['b3', 5] }).of('osc');
      expect(rest).toHaveLength(0);
      expect(o.type).toBe('square');
      const f = hz(['b3', 5], AT);
      expect(o.frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(2 * f, 6);
      expect(
        o.frequency.exponentialRampToValueAtTime.mock.calls[0][0]
      ).toBeCloseTo(f, 6);
    });
  });

  it('an unknown GRUNT_SHOT throws, naming the knob, before any node', () => {
    withBand('GRUNT_SHOT', 'cowbell', () => {
      expect(failing('gruntShot')).toHaveLength(0);
      const { ctx } = fakeContext();
      const opts = { volume: 1, pan: 0, at: AT, note: ['b3', 5] };
      expect(() => SYNTHS.gruntShot(ctx, {}, {}, opts)).toThrow(/GRUNT_SHOT/);
    });
  });

  it('a shot with no note throws before any node', () => {
    expect(failing('gruntShot', { note: undefined })).toHaveLength(0);
  });

  it("alienShoot is the grunt's shot", () => {
    expect(SOUND_CONFIG.alienShoot).toEqual({ synth: 'gruntShot' });
  });

  it("two grunts' shots in one frame don't start together or sound the same", () => {
    const { audio, made } = gameAudio();
    withBand('GRUNT_SHOT', 'stab', () => {
      for (const seed of [0.2, 0.3]) {
        audio.playSound('alienShoot', 0, 0, { note: ['b3', 5], seed });
      }
    });
    const saws = made.filter((n) => n.kind === 'osc');
    expect(saws).toHaveLength(4);
    const [a, , b] = saws;
    expect(a.start.mock.calls[0][0]).not.toBe(b.start.mock.calls[0][0]);
    expect(a.detune.setValueAtTime.mock.calls[0][0]).not.toBe(
      b.detune.setValueAtTime.mock.calls[0][0]
    );
  });
});

describe('a grunt shoots his own note', () => {
  // A grunt with this look seed, its shots' playSound calls
  function shots(seed, n = 3) {
    const audio = createMockAudio();
    const context = { get: () => undefined, set() {} };
    const g = new Grunt(0, 0, 'grunt', { context }, createMockP5(), audio);
    g.lookSeed = seed;
    for (let i = 0; i < n; i++) g.createBullet();
    return audio.playSound.mock.calls;
  }

  it("his notes are the grunt's minor third and fifth, in octave 5", () => {
    expect(GRUNT_SHOT_NOTES).toEqual([
      ['b3', 5],
      ['5', 5],
    ]);
    for (const [degree] of GRUNT_SHOT_NOTES) {
      expect(VOICE_DEGREES.grunt).toContain(degree);
    }
  });

  it('every shot of one grunt plays one note, with his seed', () => {
    const calls = shots(0.3);
    expect(calls).toHaveLength(3);
    for (const [name, , , opts] of calls) {
      expect(name).toBe('alienShoot');
      expect(opts).toEqual({ note: ['b3', 5], seed: 0.3 });
    }
  });

  it('grunts with different seeds play both notes', () => {
    const notes = [0.1, 0.4, 0.6, 0.9].map((seed) => shots(seed, 1)[0][3].note);
    expect(notes).toEqual([
      ['b3', 5],
      ['b3', 5],
      ['5', 5],
      ['5', 5],
    ]);
  });
});

describe("the tank's shot and charge", () => {
  // Where an oscillator starts and where its first ramp ends
  const ends = (o) => [
    o.frequency.setValueAtTime.mock.calls[0][0],
    o.frequency.exponentialRampToValueAtTime.mock.calls[0][0],
  ];

  it('the shot: a sine boom dropping onto his low root, under a saw and a square zap falling from his fifth to his root, 3% apart', () => {
    const { of } = play('tankShot');
    const [boom, saw, square] = of('osc');
    expect([boom.type, saw.type, square.type]).toEqual([
      'sine',
      'sawtooth',
      'square',
    ]);
    const [from, to] = ends(boom);
    expect(from).toBeCloseTo(hz(['1', 3], AT), 6);
    expect(to).toBeCloseTo(hz(['1', 1], AT), 6);
    expect(ends(saw)[0]).toBeCloseTo(hz(['5', 5], AT), 6);
    expect(ends(square)[0] / ends(saw)[0]).toBeCloseTo(1.03, 6);
    for (const z of [saw, square]) {
      expect(ends(z)[1]).toBeCloseTo(hz(['1', 2], AT), 6);
    }
    // The boom is driven: through a soft clipper on its way to the bus
    const [shaper] = of('shaper');
    expect(boom.connect).toHaveBeenCalledWith(shaper);
    expect(shaper.connect).toHaveBeenCalledWith(of('gain')[1]);
    expect(shaper.curve.at(0)).toBeCloseTo(-1, 6);
    expect(shaper.curve.at(-1)).toBeCloseTo(1, 6);
    expect(shaper.curve[600]).toBeGreaterThan((600 / 1023) * 2 - 1);
  });

  it('the charge climbs a scale step a beat from his root, to the octave on the eighth', () => {
    const at = (step) =>
      play('tankCharge', { step, steps: 8 }).of('osc')[0].frequency
        .setValueAtTime.mock.calls[0][0];
    for (let step = 0; step < 8; step++) {
      expect(at(step), `step ${step}`).toBeCloseTo(
        hz(stepUp(['1', 3], step), AT),
        6
      );
    }
    expect(at(7)).toBeCloseTo(hz(['1', 4], AT), 6);
  });

  it('the charge swells as he strains: each pluck louder than the last', () => {
    const peak = (step) =>
      play('tankCharge', { step, steps: 8 }).of('gain')[1].gain
        .linearRampToValueAtTime.mock.calls[0][0];
    const peaks = Array.from({ length: 8 }, (_, step) => peak(step));
    peaks.slice(1).forEach((p, i) => expect(p).toBeGreaterThan(peaks[i]));
    expect(peaks[7] / peaks[0]).toBeCloseTo(1 / 0.55, 6);
  });

  it.each([[-1], [8], [1.5], [undefined]])(
    'a charge step of %s out of 0..steps-1 throws before any node',
    (step) => {
      expect(failing('tankCharge', { step, steps: 8 })).toHaveLength(0);
    }
  );
});
