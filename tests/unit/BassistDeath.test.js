import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import {
  BassistDeath,
  bassistDeathRecord,
  FIRST_JET_SEC,
  FIZZLE_FROM_SEC,
} from '../../js/entities/BassistDeath.js';
import {
  EnemyDeathHandler,
  popTime,
  STRUM_SEC,
} from '../../js/systems/combat/EnemyDeathHandler.js';
import { heardLatencySec } from '../../js/audio/BeatTrack.js';
import { bassistInk } from '../../js/audio/DeathSounds.js';
import { hz } from '../../js/audio/Harmony.js';
import { Audio } from '../../js/Audio.js';
import { fakeAudio } from './helpers/fakeAudio.js';
import { fakeBuses } from './helpers/audioBuses.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { bassistWorld } from './helpers/bassistWorld.js';
import { transformP5 } from './helpers/transformP5.js';
import { drawBassist } from '../../js/entities/BassistRenderer.js';

// He dies in a cloud of ink: frozen until his death's start, then he blurts
// it and his scroll escapes on his lets (the bassist death spec)
const DEATHS = { ...CONFIG.DEATHS };
afterEach(() => {
  Object.assign(CONFIG.DEATHS, DEATHS);
  vi.restoreAllMocks();
});

function killed(blow = null, aim = null) {
  const explosionManager = { fragmentExplosions: [] };
  const w = bassistWorld({ ms0: 4100, values: { explosionManager } });
  w.audio.ensureAudioContext = vi.fn();
  w.audio.playBassistDeath = vi.fn();
  if (aim !== null) w.b.aim = aim;
  const error = vi.spyOn(console, 'error');
  const diedAt = w.clock.nowSec();
  new EnemyDeathHandler(w.context).handleEnemyDeath(
    w.b,
    'bassist',
    w.b.x,
    w.b.y,
    blow
  );
  return { ...w, explosionManager, error, diedAt };
}

