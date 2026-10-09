import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { Tank } from '../../js/entities/Tank.js';
import {
  TankDeath,
  AIR,
  airTiming,
  airDarts,
} from '../../js/entities/TankDeath.js';
import { tankParts } from '../../js/entities/TankRenderer.js';
import {
  EnemyDeathHandler,
  popTime,
} from '../../js/systems/combat/EnemyDeathHandler.js';
import { CollisionSystem } from '../../js/systems/CollisionSystem.js';
import { Bullet } from '../../js/entities/bullet.js';
import { tankAir, plateClang } from '../../js/audio/DeathSounds.js';
import { hz } from '../../js/audio/Harmony.js';
import { Audio } from '../../js/Audio.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { transformP5 } from './helpers/transformP5.js';
import { tankWorld } from './helpers/tankWorld.js';

const DEATHS = { ...CONFIG.DEATHS };
afterEach(() => {
  Object.assign(CONFIG.DEATHS, DEATHS);
  vi.restoreAllMocks();
});

// A tank posed at a beat position, without updating it (as TankLook.test.js)
const tankAt = (beats = 18, facing = 0) => {
  const clock = { getBeatPosition: () => beats, beatInterval: 500 };
  const context = { get: (k) => (k === 'beatClock' ? clock : undefined) };
  const t = new Tank(0, 0, 'tank', { context }, createMockP5(), null);
  t.isSpawning = false;
  t.facing = facing;
  t.turn = { from: facing, to: facing, at: null };
  t.poseBeats = beats;
  return t;
};
const S = 50 * CONFIG.TANK_LOOK.ART_SCALE;
// A death whose audio clock we set; it started at 0
function deathAt(o = {}) {
  let clock = 0;
  const death = new TankDeath({
    x: 0,
    y: 0,
    size: S,
    pose: tankAt().pose(),
    dir: 0,
    seed: 0.37,
    diedAt: 0,
    startsAt: 0,
    now: () => clock,
    kickAge: () => 0.3,
    ...o,
  });
  return { death, at: (t) => (clock = t) };
}

// The beat clock on audio time: beat 0 at 0, an eighth every 0.25 s
const audioClock = (t) => ({
  startTime: 0,
  beatInterval: 500,
  nowSec: () => t,
  getBeatPosition: () => t / 0.5,
});
function deathWorld(t) {
  const audio = {
    audioContext: { baseLatency: 0.01, outputLatency: 0.02 },
    playTankDeath: vi.fn(),
    playSound: vi.fn(),
    ensureAudioContext: vi.fn(),
  };
  const explosionManager = {
    fragmentExplosions: [],
    addFragmentExplosion: vi.fn(),
  };
  const cameraSystem = { addShake: vi.fn() };
  const values = {
    beatClock: audioClock(t),
    audio,
    explosionManager,
    cameraSystem,
  };
  const handler = new EnemyDeathHandler({ get: (k) => values[k] });
  const tank = tankAt();
  tank.x = 40;
  tank.y = 60;
  const kill = (blow = null) =>
    handler.handleEnemyDeath(tank, 'tank', tank.x, tank.y, blow);
  return { audio, explosionManager, cameraSystem, kill, tank };
}

