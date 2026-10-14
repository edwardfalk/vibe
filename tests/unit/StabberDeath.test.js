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
  STRUM_SEC,
} from '../../js/systems/combat/EnemyDeathHandler.js';
import {
  stabberShell,
  stabberShatter,
  STABBER_DEATH_SOUNDS,
} from '../../js/audio/DeathSounds.js';
import { shatterTimes } from '../../js/entities/StabberShatter.js';
import { hz } from '../../js/audio/Harmony.js';
import { Audio } from '../../js/Audio.js';
import { normalizeAngle } from '../../js/mathUtils.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { fakeAudio } from './helpers/fakeAudio.js';
import { fakeBuses } from './helpers/audioBuses.js';
import { beatWorld } from './helpers/beatWorld.js';
import { transformP5 } from './helpers/transformP5.js';

const DEATHS = { ...CONFIG.DEATHS };
const SOUNDS_DRIFT = CONFIG.HUM.SOUNDS_DRIFT;
afterEach(() => {
  Object.assign(CONFIG.DEATHS, DEATHS);
  CONFIG.HUM.SOUNDS_DRIFT = SOUNDS_DRIFT;
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
    s.takeDamage(1, blow.dir ?? null, 'player_bullet'); // a shot's own damage
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

// Where each point drawn on p's raw context lands on screen: it keeps the
// raw context's own transform (save, restore, translate, rotate, scale)
function screenPoints(p) {
  const raw = p.drawingContext;
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const points = [];
  const at = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const mul = ([a, b, c, d, e, f]) =>
    (m = [
      m[0] * a + m[2] * b,
      m[1] * a + m[3] * b,
      m[0] * c + m[2] * d,
      m[1] * c + m[3] * d,
      m[0] * e + m[2] * f + m[4],
      m[1] * e + m[3] * f + m[5],
    ]);
  const own = {
    save: () => (stack.push(m), raw.save()),
    restore: () => ((m = stack.pop()), raw.restore()),
    translate: (x, y) => mul([1, 0, 0, 1, x, y]),
    scale: (x, y) => mul([x, 0, 0, y, 0, 0]),
    rotate: (a) =>
      mul([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]),
    moveTo: (x, y) => points.push(at(x, y)),
    lineTo: (x, y) => points.push(at(x, y)),
    quadraticCurveTo: (cx, cy, x, y) => points.push(at(x, y)),
    bezierCurveTo: (a, b, c, d, x, y) => points.push(at(x, y)),
  };
  p.drawingContext = new Proxy(raw, {
    get: (t, k) => own[k] ?? t[k],
    set: (t, k, v) => ((t[k] = v), true),
  });
  return { points };
}

describe("when the stabber's death starts", () => {
  it("on the next eighth, at least the voices' lead ahead: his sound then, his picture when it is heard", () => {
    const w = world();
    w.audio.audioContext = { baseLatency: 0.01, outputLatency: 0.02 };
    w.run(0, 300);
    const death = w.kill({ dir: 0 });
    expect(death).toBeInstanceOf(StabberDeath);
    const at = popTime(w.clock.nowSec(), w.clock);
    const [x, y, start, rec] = w.audio.playStabberDeath.mock.calls[0];
    expect([x, y]).toEqual([w.s.x, w.s.y]);
    expect(start).toBeCloseTo(at, 9);
    expect(rec).toBe(death.record);
    expect(death.startsAt).toBeCloseTo(
      at + 0.01 + 0.02 + CONFIG.SKY.OFFSET_MS / 1000,
      9
    );
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

  it('several dying together don’t stack up: each next sounds a strum later and quieter, all seen on the start (the bassist death spec)', () => {
    const w = world();
    w.run(0, 300);
    const deaths = [0, 1, 2].map(() =>
      w.kill({ dir: 0, blast: true, bomb: true, at: 0.33 })
    );
    const calls = w.audio.playStabberDeath.mock.calls;
    expect(calls).toHaveLength(3);
    calls.forEach(([, , t, , gain], k) => {
      expect(t).toBeCloseTo(0.33 + k * STRUM_SEC, 9);
      expect(gain).toBeCloseTo(1 / Math.sqrt(k + 1), 9);
    });
    expect(new Set(deaths.map((d) => d.startsAt)).size).toBe(1);
    // each type counts its own: unlike sounds don't stack in phase
    expect(w.handler.placeAt('tank', 0.33, 0.33)).toBe(0);
    expect(w.handler.placeAt('stabber', 0.33, 0.33)).toBe(3);
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

describe('a type with no death of its own', () => {
  it('logs an error and draws nothing: a rusher never dies of damage, he blows', () => {
    const w = world();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    w.handler.handleEnemyDeath({ type: 'rusher', x: 0, y: 0 }, 'rusher', 0, 0, {
      dir: 0,
    });
    expect(error).toHaveBeenCalledTimes(1);
    expect(w.values.explosionManager.fragmentExplosions).toHaveLength(0);
    expect(w.audio.playSound).not.toHaveBeenCalled();
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

  it('the style and the linger ?tune had at the kill, whatever they say after; an unknown style is the shatter', () => {
    const w = world();
    w.run(0, 300);
    CONFIG.DEATHS.LINGER = 1.7;
    const death = w.kill({ dir: 0 });
    CONFIG.DEATHS.LINGER = 0.5;
    CONFIG.DEATHS.STABBER_STYLE = 'something else';
    expect(death.record.linger).toBe(1.7);
    expect(death.record.style).toBe('shatter');
    expect(record({ style: 'nonsense' }).style).toBe(STABBER_STYLES[0]);
    expect(STABBER_STYLES[0]).toBe('shatter');
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
  it('shuts its eye on the eighth nearest a second times the linger, never before half a second, off the grid too', () => {
    expect(shellShutAt(record({ linger: 1 }))).toBeCloseTo(1, 9);
    expect(shellShutAt(record({ linger: 1.7 }))).toBeCloseTo(1.75, 9); // 6.8 eighths: the 7th
    expect(shellShutAt(record({ linger: 0.5 }))).toBeCloseTo(0.5, 9);
    // Off the grid, the eighths start 0.15 s in: 3.0 is the nearest to 3.1,
    // and 2.75 the first not before 2.6
    expect(shellShutAt(record({ linger: 1, at: 2.1 }))).toBeCloseTo(0.9, 9);
    expect(shellShutAt(record({ linger: 0.5, at: 2.1 }))).toBeCloseTo(0.65, 9);
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

  it("is handed the game's hero, wherever he goes after the kill", () => {
    const w = world();
    w.run(0, 300);
    const death = w.kill({ dir: 0 });
    w.player.x = 500;
    w.player.y = 40;
    expect(death.heroAt()).toEqual({
      x: 500 - death.x,
      y: 40 - death.y,
    });
  });

  it('knows where the hero is each frame, from where he died; with no hero, along his aim', () => {
    const hero = { x: 300, y: 50 };
    const { death } = deathOf(record(), () => hero);
    death.x = 100;
    death.y = 20;
    expect(death.heroAt()).toEqual({ x: 200, y: 30 });
    hero.x = 0;
    expect(death.heroAt()).toEqual({ x: -100, y: 30 });
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
    CONFIG.HUM.SOUNDS_DRIFT = true;
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

  it('frees its nodes when the last source stops, at any linger', () => {
    for (const linger of [0.5, 1, 1.7, 2]) {
      const made = play(record({ linger }), 2);
      const started = made.filter((n) => n.start.mock.calls.length);
      const latest = Math.max(...started.map((n) => n.stop.mock.calls[0][0]));
      const freer = made.filter((n) => n.onended);
      expect(freer).toHaveLength(1);
      expect(freer[0].stop.mock.calls[0][0]).toBe(latest);
    }
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
    // Its level and pan, at the hero and 300 px off to his right
    CONFIG.DEATHS.STABBER_VOLUME = 1.3;
    const placedAt = (x) => {
      const from = made.length;
      audio.playStabberDeath(x, 0, 4, record({ at: 4 }));
      const mine = made.slice(from);
      return {
        gain: mine.find((n) => n.kind === 'gain').gain.setValueAtTime.mock
          .calls[0][0],
        pan: mine.find((n) => n.kind === 'pan'),
      };
    };
    const here = placedAt(0);
    const off = placedAt(300);
    const { near, pan } = audio.placement(300, 0);
    expect(near).toBeLessThan(0.9);
    expect(pan).toBeGreaterThan(0.1);
    expect(off.gain / here.gain).toBeCloseTo(near, 9);
    CONFIG.DEATHS.STABBER_VOLUME = 2.6;
    expect(placedAt(0).gain / here.gain).toBeCloseTo(2, 9);
    // one of several dying together: its gain on top
    const from = made.length;
    audio.playStabberDeath(0, 0, 4, record({ at: 4 }), 0.5);
    const half = made.slice(from).find((n) => n.kind === 'gain');
    expect(half.gain.setValueAtTime.mock.calls[0][0]).toBeCloseTo(here.gain, 9);
    expect(off.pan.pan.setValueAtTime.mock.calls[0][0]).toBeCloseTo(pan, 9);
    expect(off.pan.connect).toHaveBeenCalledWith(audio.buses.feedback);
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

  it("hangs frozen with the blow's way, not the pose's: an earlier shot's flakes trail from the killing one", () => {
    // Shoved by a shot from the right (hitDir π), killed by one from the left
    const pose = { ...record().pose, push: 1, hitDir: Math.PI };
    const firstX = (style) => {
      const { death, at } = deathOf(record({ style, pose, dir: 0 }));
      const { p } = transformP5();
      const xs = [];
      const ctx = p.drawingContext;
      p.drawingContext = new Proxy(ctx, {
        get: (t, k) => (k === 'lineTo' ? (x) => xs.push(x) : t[k]),
      });
      at(1.9);
      death.draw(p);
      return xs[0];
    };
    // His flakes trail behind the push, so against the blow: on his left
    expect(firstX('shell')).toBeLessThan(0);
    expect(firstX('shatter')).toBeLessThan(0);
  });

  it('has a sound for every style it draws, and no other', () => {
    // A style drawn with no sound would throw in Audio.playStabberDeath,
    // inside the kill, and leave the dead stabber in play
    expect(Object.keys(STABBER_DEATH_SOUNDS)).toEqual([...STABBER_STYLES]);
  });

  it('is the style ?tune picks at the kill', () => {
    const w = world();
    w.run(0, 300);
    CONFIG.DEATHS.STABBER_STYLE = 'shell';
    expect(w.kill({ dir: 0 }).record.style).toBe('shell');
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

  it('grows with him: at any ART_SCALE its plates and spike reach as far, in his sizes', () => {
    // The furthest point it draws on screen, its plates' outer edge, before the jab
    const reach = (scale) => {
      const { death, at } = deathOf(shatter({ scale }));
      const { p } = transformP5();
      const ctx = screenPoints(p);
      at(2.3);
      death.draw(p);
      return Math.max(...ctx.points.map(([x, y]) => Math.hypot(x, y)));
    };
    expect(reach(1.6) / reach(1)).toBeCloseTo(1.6, 1);
    expect(reach(0.6) / reach(1)).toBeCloseTo(0.6, 1);
  });

  it('throws its plates along the blow, further for a blast, and the blow carries them', () => {
    const dir = Math.PI / 2; // a blow downward
    const thrown = (o) => {
      const { death, at } = deathOf(shatter({ dir, ...o }));
      at(2.1);
      death.draw(transformP5().p);
      return death.state;
    };
    const sum = (qs) => qs.reduce((a, q) => a + q.go, 0);
    const st = thrown({});
    // The same plates (one seed), thrown by a blow the other way
    const back = thrown({ dir: dir + Math.PI });
    const down = (qs) => qs.filter((q) => Math.cos(q.a - dir) > 0.5);
    expect(down(st.shards).length).toBeGreaterThan(1);
    expect(sum(down(st.shards))).toBeGreaterThan(sum(down(back.shards)) * 1.2);
    expect(st.pushY).toBeGreaterThan(0);
    expect(Math.abs(st.pushX)).toBeLessThan(1e-9);
    const blasted = thrown({ blast: true });
    expect(sum(blasted.shards)).toBeGreaterThan(sum(st.shards) * 1.1);
    expect(blasted.pushY).toBeGreaterThan(st.pushY);
  });

  it('its spike turns to the hero until it crumbles; its dust stays where it crumbled', () => {
    const hero = { x: 0, y: 300 };
    const { death, at } = deathOf(shatter(), () => hero);
    const { p } = transformP5();
    at(2 + 1.02);
    death.draw(p);
    const crumbled = death.state.crumbledAt;
    expect(crumbled).toBeDefined();
    // Its blade points at him as it crumbles
    const [x, y, a] = crumbled;
    expect(normalizeAngle(a - Math.atan2(hero.y - y, hero.x - x))).toBeCloseTo(
      0,
      6
    );
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
    CONFIG.HUM.SOUNDS_DRIFT = true;
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

  it('hisses only white-hot', () => {
    const sources = (rec) =>
      play(rec, 2).filter((n) => n.kind === 'source').length;
    const cold = record({ style: 'shatter' });
    const hot = record({
      style: 'shatter',
      pose: { ...record().pose, lunge: { k: 0.2 } },
    });
    expect(sources(hot)).toBe(sources(cold) + 1);
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
