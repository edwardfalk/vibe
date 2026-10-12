import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { Stabber, LOCK_AT } from '../../js/entities/Stabber.js';
import {
  StabberDeath,
  stabberDeathRecord,
  STABBER_STYLES,
} from '../../js/entities/StabberDeath.js';
import { shellShutAt, shellEnd } from '../../js/entities/StabberShell.js';
import {
  EnemyDeathHandler,
  popTime,
} from '../../js/systems/combat/EnemyDeathHandler.js';
import { stabberShell, stabberShatter } from '../../js/audio/DeathSounds.js';
import { shatterTimes } from '../../js/entities/StabberShatter.js';
import { hz } from '../../js/audio/Harmony.js';
import { Audio } from '../../js/Audio.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { fakeAudio } from './helpers/fakeAudio.js';
import { fakeBuses } from './helpers/audioBuses.js';
import { beatWorld } from './helpers/beatWorld.js';
import { transformP5 } from './helpers/transformP5.js';

const DEATHS = { ...CONFIG.DEATHS };
afterEach(() => {
  Object.assign(CONFIG.DEATHS, DEATHS);
  vi.restoreAllMocks();
});

const FRAME_MS = 16;
const MS_PER_BEAT = 500;

// A stabber on a real beat clock with the hero at (300, 0), a death handler,
// and the explosion manager's deaths. kill(blow) kills him by takeDamage, as
// a shot does, then hands him to the handler
function world() {
  const explosionManager = { fragmentExplosions: [] };
  const player = { x: 300, y: 0 };
  const w = beatWorld({ explosionManager, player });
  w.audio.playStabberDeath = vi.fn();
  w.audio.ensureAudioContext = vi.fn();
  w.at(0);
  const s = new Stabber(
    0,
    0,
    'stabber',
    { context: w.context },
    createMockP5(),
    w.audio
  );
  s.isSpawning = false;
  s.spawnTimer = s.spawnDuration;
  const run = (from, to) => {
    for (let ms = from; ms <= to; ms += FRAME_MS) {
      w.at(ms);
      s.update(player.x, player.y, FRAME_MS);
    }
  };
  const handler = new EnemyDeathHandler(w.context);
  const kill = (blow = { dir: 0 }) => {
    s.health = 1;
    s.takeDamage(5, blow.dir ?? null, 'player_bullet');
    handler.handleEnemyDeath(s, 'stabber', s.x, s.y, blow);
    return explosionManager.fragmentExplosions.at(-1);
  };
  return { ...w, s, player, run, kill, handler };
}

// A record on a clock whose beat 0 is at 0, an eighth every 0.25 s
const record = (o = {}) =>
  stabberDeathRecord({
    style: 'shell',
    linger: 1,
    beatSec: 0.5,
    origin: 0,
    at: 2,
    pose: {
      t: 1,
      beatSec: 0.5,
      beats: 2,
      eighth: 0,
      kick: 0,
      aim: 0.3,
      toHero: 0.3,
      vx: 0,
      vy: 0,
      age: 1,
      windup: null,
      lunge: null,
      recover: null,
      stunned: null,
      hit: 0,
      hitAge: Infinity,
      hitDir: 0,
      push: 0,
      seed: 0.4,
      reach: 42,
    },
    scale: 1,
    dir: 0,
    blast: false,
    seed: 0.4,
    ...o,
  });
// A death of `rec` whose audio clock we set; killed at 1.8, it starts at 2
function deathOf(rec = record(), hero = () => ({ x: 300, y: 0 })) {
  let clock = 1.8;
  const death = new StabberDeath({
    x: 0,
    y: 0,
    record: rec,
    diedAt: 1.8,
    startsAt: 2,
    now: () => clock,
    hero,
  });
  return { death, at: (t) => (clock = t) };
}

