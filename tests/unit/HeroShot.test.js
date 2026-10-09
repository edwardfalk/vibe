// The hero's shot: four sounds from the 4 October listening page, on ?tune,
// softening on held fire (docs/superpowers/specs/2026-10-09-audio-pr2-design.md)
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  heroShot,
  HERO_SHOT_SOUNDS,
  SYNTHS,
} from '../../js/audio/Instruments.js';
import { crashNoise } from '../../js/audio/CrashSynth.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { hz } from '../../js/audio/Harmony.js';
import { CONFIG } from '../../js/config.js';
import { Audio } from '../../js/Audio.js';

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
    createBuffer: vi.fn((_channels, length) => {
      const data = new Float32Array(length);
      return { duration: length / 8000, getChannelData: () => data };
    }),
  };
  return { ctx, made };
}

// One shot of `sound` on `eighth`, at full volume, centred
function shoot(sound, eighth = 1) {
  const { ctx, made } = fakeContext();
  const saved = CONFIG.HERO_SHOT.SOUND;
  CONFIG.HERO_SHOT.SOUND = sound;
  try {
    heroShot(ctx, { kind: 'out' }, SOUND_CONFIG.playerShoot, {
      volume: 1,
      pan: 0,
      at: AT,
      eighth,
    });
  } finally {
    CONFIG.HERO_SHOT.SOUND = saved;
  }
  const of = (kind) => made.filter((n) => n.kind === kind);
  return { ctx, made, of };
}

// The level its bus (the first gain) was set to
const busLevel = (of) => of('gain')[0].gain.setValueAtTime.mock.calls[0][0];
// The peak an envelope gain rises to, or starts at
const peakOf = (g) =>
  g.gain.linearRampToValueAtTime.mock.calls[0]?.[0] ??
  g.gain.setValueAtTime.mock.calls[0][0];

afterEach(() => vi.restoreAllMocks());

