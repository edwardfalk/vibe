import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { ExplosionManager } from '../../js/effects/explosions/ExplosionManager.js';
import {
  BombSmoke,
  smokeClock,
} from '../../js/effects/explosions/BombSmoke.js';
import { handleAreaDamageEvents } from '../../js/effects/AreaDamageHandler.js';
import { cloudSound } from '../../js/audio/BombSounds.js';
import { hz } from '../../js/audio/Harmony.js';
import { Audio } from '../../js/Audio.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';

const BOMB = { ...CONFIG.BOMB };
afterEach(() => {
  Object.assign(CONFIG.BOMB, BOMB);
  vi.restoreAllMocks();
});

// A manager with a cloud's sound to watch: playBombCloud hands out handles
function world() {
  const handles = [];
  const audio = {
    playBombCloud: vi.fn(() => {
      const h = { stop: vi.fn() };
      handles.push(h);
      return h;
    }),
  };
  const clock = { getBeatPosition: () => 0, beatInterval: 500 };
  const values = { audio, beatClock: clock };
  const manager = new ExplosionManager({ get: (k) => values[k] });
  return { manager, audio, handles };
}

// A p5 stand-in for drawing a cloud: every call does nothing, gradients
// take colour stops
function standInP() {
  const ctx = () =>
    new Proxy(
      {},
      {
        get: (t, k) =>
          k in t
            ? t[k]
            : k === 'createRadialGradient'
              ? () => ({ addColorStop() {} })
              : () => {},
        set: (t, k, v) => ((t[k] = v), true),
      }
    );
  let made = 0;
  return {
    drawingContext: ctx(),
    createGraphics: () => ({
      elt: { id: made++ },
      drawingContext: ctx(),
      pixelDensity() {},
    }),
  };
}

// The damage each frame from a bomb's cloud: [frame, radius] in order
function ticksOf(manager, frames) {
  const ticks = [];
  for (let f = 1; f <= frames; f++) {
    for (const e of manager.update()) ticks.push([f, e.radius]);
  }
  return ticks;
}

describe("the bomb's cloud hurts as today's two did", () => {
  it('plasma 9 times (frames 30 to 270), debris 19 (45 to 855), plasma first when both tick', () => {
    const { manager } = world();
    manager.addBombCloud(100, 100, 0.5);
    const ticks = ticksOf(manager, 1000);
    const plasma = ticks.filter(([, r]) => r === CONFIG.PLASMA.RADIUS);
    const debris = ticks.filter(([, r]) => r === CONFIG.DEBRIS.RADIUS);
    expect(plasma.map(([f]) => f)).toEqual(
      Array.from({ length: 9 }, (_, i) => 30 * (i + 1))
    );
    expect(debris.map(([f]) => f)).toEqual(
      Array.from({ length: 19 }, (_, i) => 45 * (i + 1))
    );
    // Frame 90: both, plasma's first
    const at90 = ticks.filter(([f]) => f === 90).map(([, r]) => r);
    expect(at90).toEqual([CONFIG.PLASMA.RADIUS, CONFIG.DEBRIS.RADIUS]);
  });

  it('hurts the hero by his centre and an alien by his hit circle, right to the edge', () => {
    const R = CONFIG.PLASMA.RADIUS;
    const event = { x: 0, y: 0, radius: R, damage: 15 };
    const hero = (x) => ({
      x,
      y: 0,
      hurt: vi.fn(() => true),
      knockBack: vi.fn(),
    });
    const alien = (x) => ({
      x,
      y: 0,
      size: 50,
      hitRadius: 55,
      markedForRemoval: false,
      takeDamage: vi.fn(() => 'damaged'),
    });
    const inside = hero(R - 0.1);
    const outside = hero(R + 0.1);
    const near = alien(R + 55 - 0.1);
    const far = alien(R + 55 + 0.1);
    for (const player of [inside, outside]) {
      handleAreaDamageEvents([event], { player, enemies: [near, far] });
    }
    expect(inside.hurt).toHaveBeenCalled();
    expect(outside.hurt).not.toHaveBeenCalled();
    expect(near.takeDamage).toHaveBeenCalled();
    expect(far.takeDamage).not.toHaveBeenCalled();
  });
});

