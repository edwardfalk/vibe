// Sounds on the beat: a sound played in the frame after its eighth starts on
// it, because the game runs a lead ahead of the audio (the beat-lead spec,
// section 2)
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Audio, SNAP_SEC } from '../../js/Audio.js';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { CONFIG } from '../../js/config.js';
import { hz } from '../../js/audio/Harmony.js';
import { EnemyDeathHandler } from '../../js/systems/combat/EnemyDeathHandler.js';
import { plantBomb, updateBombs } from '../../js/systems/BombSystem.js';
import { Tank } from '../../js/entities/Tank.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { tankWorld } from './helpers/tankWorld.js';

const DEFAULT_AHEAD_MS = CONFIG.BEAT_CLOCK.AHEAD_MS;
const AHEAD = 0.025;
const SPREAD = 0.005; // MAX_START_OFFSET_SEC: copies start up to this late

afterEach(() => {
  CONFIG.BEAT_CLOCK.AHEAD_MS = DEFAULT_AHEAD_MS;
  vi.restoreAllMocks();
});

// A Web Audio stand-in at 48 kHz (a render quantum is 2.7 ms) that records
// the nodes a sound makes
function fakeContext() {
  const made = [];
  const param = () => ({
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
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
    currentTime: 0,
    sampleRate: 48000,
    state: 'running',
    createStereoPanner: () => node('pan', { pan: param() }),
    createBiquadFilter: () =>
      node('filter', { frequency: param(), Q: param(), gain: param() }),
    createGain: () => node('gain', { gain: param() }),
    createOscillator: () =>
      node('osc', { frequency: param(), detune: param() }),
    createBufferSource: () =>
      node('source', { playbackRate: param(), detune: param() }),
    createConstantSource: () => node('constant', { offset: param() }),
    createWaveShaper: () => node('shaper'),
    createConvolver: () => node('convolver'),
    createBuffer: vi.fn((_channels, length) => {
      const data = new Float32Array(length);
      return { duration: length / 48000, getChannelData: () => data };
    }),
  };
  return { ctx, made };
}

// The game's Audio on the stand-in, the hero at (0, 0), with a real beat
// clock on the same context running AHEAD ahead of it: its eighths are at
// clock times k × 0.25 s. `game(t)` sets the game's now to t
function ledAudio({ ahead = AHEAD, otherClock = false } = {}) {
  CONFIG.BEAT_CLOCK.AHEAD_MS = ahead * 1000;
  const { ctx, made } = fakeContext();
  const clock = new BeatClock(120, otherClock ? { currentTime: 0 } : ctx);
  clock.startTime = 0;
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
  const game = (t) => {
    ctx.currentTime = t - ahead;
    return audio;
  };
  return { audio, ctx, made, clock, game };
}

describe('a sound played now starts on its eighth when it can', () => {
  it('in the frame after its eighth: on it, told that eighth', () => {
    const { game } = ledAudio();
    const t = game(3.01).beatTiming(); // 10 ms after eighth 12, at 3 s
    expect(t.at).toBe(3);
    expect(t.eighth).toBe(12);
    expect(t.now).toBeCloseTo(2.985, 9);
  });

  it('up to one lead, less a render quantum, after it: still on it', () => {
    const { game } = ledAudio();
    expect(game(3.022).beatTiming().at).toBe(3); // 3 ms ahead of the audio
    const late = game(3.023).beatTiming(); // 2 ms: inside one quantum
    expect(late.at).toBeCloseTo(2.998, 9);
  });

  it('a later one plays now, told the nearest eighth', () => {
    const { game } = ledAudio();
    const t = game(3.2).beatTiming(); // after eighth 12, nearer 13
    expect(t.at).toBeCloseTo(3.175, 9);
    expect(t.eighth).toBe(13);
  });

  it('one 230 ms late plays now, not on the next eighth', () => {
    const { game } = ledAudio();
    // The next eighth, 3.25 s, is 45 ms ahead of the audio: it isn't his
    expect(game(3.23).beatTiming().at).toBeCloseTo(3.205, 9);
  });

  it("the hero's early window books an eighth just ahead of the game", () => {
    const { game } = ledAudio();
    expect(game(2.995).beatTiming({ early: SNAP_SEC }).at).toBe(3);
    expect(game(2.995).beatTiming().at).toBeCloseTo(2.97, 9);
  });

  it('at lead 0 nothing books; the early window books as the hero did', () => {
    const { game } = ledAudio({ ahead: 0 });
    expect(game(3.001).beatTiming().at).toBe(3.001);
    expect(game(2.999).beatTiming().at).toBe(2.999);
    expect(game(2.99).beatTiming({ early: SNAP_SEC }).at).toBe(3);
    expect(game(2.96).beatTiming({ early: SNAP_SEC }).at).toBe(2.96);
  });

  it('a beat clock on another AudioContext books nothing', () => {
    const { game } = ledAudio({ otherClock: true });
    expect(game(3.01).beatTiming().at).toBeCloseTo(2.985, 9);
  });
});

describe("the hero's shot", () => {
  // The hero marks each shot held or not (Player.fireBullet)
  const hero = (held) => {
    const w = ledAudio();
    w.audio.player.shotHeld = held;
    return w;
  };

  // 45 ms before the heard eighth at 3 s: 20 ms before it on the game's clock
  it('held fire books its eighth up to SNAP_SEC ahead of the game', () => {
    expect(hero(true).game(2.98).heroShotTiming().at).toBe(3);
  });

  it("the first shot of a press never waits more than SNAP_SEC from the audio's now", () => {
    expect(hero(false).game(2.98).heroShotTiming().at).toBeCloseTo(2.955, 9);
    // 20 ms before the heard eighth: within SNAP_SEC, so on it
    expect(hero(false).game(3.005).heroShotTiming().at).toBe(3);
  });

  it('a rapid tap, 300 ms after the last shot, is a first shot all the same', () => {
    const { audio, game } = hero(false);
    audio._heroRun = { at: 2.655, n: 0 }; // inside RUN_GAP_BEATS: one run
    expect(game(2.98).heroShotTiming().at).toBeCloseTo(2.955, 9);
  });

  it('a shot with no mark is taken as a first shot', () => {
    expect(hero(undefined).game(2.98).heroShotTiming().at).toBeCloseTo(
      2.955,
      9
    );
  });
});

describe('every beat sound books on its eighth through playSound', () => {
  // Each with what its creature passes (the spec's table)
  it.each([
    ['alienShoot', { note: ['b3', 5], seed: 0.3 }],
    ['gruntChatter', { voice: 'whine', seed: 0.3 }],
    ['gruntAdvance', {}],
    ['gruntRetreat', {}],
    ['tankShot', { seed: 0.3 }],
    ['tankCharge', { step: 0, steps: 8, seed: 0.3 }],
    ['tankShove', {}],
    ['rusherCharge', {}],
    ['rusherFuse', { left: 2, seed: 0.3 }],
    ['rusherCrash', {}],
    ['gruntResponse', { at: 3 }],
    ['tankResponse', { at: 3 }],
    ['stabberResponse', { at: 3 }],
    ['rusherResponse', { at: 3 }],
    ['shieldUp', {}],
    ['gameOver', {}],
  ])('%s', (name, opts) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { made, game } = ledAudio();
    game(3.01).playSound(name, 100, 0, opts);
    expect(error).not.toHaveBeenCalled();
    // Not the 2 Hz wobble of a tone's tremolo, which stays on now
    const lfo = (n) =>
      n.kind === 'osc' && n.frequency.setValueAtTime.mock.calls[0]?.[0] < 20;
    const starts = made
      .filter((n) => n.start.mock.calls.length && !lfo(n))
      .map((n) => n.start.mock.calls[0][0]);
    expect(starts.length).toBeGreaterThan(0);
    for (const t of starts) {
      expect(t).toBeGreaterThanOrEqual(3);
      expect(t).toBeLessThanOrEqual(3 + SPREAD);
    }
  });

  it('a sound later than the lead after its eighth plays now', () => {
    const { made, game } = ledAudio();
    game(3.05).playSound('gruntAdvance', 100, 0);
    const [osc] = made.filter((n) => n.kind === 'osc');
    const start = osc.start.mock.calls[0][0];
    expect(start).toBeGreaterThanOrEqual(3.025);
    expect(start).toBeLessThanOrEqual(3.025 + SPREAD);
  });

  // Only the hero's shot has an early window: a sound just before its
  // eighth on the game's clock belongs to the eighth before, long past
  it.each([['gruntAdvance'], ['alienShoot']])(
    '%s just before its eighth plays now, not on it',
    (name) => {
      const { made, game } = ledAudio();
      game(2.995).playSound(name, 100, 0, { note: ['b3', 5], seed: 0.3 });
      const [osc] = made.filter((n) => n.kind === 'osc');
      const start = osc.start.mock.calls[0][0];
      expect(start).toBeGreaterThanOrEqual(2.97);
      expect(start).toBeLessThanOrEqual(2.97 + SPREAD);
    }
  );

  it("a tone's pitch is read at its booked start, before its spread", () => {
    // The hum's drift moves every pitch: it is read where the tone starts
    const { made, game } = ledAudio();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5); // no detune
    game(3.01).playSound('gruntAdvance', 100, 0);
    random.mockRestore();
    const [osc] = made.filter((n) => n.kind === 'osc');
    const [f, at] = osc.frequency.setValueAtTime.mock.calls[0];
    expect(f).toBe(hz(['b3', 4], 3));
    expect(hz(['b3', 4], 3)).not.toBe(hz(['b3', 4], 2.985));
    expect(at).toBeCloseTo(3 + SPREAD / 2, 9);
  });

  // A neighbour's answer to a death aims at an eighth (BaseEnemy.onNearbyDeath)
  const answerStart = (ahead, t) => {
    const { made, game } = ledAudio({ ahead });
    game(t).playSound('gruntResponse', 100, 0, { at: 3 });
    const [osc] = made.filter((n) => n.kind === 'osc');
    return osc.start.mock.calls[0][0];
  };

  it("a neighbour's answer whose timer wakes just before its eighth still lands on it", () => {
    const start = answerStart(AHEAD, 2.995);
    expect(start).toBeGreaterThanOrEqual(3);
    expect(start).toBeLessThanOrEqual(3 + SPREAD);
  });

  it('an answer whose timer wakes late plays at once, not on the next eighth', () => {
    // At 3.23 the next eighth, 3.25, is 45 ms ahead of the audio: not its own
    const start = answerStart(AHEAD, 3.23);
    expect(start).toBeGreaterThanOrEqual(3.205);
    expect(start).toBeLessThanOrEqual(3.205 + SPREAD);
  });

  it('at lead 0 an answer books only when its timer wakes a render quantum or more before its eighth', () => {
    expect(answerStart(0, 2.99)).toBeGreaterThanOrEqual(3);
    const late = answerStart(0, 3.001);
    expect(late).toBeGreaterThanOrEqual(3.001);
    expect(late).toBeLessThanOrEqual(3.001 + SPREAD);
    const close = answerStart(0, 2.999); // 1 ms ahead: inside one quantum
    expect(close).toBeGreaterThanOrEqual(2.999);
    expect(close).toBeLessThanOrEqual(2.999 + SPREAD);
  });
});