describe("the hero's four shots, as on the listening page", () => {
  it('offers the four Edward shortlisted', () => {
    expect(HERO_SHOT_SOUNDS).toEqual([
      'softHat',
      'metalHat',
      'tick',
      'ghostArp',
    ]);
  });

  it('tick: a 30 ms triangle on the root five octaves up, at its trim', () => {
    const { of } = shoot('tick');
    const [o] = of('osc');
    expect(o.type).toBe('triangle');
    expect(o.frequency.setValueAtTime).toHaveBeenCalledWith(
      hz(['1', 6], AT),
      AT
    );
    expect(o.start).toHaveBeenCalledWith(AT);
    expect(busLevel(of)).toBeCloseTo(dB(0.1 + CONFIG.HERO_SHOT.LEVEL_DB), 6);
    const env = of('gain')[1];
    expect(env.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.2,
      AT + 0.002
    );
    expect(env.gain.exponentialRampToValueAtTime.mock.calls[0][1]).toBe(
      AT + 0.03
    );
  });

  it('the "and" is louder than the beat: x1 off it, x0.65 on it', () => {
    const and = peakOf(shoot('tick', 3).of('gain')[1]);
    const on = peakOf(shoot('tick', 4).of('gain')[1]);
    expect(and).toBeCloseTo(0.2, 6);
    expect(on).toBeCloseTo(0.2 * 0.65, 6);
  });

  it("softHat: the shared noise through a 7 kHz high-pass, read from the eighth's own place in it", () => {
    const { ctx, of } = shoot('softHat', 21);
    expect(of('osc')).toHaveLength(0);
    const [src] = of('source');
    expect(src.buffer).toBe(crashNoise(ctx));
    expect(src.start).toHaveBeenCalledWith(AT, (21 % 16) * 0.1);
    const [hp] = of('filter');
    expect(hp.type).toBe('highpass');
    expect(hp.frequency.setValueAtTime).toHaveBeenCalledWith(7000, AT);
    expect(hp.Q.setValueAtTime).toHaveBeenCalledWith(0.8, AT);
    expect(src.connect).toHaveBeenCalledWith(hp);
    expect(busLevel(of)).toBeCloseTo(dB(1.1 + CONFIG.HERO_SHOT.LEVEL_DB), 6);
    expect(peakOf(of('gain')[1])).toBeCloseTo(0.2, 6);
  });

  it("metalHat: the crash's six squares through a 10 kHz band-pass and a 7 kHz high-pass", () => {
    const { of } = shoot('metalHat');
    const oscs = of('osc');
    expect(oscs.map((o) => o.type)).toEqual(Array(6).fill('square'));
    expect(
      oscs.map((o) => o.frequency.setValueAtTime.mock.calls[0][0])
    ).toEqual(SOUND_CONFIG.rusherCrash.partialsHz);
    const [hp, bp] = of('filter');
    expect([hp.type, bp.type]).toEqual(['highpass', 'bandpass']);
    expect(bp.frequency.setValueAtTime).toHaveBeenCalledWith(10000, AT);
    expect(bp.Q.setValueAtTime).toHaveBeenCalledWith(0.9, AT);
    expect(hp.Q.setValueAtTime).toHaveBeenCalledWith(0.7, AT);
    for (const o of oscs) expect(o.connect).toHaveBeenCalledWith(bp);
    expect(bp.connect).toHaveBeenCalledWith(hp);
    expect(busLevel(of)).toBeCloseTo(dB(1.8 + CONFIG.HERO_SHOT.LEVEL_DB), 6);
  });

  it('ghostArp: the soft hat, plus a quiet square pluck walking the chord over two bars', () => {
    const walk = [
      ['1', 4],
      ['b3', 4],
      ['5', 4],
      ['1', 5],
      ['5', 4],
      ['b3', 4],
      ['5', 4],
      ['b3', 4],
      ['1', 4],
      ['b3', 4],
      ['5', 4],
      ['b7', 4],
      ['1', 5],
      ['b7', 4],
      ['5', 4],
      ['b3', 4],
    ];
    for (let eighth = 0; eighth < 18; eighth++) {
      const { of } = shoot('ghostArp', eighth);
      expect(of('source')).toHaveLength(1); // the hat
      const [o] = of('osc');
      expect(o.type).toBe('square');
      expect(o.frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(
        hz(walk[eighth % 16], AT),
        6
      );
      // The pluck's own peak: no accent
      const pluckEnv = of('gain').find(
        (g) => g.gain.linearRampToValueAtTime.mock.calls.length
      );
      expect(peakOf(pluckEnv)).toBeCloseTo(0.07, 6);
      expect(busLevel(of)).toBeCloseTo(dB(-3.5 + CONFIG.HERO_SHOT.LEVEL_DB), 6);
    }
  });

  it('lets every node go when its last source ends: the latest to stop', () => {
    for (const sound of HERO_SHOT_SOUNDS) {
      const { made } = shoot(sound);
      const ends = made.filter((n) => n.onended);
      expect(ends, sound).toHaveLength(1);
      const [last] = ends;
      // No source stops after the one that frees them all
      const stops = made
        .filter((n) => n.stop.mock.calls.length)
        .map((n) => n.stop.mock.calls[0][0]);
      expect(last.stop.mock.calls[0][0], sound).toBe(Math.max(...stops));
      last.onended();
      for (const n of made)
        expect(n.disconnect, `${sound} ${n.kind}`).toHaveBeenCalled();
    }
  });

  it('HERO_SHOT.LEVEL_DB moves the whole shot', () => {
    const saved = CONFIG.HERO_SHOT.LEVEL_DB;
    try {
      CONFIG.HERO_SHOT.LEVEL_DB = 0;
      const at0 = busLevel(shoot('tick').of);
      CONFIG.HERO_SHOT.LEVEL_DB = -6;
      expect(busLevel(shoot('tick').of) / at0).toBeCloseTo(dB(-6), 6);
    } finally {
      CONFIG.HERO_SHOT.LEVEL_DB = saved;
    }
  });

  it("draws none of the game's random numbers", () => {
    const random = vi.spyOn(Math, 'random');
    for (const sound of HERO_SHOT_SOUNDS) shoot(sound);
    expect(random).not.toHaveBeenCalled();
  });

  it('an unknown sound on the knob warns once and plays the tick', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = shoot('cowbell');
    shoot('cowbell');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(first.of('osc')[0].type).toBe('triangle');
  });

  it('a note that cannot resolve (a bad root) throws before any node is made', () => {
    const root = CONFIG.HUM.ROOT;
    try {
      CONFIG.HUM.ROOT = 'H';
      const { ctx, made } = fakeContext();
      const saved = CONFIG.HERO_SHOT.SOUND;
      CONFIG.HERO_SHOT.SOUND = 'tick';
      try {
        expect(() =>
          heroShot(ctx, {}, SOUND_CONFIG.playerShoot, {
            volume: 1,
            pan: 0,
            at: AT,
            eighth: 1,
          })
        ).toThrow();
      } finally {
        CONFIG.HERO_SHOT.SOUND = saved;
      }
      expect(made).toHaveLength(0);
    } finally {
      CONFIG.HUM.ROOT = root;
    }
  });
});

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