describe("the cloud's picture and sound", () => {
  it('starts its sound at the bang and stops it when the last of its damage is over', () => {
    const { manager, audio, handles } = world();
    manager.addBombCloud(30, 40, 0.25);
    expect(audio.playBombCloud).toHaveBeenCalledWith(30, 40, 0.25);
    for (let f = 1; f < CONFIG.DEBRIS.DURATION; f++) manager.update();
    expect(handles[0].stop).not.toHaveBeenCalled();
    manager.update(); // frame 900: the debris is over
    expect(handles[0].stop).toHaveBeenCalledTimes(1);
    // Its fade goes on a little, then it is gone
    expect(manager.smokes).toHaveLength(1);
    for (let f = 0; f < 120; f++) manager.update();
    expect(manager.smokes).toHaveLength(0);
    expect(handles[0].stop).toHaveBeenCalledTimes(1);
  });

  it('a restart takes the cloud and stops its sound at once', () => {
    const { manager, handles } = world();
    manager.addBombCloud(0, 0, 0.5);
    manager.update();
    manager.reset();
    expect(handles[0].stop).toHaveBeenCalledTimes(1);
    expect(manager.smokes).toEqual([]);
    expect(manager.plasmaClouds).toEqual([]);
    expect(manager.radioactiveDebris).toEqual([]);
  });

  it('ages only as the manager updates it, with its damage, so it holds through hitstop with it', () => {
    const { manager } = world();
    manager.addBombCloud(0, 0, 0.5);
    const p = standInP();
    const [smoke] = manager.smokes;
    const [debris] = manager.radioactiveDebris;
    for (let f = 0; f < 90; f++) {
      manager.update();
      manager.drawUnder(p);
    }
    // Its age is its damage's: the debris timer counts frames at 60 a second
    expect(smoke.age).toBeCloseTo(debris.timer / 60, 9);
    // Hitstop: drawn, not updated
    for (let f = 0; f < 30; f++) manager.drawUnder(p);
    expect(smoke.age).toBeCloseTo(debris.timer / 60, 9);
    expect(smoke.age).toBeCloseTo(1.5, 9);
  });

  it('shows where it hurts: blooms to the plasma edge, steps in to the debris edge, and fades after it', () => {
    const c = {
      plasma: { radius: 80, sec: 5 },
      debris: { radius: 60, sec: 15 },
      linger: 1,
      beats: 0,
      beatSec: 0.5,
    };
    expect(smokeClock(c, 1).R).toBeCloseTo(80, 3);
    expect(smokeClock(c, 5.31).R).toBeCloseTo(60, 3);
    expect(smokeClock(c, 14.9).fade).toBe(1);
    expect(smokeClock(c, 15.4).fade).toBeLessThan(1);
    expect(smokeClock(c, 15.9).fade).toBeLessThanOrEqual(0);
  });

  it('each live cloud keeps its own layer (more than eight at once), and an ended one hands it on', () => {
    const p = standInP();
    const smoke = () =>
      new BombSmoke(0, 0, { seed: 0.5, beats: () => 0, beatSec: 0.5 });
    const live = Array.from({ length: 10 }, smoke);
    for (const s of live) {
      s.update();
      s.draw(p);
    }
    const layers = new Set(live.map((s) => s.layer));
    expect(layers.size).toBe(10);
    // The first ends; the next new cloud takes its layer, not a new one
    const handed = live[0].layer;
    live[0].end();
    const next = smoke();
    next.update();
    next.draw(p);
    expect(next.layer).toBe(handed);
    for (const s of live.slice(1)) expect(s.layer).not.toBe(handed);
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
    currentTime: 3,
    sampleRate: 8000,
    state: 'running',
    createStereoPanner: () => node('pan', { pan: param() }),
    createBiquadFilter: () =>
      node('filter', { frequency: param(), Q: param() }),
    createGain: () => node('gain', { gain: param() }),
    createOscillator: () =>
      node('osc', { frequency: param(), detune: param() }),
    createBufferSource: () => node('source', { playbackRate: param() }),
    createBuffer: vi.fn((channels, length, rate) => {
      const data = new Float32Array(length);
      return { duration: length / rate, getChannelData: () => data };
    }),
  };
  return { ctx, made };
}
const SOUND = {
  at: 2,
  noise: { duration: 2 },
  volume: 1,
  pan: 0,
  beatSec: 0.5,
  plasmaSec: 5,
  debrisSec: 15,
  seed: 0.5,
};

describe("the cloud's sound", () => {
  it('is a bed on the root from the bang to the end of its debris, its crackles on the eighths', () => {
    const { ctx, made } = fakeAudio();
    cloudSound(ctx, { kind: 'bus' }, SOUND);
    const sources = made.filter((n) => n.start.mock.calls.length);
    expect(sources.length).toBeGreaterThan(10); // the bed and many crackles
    // On the grid of eighth notes from the bang
    const onEighth = (t) => {
      const n = t / (SOUND.beatSec / 2);
      return Math.abs(n - Math.round(n)) < 1e-9;
    };
    for (const s of sources) {
      const [from] = s.start.mock.calls[0];
      expect(from).toBeGreaterThanOrEqual(SOUND.at);
      // A crackle lands on an eighth, or an eighth of a beat after one
      const t = from - SOUND.at;
      expect(onEighth(t) || onEighth(t - SOUND.beatSec / 8)).toBe(true);
    }
    const last = Math.max(...sources.map((s) => s.stop.mock.calls[0][0]));
    expect(last).toBeLessThan(SOUND.at + SOUND.debrisSec + 0.5);
    const tri = made.find((n) => n.kind === 'osc' && n.type === 'triangle');
    expect(tri.frequency.value).toBeCloseTo(hz(['1', 2], SOUND.at), 6);
  });

  it('stops at once with a short fade, and lets every node go when its last source ends', () => {
    const { ctx, made } = fakeAudio();
    const sound = cloudSound(ctx, { kind: 'bus' }, SOUND);
    sound.stop();
    const bus = made.find((n) => n.kind === 'gain');
    expect(bus.gain.setTargetAtTime).toHaveBeenCalledWith(
      0,
      ctx.currentTime,
      expect.any(Number)
    );
    const sources = made.filter((n) => n.start.mock.calls.length);
    for (const s of sources) {
      expect(s.stop.mock.calls.at(-1)[0]).toBeLessThanOrEqual(
        ctx.currentTime + 0.3
      );
    }
    const ender = sources.find((s) => typeof s.onended === 'function');
    ender.onended();
    for (const n of made) expect(n.disconnect).toHaveBeenCalled();
    sound.stop(); // a second stop does nothing
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
      getContextValue: () => null,
    });
    CONFIG.BOMB.CLOUD_VOLUME = 2;
    // Off to the hero's right: quieter and panned right
    const { near, pan: side } = audio.placement(300, 0);
    expect(near).toBeLessThan(1);
    expect(side).toBeGreaterThan(0);
    const handle = audio.playBombCloud(300, 0, 0.5);
    expect(typeof handle.stop).toBe('function');
    // It lasts as long as the cloud's damage: the debris's frames at 60 a second
    const ends = made
      .filter((n) => n.stop.mock.calls.length)
      .map((n) => n.stop.mock.calls[0][0]);
    const debrisEnd = ctx.currentTime + CONFIG.DEBRIS.DURATION / 60;
    expect(Math.max(...ends)).toBeGreaterThan(debrisEnd - 0.5);
    expect(Math.max(...ends)).toBeLessThan(debrisEnd + 1);
    const bus = made.find((n) => n.kind === 'gain');
    expect(bus.gain.setValueAtTime.mock.calls[0][0]).toBeCloseTo(2 * near, 9);
    const pan = made.find((n) => n.kind === 'pan');
    expect(pan.pan.setValueAtTime.mock.calls[0][0]).toBeCloseTo(side, 9);
    expect(pan.connect).toHaveBeenCalledWith(audio.masterGain);
    audio._pausedByGame = true;
    expect(audio.playBombCloud(0, 0, 0.5)).toBeNull();
  });
});
