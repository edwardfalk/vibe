import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  gruntPop,
  lastBreath,
  GRUNT_POP_SEC,
} from '../../js/audio/DeathSounds.js';
import { hz } from '../../js/audio/Harmony.js';
import { CONFIG } from '../../js/config.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { Audio } from '../../js/Audio.js';

const DEATHS = { ...CONFIG.DEATHS };
afterEach(() => {
  Object.assign(CONFIG.DEATHS, DEATHS);
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
    setTargetAtTime: vi.fn(),
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
    createBuffer: vi.fn((channels, length, rate) => {
      const data = new Float32Array(length);
      return { duration: length / rate, getChannelData: () => data };
    }),
  };
  return { ctx, made };
}
const noise = { duration: 1.6 };
const oscs = (made) => made.filter((n) => n.kind === 'osc');
const sources = (made) =>
  made.filter((n) => n.kind === 'osc' || n.kind === 'source');

describe("a grunt's pop", () => {
  it('whines down from above onto its note, with the drift at its own start', () => {
    const { ctx, made } = fakeAudio();
    const at = 7.31; // a strummed tone's own start
    gruntPop(
      ctx,
      {},
      { at, note: ['5', 5], noise, offset: 0.4, volume: 1, pan: 0 }
    );
    const f = hz(['5', 5], at);
    const whine = oscs(made).find((o) =>
      o.frequency.exponentialRampToValueAtTime.mock.calls.some(
        ([v]) => Math.abs(v - f) < 1e-9
      )
    );
    expect(whine).toBeDefined();
    expect(whine.frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(
      1.5 * f,
      9
    );
  });

  it('is over in GRUNT_POP_SEC, and lets go of every node once it ends', () => {
    const { ctx, made } = fakeAudio();
    gruntPop(
      ctx,
      {},
      { at: 3, note: ['b3', 5], noise, offset: 0, volume: 1, pan: 0 }
    );
    for (const s of sources(made)) {
      const [stop] = s.stop.mock.calls[0];
      expect(stop).toBeLessThanOrEqual(3 + GRUNT_POP_SEC + 0.05);
    }
    const last = sources(made).find((s) => s.onended);
    last.onended();
    for (const n of made) expect(n.disconnect).toHaveBeenCalled();
  });
});

describe("the Dude's last breath", () => {
  it('is a pad an octave under his note: saws on the root, a triangle on the fifth, a sine below, gliding down a whole tone', () => {
    const { ctx, made } = fakeAudio();
    lastBreath(ctx, {}, { at: 5, noise, volume: 1 });
    const voices = oscs(made).map((o) => [
      o.type,
      o.frequency.setValueAtTime.mock.calls[0][0],
      o.frequency.exponentialRampToValueAtTime.mock.calls[0][0],
    ]);
    const tone = 2 ** (-2 / 12);
    const expected = [
      ['sawtooth', hz(['1', 3], 5)],
      ['sawtooth', hz(['1', 3], 5)],
      ['triangle', hz(['5', 3], 5)],
      ['sine', hz(['1', 2], 5)],
    ];
    expect(voices).toHaveLength(4);
    // ...and lets go of every node once it ends
    const last = sources(made).find((s) => s.onended);
    last.onended();
    for (const n of made) expect(n.disconnect).toHaveBeenCalled();
    voices.forEach(([type, from, to], i) => {
      expect(type).toBe(expected[i][0]);
      expect(from).toBeCloseTo(expected[i][1], 9);
      expect(to).toBeCloseTo(expected[i][1] * tone, 9);
    });
  });
});

describe("the game's Audio plays them", () => {
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
      _pausedByGame: false,
      _resuming: false,
    });
    const busGain = () =>
      made.find((n) => n.kind === 'gain' && n.connect.mock.calls.length).gain
        .setValueAtTime.mock.calls[0][0];
    return { audio, made, busGain };
  }

  it('a pop at its volume knob, quieter and panned with distance, within its noise', () => {
    CONFIG.DEATHS.GRUNT_VOLUME = 2;
    const near = gameAudio();
    near.audio.playGruntPop(0, 0, 3, ['b3', 5], 1);
    expect(near.busGain()).toBeCloseTo(2, 9);
    // Into the effects' bus, so it mutes and ducks with them
    const nearPan = near.made.find((n) => n.kind === 'pan');
    expect(nearPan.connect).toHaveBeenCalledWith(near.audio.masterGain);
    const source = near.made.find((n) => n.kind === 'source');
    const [, offset] = source.start.mock.calls[0];
    expect(offset + GRUNT_POP_SEC).toBeLessThanOrEqual(
      SOUND_CONFIG.rusherCrash.duration
    );
    const far = gameAudio();
    far.audio.playGruntPop(600, 0, 3, ['b3', 5], 0.5);
    expect(far.busGain()).toBeLessThan(2);
    const pan = far.made.find((n) => n.kind === 'pan');
    expect(pan.pan.setValueAtTime.mock.calls[0][0]).toBeGreaterThan(0);
  });

  it('his last breath at its volume knob', () => {
    CONFIG.DEATHS.BREATH_VOLUME = 0.5;
    const { audio, made, busGain } = gameAudio();
    audio.playLastBreath(4);
    expect(busGain()).toBeCloseTo(0.5, 9);
    const pan = made.find((n) => n.kind === 'pan');
    expect(pan.connect).toHaveBeenCalledWith(audio.masterGain);
  });

  it('neither while a pause holds the sound', () => {
    const { audio, made } = gameAudio();
    audio._pausedByGame = true;
    audio.playGruntPop(0, 0, 3, ['b3', 5], 0.5);
    audio.playLastBreath(4);
    expect(made).toHaveLength(0);
  });
});
