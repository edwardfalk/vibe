import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hum, filterTarget } from '../../js/audio/Hum.js';
import { CONFIG } from '../../js/config.js';

// A Web Audio stand-in: every AudioParam records its automation calls as
// [method, ...args] in `calls`, every node what it connects to, and the
// context counts its oscillators
function fakeAudioContext(currentTime = 0) {
  const made = { oscillators: 0 };
  const param = (value) => {
    const p = { value, calls: [] };
    for (const method of [
      'setValueAtTime',
      'setTargetAtTime',
      'linearRampToValueAtTime',
    ]) {
      p[method] = (...args) => {
        p.calls.push([method, ...args]);
        return p;
      };
    }
    return p;
  };
  const node = (extra) => {
    const n = {
      connected: [],
      connect(to) {
        n.connected.push(to);
        return to;
      },
      start() {},
      ...extra,
    };
    return n;
  };
  return {
    currentTime,
    made,
    createOscillator: () => {
      made.oscillators++;
      return node({ type: 'sine', frequency: param(440), detune: param(0) });
    },
    createGain: () => node({ gain: param(1) }),
    createBiquadFilter: () =>
      node({ type: 'lowpass', frequency: param(350), Q: param(1) }),
    createConstantSource: () => node({ offset: param(1) }),
  };
}

// The last setTargetAtTime on a fake param, as [target, time, timeConstant]
const lastTarget = (p) =>
  p.calls.findLast(([method]) => method === 'setTargetAtTime')?.slice(1);
const setTargets = (p) =>
  p.calls.filter(([method]) => method === 'setTargetAtTime').length;
// Each voice's gain: its last target, or its starting value if never moved
const voiceLevels = (hum) =>
  hum.voices.map((v) => lastTarget(v.gain.gain)?.[0] ?? v.gain.gain.value);

const original = structuredClone(CONFIG.HUM);
const originalCap = CONFIG.PACING.MAX_ENEMIES_CAP;