describe('the sounds outside playSound book on their eighth too', () => {
  const starts = (made) =>
    made
      .filter((n) => n.start.mock.calls.length)
      .map((n) => n.start.mock.calls[0][0]);

  it.each([['tremolo'], ['stab'], ['screech'], ['pluck']])(
    "the stabber's %s",
    (part) => {
      const { audio, made, game } = ledAudio();
      game(3.01);
      audio.playStabberStrings(part, 100, 0, {
        untilSec: 0.49,
        beatSec: 0.5,
        seed: 0.3,
      });
      expect(Math.min(...starts(made))).toBe(3);
    }
  );

  it("the stabber's tremolo ends on the lock, however late it starts", () => {
    // Played 10 ms after its eighth, the lock 0.49 s on from the game's now
    const { audio, made, game } = ledAudio();
    game(3.01);
    audio.playStabberStrings('tremolo', 100, 0, { untilSec: 0.49, seed: 0.3 });
    const stops = made
      .filter((n) => n.stop.mock.calls.length)
      .map((n) => n.stop.mock.calls[0][0]);
    // Its sources stop TREM.STOP_SEC (30 ms) after the lock, at 3.5 s
    for (const t of stops) expect(t).toBeCloseTo(3.53, 9);
  });

  // A hit before the lock, or a death, cuts it (Stabber.daze, silence)
  const cutAt = (now) => {
    const { audio, ctx, made, game } = ledAudio();
    game(3.01); // booked on its eighth, at 3
    const handle = audio.playStabberStrings('tremolo', 100, 0, {
      untilSec: 0.49,
      seed: 0.3,
    });
    ctx.currentTime = now;
    handle.stop();
    return made;
  };

  it("the stabber's tremolo, cut over 20 ms before it starts, never sounds", () => {
    const made = cutAt(2.97);
    for (const n of made.filter((m) => m.stop.mock.calls.length)) {
      const [last] = n.stop.mock.calls.at(-1);
      expect(last).toBeLessThanOrEqual(n.start.mock.calls[0][0]);
    }
  });

  it('cut nearer its start, it fades, and its booked start cannot reopen it', () => {
    // This thread's clock trails the audio thread's: it may have begun
    const made = cutAt(2.99);
    const cleared = made.filter(
      (n) => n.kind === 'gain' && n.gain.cancelScheduledValues.mock.calls.length
    );
    expect(cleared).toHaveLength(1);
    const [cut] = cleared;
    expect(cut.gain.cancelScheduledValues).toHaveBeenCalledWith(2.99);
    const [to, by] = cut.gain.linearRampToValueAtTime.mock.calls.at(-1);
    expect(to).toBe(0);
    expect(by).toBeCloseTo(2.99 + 0.015, 9);
    for (const n of made.filter((m) => m.stop.mock.calls.length)) {
      expect(n.stop.mock.calls.at(-1)[0]).toBeCloseTo(2.99 + 0.035, 9);
    }
  });

  it("the bomb's bang, which hands back its start, and its cloud", () => {
    const { audio, made, game } = ledAudio();
    expect(game(3.01).playBombBang(100, 0)).toBe(3);
    expect(Math.min(...starts(made))).toBe(3);
    made.length = 0;
    audio.playBombCloud(100, 0, 0.3);
    expect(Math.min(...starts(made))).toBe(3);
  });

  it("a tank's plate breaking", () => {
    const { audio, made, game } = ledAudio();
    game(3.01);
    audio.playPlateClang(100, 0);
    expect(Math.min(...starts(made))).toBe(3);
  });
});

