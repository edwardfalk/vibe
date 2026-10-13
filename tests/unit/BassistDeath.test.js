import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import {
  BassistDeath,
  DEATH_SEC,
  bassistDeathRecord,
  FIRST_JET_SEC,
  FIZZLE_FROM_SEC,
} from '../../js/entities/BassistDeath.js';
import {
  EnemyDeathHandler,
  popTime,
} from '../../js/systems/combat/EnemyDeathHandler.js';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { bassistWorld } from './helpers/bassistWorld.js';
import { transformP5 } from './helpers/transformP5.js';

// For now he dies his own simple way: the last string snaps, its twang
// sliding down onto the hum's root, and on the next eighth he goes slack and
// drifts off (the bassist spec, Death)
const DEATHS = { ...CONFIG.DEATHS };
afterEach(() => {
  Object.assign(CONFIG.DEATHS, DEATHS);
  vi.restoreAllMocks();
});

function killed(blow = null) {
  const explosionManager = { fragmentExplosions: [] };
  const w = bassistWorld({ ms0: 4100, values: { explosionManager } });
  w.audio.ensureAudioContext = vi.fn();
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
  it('starts on the next eighth, his own, with the twang sliding onto the root', () => {
    const w = killed({ dir: 0 });
    expect(w.error).not.toHaveBeenCalled();
    const [death] = w.explosionManager.fragmentExplosions;
    expect(death).toBeInstanceOf(BassistDeath);
    const at = popTime(w.diedAt, w.clock);
    expect(w.audio.playSound).toHaveBeenCalledWith('bassistDeath', 0, 0, {
      at,
    });
    expect(SOUND_CONFIG.bassistDeath.sweep.to[0]).toBe('1');
  });

  it('starts with the bang when the bomb killed him', () => {
    const w = killed({ dir: 0, bomb: true, at: 3 });
    expect(w.audio.playSound).toHaveBeenCalledWith('bassistDeath', 0, 0, {
      at: 3,
    });
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

  it('draws before and after its start, and is gone once its time is up', () => {
    let now = 0;
    const death = new BassistDeath({
      x: 10,
      y: 20,
      pose: bassistWorld().b.pose(),
      scale: 1,
      dir: 1,
      seed: 0.3,
      diedAt: 0,
      startsAt: 0.25,
      now: () => now,
    });
    const { p } = transformP5();
    for (now of [0.1, 0.3, 0.25 + DEATH_SEC * 0.9]) {
      death.draw(p);
      expect(death.active).toBe(true);
    }
    expect(p.drawingContext.depth).toBe(0);
    expect(p.drawingContext.globalAlpha).toBe(1); // he fades only himself
    CONFIG.DEATHS.LINGER = 2; // remains stay twice as long
    now = 0.25 + DEATH_SEC * 1.5;
    death.draw(p);
    expect(death.active).toBe(true);
    now = 0.25 + DEATH_SEC * 2.01;
    death.draw(p);
    expect(death.active).toBe(false);
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
