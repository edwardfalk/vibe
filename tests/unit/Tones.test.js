import { describe, it, expect, vi, afterEach } from 'vitest';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { AMBIENT_SOUNDS } from '../../js/audio/AmbientSoundProfile.js';
import { crashNoise } from '../../js/audio/CrashSynth.js';
import { Audio } from '../../js/Audio.js';

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
        2
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