describe("when the tank's death starts", () => {
  it('with the bang, when the bomb killed him: at once, his sound now', () => {
    const w = deathWorld(1.13);
    w.kill({ dir: 0, blast: true, bomb: true });
    const [death] = w.explosionManager.fragmentExplosions;
    expect(death).toBeInstanceOf(TankDeath);
    expect(death.startsAt).toBeCloseTo(1.13 + 0.03, 9); // when it is heard
    const [x, y, at, timing, darts] = w.audio.playTankDeath.mock.calls[0];
    expect([x, y, at]).toEqual([40, 60, 1.13]);
    expect(timing).toBe(death.timing);
    expect(darts).toEqual(airDarts(death.timing, w.tank.lookSeed));
  });

  it('on the next eighth for any other kill (a shot, a cloud, a stab)', () => {
    const w = deathWorld(1.13);
    w.kill({ dir: 0 });
    const clock = audioClock(1.13);
    const at = popTime(1.13, clock);
    expect(at).toBeCloseTo(1.25, 9);
    expect(w.audio.playTankDeath.mock.calls[0][2]).toBeCloseTo(at, 9);
    w.kill({ dir: 0, blast: true }); // a cloud's or a rusher's blast
    expect(w.audio.playTankDeath.mock.calls[1][2]).toBeCloseTo(at, 9);
  });

  it('with no burst, no cloud, no old "oh no" and no extra explosion; a small shake', () => {
    const w = deathWorld(1.13);
    w.kill({ dir: 0 });
    expect(w.explosionManager.addFragmentExplosion).not.toHaveBeenCalled();
    const sounds = w.audio.playSound.mock.calls.map(([k]) => k);
    expect(sounds).not.toContain('tankOhNo');
    expect(sounds).not.toContain('explosion');
    expect(w.cameraSystem.addShake).toHaveBeenCalledWith(8, 15);
  });

  it('friendly fire that kills a tank adds no explosion of its own', () => {
    const w = tankWorld({ hero: { x: 9999, y: 0 } });
    const tank = w.tank(0, 0);
    tank.health = 1;
    const ball = Bullet.acquire(0, 0, 0, 2, 'enemy');
    ball.ownerId = 'a grunt';
    w.values.enemyBullets = [ball];
    const handleEnemyDeath = vi.fn();
    new CollisionSystem(w.context, {
      handleEnemyDeath,
    }).checkEnemyBulletsVsEnemies();
    expect(handleEnemyDeath).toHaveBeenCalled();
    const sounds = w.values.audio.playSound.mock.calls.map(([key]) => key);
    expect(sounds).not.toContain('explosion');
  });
});

