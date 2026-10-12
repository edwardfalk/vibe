import { describe, it, expect, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { volleyGain } from '../../js/systems/GruntSwarm.js';
import { bassistWorld } from './helpers/bassistWorld.js';

// He plays the let of every beat: ghost plucks on 1 to 3, the slap on 4,
// each once and on its grid time (the bassist spec, His bar and Timing)
const DEFAULTS = { ...CONFIG.BASSIST };
const AND_AT = CONFIG.SWING.AND_AT;
const AT0 = CONFIG.BEAT_CLOCK.AHEAD_MS / 1000; // a beat world's grid origin, s
const letAt = (n) => AT0 + (n + CONFIG.SWING.AND_AT) * 0.5; // let n's grid time
const letMs = (n) => (n + CONFIG.SWING.AND_AT) * 500; // when the game reaches it

afterEach(() => {
  Object.assign(CONFIG.BASSIST, DEFAULTS);
  CONFIG.SWING.AND_AT = AND_AT;
});

// Bar 1 (beats 4 to 8), from a bassist made just before it
function barOne({ health } = {}) {
  const w = bassistWorld({ ms0: 1990 });
  if (health !== undefined) w.b.health = health;
  w.run(2000, 3999);
  return w;
}

describe('his lets', () => {
  it('plucks lets 1 to 3 and slaps on 4, at their grid times, walking up to b7', () => {
    const w = barOne();
    const plays = w.plays();
    expect(plays.map((p) => p.name)).toEqual([
      'bassPluck',
      'bassPluck',
      'bassPluck',
      'bassSlap',
    ]);
    plays.forEach((p, k) => expect(p.at).toBeCloseTo(letAt(4 + k), 9));
    expect(plays.map((p) => p.note)).toEqual([
      ['b3', 2],
      ['4', 2],
      ['5', 2],
      ['b7', 2],
    ]);
    for (const p of plays) {
      expect(p.seed).toBe(w.b.lookSeed);
      expect(p.exact).toBe(true); // booked on the let, not its nearest eighth
    }
  });

  it('drops plucks in order as strings snap; the slap stays to the last', () => {
    const notes = (health) =>
      barOne({ health })
        .plays()
        .map((p) => p.note[0]);
    expect(notes(12)).toEqual(['b3', '4', '5', 'b7']);
    expect(notes(9)).toEqual(['4', '5', 'b7']);
    expect(notes(6)).toEqual(['5', 'b7']);
    expect(notes(3)).toEqual(['b7']);
    expect(notes(1)).toEqual(['b7']);
  });

  it('plays the octave CONFIG.BASSIST.OCTAVE', () => {
    CONFIG.BASSIST.OCTAVE = 3;
    expect(barOne().plays()[0].note).toEqual(['b3', 3]);
  });

  it('plays a let reached a little late on its grid time; one later than half its gap is dropped', () => {
    const w = bassistWorld({ ms0: 1990 });
    w.step(letMs(4) + 60); // 60 ms late: under (1 − 2/3) / 2 beat (83 ms)
    w.step(letMs(5) + 100); // 100 ms late: dropped
    w.run(letMs(5) + 116, letMs(6) + 10);
    const plays = w.plays();
    expect(plays.map((p) => p.note[0])).toEqual(['b3', '5']);
    expect(plays[0].at).toBeCloseTo(letAt(4), 9);
  });

  it('never replays a let when AND_AT rises', () => {
    const w = bassistWorld({ ms0: 1990 });
    w.step(letMs(4) + 5);
    CONFIG.SWING.AND_AT = 0.75;
    w.step(4.76 * 500); // past let 4 again, at the new AND_AT
    expect(w.plays()).toHaveLength(1);
  });

  it('a let 3 he reaches too late locks nothing, so that bar has no slap', () => {
    const w = bassistWorld({ ms0: 1990 });
    w.run(2000, letMs(6) - 10);
    const fired = [w.step(letMs(6) + 100)]; // let 3, 100 ms late: dropped
    fired.push(...w.run(letMs(6) + 116, 3999).map((e) => e.r));
    expect(fired.filter(Boolean)).toEqual([]);
    expect(w.plays().map((p) => p.name)).not.toContain('bassSlap');
  });

  it('never slaps without a let 3 before it: a fresh one waits a whole count', () => {
    const w = bassistWorld({ ms0: letMs(6) + 20 }); // made just after let 3
    w.run(letMs(6) + 30, 5999);
    const names = w.plays().map((p) => p.name);
    expect(names).toEqual(['bassPluck', 'bassPluck', 'bassPluck', 'bassSlap']);
    expect(w.plays()[0].at).toBeCloseTo(letAt(8), 9); // all from bar 2
  });

  it('a crowd of him plays quieter, by the volley rule; one still spawning or gone does not count', () => {
    const w = bassistWorld({ ms0: 1990 });
    w.values.enemies.push(
      { type: 'bassist', isSpawning: false },
      { type: 'bassist', isSpawning: true },
      { type: 'bassist', markedForRemoval: true },
      { type: 'grunt' }
    );
    w.run(2000, letMs(4) + 20);
    expect(w.plays()[0].gain).toBeCloseTo(volleyGain(2), 9);
    expect(volleyGain(2)).toBeCloseTo(
      10 ** (CONFIG.SWARM.VOLLEY_DB_PER_DOUBLING / 20),
      9
    );
  });

  it('puffs, and lurches, on each let he plays, not on one he drops', () => {
    const speed = (w) => Math.hypot(w.b.push.x, w.b.push.y);
    const full = bassistWorld({ ms0: 1990 });
    full.run(2000, letMs(4) - 20);
    expect(speed(full)).toBe(0);
    full.step(letMs(4) + 5);
    const { LURCH_PX_S, PUFF_KEEP } = CONFIG.BASSIST;
    const frames = 16 / CONFIG.GAME_SETTINGS.FRAME_TIME_MS; // one update
    expect(speed(full)).toBeCloseTo(LURCH_PX_S * PUFF_KEEP ** frames, 6);
    expect(full.b.puffAt).toBeCloseTo((letMs(4) + 5) / 500, 9);
    const hurt = bassistWorld({ ms0: 1990 });
    hurt.b.health = 9; // let 1's string gone
    hurt.run(2000, letMs(4) + 5);
    expect(speed(hurt)).toBe(0);
    expect(hurt.b.puffAt).toBeNull();
  });
});
