import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import {
  BombBlast,
  COMIC,
  RING_LANDS_SEC,
} from '../../js/effects/explosions/BombBlast.js';
import { ExplosionManager } from '../../js/effects/explosions/ExplosionManager.js';
import { HazardCloud } from '../../js/effects/explosions/HazardCloud.js';
import { runDraw } from '../../js/GameLoopDraw.js';
import { bangSound } from '../../js/audio/BombSounds.js';
import { hz } from '../../js/audio/Harmony.js';
import { Audio } from '../../js/Audio.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';

const BOMB = { ...CONFIG.BOMB };
const DEATHS = { ...CONFIG.DEATHS };
afterEach(() => {
  Object.assign(CONFIG.BOMB, BOMB);
  Object.assign(CONFIG.DEATHS, DEATHS);
  vi.restoreAllMocks();
});

// A canvas stand-in that records each arc stroked: [radius, lineWidth]
function strokeCanvas() {
  const strokes = [];
  let arcs = [];
  const state = {};
  const ctx = new Proxy(state, {
    get: (t, k) => {
      if (k in t) return t[k];
      if (k === 'beginPath') return () => (arcs = []);
      if (k === 'arc') return (x, y, r) => arcs.push(r);
      if (k === 'stroke') {
        return () => arcs.forEach((r) => strokes.push([r, t.lineWidth]));
      }
      return () => {};
    },
    set: (t, k, v) => ((t[k] = v), true),
  });
  return { p: { drawingContext: ctx }, strokes };
}
const FRAME_MS = 1000 / 60;
// A bang aged to `sec` and drawn: the arcs its ring stroked
function ringAt(bang, sec) {
  while (bang.ageMs / 1000 < sec - 1e-9) bang.update(FRAME_MS);
  const { p, strokes } = strokeCanvas();
  bang.draw(p);
  return strokes;
}