describe('All air', () => {
  it('holds his last pose until it starts, then lives its course and is gone', () => {
    const { death, at } = deathAt({ startsAt: 0.2 });
    at(0.1);
    const before = transformP5();
    death.draw(before.p);
    const slab = before.shapes.find(
      (sh) => sh.kind === 'image' && sh.g === tankParts(before.p, S).slab.g
    );
    expect(slab).toBeDefined();
    const T = death.timing;
    const end =
      0.2 + T.done + AIR.LIMP_SEC * CONFIG.DEATHS.LINGER + AIR.FADE_SEC;
    at(end - 0.05);
    death.draw(transformP5().p);
    expect(death.active).toBe(true);
    at(end + 0.05);
    death.draw(transformP5().p);
    expect(death.active).toBe(false);
  });

  it('keeps the zip and linger he died with, whatever the sliders do after', () => {
    const born = () => {
      CONFIG.DEATHS.TANK_ZIP_SEC = 0.7;
      CONFIG.DEATHS.LINGER = 1.5;
    };
    const moved = () => {
      CONFIG.DEATHS.TANK_ZIP_SEC = 1.8;
      CONFIG.DEATHS.LINGER = 0.5;
    };
    born();
    const kept = deathAt();
    const still = deathAt();
    // What a death draws at t, its sprites named by their part, not by object
    const drawn = ({ death, at }, t) => {
      at(t);
      const r = transformP5();
      death.draw(r.p);
      return {
        shapes: r.shapes.map(({ g, ...rest }) => ({ ...rest, g: !!g })),
        calls: r.calls,
        active: death.active,
      };
    };
    // One drawn with the sliders moved, one with them where he died
    for (const t of [0.4, 0.9, 1.5, 2.4, 3.6]) {
      moved();
      const a = drawn(kept, t);
      born();
      const b = drawn(still, t);
      expect(a).toEqual(b);
    }
    expect(kept.death.timing.sec).toBe(0.7);
    expect(kept.death.linger).toBe(1.5);
  });

  it('a zip at either end of its slider, or past it, still makes a whole death and a whole squeal', () => {
    expect(airTiming(0.1).sec).toBe(AIR.ZIP_MIN_SEC);
    expect(airTiming(9).sec).toBe(AIR.ZIP_MAX_SEC);
    // A death made with the slider past its range (a hand-edited config) too
    CONFIG.DEATHS.TANK_ZIP_SEC = 0.1;
    expect(deathAt().death.timing.sec).toBe(AIR.ZIP_MIN_SEC);
    for (const zip of [AIR.ZIP_MIN_SEC, AIR.ZIP_MAX_SEC]) {
      CONFIG.DEATHS.TANK_ZIP_SEC = zip;
      const { death, at } = deathAt();
      for (let t = 0; t < 6; t += 0.05) {
        at(t);
        const r = transformP5();
        death.draw(r.p);
        for (const sh of r.shapes) {
          expect(Number.isFinite(sh.matrix?.[4] ?? sh.centre?.[0] ?? 0)).toBe(
            true
          );
        }
      }
      expect(death.active).toBe(false);
      // The squeal's slides go forward in time
      const { ctx, made } = fakeAudio();
      tankAir(
        ctx,
        { kind: 'bus' },
        {
          at: 1,
          note: ['1', 2],
          noise: { duration: 2 },
          volume: 1,
          pan: 0,
          timing: death.timing,
          darts: airDarts(death.timing, 0.37),
        }
      );
      // The hiss's noise lasts as long as its envelope, however long the zip
      const hiss = made.find((n) => n.kind === 'source');
      const [from, offset] = hiss.start.mock.calls[0];
      const until = hiss.stop.mock.calls[0][0];
      expect(hiss.loop || 2 - offset >= until - from).toBe(true);
      const square = made.find((n) => n.type === 'square');
      const times =
        square.frequency.exponentialRampToValueAtTime.mock.calls.map(
          ([, t]) => t
        );
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThan(times[i - 1]);
      }
      for (const g of made.filter((n) => n.kind === 'gain')) {
        const calls = [
          ...g.gain.setValueAtTime.mock.calls,
          ...g.gain.exponentialRampToValueAtTime.mock.calls,
        ];
        for (const [v, t] of calls) {
          expect(Number.isFinite(v)).toBe(true);
          expect(Number.isFinite(t)).toBe(true);
        }
      }
    }
  });

  it('his shades and chain glint on the heard kick, not on his own clock', () => {
    const glintsAt = (kickAge) => {
      const { death, at } = deathAt({ kickAge: () => kickAge });
      at(0.8); // well after they were blown off
      const r = transformP5();
      death.draw(r.p);
      return r.calls.filter(
        ([k, red, green, blue, a]) =>
          k === 'fill' &&
          red === 255 &&
          green === 255 &&
          blue === 255 &&
          a > 200
      ).length;
    };
    expect(glintsAt(0)).toBeGreaterThan(0);
    expect(glintsAt(0.3)).toBe(0);
  });
});

// A Web Audio stand-in that records the nodes it makes (as DeathSounds.test.js)
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
    currentTime: 3,
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

