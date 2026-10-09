import { describe, it, expect, vi, afterEach } from 'vitest';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { AMBIENT_SOUNDS } from '../../js/audio/AmbientSoundProfile.js';
import { crashNoise } from '../../js/audio/CrashSynth.js';
import { Audio } from '../../js/Audio.js';
import { CONFIG } from '../../js/config.js';
import { hz } from '../../js/audio/Harmony.js';

// A Web Audio stand-in that records the nodes playTone makes
function fakeAudio() {
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
    createBuffer: vi.fn((channels, length) => {
      const data = new Float32Array(length);
      return { duration: length / 8000, getChannelData: () => data };
    }),
  };
  return { ctx, made };
}

// The game's Audio on that stand-in, sound on, the hero at (0, 0)
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
    effects: { reverb: null },
    context: null,
    _pausedByGame: false,
    _resuming: false,
  });
  return { audio, ctx, made };
}

afterEach(() => vi.restoreAllMocks());

describe('noise presets', () => {
  it('the dash and the frying are noise through a band-pass, not a saw', () => {
    for (const name of ['playerDash', 'enemyFrying']) {
      const { audio, ctx, made } = gameAudio();
      audio.playSound(name);
      expect(
        made.filter((n) => n.kind === 'osc'),
        name
      ).toHaveLength(0);
      const [src] = made.filter((n) => n.kind === 'source');
      expect(src.buffer, name).toBe(crashNoise(ctx));
      const [band] = made.filter((n) => n.kind === 'filter');
      expect(band.type, name).toBe('bandpass');
      expect(band.frequency.setValueAtTime, name).toHaveBeenCalledWith(
        SOUND_CONFIG[name].bandHz,
        src.start.mock.calls[0][0]
      );
      expect(src.connect, name).toHaveBeenCalledWith(band);
      expect(src.start, name).toHaveBeenCalled();
      expect(src.stop, name).toHaveBeenCalled();
    }
  });
});

describe('deleted presets', () => {
  it('enemyIdle is gone, from the presets and the ambient set', () => {
    expect(SOUND_CONFIG.enemyIdle).toBeUndefined();
    expect(AMBIENT_SOUNDS.has('enemyIdle')).toBe(false);
  });
});

describe('playTone plays notes', () => {
  // The first oscillator playTone made, and the times it was given
  const toneOf = (made) => made.find((n) => n.kind === 'osc');
  const startOf = (osc) => osc.start.mock.calls[0][0];
  const startHzOf = (osc) => osc.frequency.setValueAtTime.mock.calls[0][0];

  it("plays its preset's note at the hum's root and drift, with no random detune at the middle draw", () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { audio, made } = gameAudio();
    audio.playSound('gruntHit');
    expect(startHzOf(toneOf(made))).toBeCloseTo(
      hz(SOUND_CONFIG.gruntHit.note, 2),
      6
    );
  });

  it('a random detune of at most DETUNE_CENTS either way', () => {
    const cents = CONFIG.TONES.DETUNE_CENTS;
    expect(cents).toBeGreaterThan(0);
    const note = hz(SOUND_CONFIG.gruntHit.note, 2);
    for (const [draw, sign] of [
      [0, -1],
      [0.9999, 1],
    ]) {
      vi.spyOn(Math, 'random').mockReturnValue(draw);
      const { audio, made } = gameAudio();
      audio.playSound('gruntHit');
      const ratio = startHzOf(toneOf(made)) / note;
      expect(1200 * Math.log2(ratio)).toBeCloseTo(sign * cents, 1);
      vi.restoreAllMocks();
    }
  });

  it('DETUNE_CENTS sets how wide the detune goes', () => {
    const saved = CONFIG.TONES.DETUNE_CENTS;
    const note = hz(SOUND_CONFIG.gruntHit.note, 2);
    try {
      CONFIG.TONES.DETUNE_CENTS = 20;
      for (const [draw, sign] of [
        [0, -1],
        [0.9999, 1],
      ]) {
        vi.spyOn(Math, 'random').mockReturnValue(draw);
        const { audio, made } = gameAudio();
        audio.playSound('gruntHit');
        const ratio = startHzOf(toneOf(made)) / note;
        expect(1200 * Math.log2(ratio)).toBeCloseTo(sign * 20, 1);
        vi.restoreAllMocks();
      }
    } finally {
      CONFIG.TONES.DETUNE_CENTS = saved;
    }
  });

  it('starts up to 5 ms late, and the whole envelope with it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9999);
    for (const name of ['tankHit', 'stabberHit']) {
      const { audio, made } = gameAudio();
      audio.playSound(name);
      const osc = toneOf(made);
      const late = startOf(osc) - 2;
      expect(late, name).toBeGreaterThan(0.00499);
      expect(late, name).toBeLessThanOrEqual(0.005);
      const gain = made.find((n) => n.kind === 'gain');
      expect(gain.gain.setValueAtTime, name).toHaveBeenCalledWith(
        0,
        startOf(osc)
      );
    }
  });

  it("copies started in one frame don't start together", () => {
    let i = 0;
    const draws = [0.1, 0.5, 0.5, 0.2, 0.9, 0.5, 0.5, 0.8];
    vi.spyOn(Math, 'random').mockImplementation(() => draws[i++ % 8]);
    const { audio, made } = gameAudio();
    audio.playSound('alienShoot');
    audio.playSound('alienShoot');
    const [a, b] = made.filter((n) => n.kind === 'osc');
    expect(startOf(a)).not.toBe(startOf(b));
    expect(startHzOf(a)).not.toBe(startHzOf(b));
  });

  it('a sweep ends on its note, with the same detune', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { audio, made } = gameAudio();
    audio.playSound('levelUp');
    const osc = toneOf(made);
    const [endHz] = osc.frequency.exponentialRampToValueAtTime.mock.calls[0];
    const cfg = SOUND_CONFIG.levelUp;
    expect(endHz / startHzOf(osc)).toBeCloseTo(
      hz(cfg.sweep.to, 2) / hz(cfg.note, 2),
      6
    );
  });

  it("the tank's arc rides 3% above his zap at both ends", () => {
    const ends = (name) => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const { audio, made } = gameAudio();
      audio.playSound(name);
      const osc = toneOf(made);
      const both = [
        startHzOf(osc),
        osc.frequency.exponentialRampToValueAtTime.mock.calls[0][0],
      ];
      vi.restoreAllMocks(); // also clears the fake's recorded calls
      return both;
    };
    const zap = ends('tankZap');
    const arc = ends('tankArc');
    expect(arc[0] / zap[0]).toBeCloseTo(1.03, 2);
    expect(arc[1] / zap[1]).toBeCloseTo(1.03, 2);
  });

  it('a note that cannot resolve (a bad root) logs an error once per sound, plays nothing and throws nothing', () => {
    const root = CONFIG.HUM.ROOT;
    // An error, not a warning: the browser tests fail on console errors
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      CONFIG.HUM.ROOT = 'H';
      const { audio, made } = gameAudio();
      expect(() => {
        audio.playSound('gruntHit');
        audio.playSound('gruntHit');
        audio.playSound('alienShoot');
      }).not.toThrow();
      expect(made).toHaveLength(0);
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      CONFIG.HUM.ROOT = root;
    }
  });
});