describe('a tank the bomb kills dies with the bang', () => {
  it('the bomb hands its bang start to the kill', () => {
    const w = tankWorld({ hero: { x: 9999, y: 0 } });
    const tank = w.tank();
    w.at(4000);
    plantBomb(w.values.activeBombs, tank, w.clock);
    const enemyDeathHandler = { handleEnemyDeath: vi.fn() };
    const audio = { playBombBang: vi.fn(() => 12.5) };
    for (let ms = 4000; w.values.activeBombs.length && ms < 20000; ms += 100) {
      w.at(ms);
      updateBombs({
        activeBombs: w.values.activeBombs,
        enemies: [tank],
        explosionManager: {
          addExplosion() {},
          addBombBlast() {},
          addBombCloud() {},
        },
        enemyDeathHandler,
        audio,
        beatClock: w.clock,
      });
    }
    expect(audio.playBombBang).toHaveBeenCalledTimes(1);
    const [[enemy, , , , blow]] = enemyDeathHandler.handleEnemyDeath.mock.calls;
    expect(enemy).toBe(tank);
    expect(blow.at).toBe(12.5);
  });

  it('his air starts at that start, not when the game saw him die', () => {
    CONFIG.BEAT_CLOCK.AHEAD_MS = 25;
    const ctx = { currentTime: 2.985, baseLatency: 0, outputLatency: 0 };
    const clock = new BeatClock(120, ctx);
    clock.startTime = 0;
    const audio = {
      audioContext: ctx,
      playTankDeath: vi.fn(),
      playSound: vi.fn(),
      ensureAudioContext: vi.fn(),
    };
    const values = {
      beatClock: clock,
      audio,
      explosionManager: { fragmentExplosions: [] },
      cameraSystem: { addShake: vi.fn() },
    };
    const handler = new EnemyDeathHandler({ get: (k) => values[k] });
    const tank = new Tank(
      0,
      0,
      'tank',
      { context: { get: () => clock } },
      createMockP5(),
      null
    );
    tank.isSpawning = false;
    tank.turn = { from: 0, to: 0, at: null };
    tank.poseBeats = 6;
    handler.handleEnemyDeath(tank, 'tank', 0, 0, {
      dir: 0,
      blast: true,
      bomb: true,
      at: 3,
    });
    const [, , at] = audio.playTankDeath.mock.calls[0];
    expect(at).toBe(3); // not the game's now, 3.01
    // and he is seen to start dying as the bang is heard
    const [death] = values.explosionManager.fragmentExplosions;
    expect(death.startsAt).toBeCloseTo(
      3 + CONFIG.SKY.OFFSET_MS / 1000 + 0.025,
      9
    );
  });
});