describe("when the stabber's death starts", () => {
  it("on the next eighth, at least the voices' lead ahead: his sound then, his picture when it is heard", () => {
    const w = world();
    w.run(0, 300);
    const death = w.kill({ dir: 0 });
    expect(death).toBeInstanceOf(StabberDeath);
    const at = popTime(w.clock.nowSec(), w.clock);
    const [x, y, start, rec] = w.audio.playStabberDeath.mock.calls[0];
    expect([x, y]).toEqual([w.s.x, w.s.y]);
    expect(start).toBeCloseTo(at, 9);
    expect(rec).toBe(death.record);
    expect(death.startsAt).toBeGreaterThanOrEqual(at);
  });

  it('with the bang when the bomb killed him; on the next eighth when the bang played nothing', () => {
    const w = world();
    w.run(0, 300);
    w.kill({ dir: 0, blast: true, bomb: true, at: 0.33 });
    expect(w.audio.playStabberDeath.mock.calls[0][2]).toBe(0.33);
    const w2 = world();
    w2.run(0, 300);
    w2.kill({ dir: 0, blast: true, bomb: true, at: null });
    expect(w2.audio.playStabberDeath.mock.calls[0][2]).toBeCloseTo(
      popTime(w2.clock.nowSec(), w2.clock),
      9
    );
  });

  it('his neighbours answer an eighth after it starts, not on it', () => {
    const w = world();
    w.run(0, 300);
    const neighbour = { type: 'stabber', onNearbyDeath: vi.fn(() => true) };
    w.values.enemies = [neighbour];
    w.kill({ dir: 0 });
    const start = w.audio.playStabberDeath.mock.calls[0][2];
    expect(neighbour.onNearbyDeath).toHaveBeenCalledWith(w.s, start, false);
  });
});

describe('what his death keeps from the kill', () => {
  it('the pose he died in: killed before his lock, he is winding up, not dazed', () => {
    const w = world();
    w.run(0, LOCK_AT * MS_PER_BEAT - 100);
    expect(w.s.state).toBe('windup');
    const death = w.kill({ dir: 0 });
    expect(death.record.pose.windup).not.toBeNull();
    expect(death.record.pose.stunned).toBeNull();
    expect(death.record.hot).toBe(false);
    // Clean: the death draws its own flash
    expect(death.record.pose.hit).toBe(0);
  });

  it('white-hot from his lock', () => {
    const w = world();
    w.run(0, LOCK_AT * MS_PER_BEAT + 100);
    expect(w.s.locked).toBe(true);
    expect(w.kill({ dir: 0 }).record.hot).toBe(true);
  });

  it('the style and the linger ?tune had at the kill, whatever they say after; an unknown style is the shell', () => {
    const w = world();
    w.run(0, 300);
    CONFIG.DEATHS.LINGER = 1.7;
    const death = w.kill({ dir: 0 });
    CONFIG.DEATHS.LINGER = 0.5;
    CONFIG.DEATHS.STABBER_STYLE = 'something else';
    expect(death.record.linger).toBe(1.7);
    expect(death.record.style).toBe('shell');
    expect(record({ style: 'nonsense' }).style).toBe(STABBER_STYLES[0]);
    expect(STABBER_STYLES[0]).toBe('shell');
  });

  it("the blow's way, or his aim with none, and whether it was a blast", () => {
    const w = world();
    w.run(0, 300);
    const blown = w.kill({ dir: 2, blast: true });
    expect([blown.record.dir, blown.record.blast]).toEqual([2, true]);
    const w2 = world();
    Object.assign(w2.player, { x: 200, y: 150 }); // his aim isn't 0
    w2.run(0, 300);
    const none = w2.kill({});
    expect(w2.s.aim).toBeGreaterThan(0.3);
    expect(none.record.dir).toBe(w2.s.aim);
    expect(none.record.blast).toBe(false);
  });

  it("the song's eighths from its start, even a start off the grid", () => {
    const on = record({ at: 2 });
    expect(on.offset).toBeCloseTo(0, 9);
    expect(on.eighthAfter(3)).toBeCloseTo(0.75, 9);
    const off = record({ at: 2.1 }); // a late bang: the next eighth is at 2.25
    expect(off.offset).toBeCloseTo(0.15, 9);
    expect(off.eighthAfter(1)).toBeCloseTo(0.4, 9);
    expect(off.lastEighth(0.1)).toEqual([-1, expect.closeTo(-0.1, 9)]);
    expect(off.lastEighth(0.42)[0]).toBe(1);
  });
});

