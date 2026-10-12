import { describe, it, expect, vi, afterEach } from 'vitest';
import { Audio } from '../../js/Audio.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { fakeBuses } from './helpers/audioBuses.js';

afterEach(() => vi.restoreAllMocks());

// The game's Audio on a context where making any node throws, as a bad
// CONFIG.HUM.ROOT or a Web Audio error would, partway into a sound
function brokenAudio(enabled = true) {
  const ctx = new Proxy(
    { currentTime: 3, sampleRate: 48000, state: 'running' },
    {
      get: (t, k) =>
        k in t
          ? t[k]
          : () => {
              throw new Error(`broken ${String(k)}`);
            },
    }
  );
  return Object.assign(Object.create(Audio.prototype), {
    audioContext: ctx,
    initialized: true,
    enabled,
    initialize() {},
    sounds: { ...SOUND_CONFIG },
    player: { x: 0, y: 0 },
    buses: fakeBuses(),
    getContextValue: () => undefined, // no beat clock: now
    _pausedByGame: false,
    _resuming: false,
  });
}

const record = { style: 'shatter' };
// Every sound the game plays outside playSound, as it calls them
const DIRECT = {
  gruntPop: (a) => a.playGruntPop(10, 0, 3.1, [2, 1], 0.5),
  stabberStrings: (a) => a.playStabberStrings('pluck', 10, 0, { seed: 0.5 }),
  tankDeath: (a) => a.playTankDeath(10, 0, 3.1, {}, []),
  stabberDeath: (a) => a.playStabberDeath(10, 0, 3.1, record),
  plateClang: (a) => a.playPlateClang(10, 0),
  bombBang: (a) => a.playBombBang(10, 0),
  bombCloud: (a) => a.playBombCloud(10, 0, 0.5),
  lastBreath: (a) => a.playLastBreath(3.1),
};

describe('a sound that throws', () => {
  it.each(Object.keys(DIRECT))(
    '%s logs once and plays nothing; the game goes on',
    (name) => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const audio = brokenAudio();
      expect(() => DIRECT[name](audio)).not.toThrow();
      expect(() => DIRECT[name](audio)).not.toThrow();
      expect(error).toHaveBeenCalledTimes(1);
    }
  );

  it('a sound with a handle gives none', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const audio = brokenAudio();
    expect(DIRECT.stabberStrings(audio)).toBe(null);
    expect(DIRECT.bombCloud(audio)).toBe(null);
  });
});

describe("the bomb's bang gives the tank it kills its time", () => {
  it('when it throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(DIRECT.bombBang(brokenAudio())).toBe(3);
  });

  it('when muted: he dies with the bang he would hear', () => {
    expect(DIRECT.bombBang(brokenAudio(false))).toBe(3);
  });

  it('but not before the game has its audio', () => {
    const audio = brokenAudio();
    audio.audioContext = null;
    audio.enabled = false;
    expect(DIRECT.bombBang(audio)).toBe(null);
  });
});

describe('where a sound is, heard from the hero (placement)', () => {
  const audio = Object.assign(Object.create(Audio.prototype), {
    player: { x: 100, y: 50 },
  });

  it('one with no position, or a broken one, is beside him: full and centred', () => {
    for (const [x, y] of [
      [null, null],
      [undefined, undefined],
      [NaN, 0],
      [0, Infinity],
    ]) {
      expect(audio.placement(x, y)).toEqual({ near: 1, pan: 0, far: 0 });
    }
  });

  it('quieter, panned and further with distance, to its floor at 600 px', () => {
    const half = audio.placement(400, 50); // 300 px to his right
    expect(half.far).toBeCloseTo(0.5, 12);
    expect(half.near).toBeCloseTo(0.7, 12);
    expect(half.pan).toBeCloseTo(0.75, 12);
    const beyond = audio.placement(100, 50 + 900);
    expect(beyond).toEqual({ near: 0.4, pan: 0, far: 1 });
  });
});