describe('Hum', () => {
  let ctx;
  let hum;
  beforeEach(() => {
    CONFIG.HUM = structuredClone(original);
    CONFIG.HUM.DRIFT_CENTS = 0;
    CONFIG.PACING.MAX_ENEMIES_CAP = 6;
    ctx = fakeAudioContext(1);
    hum = new Hum(ctx, ctx.createGain());
  });
  afterEach(() => {
    CONFIG.HUM = structuredClone(original);
    CONFIG.PACING.MAX_ENEMIES_CAP = originalCap;
  });

  it('opens the filter as enemies fill the screen, up to the cap', () => {
    CONFIG.HUM.CUTOFF_HZ = 400;
    expect(filterTarget(0)).toBe(400);
    expect(filterTarget(3)).toBe(600);
    expect(filterTarget(6)).toBe(800);
    // A preview enemy, or the cap lowered on ?tune mid-fight
    expect(filterTarget(9)).toBe(800);
    CONFIG.PACING.MAX_ENEMIES_CAP = 0;
    expect(filterTarget(3)).toBe(400);
    CONFIG.PACING.MAX_ENEMIES_CAP = 6;
    CONFIG.HUM.FIGHT_OPEN = 0;
    expect(filterTarget(6)).toBe(400);
  });

  it('is silent until the first bar, and plays into the output it was given', () => {
    const out = ctx.createGain();
    const fresh = new Hum(ctx, out);
    expect(fresh.fade.gain.value).toBe(0);
    expect(fresh.levelGain.connected).toContain(out);
  });

  it('builds nothing on a bad root: it throws before any node exists', () => {
    const empty = fakeAudioContext(1);
    const out = empty.createGain();
    CONFIG.HUM.ROOT = 'H';
    expect(() => new Hum(empty, out)).toThrow(/root/);
    expect(empty.made.oscillators).toBe(0);
    expect(out.connected).toEqual([]);
  });

  it('wires voices -> filter -> dip -> fade -> level, with the breath into the cutoff', () => {
    const out = ctx.createGain();
    const wired = new Hum(ctx, out);
    for (const v of wired.voices) {
      expect(v.osc.connected).toEqual([v.gain]);
      expect(v.gain.connected).toEqual([wired.filter]);
    }
    expect(wired.filter.connected).toEqual([wired.dip]);
    expect(wired.dip.connected).toEqual([wired.fade]);
    expect(wired.fade.connected).toEqual([wired.levelGain]);
    expect(wired.levelGain.connected).toEqual([out]);
    expect(wired.breath.connected).toEqual([wired.filter.frequency]);
  });

  it('glides every voice to a new root without making new ones', () => {
    const made = ctx.made.oscillators;
    CONFIG.HUM.ROOT = 'A';
    hum.sync(1, 1, 0);
    expect(ctx.made.oscillators).toBe(made);
    // ×2, ×2, ×3, ×1, then the layers ×4, ×6, ×12
    const expected = [110, 110, 165, 55, 220, 330, 660];
    hum.voices.forEach((v, i) => {
      const [target, time, tau] = lastTarget(v.osc.frequency);
      expect(target).toBeCloseTo(expected[i], 6);
      expect(time).toBe(1);
      expect(tau).toBe(0.1);
    });
  });

  it('carries the drift into every voice', () => {
    CONFIG.HUM.DRIFT_CENTS = 9;
    CONFIG.HUM.ROOT = 'A';
    hum.sync(5, 1, 0);
    // 6.847 cents at t = 5 (Harmony.test.js)
    const [target] = lastTarget(hum.voices[3].osc.frequency);
    expect(target).toBeCloseTo(55 * 2 ** (6.847 / 1200), 3);
  });

  it('fades in only the layers whose level changed, and out again', () => {
    hum.sync(1, 3, 0);
    expect(voiceLevels(hum)).toEqual([0.5, 0.5, 0.25, 0.6, 0.15, 0, 0]);
    hum.sync(1.025, 5, 0);
    hum.sync(1.05, 5, 0); // no change: no new writes
    expect(voiceLevels(hum)).toEqual([0.5, 0.5, 0.25, 0.6, 0.15, 0.05, 0.05]);
    expect(hum.voices.map((v) => setTargets(v.gain.gain))).toEqual([
      0, 0, 0, 0, 1, 1, 1,
    ]);
    hum.sync(2, 1, 0); // a restart
    expect(voiceLevels(hum)).toEqual([0.5, 0.5, 0.25, 0.6, 0, 0, 0]);
  });

  it('sets the filter target and the level on each sync', () => {
    CONFIG.HUM.CUTOFF_HZ = 400;
    CONFIG.HUM.LEVEL_DB = 6;
    hum.sync(1, 1, 6);
    expect(lastTarget(hum.filter.frequency)).toEqual([800, 1, 2]);
    const [level] = lastTarget(hum.levelGain.gain);
    expect(level).toBeCloseTo(10 ** ((-27 + 6) / 20), 9);
  });

  it('dips on the beat and swells back', () => {
    CONFIG.HUM.DIP = 0.6;
    hum.dipAt(3);
    expect(hum.dip.gain.calls).toEqual([
      ['setTargetAtTime', 1 - 0.6, 3, 0.008],
      ['setTargetAtTime', 1, 3 + 0.07, 0.12],
    ]);
  });

  it('breathes on the bars; a restart that moves them bends the breath', () => {
    CONFIG.HUM.CUTOFF_HZ = 400;
    CONFIG.HUM.BREATH = 0.5;
    const swing = 400 * 0.6 * 0.5; // 120 Hz
    hum.barAt(2, 2);
    // The bar line moved half a bar earlier: the old ramp still ends at 4,
    // and this one ends on the new line, so nothing jumps
    hum.barAt(3.5, 2);
    hum.barAt(5.5, 2);
    expect(hum.breath.offset.calls).toEqual([
      ['setValueAtTime', 0, 2],
      ['linearRampToValueAtTime', swing, 2 + 2],
      ['linearRampToValueAtTime', -swing, 3.5 + 2],
      ['linearRampToValueAtTime', swing, 5.5 + 2],
    ]);
    // The fade-in runs once, from the first bar
    expect(hum.fade.gain.calls).toEqual([
      ['setValueAtTime', 0, 2],
      ['linearRampToValueAtTime', 1, 2 + 0.4],
    ]);
  });

  it('holds the breath through missed bars, then carries on from there', () => {
    CONFIG.HUM.CUTOFF_HZ = 400;
    CONFIG.HUM.BREATH = 0.5;
    const swing = 400 * 0.6 * 0.5;
    hum.barAt(2, 2);
    // A stall or a hidden tab skipped the bars at 4 and 6: the next ramp
    // starts from the value held since 4, not from 4 itself
    hum.barAt(8, 2);
    expect(hum.breath.offset.calls).toEqual([
      ['setValueAtTime', 0, 2],
      ['linearRampToValueAtTime', swing, 2 + 2],
      ['setValueAtTime', swing, 8],
      ['linearRampToValueAtTime', -swing, 8 + 2],
    ]);
  });
});