describe('his death', () => {
  it('starts on the next eighth, his own, from a record of the kill', () => {
    const w = killed({ dir: 0.4 });
    expect(w.error).not.toHaveBeenCalled();
    const [death] = w.explosionManager.fragmentExplosions;
    expect(death).toBeInstanceOf(BassistDeath);
    const at = popTime(w.diedAt, w.clock);
    expect(death.startsAt).toBeCloseTo(
      at + heardLatencySec(w.audio.audioContext, w.clock),
      9
    );
    expect(death.record.dir).toBe(0.4);
    // his own pose at the kill, with the kill's snaps
    expect(death.record.pose.aim).toBe(w.b.aim);
    expect(death.record.pose.sinews.map((s) => s.snapped >= 0)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(death.record.pose.strings).toBe(0);
    expect(death.record.jets[0]).toBe(0);
    // its sound from the same record, at its start
    expect(w.audio.playBassistDeath).toHaveBeenCalledWith(
      0,
      0,
      at,
      death.record,
      1
    );
  });

  it('starts with the bang when the bomb killed him', () => {
    const w = killed({ dir: 0, bomb: true, at: 3 });
    const [death] = w.explosionManager.fragmentExplosions;
    expect(death.startsAt).toBeCloseTo(
      3 + heardLatencySec(w.audio.audioContext, w.clock),
      9
    );
  });

  it('falls back to his aim when the blow has no way', () => {
    const w = killed(null, 1.2);
    const [death] = w.explosionManager.fragmentExplosions;
    expect(death.record.dir).toBe(1.2);
  });

  it('several dying together don’t stack up: each next sounds a strum later and quieter, all seen on the start (Edward’s addition)', () => {
    const explosionManager = { fragmentExplosions: [] };
    const w = bassistWorld({ ms0: 4100, values: { explosionManager } });
    w.audio.ensureAudioContext = vi.fn();
    w.audio.playBassistDeath = vi.fn();
    const handler = new EnemyDeathHandler(w.context);
    const at = popTime(w.clock.nowSec(), w.clock);
    for (let i = 0; i < 3; i++) handler.handleEnemyDeath(w.b, 'bassist', 0, 0);
    const calls = w.audio.playBassistDeath.mock.calls;
    calls.forEach(([, , t, , gain], k) => {
      expect(t).toBeCloseTo(at + k * STRUM_SEC, 9);
      expect(gain).toBeCloseTo(1 / Math.sqrt(k + 1), 9);
    });
    expect(calls).toHaveLength(3);
    const starts = explosionManager.fragmentExplosions.map((d) => d.startsAt);
    expect(new Set(starts).size).toBe(1);
    // a later start begins a new count
    w.at(4600);
    handler.handleEnemyDeath(w.b, 'bassist', 0, 0);
    const [, , t, , gain] = calls.at(-1);
    expect(t).toBeCloseTo(popTime(w.clock.nowSec(), w.clock), 9);
    expect(gain).toBe(1);
  });

  it('keeps the count of a start when another start comes between its deaths', () => {
    const explosionManager = { fragmentExplosions: [] };
    const w = bassistWorld({ ms0: 4100, values: { explosionManager } });
    w.audio.ensureAudioContext = vi.fn();
    w.audio.playBassistDeath = vi.fn();
    const handler = new EnemyDeathHandler(w.context);
    const P = popTime(w.clock.nowSec(), w.clock);
    handler.handleEnemyDeath(w.b, 'bassist', 0, 0); // shot: on the next eighth
    handler.handleEnemyDeath(w.b, 'bassist', 0, 0, { bomb: true, at: P - 0.2 }); // the bang
    handler.handleEnemyDeath(w.b, 'bassist', 0, 0); // shot again, the same eighth
    const [, , t, , gain] = w.audio.playBassistDeath.mock.calls[2];
    expect(t).toBeCloseTo(P + STRUM_SEC, 9);
    expect(gain).toBeCloseTo(1 / Math.sqrt(2), 9);
  });

  it('counts his lets from the song’s start and beat, off the grid too', () => {
    const explosionManager = { fragmentExplosions: [] };
    const w = bassistWorld({ ms0: 4100, values: { explosionManager } });
    w.audio.ensureAudioContext = vi.fn();
    w.audio.playBassistDeath = vi.fn();
    w.clock.startTime = w.clock.startTime + 123.4; // the song's start, not on a beat of ours
    new EnemyDeathHandler(w.context).handleEnemyDeath(w.b, 'bassist', 0, 0);
    const [death] = explosionManager.fragmentExplosions;
    const at = w.audio.playBassistDeath.mock.calls[0][2];
    const beatSec = w.clock.beatInterval / 1000;
    const origin = w.clock.startTime / 1000;
    expect(death.record.jets.length).toBeGreaterThan(1);
    // the fizzle on the first let from 0.45 s: within a beat of it
    expect(death.record.fizzle).toBeGreaterThanOrEqual(FIZZLE_FROM_SEC);
    expect(death.record.fizzle).toBeLessThan(FIZZLE_FROM_SEC + beatSec);
    for (const offset of death.record.jets.slice(1)) {
      const beats = (at + offset - origin) / beatSec - CONFIG.SWING.AND_AT;
      expect(beats).toBeCloseTo(Math.round(beats), 6);
    }
  });

  it('spreads the bassists one bomb kills, its bang already past (Edward’s addition)', () => {
    const explosionManager = { fragmentExplosions: [] };
    const w = bassistWorld({ ms0: 4100, values: { explosionManager } });
    w.audio.ensureAudioContext = vi.fn();
    w.audio.playBassistDeath = vi.fn();
    const handler = new EnemyDeathHandler(w.context);
    const bang = w.clock.nowSec() - 0.05; // the eighth that just passed
    for (let i = 0; i < 2; i++) {
      handler.handleEnemyDeath(w.b, 'bassist', 0, 0, { bomb: true, at: bang });
    }
    const calls = w.audio.playBassistDeath.mock.calls;
    expect(calls[0][2]).toBeCloseTo(bang, 9);
    expect(calls[0][4]).toBe(1);
    expect(calls[1][2]).toBeCloseTo(bang + STRUM_SEC, 9);
    expect(calls[1][4]).toBeCloseTo(1 / Math.sqrt(2), 9);
  });

  it('dies where he was, keeps the hero, the linger and his seed from the kill', () => {
    const explosionManager = { fragmentExplosions: [] };
    const player = { x: 200, y: 10 };
    const w = bassistWorld({
      x: 37,
      y: -52,
      ms0: 4100,
      values: { explosionManager, player },
    });
    w.audio.ensureAudioContext = vi.fn();
    w.audio.playBassistDeath = vi.fn();
    CONFIG.DEATHS.LINGER = 1.6;
    new EnemyDeathHandler(w.context).handleEnemyDeath(w.b, 'bassist', 37, -52);
    const [death] = explosionManager.fragmentExplosions;
    expect([death.x, death.y]).toEqual([37, -52]);
    expect(w.audio.playBassistDeath.mock.calls[0].slice(0, 2)).toEqual([
      37, -52,
    ]);
    expect(death.record.linger).toBe(1.6);
    expect(death.record.seed).toBe(w.b.lookSeed);
    expect(death.heroAt()).toEqual({ x: 200 - 37, y: 10 + 52 });
  });

  it('asks a bassist nearby to answer, from its start', () => {
    const explosionManager = { fragmentExplosions: [] };
    const w = bassistWorld({ ms0: 4100, values: { explosionManager } });
    w.audio.ensureAudioContext = vi.fn();
    const other = { type: 'bassist', onNearbyDeath: vi.fn(() => true) };
    w.values.enemies.push(other);
    const diedAt = w.clock.nowSec();
    new EnemyDeathHandler(w.context).handleEnemyDeath(w.b, 'bassist', 0, 0);
    expect(other.onNearbyDeath).toHaveBeenCalledWith(
      w.b,
      popTime(diedAt, w.clock),
      false
    );
    expect(SOUND_CONFIG.bassistResponse.group).toBe('band');
  });
});

// A death of his on its own clock: frozen until 0.25 s, the ink from then
function inkDeath({ hero = () => ({ x: 310, y: 20 }), linger = 1 } = {}) {
  let now = 0;
  const w = bassistWorld();
  w.b.takeDamage(w.b.maxHealth, 0);
  const death = new BassistDeath({
    x: 10,
    y: 20,
    record: bassistDeathRecord({
      linger,
      andAt: 2 / 3,
      beatSec: 0.5,
      origin: 0,
      at: 2, // beat 4: his lets 0.33 and 0.83 s on
      pose: w.b.pose(),
      dir: 1,
      seed: 0.3,
    }),
    diedAt: 0,
    startsAt: 0.25,
    now: () => now,
    hero,
    kickAge: () => 0.1,
  });
  const { p } = transformP5();
  const at = (t) => {
    now = t;
    death.draw(p);
    return death;
  };
  return { death, p, at };
}
// Seconds after its start that it shows: the ink's fade or the scroll's
const showsFor = (r) =>
  Math.max(
    1.25 * r.linger,
    r.fizzle + 0.12 + 0.4 * r.linger,
    r.fizzle + 0.45 * r.linger
  );

describe('the ink', () => {
  it('waits frozen, then blurts, and is gone once all of it has faded', () => {
    const { death, p, at } = inkDeath();
    const ends = 0.25 + showsFor(death.record);
    for (const t of [0.1, 0.25, 0.3, 0.6, 1.1, ends - 0.01]) {
      at(t);
      expect(death.active).toBe(true);
    }
    expect(p.drawingContext.depth).toBe(0);
    expect(p.drawingContext.globalAlpha).toBe(1); // it fades only itself
    at(ends + 0.01);
    expect(death.active).toBe(false);
  });

  it('stays longer with the linger kept at the kill', () => {
    const { death, at } = inkDeath({ linger: 2 });
    at(0.25 + showsFor({ ...death.record, linger: 1 }) + 0.05);
    expect(death.active).toBe(true);
    at(0.25 + showsFor(death.record) + 0.01);
    expect(death.active).toBe(false);
  });

  it('draws at any age it is first drawn', () => {
    for (const t of [0.05, 0.25, 0.4, 0.9, 1.6]) {
      const { death, p, at } = inkDeath();
      at(t);
      expect(death.active).toBe(true);
      expect(p.drawingContext.depth).toBe(0);
    }
  });

  it('keeps the hero’s place from its first frame of ink, though he moves', () => {
    let hero = { x: 10, y: -300 }; // during the wait: straight above him
    const { death, at } = inkDeath({ hero: () => hero });
    at(0.1);
    expect(death.state.esc).toBeUndefined();
    hero = { x: 310, y: 20 }; // at the start: to his right
    at(0.26);
    expect(Math.cos(death.state.esc.E)).toBeCloseTo(-1, 6); // flees left
    hero = { x: 10, y: 320 };
    at(0.6);
    expect(Math.cos(death.state.esc.E)).toBeCloseTo(-1, 6);
  });

  it('a living bassist drawn between two of its frames leaves its scroll as it was', () => {
    const { at, p } = inkDeath();
    const calls = () => {
      const log = [];
      const keep = p.drawingContext;
      p.drawingContext = new Proxy(
        {},
        {
          get: (t, k) =>
            k in t
              ? t[k]
              : (...a) => {
                  log.push(
                    `${String(k)}(${a.map((v) => (typeof v === 'number' ? v.toFixed(6) : typeof v)).join()})`
                  );
                  return { addColorStop() {} };
                },
          set: (t, k, v) => {
            t[k] = v;
            return true;
          },
        }
      );
      at(0.6); // the scroll jetting away, after the ink's start at 0.25
      p.drawingContext = keep;
      return log;
    };
    const before = calls();
    drawBassist(p, 1, bassistWorld().b.pose());
    expect(calls()).toEqual(before);
  });

  it('with no hero, or one on top of him, flees along the blow', () => {
    for (const hero of [
      () => null,
      () => ({ x: 10 + 19, y: 20 }),
      () => ({ x: 10 + 20, y: 20 }),
    ]) {
      const { death, at } = inkDeath({ hero });
      at(0.3);
      expect(death.state.esc.E).toBe(1);
    }
    const { death, at } = inkDeath({ hero: () => ({ x: 10 + 21, y: 20 }) });
    at(0.3);
    expect(Math.cos(death.state.esc.E)).toBeCloseTo(-1, 6);
  });
});

// What his death keeps from the kill: one record, read by its picture and
// its sound alike (the bassist death spec, How he dies)
describe('what his death keeps', () => {
  const BEAT = 0.5;
  const AND = 2 / 3;
  const ORIGIN = 123.456; // the song's start on the audio clock, s
  const record = (o = {}) =>
    bassistDeathRecord({
      linger: 1,
      andAt: AND,
      beatSec: BEAT,
      origin: ORIGIN,
      at: ORIGIN + 4 * BEAT, // on beat 4
      pose: bassistWorld().b.pose(),
      dir: 1,
      seed: 0.3,
      ...o,
    });
  const atBeat = (b) => ORIGIN + b * BEAT;
  const near = (got, want) => {
    expect(got).toHaveLength(want.length);
    want.forEach((w, i) => expect(got[i]).toBeCloseTo(w, 6));
  };

  it('his pose with the kill’s snaps, after an ordinary last shot', () => {
    const w = bassistWorld();
    w.b.takeDamage(9, 0); // three strings gone, one left
    const earlier = w.b.pose().sinews.map((s) => s.snapped);
    w.b.takeDamage(3, 0); // the last, lethal: it stamps no snap
    const { pose } = record({ pose: { ...w.b.pose(), hit: 0.7 } });
    expect(pose.strings).toBe(0);
    expect(pose.plays).toEqual([false, false, false, false]);
    expect(pose.sinews.map((s) => s.snapped)).toEqual([
      ...earlier.slice(0, 3),
      0,
    ]);
    expect(pose.hit).toBe(0);
  });

  it('his pose with the kill’s snaps, after one blow to an unhurt bassist', () => {
    const w = bassistWorld();
    w.b.takeDamage(w.b.maxHealth, 0);
    const { pose } = record({ pose: w.b.pose() });
    expect(pose.sinews.map((s) => s.snapped)).toEqual([0, 0, 0, 0]);
    expect(pose.strings).toBe(0);
  });

  it('his scroll jets on his lets: a jet on each from 0.04 s, the fizzle on the first from 0.45 s', () => {
    near(record().jets, [0, AND * BEAT, (1 + AND) * BEAT]); // from beat 4: lets at 0.33 and 0.83 s
    near(record({ at: atBeat(4.5) }).jets, [
      0,
      (4 + AND - 4.5) * BEAT,
      (5 + AND - 4.5) * BEAT,
    ]);
    near(record({ andAt: 0.75 }).jets, [0, 0.375, 0.875]);
    // a bang off the grid: the let 0.02 s on is too soon for a jet
    near(record({ at: atBeat(4.62) }).jets, [0, (5 + AND - 4.62) * BEAT]);
    expect(record().fizzle).toBeCloseTo((5 + AND - 4) * BEAT, 6);
  });

  it('keeps his lets whatever the linger', () => {
    for (const linger of [0.5, 1, 2])
      near(record({ linger }).jets, record().jets);
  });

  it('decides each threshold within a hair of it, and not beyond', () => {
    const letAt = (sec) => atBeat(5 + AND) - sec; // let 5's offset is `sec`
    const jets = (sec) => record({ at: letAt(sec) }).jets;
    // the first jet's 0.04 s: a let just before it isn't a jet
    expect(jets(FIRST_JET_SEC - 1e-4)).not.toContainEqual(
      expect.closeTo(FIRST_JET_SEC - 1e-4, 6)
    );
    expect(jets(FIRST_JET_SEC - 1e-9)[1]).toBeCloseTo(FIRST_JET_SEC, 6);
    expect(jets(FIRST_JET_SEC + 1e-4)[1]).toBeCloseTo(FIRST_JET_SEC + 1e-4, 6);
    // the fizzle's 0.45 s: on it or after, that let is the fizzle
    expect(record({ at: letAt(FIZZLE_FROM_SEC - 1e-9) }).fizzle).toBeCloseTo(
      FIZZLE_FROM_SEC,
      6
    );
    expect(record({ at: letAt(FIZZLE_FROM_SEC + 1e-4) }).fizzle).toBeCloseTo(
      FIZZLE_FROM_SEC + 1e-4,
      6
    );
    expect(record({ at: letAt(FIZZLE_FROM_SEC - 1e-4) }).fizzle).toBeCloseTo(
      FIZZLE_FROM_SEC - 1e-4 + BEAT,
      6
    );
  });

  it('a beat that isn’t one can’t hang it', () => {
    for (const beatSec of [0, NaN, -0.5]) {
      const r = record({ beatSec });
      expect(r.jets.length).toBeLessThanOrEqual(8);
    }
  });
});

// His death's sound: the blurt, a pluck and a squirt on each middle jet, and
// his last note bent onto the root, all from the same record
describe('the ink’s sound', () => {
  const rec = (o = {}) =>
    bassistDeathRecord({
      linger: 1,
      andAt: 2 / 3,
      beatSec: 0.5,
      origin: 0,
      at: 7, // on a beat: a jet on the let 0.33 s on, then the fizzle at 0.83 s
      pose: bassistWorld().b.pose(),
      dir: 0,
      seed: 0.4,
      ...o,
    });
  const play = (r, at = 7) => {
    const { ctx, made } = fakeAudio();
    bassistInk(
      ctx,
      { kind: 'bus' },
      { at, record: r, noise: { duration: 2 }, volume: 1, pan: 0 }
    );
    return made;
  };
  const startsOf = (made, kind) =>
    made
      .filter((n) => n.kind === kind && n.start.mock.calls.length)
      .map((n) => n.start.mock.calls[0][0]);

  it('books each jet at its start plus its offset, and the fizzle’s note last', () => {
    const r = rec();
    expect(r.jets.length).toBeGreaterThanOrEqual(3);
    const made = play(r);
    const middle = r.jets.slice(1, -1).filter((a) => a >= 0.2);
    expect(middle.length).toBeGreaterThan(0);
    const starts = startsOf(made, 'osc');
    for (const a of middle)
      expect(starts.some((t) => Math.abs(t - (7 + a)) < 1e-9)).toBe(true);
    expect(Math.max(...starts)).toBeCloseTo(7 + r.fizzle, 9);
  });

  it('plucks no jet hard on the blurt: none under 0.2 s', () => {
    const r = rec({ at: 7.25 }); // a quaver before a beat: his let 0.08 s on
    expect(r.jets[1]).toBeLessThan(0.2);
    const made = play(r, 7.25);
    const starts = startsOf(made, 'osc');
    expect(starts.some((t) => Math.abs(t - (7.25 + r.jets[1])) < 1e-6)).toBe(
      false
    );
  });

  it('sounds his last note on his b3 as it drifts at the fizzle', () => {
    const r = rec();
    const t = 7 + r.fizzle;
    expect(Math.abs(hz(['b3', 2], t) - hz(['b3', 2], 7))).toBeGreaterThan(1e-6);
    const made = play(r);
    const last = made.filter(
      (n) => n.kind === 'osc' && n.start.mock.calls[0]?.[0] === t
    );
    expect(last.length).toBeGreaterThan(0);
    for (const o of last) {
      expect(o.frequency.setValueAtTime.mock.calls[0][0]).toBeCloseTo(
        hz(['b3', 2], t),
        6
      );
    }
  });

  it('bends his last note onto the root as it drifts at the fizzle, not the drift-less one', () => {
    const r = rec();
    const t = 7 + r.fizzle;
    expect(Math.abs(hz(['1', 2], t) - hz(['1', 2], 0))).toBeGreaterThan(0.01);
    const made = play(r);
    const bends = made
      .filter((n) => n.kind === 'osc')
      .flatMap((o) =>
        o.frequency.exponentialRampToValueAtTime.mock.calls.map((c) => c[0])
      );
    expect(bends.some((f) => Math.abs(f - hz(['1', 2], t)) < 1e-6)).toBe(true);
  });

  it('sounds every note of his from its start, never the default 440 Hz', () => {
    const made = play(rec());
    const tuned = made.filter(
      (n) => n.kind === 'osc' && n.frequency.setValueAtTime.mock.calls.length
    );
    expect(tuned.length).toBeGreaterThan(3);
    for (const o of tuned) {
      const first = Math.min(
        ...o.frequency.setValueAtTime.mock.calls.map((c) => c[1])
      );
      expect(first).toBeLessThanOrEqual(o.start.mock.calls[0][0]);
    }
  });

  it('makes no node when his band pluck knob is broken, rather than half a sound', () => {
    const knob = CONFIG.BAND.BASS_PLUCK_DB;
    CONFIG.BAND.BASS_PLUCK_DB = NaN;
    try {
      const { ctx, made } = fakeAudio();
      expect(() =>
        bassistInk(
          ctx,
          { kind: 'bus' },
          {
            at: 7,
            record: rec(),
            noise: { duration: 2 },
            volume: 1,
            pan: 0,
          }
        )
      ).toThrow();
      expect(made).toEqual([]);
    } finally {
      CONFIG.BAND.BASS_PLUCK_DB = knob;
    }
  });

  it('stops every source it starts, and frees every node once they end', () => {
    const made = play(rec());
    const started = made.filter((n) => n.start.mock.calls.length);
    expect(started.length).toBeGreaterThan(6);
    for (const n of started) expect(n.stop).toHaveBeenCalled();
    for (const n of made.filter((m) => m.onended)) n.onended();
    for (const n of made) expect(n.disconnect).toHaveBeenCalled();
    // its own nodes go with its last source to stop
    const latest = Math.max(...started.map((n) => n.stop.mock.calls[0][0]));
    expect(
      made.some((n) => n.onended && n.stop.mock.calls[0][0] === latest)
    ).toBe(true);
  });

  it('plays its plucks into its own placed bus, never past it', () => {
    const { ctx, made } = fakeAudio();
    const out = { kind: 'feedback' };
    bassistInk(ctx, out, {
      at: 7,
      record: rec(),
      noise: { duration: 2 },
      volume: 1,
      pan: 0.3,
    });
    const intoOut = made.filter((n) =>
      n.connect.mock.calls.some((c) => c[0] === out)
    );
    expect(intoOut).toHaveLength(1);
    expect(intoOut[0].kind).toBe('pan');
    expect(intoOut[0].pan.setValueAtTime.mock.calls[0][0]).toBe(0.3);
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
    CONFIG.DEATHS.BASSIST_VOLUME = 1.3;
    const placedAt = (x) => {
      const from = made.length;
      audio.playBassistDeath(x, 0, 4, rec({ at: 4 }));
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
    expect(off.gain / here.gain).toBeCloseTo(near, 9);
    CONFIG.DEATHS.BASSIST_VOLUME = 2.6;
    expect(placedAt(0).gain / here.gain).toBeCloseTo(2, 9);
    // one of several dying together: its gain on top
    const from = made.length;
    audio.playBassistDeath(0, 0, 4, rec({ at: 4 }), 0.5);
    const half = made.slice(from).find((n) => n.kind === 'gain');
    expect(half.gain.setValueAtTime.mock.calls[0][0]).toBeCloseTo(here.gain, 9);
    expect(off.pan.pan.setValueAtTime.mock.calls[0][0]).toBeCloseTo(pan, 9);
    expect(off.pan.connect).toHaveBeenCalledWith(audio.buses.feedback);
    CONFIG.DEATHS.BASSIST_VOLUME = 0; // silences the jets' plucks too: they play into it
    expect(placedAt(0).gain).toBe(0);
    const count = made.length;
    audio._pausedByGame = true;
    audio.playBassistDeath(0, 0, 4, rec({ at: 4 }));
    expect(made).toHaveLength(count);
  });
});