describe("the hero's shot in the game", () => {
  // The tick at its trim, softening 6 dB over 8 shots, whatever ?tune or
  // config sets them to
  let saved;
  beforeEach(() => {
    saved = { ...CONFIG.HERO_SHOT };
    Object.assign(CONFIG.HERO_SHOT, {
      SOUND: 'tick',
      LEVEL_DB: 0,
      SOFTEN_DB: 6,
      SOFTEN_SHOTS: 8,
    });
  });
  afterEach(() => Object.assign(CONFIG.HERO_SHOT, saved));

  it("plays from the hero's spot, told BeatClock's nearest eighth: an early shot rounds to its own", () => {
    const { audio, made } = gameAudio(3.96); // 20 ms before beat 4
    audio.playSound('playerShoot', 0, 0);
    const [osc] = made.filter((n) => n.kind === 'osc');
    // eighth 8 is on a beat: the tick's on-beat accent
    const env = made.filter((n) => n.kind === 'gain')[1];
    expect(peakOf(env)).toBeCloseTo(0.2 * 0.65, 6);
    expect(osc.frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(
      hz(['1', 6], 2),
      6
    );
    // Unpanned, as on the page: a centred panner takes 3 dB off each channel
    expect(made.filter((n) => n.kind === 'pan')).toHaveLength(0);
  });

  it('every other synth is told the nearest eighth too, and plays now at its distance', () => {
    const { audio } = gameAudio(3.6); // eighth 7.2: the nearest is 7
    const told = [];
    SYNTHS.probe = (_ctx, _out, _cfg, opts) => told.push(opts);
    audio.sounds.probe = { synth: 'probe' };
    try {
      audio.playSound('probe', 0, 0);
    } finally {
      delete SYNTHS.probe;
    }
    expect(told).toEqual([{ volume: 1, pan: 0, at: 2, eighth: 7 }]);
  });

  it('a synth that throws logs an error once per sound and plays nothing; the game goes on', () => {
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { audio } = gameAudio();
    SYNTHS.broken = () => {
      throw new Error('a bad root');
    };
    audio.sounds.broken = { synth: 'broken' };
    try {
      expect(() => {
        audio.playSound('broken');
        audio.playSound('broken');
      }).not.toThrow();
    } finally {
      delete SYNTHS.broken;
    }
    expect(warn).toHaveBeenCalledTimes(1);
  });

  describe('softening on held fire', () => {
    // The level of shots at these audio times, from a fresh run
    const levels = (times) => {
      const { audio, clock } = gameAudio();
      return times.map((t) => audio.heroRunLevel(t, clock));
    };
    const eighths = (n) => Array.from({ length: n }, (_, i) => 10 + i * 0.25);

    it("a run's first shot is unsoftened; shot n is down SOFTEN_DB x min(n, SOFTEN_SHOTS) / SOFTEN_SHOTS dB", () => {
      const { SOFTEN_DB, SOFTEN_SHOTS } = CONFIG.HERO_SHOT;
      const got = levels(eighths(12));
      got.forEach((level, n) => {
        const down = (SOFTEN_DB * Math.min(n, SOFTEN_SHOTS)) / SOFTEN_SHOTS;
        expect(20 * Math.log10(level), `shot ${n}`).toBeCloseTo(-down, 6);
      });
    });

    it('a gap over 0.75 beats starts the run again', () => {
      const [, second, third] = levels([10, 10.25, 10.25 + 0.38]);
      expect(second).toBeLessThan(1);
      expect(third).toBe(1); // 0.38 s is 0.76 beats
    });

    it('SOFTEN_SHOTS 0 turns it off', () => {
      const saved = CONFIG.HERO_SHOT.SOFTEN_SHOTS;
      try {
        CONFIG.HERO_SHOT.SOFTEN_SHOTS = 0;
        expect(levels(eighths(10))).toEqual(Array(10).fill(1));
      } finally {
        CONFIG.HERO_SHOT.SOFTEN_SHOTS = saved;
      }
    });

    it('SOFTEN_DB sets how far a long burst falls', () => {
      CONFIG.HERO_SHOT.SOFTEN_DB = 12;
      const got = levels(eighths(10));
      expect(20 * Math.log10(got[9])).toBeCloseTo(-12, 6);
    });

    it('reaches the shot through playSound: the run softens the bus', () => {
      const { audio, made } = gameAudio();
      for (let i = 0; i < 9; i++) {
        audio.audioContext.currentTime = 10 + i * 0.25;
        audio.playSound('playerShoot', 0, 0);
      }
      const buses = made
        .filter((n) => n.kind === 'gain')
        .filter((_, i) => i % 2 === 0); // bus, envelope, bus, envelope ...
      const first = buses[0].gain.setValueAtTime.mock.calls[0][0];
      const last = buses[8].gain.setValueAtTime.mock.calls[0][0];
      expect(20 * Math.log10(last / first)).toBeCloseTo(
        -CONFIG.HERO_SHOT.SOFTEN_DB,
        6
      );
    });
  });
});

describe('the shot booked on its eighth', () => {
  // The tick: its oscillator's start and its accent are what is read
  let savedSound;
  beforeEach(() => {
    savedSound = CONFIG.HERO_SHOT.SOUND;
    CONFIG.HERO_SHOT.SOUND = 'tick';
  });
  afterEach(() => (CONFIG.HERO_SHOT.SOUND = savedSound));

  // The game's Audio at audio time `now`, its beat clock on the same context
  // (grid from 1 s, an eighth every 0.25 s: eighth 8 is at 3 s) unless
  // `otherClock`; 48 kHz, so a render quantum is 2.7 ms
  function at(now, { otherClock = false } = {}) {
    const { audio, ctx, made } = gameAudio();
    ctx.sampleRate = 48000;
    ctx.currentTime = now;
    const clock = {
      audioContext: otherClock ? {} : ctx,
      startTime: 1000,
      beatInterval: 500,
      getBeatPosition: () => (ctx.currentTime * 1000 - 1000) / 500,
    };
    audio.getContextValue = (key) => (key === 'beatClock' ? clock : undefined);
    audio.playSound('playerShoot', 0, 0);
    const [osc] = made.filter((n) => n.kind === 'osc');
    const env = made.filter((n) => n.kind === 'gain')[1];
    return { start: osc.start.mock.calls[0][0], accent: peakOf(env) / 0.2 };
  }

  it('a shot 10 ms before an eighth starts exactly on it', () => {
    expect(at(2.99).start).toBe(3);
  });

  it('one 25 ms before still does; one 40 ms before plays now', () => {
    expect(at(2.975).start).toBe(3);
    expect(at(2.96).start).toBe(2.96);
  });

  it('one closer than a render quantum (1 ms) plays now, not in the past', () => {
    expect(at(2.999).start).toBe(2.999);
  });

  it('one 5 ms after its eighth plays now, and is told that eighth', () => {
    const shot = at(3.005);
    expect(shot.start).toBe(3.005);
    expect(shot.accent).toBeCloseTo(0.65, 6); // eighth 8: on the beat
  });

  it('it is told the eighth it lands on: the "and" for 3.25 s', () => {
    expect(at(3.24).accent).toBeCloseTo(1, 6);
    expect(at(3.24).start).toBe(3.25);
  });

  it('a beat clock on another AudioContext books nothing', () => {
    expect(at(2.99, { otherClock: true }).start).toBe(2.99);
  });

  it('every one of the four sounds starts on the booked eighth, sources and envelopes alike', () => {
    for (const sound of HERO_SHOT_SOUNDS) {
      CONFIG.HERO_SHOT.SOUND = sound;
      const { audio, ctx, made } = gameAudio();
      ctx.sampleRate = 48000;
      ctx.currentTime = 2.99; // 10 ms before eighth 8, at 3 s
      const clock = {
        audioContext: ctx,
        startTime: 1000,
        beatInterval: 500,
        getBeatPosition: () => (ctx.currentTime * 1000 - 1000) / 500,
      };
      audio.getContextValue = (key) =>
        key === 'beatClock' ? clock : undefined;
      audio.playSound('playerShoot', 0, 0);
      const sources = made.filter((n) => n.start.mock.calls.length);
      expect(sources.length, sound).toBeGreaterThan(0);
      for (const n of sources) {
        expect(n.start.mock.calls[0][0], `${sound} ${n.kind}`).toBe(3);
      }
      for (const n of made.filter((m) => m.kind === 'gain')) {
        expect(n.gain.setValueAtTime.mock.calls[0][1], sound).toBe(3);
      }
    }
  });

  it('with no beat clock it plays now', () => {
    const { audio, ctx, made } = gameAudio();
    ctx.currentTime = 2.99;
    audio.getContextValue = () => undefined;
    audio.playSound('playerShoot', 0, 0);
    const [osc] = made.filter((n) => n.kind === 'osc');
    expect(osc.start).toHaveBeenCalledWith(2.99);
  });
});