describe("the tank's air (his death's sound)", () => {
  it("squeals down onto the root, jumping on each of the picture's darts", () => {
    const { ctx, made } = fakeAudio();
    const timing = airTiming(0.95);
    const darts = airDarts(timing, 0.37);
    const at = 2;
    tankAir(
      ctx,
      { kind: 'bus' },
      {
        at,
        note: ['1', 2],
        noise: { duration: 2 },
        volume: 1,
        pan: 0,
        timing,
        darts,
      }
    );
    const square = made.find((n) => n.type === 'square');
    const ramps = square.frequency.exponentialRampToValueAtTime.mock.calls;
    expect(ramps.at(-1)[0]).toBeCloseTo(hz(['1', 2], at), 6);
    const jumps = square.detune.linearRampToValueAtTime.mock.calls.filter(
      ([cents]) => cents > 0
    );
    expect(jumps.map(([, t]) => t)).toEqual(darts.map((d) => at + d.at + 0.02));
    // Its nodes go when it ends
    square.onended();
    for (const n of made) expect(n.disconnect).toHaveBeenCalled();
  });

  it("the game's Audio plays it at its volume knob, placed, and not while a pause holds the sound", () => {
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
    CONFIG.DEATHS.TANK_VOLUME = 0.25;
    const timing = airTiming(0.95);
    // Off to the hero's right: quieter and panned right
    const { near, pan: side } = audio.placement(300, 0);
    expect(near).toBeLessThan(1);
    expect(side).toBeGreaterThan(0);
    audio.playTankDeath(300, 0, 4, timing, airDarts(timing, 0.5));
    const bus = made.find((n) => n.kind === 'gain');
    expect(bus.gain.setValueAtTime.mock.calls[0][0]).toBeCloseTo(
      0.25 * near,
      9
    );
    const pan = made.find((n) => n.kind === 'pan');
    expect(pan.pan.setValueAtTime.mock.calls[0][0]).toBeCloseTo(side, 9);
    expect(pan.connect).toHaveBeenCalledWith(audio.masterGain);
    const count = made.length;
    audio._pausedByGame = true;
    audio.playTankDeath(0, 0, 4, timing, airDarts(timing, 0.5));
    expect(made).toHaveLength(count);
  });
});

describe("a plate's clang", () => {
  const clangAt = (at) => {
    const { ctx, made } = fakeAudio();
    plateClang(
      ctx,
      { kind: 'bus' },
      { at, noise: { duration: 2 }, volume: 1, pan: 0 }
    );
    return made;
  };
  it("rings on the hum's F#, its higher partials dying first, over in under 0.8 s", () => {
    const made = clangAt(2);
    const partials = made.filter((n) => n.kind === 'osc');
    expect(partials[0].frequency.value).toBeCloseTo(hz(['1', 5], 2), 6);
    const ends = partials.map((o) => o.stop.mock.calls[0][0]);
    for (let i = 1; i < ends.length; i++)
      expect(ends[i]).toBeLessThan(ends[i - 1]);
    // Silent by 0.8 s (each source stops a moment after its fade)
    const fades = made
      .filter((n) => n.kind === 'gain')
      .flatMap((g) => g.gain.exponentialRampToValueAtTime.mock.calls)
      .map(([, t]) => t);
    expect(Math.max(...fades)).toBeLessThan(2 + 0.81);
    partials[0].onended();
    for (const n of made) expect(n.disconnect).toHaveBeenCalled();
  });

  it('differs a little from one break to the next', () => {
    // Its partials' ratios to its note: the hum's drift moves the note, not these
    const ratio = (made) => {
      const [note, , upper] = made.filter((n) => n.kind === 'osc');
      return upper.frequency.value / note.frequency.value;
    };
    expect(ratio(clangAt(2))).not.toBeCloseTo(ratio(clangAt(2.37)), 4);
  });

  it("the game's Audio plays it at its volume knob, placed, and not while a pause holds the sound", () => {
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
    const saved = CONFIG.TANK_ARMOR.CLANG_VOLUME;
    CONFIG.TANK_ARMOR.CLANG_VOLUME = 0.4;
    try {
      // Off to the hero's right: quieter and panned right
      const { near, pan: side } = audio.placement(300, 0);
      expect(near).toBeLessThan(1);
      expect(side).toBeGreaterThan(0);
      audio.playPlateClang(300, 0);
      const bus = made.find((n) => n.kind === 'gain');
      expect(bus.gain.setValueAtTime.mock.calls[0][0]).toBeCloseTo(
        0.4 * near,
        9
      );
      const pan = made.find((n) => n.kind === 'pan');
      expect(pan.pan.setValueAtTime.mock.calls[0][0]).toBeCloseTo(side, 9);
      expect(pan.connect).toHaveBeenCalledWith(audio.masterGain);
      const count = made.length;
      audio._pausedByGame = true;
      audio.playPlateClang(0, 0);
      expect(made).toHaveLength(count);
    } finally {
      CONFIG.TANK_ARMOR.CLANG_VOLUME = saved;
    }
  });
});