describe('Empty shell', () => {
  it('shuts its eye on the eighth nearest a second times the linger, never before half a second', () => {
    expect(shellShutAt(record({ linger: 1 }))).toBeCloseTo(1, 9);
    expect(shellShutAt(record({ linger: 1.7 }))).toBeCloseTo(1.75, 9); // 6.8 eighths: the 7th
    expect(shellShutAt(record({ linger: 0.5 }))).toBeCloseTo(0.5, 9);
    expect(shellShutAt(record({ linger: 1, at: 2.1 }))).toBeCloseTo(1.15, 9);
  });

  it('hangs frozen until it starts, then cracks, lives its course and is gone', () => {
    const { death, at } = deathOf();
    const { p } = transformP5();
    const spy = vi.spyOn(Math, 'random');
    for (const t of [1.8, 1.9, 1.99]) {
      at(t);
      death.draw(p);
      expect(death.active).toBe(true);
    }
    const end = shellEnd(death.record);
    for (let t = 2; t < 2 + end; t += 0.05) {
      at(t);
      death.draw(p);
      expect(death.active).toBe(true);
    }
    at(2 + end + 0.01);
    death.draw(p);
    expect(death.active).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    expect(p.drawingContext.depth).toBe(0);
  });

  it('can first be drawn at any age, white-hot or not, at any scale', () => {
    const pose = {
      ...record().pose,
      windup: { k: 0.8, locked: true, lockAge: 0.1, left: 1, len: 300 },
    };
    for (const rec of [record(), record({ pose, scale: 1.4 })]) {
      for (const t of [2.3, 2.8, 3.05]) {
        const { death, at } = deathOf(rec);
        const { p } = transformP5();
        at(t);
        expect(() => death.draw(p)).not.toThrow();
        expect(p.drawingContext.depth).toBe(0);
      }
    }
  });

  it('knows where the hero is each frame, from where he died; with no hero, along his aim', () => {
    const hero = { x: 300, y: 50 };
    const { death } = deathOf(record(), () => hero);
    death.x = 100;
    expect(death.heroAt()).toEqual({ x: 200, y: 50 });
    hero.x = 0;
    expect(death.heroAt()).toEqual({ x: -100, y: 50 });
    const { death: alone } = deathOf(record(), () => null);
    const h = alone.heroAt();
    expect(Math.atan2(h.y, h.x)).toBeCloseTo(0.3, 9);
  });
});

