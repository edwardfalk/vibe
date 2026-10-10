import { describe, it, expect, vi, afterEach } from 'vitest';
import { Audio } from '../../js/Audio.js';
import { CONFIG } from '../../js/config.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { AMBIENT_SOUNDS } from '../../js/audio/AmbientSoundProfile.js';
import { STRING_PARTS } from '../../js/audio/StabberStrings.js';
import { airTiming, airDarts } from '../../js/entities/TankDeath.js';

const MIX = { ...CONFIG.MIX };
afterEach(() => {
  Object.assign(CONFIG.MIX, MIX);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const dB = (d) => 10 ** (d / 20);

// The game's Audio with its three buses, sound on, a beat track to hear
// what the mix tells it
function mixedAudio() {
  const gain = () => ({ gain: { value: 1 } });
  const beatTrack = { setVolume: vi.fn() };
  vi.stubGlobal('window', { beatTrack });
  const audio = Object.assign(Object.create(Audio.prototype), {
    enabled: true,
    masterGain: gain(),
    buses: { drums: gain(), band: gain(), feedback: gain() },
    voicebox: null,
  });
  return { audio, beatTrack };
}

describe("the mix's three groups", () => {
  it('each bus plays at its own knob, live', () => {
    const { audio } = mixedAudio();
    Object.assign(CONFIG.MIX, { DRUMS_DB: -3, BAND_DB: 2.5, FEEDBACK_DB: -7 });
    audio.applyMix();
    expect(audio.buses.drums.gain.value).toBeCloseTo(dB(-3), 9);
    expect(audio.buses.band.gain.value).toBeCloseTo(dB(2.5), 9);
    expect(audio.buses.feedback.gain.value).toBeCloseTo(dB(-7), 9);
    CONFIG.MIX.BAND_DB = -1.5;
    audio.applyMix();
    expect(audio.buses.band.gain.value).toBeCloseTo(dB(-1.5), 9);
  });

  it('mute stays on masterGain, so a muted bus keeps its level for unmuting', () => {
    const { audio } = mixedAudio();
    CONFIG.MIX.FEEDBACK_DB = -4;
    audio.enabled = false;
    audio.applyMix();
    expect(audio.masterGain.gain.value).toBe(0);
    expect(audio.buses.feedback.gain.value).toBeCloseTo(dB(-4), 9);
  });

  it('the drums knob leaves the kick on its own knob', () => {
    const { audio, beatTrack } = mixedAudio();
    CONFIG.MIX.DRUMS_DB = -6;
    audio.applyMix();
    expect(beatTrack.setVolume).toHaveBeenCalledWith(
      CONFIG.MIX.BEAT_TRACK_VOLUME
    );
  });

  it('start at 0 dB, so the groups play as levelled', () => {
    expect([MIX.DRUMS_DB, MIX.BAND_DB, MIX.FEEDBACK_DB]).toEqual([0, 0, 0]);
  });
});

// The spec's groups (docs/superpowers/specs/2026-10-10-mix-pass-design.md);
// every other preset is feedback
const DRUMS = ['playerShoot', 'rusherCrash'];
const BAND = [
  'alienShoot',
  'tankShot',
  'tankCharge',
  'gruntChatter',
  'rusherFuse',
  'rusherCharge',
  'gruntAdvance',
  'gruntRetreat',
  'gruntResponse',
  'tankResponse',
  'stabberResponse',
  'rusherResponse',
];
const groupOf = (name) =>
  DRUMS.includes(name) ? 'drums' : BAND.includes(name) ? 'band' : 'feedback';

// A Web Audio stand-in whose every node records what it connects to; any
// param or method a sound reaches for is there
function recordingContext() {
  const made = [];
  const param = () =>
    new Proxy({ value: 1 }, { get: (t, k) => (k in t ? t[k] : () => {}) });
  const node = (kind) => {
    const n = { kind, to: [] };
    n.connect = (d) => (n.to.push(d), d);
    return new Proxy(n, {
      get(t, k) {
        if (k in t) return t[k];
        if (['disconnect', 'start', 'stop'].includes(k)) return () => {};
        return typeof k === 'string' ? (t[k] = param()) : undefined;
      },
    });
  };
  const ctx = new Proxy(
    { currentTime: 2, sampleRate: 8000, state: 'running' },
    {
      get(t, k) {
        if (k in t) return t[k];
        if (k === 'createBuffer') {
          return (channels, length, rate) => {
            const data = new Float32Array(length);
            return { duration: length / rate, getChannelData: () => data };
          };
        }
        if (typeof k === 'string' && k.startsWith('create')) {
          return () => {
            const n = node(k.slice('create'.length));
            made.push(n);
            return n;
          };
        }
        return undefined;
      },
    }
  );
  return { ctx, made, node };
}

// The game's Audio on that stand-in, with its buses and shared reverb
function routedAudio() {
  const { ctx, made, node } = recordingContext();
  const buses = {
    drums: node('drums'),
    band: node('band'),
    feedback: node('feedback'),
  };
  const audio = Object.assign(Object.create(Audio.prototype), {
    audioContext: ctx,
    initialized: true,
    enabled: true,
    initialize() {},
    sounds: { ...SOUND_CONFIG },
    player: { x: 0, y: 0 },
    masterGain: node('master'),
    buses,
    effects: { reverb: ctx.createConvolver() },
    ambientDistortionCurve: new Float32Array(2),
    context: null,
    getContextValue: () => undefined,
    _pausedByGame: false,
    _resuming: false,
  });
  // Where the sound's nodes lead: the buses and masterGain they reach
  const reached = () => {
    const ends = new Set();
    for (const n of made) {
      for (const d of n.to) {
        if (d === audio.masterGain) ends.add('masterGain');
        for (const [group, bus] of Object.entries(buses)) {
          if (d === bus) ends.add(group);
        }
      }
    }
    return [...ends];
  };
  return { audio, made, reached };
}

// What each synth preset needs from its caller (Grunt, Tank, Rusher)
const OPTS = {
  alienShoot: { note: ['b3', 5], seed: 0.3 },
  tankShot: { seed: 0.3 },
  tankCharge: { step: 2, steps: 8, seed: 0.3 },
  gruntChatter: { voice: 'whine', seed: 0.3 },
  rusherFuse: { left: 2, seed: 0.3 },
};

describe('every sound plays in its group', () => {
  it("every preset reaches its own group's bus, and no other way out", () => {
    const error = vi.spyOn(console, 'error');
    for (const [name, config] of Object.entries(SOUND_CONFIG)) {
      const { audio, reached } = routedAudio();
      const opts = config.hit ? { health: 5, maxHealth: 10 } : OPTS[name];
      audio.playSound(name, 10, 20, opts ?? null);
      expect(error, name).not.toHaveBeenCalled();
      expect(reached(), name).toEqual([groupOf(name)]);
    }
  });

  it("the ambient sounds' shared reverb leads only to the band's bus, and every ambient sound is band", () => {
    const { audio } = routedAudio();
    audio.createEffects();
    for (const name of AMBIENT_SOUNDS) {
      expect(SOUND_CONFIG[name].group, name).toBe('band');
      audio.playSound(name, 300, 0);
      audio.playSound(name, 300, 0);
    }
    expect(audio.effects.reverb.to).toEqual([audio.buses.band]);
  });

  it("every direct sound reaches its own group's bus, and no other way out", () => {
    const timing = airTiming(CONFIG.DEATHS.TANK_ZIP_SEC);
    const direct = {
      gruntPop: [
        'feedback',
        (a) => a.playGruntPop(10, 20, 2.1, ['b3', 4], 0.3),
      ],
      tankDeath: [
        'feedback',
        (a) => a.playTankDeath(10, 20, 2.1, timing, airDarts(timing, 0.5)),
      ],
      plateClang: ['feedback', (a) => a.playPlateClang(10, 20)],
      bombBang: ['feedback', (a) => a.playBombBang(10, 20)],
      bombCloud: ['feedback', (a) => a.playBombCloud(10, 20, 0.4)],
      lastBreath: ['feedback', (a) => a.playLastBreath(2.1)],
    };
    for (const part of Object.keys(STRING_PARTS)) {
      direct[part] = [
        'band',
        (a) =>
          a.playStabberStrings(part, 10, 20, {
            seed: 0.3,
            untilSec: 0.4,
            beatSec: 0.5,
          }),
      ];
    }
    for (const [name, [group, play]] of Object.entries(direct)) {
      const { audio, reached } = routedAudio();
      play(audio);
      expect(reached(), name).toEqual([group]);
    }
  });

  it('a group that is none of the three throws before any node is made, and logs', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const config of [
      { ...SOUND_CONFIG.levelUp, group: 'feedbak' },
      { ...SOUND_CONFIG.playerShoot, group: 'drum' },
      { ...SOUND_CONFIG.levelUp, group: undefined },
    ]) {
      const { audio, made } = routedAudio();
      const before = made.length;
      audio.sounds.odd = config;
      audio.playSound('odd');
      expect(made.length, config.group).toBe(before);
      expect(error, config.group).toHaveBeenCalledTimes(1);
      error.mockClear();
    }
  });
});