describe('the Comic bang', () => {
  it("its ring bursts out, slams to a stop at the bomb's reach and holds there", () => {
    const R = CONFIG.BOMB.RADIUS_PX;
    const bang = new BombBlast(0, 0, 0.5);
    const early = ringAt(bang, 0.02).map(([r]) => r);
    expect(Math.max(...early)).toBeLessThan(R);
    expect(Math.max(...early)).toBeGreaterThan(R / 2); // half the reach in a frame or so
    const landed = ringAt(bang, RING_LANDS_SEC + 0.02).map(([r]) => r);
    // The fat ring's outside sits on the reach
    expect(landed.some((r) => Math.abs(r - R) < COMIC.SLAM_W[1])).toBe(true);
    expect(Math.max(...landed)).toBeLessThanOrEqual(R);
  });

  it('keeps the reach it blew with, whatever the slider does after', () => {
    const bang = new BombBlast(0, 0, 0.5);
    const R = CONFIG.BOMB.RADIUS_PX;
    CONFIG.BOMB.RADIUS_PX = R * 2;
    const landed = ringAt(bang, RING_LANDS_SEC + 0.02).map(([r]) => r);
    expect(Math.max(...landed)).toBeLessThanOrEqual(R);
  });

  it('its fireball and ring end within half a second; its dashes and puffs within about a second, stretched by linger', () => {
    const live = (linger) => {
      CONFIG.DEATHS.LINGER = linger;
      const bang = new BombBlast(0, 0, 0.5);
      const { p } = strokeCanvas();
      const done = { over: null, under: null };
      for (let f = 0; f < 600 && bang.active; f++) {
        bang.update(FRAME_MS);
        bang.draw(p);
        bang.drawUnder(p);
        const t = bang.ageMs / 1000;
        if (bang.overDone && done.over === null) done.over = t;
        if (bang.underDone && done.under === null) done.under = t;
      }
      return { ...done, active: bang.active };
    };
    const one = live(1);
    expect(one.over).toBeLessThan(0.5);
    expect(one.under).toBeGreaterThan(0.5);
    expect(one.under).toBeLessThan(1.3);
    expect(one.active).toBe(false);
    const two = live(2);
    expect(two.over).toBeCloseTo(one.over, 2); // the fireball isn't stretched
    expect(two.under).toBeGreaterThan(one.under + 0.3);
  });

  it('holds still while the game does: it ages, and its picture moves, only when updated', () => {
    const bang = new BombBlast(0, 0, 0.5);
    bang.update(FRAME_MS);
    const drawn = () => {
      const { p, strokes } = strokeCanvas();
      bang.draw(p);
      return strokes;
    };
    const first = drawn();
    expect(drawn()).toEqual(first);
    expect(bang.ageMs).toBeCloseTo(FRAME_MS);
    bang.update(FRAME_MS);
    expect(drawn()).not.toEqual(first);
  });

  it('the manager draws its dashes under everyone and its fireball over them, and lets it go when both are done', () => {
    const manager = new ExplosionManager();
    manager.addBombBlast(10, 20, 0.5);
    const bang = manager.bangs[0];
    const under = vi.spyOn(bang, 'drawUnder');
    const over = vi.spyOn(bang, 'draw');
    const p = strokeCanvas().p;
    manager.drawUnder(p);
    expect(under).toHaveBeenCalledWith(p);
    expect(over).not.toHaveBeenCalled();
    manager.draw(p);
    expect(over).toHaveBeenCalledWith(p);
    for (let f = 0; f < 300; f++) {
      manager.update(FRAME_MS);
      manager.drawUnder(p);
      manager.draw(p);
    }
    expect(manager.bangs).toEqual([]);
    manager.addBombBlast(0, 0, 0.5);
    manager.reset();
    expect(manager.bangs).toEqual([]);
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
    createBufferSource: () => node('source', { playbackRate: param() }),
    createWaveShaper: () => node('shaper'),
    createConvolver: () => node('convolver'),
    createBuffer: vi.fn((channels, length, rate) => {
      const data = new Float32Array(length);
      return { duration: length / rate, getChannelData: () => data };
    }),
  };
  return { ctx, made };
}

describe("the hero's death scene", () => {
  it('a bang plays out while the world holds still, rather than freezing over him', () => {
    const manager = new ExplosionManager();
    manager.addBombBlast(0, 0, 0.5);
    const cloud = new HazardCloud(0, 0, 'PLASMA');
    manager.plasmaClouds.push(cloud);
    // The draw loop reads the game from window; Node has none
    const hadWindow = 'window' in globalThis;
    if (!hadWindow) globalThis.window = globalThis;
    const keys = ['gameState', 'explosionManager', 'frameCount'];
    const saved = keys.map((k) => [k, k in window, window[k]]);
    window.gameState = {
      gameState: 'gameOver',
      updateScene() {},
      overlayUp: () => false,
    };
    window.explosionManager = manager;
    try {
      // A long frame counts as the game's longest
      const { p } = strokeCanvas();
      // The world drawn as it was: the manager's two layers
      const drawGame = () => {
        manager.drawUnder(p);
        manager.draw(p);
      };
      runDraw({ ...p, frameCount: 1, deltaTime: 400 }, () => {}, drawGame);
      const [bang] = manager.bangs;
      expect(bang.ageMs).toBeCloseTo(CONFIG.GAME_SETTINGS.MAX_FRAME_MS, 9);
      for (let f = 2; f < 120; f++) {
        runDraw(
          { ...p, frameCount: f, deltaTime: FRAME_MS },
          () => {},
          drawGame
        );
      }
      expect(manager.bangs).toEqual([]); // played out and let go
      expect(cloud.timer).toBe(0); // the world held still
    } finally {
      for (const [k, had, v] of saved) {
        if (had) window[k] = v;
        else delete window[k];
      }
      if (!hadWindow) delete globalThis.window;
    }
  });
});

describe("the bang's sound", () => {
  it('a thump onto the root through a drive with the kick curve, the fifth over it, and the slam when the ring lands', () => {
    const { ctx, made } = fakeAudio();
    const at = 3.7; // any time: the game's audio clock is long past 0 by then
    bangSound(
      ctx,
      { kind: 'bus' },
      { at, noise: { duration: 2 }, volume: 1, pan: 0 }
    );
    const drive = made.find((n) => n.kind === 'shaper');
    const k = CONFIG.BEAT_TRACK.KICK.DRIVE;
    const mid = drive.curve.length - 1;
    expect(drive.curve[mid]).toBeCloseTo(1, 9); // ±1 stays ±1
    expect(drive.curve[(mid / 2 + 0.5) | 0]).toBeCloseTo(
      Math.tanh(k * (1 / mid)) / Math.tanh(k),
      4
    );
    const oscs = made.filter((n) => n.kind === 'osc');
    // The thump: falls onto the root, into the drive
    const thump = oscs.find((o) =>
      o.connect.mock.calls.some(([g]) =>
        g.connect?.mock.calls.some(([d]) => d === drive)
      )
    );
    const root = hz(['1', 2], at);
    expect(
      thump.frequency.exponentialRampToValueAtTime.mock.calls[0][0]
    ).toBeCloseTo(root, 6);
    // It and the fifth start with the bang, an octave up
    expect(thump.start.mock.calls[0][0]).toBeCloseTo(at, 9);
    expect(thump.frequency.setValueAtTime.mock.calls[0]).toEqual([
      root * 2,
      at,
    ]);
    const fifth = oscs.find(
      (o) =>
        o !== thump &&
        o.frequency.exponentialRampToValueAtTime.mock.calls[0]?.[0] ===
          hz(['5', 2], at)
    );
    expect(fifth.start.mock.calls[0][0]).toBeCloseTo(at, 9);
    // The slam: fifth to root, when the ring is seen to land
    const slam = oscs.find((o) => o.start.mock.calls[0][0] > at);
    expect(slam.start.mock.calls[0][0]).toBeCloseTo(at + RING_LANDS_SEC, 9);
    expect(slam.frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(
      hz(['5', 2], at),
      6
    );
    // Its noise loops, so no part of it runs out before its fade does
    const noises = made.filter((n) => n.kind === 'source');
    expect(noises.length).toBeGreaterThan(3);
    for (const n of noises) expect(n.loop).toBe(true);
    // Every node lets go when its last source ends
    const last = made.find((n) => typeof n.onended === 'function');
    last.onended();
    for (const n of made) expect(n.disconnect).toHaveBeenCalled();
  });

  it("keeps its drive finite with the kick's drive slider at 0", () => {
    const KICK = { ...CONFIG.BEAT_TRACK.KICK };
    CONFIG.BEAT_TRACK.KICK.DRIVE = 0;
    try {
      const { ctx, made } = fakeAudio();
      bangSound(
        ctx,
        { kind: 'bus' },
        { at: 2, noise: { duration: 2 }, volume: 1, pan: 0 }
      );
      const drive = made.find((n) => n.kind === 'shaper');
      expect(drive.curve.every(Number.isFinite)).toBe(true);
    } finally {
      Object.assign(CONFIG.BEAT_TRACK.KICK, KICK);
    }
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
    CONFIG.BOMB.BANG_VOLUME = 0.5;
    // Off to the hero's right: quieter and panned right
    const { near, pan: side } = audio.placement(300, 0);
    expect(near).toBeLessThan(1);
    expect(side).toBeGreaterThan(0);
    audio.playBombBang(300, 0);
    const bus = made.find((n) => n.kind === 'gain');
    expect(bus.gain.setValueAtTime.mock.calls[0][0]).toBeCloseTo(0.5 * near, 9);
    const pan = made.find((n) => n.kind === 'pan');
    expect(pan.pan.setValueAtTime.mock.calls[0][0]).toBeCloseTo(side, 9);
    expect(pan.connect).toHaveBeenCalledWith(audio.masterGain);
    const count = made.length;
    audio._pausedByGame = true;
    audio.playBombBang(0, 0);
    expect(made).toHaveLength(count);
  });
});