describe("Empty shell's sound", () => {
  const play = (rec, at) => {
    const { ctx, made } = fakeAudio();
    stabberShell(
      ctx,
      { kind: 'bus' },
      { at, record: rec, noise: { duration: 2 }, volume: 1, pan: 0 }
    );
    return made;
  };

  it("glides onto the hum's fifth as it drifts at its start, not the drift-less one", () => {
    const at = 7.3;
    expect(Math.abs(hz(['5', 5], at) - hz(['5', 5], 0))).toBeGreaterThan(0.05);
    const made = play(record({ at }), at);
    // The voice on his note itself: a saw whose glide ends at the curve's last value
    const ends = made
      .filter(
        (n) =>
          n.kind === 'osc' && n.frequency.setValueCurveAtTime.mock.calls.length
      )
      .map((o) => o.frequency.setValueCurveAtTime.mock.calls[0][0].at(-1));
    expect(ends.some((f) => Math.abs(f - hz(['5', 5], at)) < 1e-3)).toBe(true);
  });

  it('plucks the fifth as the eye shuts, from the same record, at any linger', () => {
    const at = 2;
    const rec = record({ at, linger: 1.7 });
    const made = play(rec, at);
    const pluck = made.filter((n) => n.kind === 'osc').at(-1);
    expect(pluck.start.mock.calls[0][0]).toBeCloseTo(at + shellShutAt(rec), 9);
    expect(pluck.start.mock.calls[0][0]).toBeCloseTo(at + 1.75, 9);
    expect(pluck.frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(
      hz(['5', 5], at),
      9
    );
  });

  it('stops every source it starts, and frees its nodes when it ends', () => {
    for (const rec of [
      record(),
      record({ pose: { ...record().pose, lunge: { k: 0.2 } } }),
    ]) {
      const made = play(rec, 2);
      const started = made.filter((n) => n.start.mock.calls.length);
      expect(started.length).toBeGreaterThan(5);
      for (const n of started) expect(n.stop).toHaveBeenCalled();
      const last = made.find((n) => n.onended);
      last.onended();
      for (const n of made) expect(n.disconnect).toHaveBeenCalled();
    }
  });

  it('hisses only white-hot', () => {
    const sources = (rec) =>
      play(rec, 2).filter((n) => n.kind === 'source').length;
    const hot = record({ pose: { ...record().pose, lunge: { k: 0.2 } } });
    expect(sources(hot)).toBe(sources(record()) + 1);
  });

  it("the game's Audio plays it at its volume knob, placed, on feedback, and not while a pause holds the sound", () => {
    const { ctx, made } = fakeAudio();
    const audio = Object.assign(Object.create(Audio.prototype), {
      audioContext: ctx,
      initialized: true,
      enabled: true,
      initialize() {},
      sounds: { ...SOUND_CONFIG },
      player: { x: 0, y: 0 },
      masterGain: { kind: 'effects bus' },
      buses: fakeBuses(),
      getContextValue: () => undefined,
      _pausedByGame: false,
      _resuming: false,
    });
    CONFIG.DEATHS.STABBER_VOLUME = 0;
    const { near } = audio.placement(300, 0);
    audio.playStabberDeath(300, 0, 4, record({ at: 4 }));
    const bus = made.find((n) => n.kind === 'gain');
    expect(bus.gain.setValueAtTime.mock.calls[0][0]).toBe(0 * near);
    const pan = made.find((n) => n.kind === 'pan');
    expect(pan.connect).toHaveBeenCalledWith(audio.buses.feedback);
    const count = made.length;
    audio._pausedByGame = true;
    audio.playStabberDeath(0, 0, 4, record({ at: 4 }));
    expect(made).toHaveLength(count);
  });
});

describe('Gold shatter', () => {
  const shatter = (o = {}) => record({ style: 'shatter', ...o });

  it("jabs and crumbles on the song's eighths, four of them times the linger on", () => {
    expect(shatterTimes(shatter())).toEqual({ jab: 0.75, crumble: 1 });
    const long = shatterTimes(shatter({ linger: 1.7 })); // 6.8 eighths: the 7th
    expect(long.jab).toBeCloseTo(1.5, 9);
    expect(long.crumble).toBeCloseTo(1.75, 9);
    const off = shatterTimes(shatter({ at: 2.1 }));
    expect(off.crumble).toBeCloseTo(1.15, 9);
  });

  it('is the style ?tune picks at the kill', () => {
    const w = world();
    w.run(0, 300);
    CONFIG.DEATHS.STABBER_STYLE = 'shatter';
    expect(w.kill({ dir: 0 }).record.style).toBe('shatter');
  });

  it('hangs frozen until it starts, then shatters, lives its course and is gone', () => {
    const rec = shatter();
    const { death, at } = deathOf(rec);
    const { p } = transformP5();
    const spy = vi.spyOn(Math, 'random');
    for (const t of [1.8, 1.9, 1.99]) {
      at(t);
      death.draw(p);
      expect(death.active).toBe(true);
    }
    let t = 2;
    for (; t < 4 && death.active; t += 0.05) {
      at(t);
      death.draw(p);
    }
    expect(death.active).toBe(false);
    // Gone after its spike's crumble, within about 1.4 s of its start
    expect(t - 2).toBeGreaterThan(shatterTimes(rec).crumble);
    expect(t - 2).toBeLessThan(1.5);
    expect(spy).not.toHaveBeenCalled();
    expect(p.drawingContext.depth).toBe(0);
  });

  it('can first be drawn at any age, white-hot or not, blasted or not', () => {
    const hotPose = { ...record().pose, lunge: { k: 0.3 } };
    for (const rec of [
      shatter(),
      shatter({ pose: hotPose, blast: true, scale: 1.3 }),
    ]) {
      for (const t of [2.05, 2.5, 2.8, 3.1]) {
        const { death, at } = deathOf(rec);
        const { p } = transformP5();
        at(t);
        expect(() => death.draw(p)).not.toThrow();
        expect(p.drawingContext.depth).toBe(0);
      }
    }
  });

  it('its spike turns to the hero until it crumbles; its dust stays where it crumbled', () => {
    const hero = { x: 0, y: 300 };
    const { death, at } = deathOf(shatter(), () => hero);
    const { p } = transformP5();
    at(2 + 1.02);
    death.draw(p);
    const crumbled = death.state.crumbledAt;
    expect(crumbled).toBeDefined();
    hero.x = 500;
    at(2 + 1.1);
    death.draw(p);
    expect(death.state.crumbledAt).toBe(crumbled);
  });
});

describe("Gold shatter's sound", () => {
  const play = (rec, at) => {
    const { ctx, made } = fakeAudio();
    stabberShatter(
      ctx,
      { kind: 'bus' },
      { at, record: rec, noise: { duration: 2 }, volume: 1, pan: 0 }
    );
    return made;
  };

  it("rings on the hum's fifth as it drifts at its start", () => {
    const at = 7.3;
    const made = play(record({ style: 'shatter', at }), at);
    const freqs = made
      .filter(
        (n) => n.kind === 'osc' && n.frequency.setValueAtTime.mock.calls.length
      )
      .map((o) => o.frequency.setValueAtTime.mock.calls[0][0]);
    expect(freqs.some((f) => Math.abs(f - hz(['5', 6], at)) < 1e-6)).toBe(true);
    expect(freqs.some((f) => Math.abs(f - hz(['5', 6], 0)) < 1e-6)).toBe(false);
  });

  it('jabs and crumbles where the picture does, at any linger', () => {
    const at = 2;
    const rec = record({ style: 'shatter', at, linger: 1.7 });
    const { jab, crumble } = shatterTimes(rec);
    const made = play(rec, at);
    const starts = made.flatMap((n) => n.start.mock.calls.map(([t]) => t));
    expect(starts.some((t) => Math.abs(t - (at + jab)) < 1e-9)).toBe(true);
    expect(starts.some((t) => Math.abs(t - (at + crumble)) < 1e-9)).toBe(true);
  });

  it('stops every source it starts, and frees its nodes when the last stops', () => {
    for (const linger of [0.5, 1, 2]) {
      const made = play(record({ style: 'shatter', linger }), 2);
      const started = made.filter((n) => n.start.mock.calls.length);
      for (const n of started) expect(n.stop).toHaveBeenCalled();
      const latest = Math.max(...started.map((n) => n.stop.mock.calls[0][0]));
      const last = made.filter((n) => n.onended);
      // Its own (the jab frees its own nodes)
      const own = last.find((n) => n.stop.mock.calls[0][0] === latest);
      expect(own).toBeDefined();
    }
  });

  it("the game's Audio plays it in its style, and its volume knob silences the jab too", () => {
    const { ctx, made } = fakeAudio();
    const audio = Object.assign(Object.create(Audio.prototype), {
      audioContext: ctx,
      initialized: true,
      enabled: true,
      initialize() {},
      sounds: { ...SOUND_CONFIG },
      player: { x: 0, y: 0 },
      masterGain: { kind: 'effects bus' },
      buses: fakeBuses(),
      getContextValue: () => undefined,
      _pausedByGame: false,
      _resuming: false,
    });
    CONFIG.DEATHS.STABBER_VOLUME = 0;
    audio.playStabberDeath(0, 0, 4, record({ style: 'shatter', at: 4 }));
    const [top] = made.filter((n) => n.kind === 'gain');
    expect(top.gain.setValueAtTime.mock.calls[0][0]).toBe(0);
    // The jab is his pizzicato: its own way out goes into the death's
    const jabPan = made.filter((n) => n.kind === 'pan')[1];
    expect(jabPan.connect).toHaveBeenCalledWith(top);
  });
});
