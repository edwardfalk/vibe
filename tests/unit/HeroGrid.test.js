import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { CONFIG } from '../../js/config.js';

// The hero's eighths: straight, or swung onto CONFIG.SWING.AND_AT while a
// bassist is about (BeatClock.wantSwing, applied in a new bar)
describe('the hero grid', () => {
  let ctx;
  let clock;
  const andAt = CONFIG.SWING.AND_AT;
  const at = (beats) => {
    ctx.currentTime = beats * 0.5 - CONFIG.BEAT_CLOCK.AHEAD_MS / 1000;
    clock.update(true);
  };

  beforeEach(() => {
    ctx = { currentTime: 0 };
    clock = new BeatClock(120, ctx);
    clock.startTime = 0;
    at(0);
  });

  afterEach(() => {
    CONFIG.SWING.AND_AT = andAt;
  });

  it('is the straight grid with swing off', () => {
    for (const b of [0, 0.3, 0.5, 0.74, 1.6667, 7.999, 13.25]) {
      expect(clock.heroEighths(b)).toBe(b * 2);
    }
    expect(clock.heroEighthBeat(5)).toBe(2.5);
    expect(clock.heroEighthBeat(6)).toBe(3);
  });

  it('puts the "and" at AND_AT once swing is on, from the next bar', () => {
    CONFIG.SWING.AND_AT = 2 / 3;
    clock.wantSwing(true);
    at(1.2); // the bar it was asked in stays straight
    expect(clock.swingOn).toBe(false);
    expect(clock.heroEighths(1.5)).toBe(3);
    at(4.1); // the next bar swings
    expect(clock.swingOn).toBe(true);
    expect(clock.heroEighths(4 + 2 / 3)).toBeCloseTo(9, 9);
    expect(clock.heroEighths(4 + 1 / 3)).toBeCloseTo(8.5, 9);
    expect(clock.heroEighths(4 + 5 / 6)).toBeCloseTo(9.5, 9);
    expect(clock.heroEighthBeat(9)).toBeCloseTo(4 + 2 / 3, 9);
    expect(clock.heroEighthBeat(10)).toBe(5);
  });

  it('reads AND_AT live, and the eighth count stays two a beat', () => {
    CONFIG.SWING.AND_AT = 0.75;
    clock.wantSwing(true);
    at(4.05);
    expect(clock.heroEighthBeat(9)).toBeCloseTo(4.75, 9);
    expect(Math.floor(clock.heroEighths(4.7))).toBe(8);
    expect(Math.floor(clock.heroEighths(4.76))).toBe(9);
    expect(Math.floor(clock.heroEighths(5.01))).toBe(10);
  });

  it('turns off in the bar after it is no longer wanted', () => {
    clock.wantSwing(true);
    at(4.1);
    expect(clock.swingOn).toBe(true);
    clock.wantSwing(false);
    at(7.9);
    expect(clock.swingOn).toBe(true);
    at(8.0);
    expect(clock.swingOn).toBe(false);
  });

  it('switches on a bar line after a restart too, and reset() turns it off', () => {
    clock.wantSwing(true);
    at(40.2);
    expect(clock.swingOn).toBe(true);
    clock.reset(); // numbers bars from 0 again
    expect(clock.swingOn).toBe(false);
    expect(clock.getBeatPosition()).toBeLessThan(4);
    clock.wantSwing(true);
    ctx.currentTime += 2; // four beats on: a new bar, though a lower number
    clock.update(true);
    expect(clock.swingOn).toBe(true);
  });

  it('switches in a new bar whose number is lower (a slower tempo)', () => {
    at(41);
    clock.setBPM(60); // 20.5 beats: the bar number drops from 10 to 5
    clock.wantSwing(true);
    ctx.currentTime += 4;
    clock.update(true);
    expect(clock.swingOn).toBe(true);
  });

  it('a restart turns it off even when a slower tempo brought the bar number back to 0', () => {
    clock.wantSwing(true);
    at(4.1);
    expect(clock.swingOn).toBe(true);
    clock.setBPM(30); // 2.05 s is beat 1.025: bar 0, and swing still wanted
    expect(clock.swingOn).toBe(true);
    clock.reset();
    expect(clock.swingOn).toBe(false);
  });

  it('times the hero eighths: on one, and the time to the next', () => {
    clock.wantSwing(true);
    at(4.01);
    at(4 + 2 / 3 + 0.01); // 5 ms after the swung "and"
    expect(clock.isOnHeroEighth()).toBe(true);
    expect(clock.getTimeToNextHeroEighth()).toBeCloseTo(500 / 3 - 5, 6);
    at(4.5); // the straight "and" is not his eighth now
    expect(clock.isOnHeroEighth()).toBe(false);
    expect(clock.getTimeToNextHeroEighth()).toBeCloseTo(500 / 6, 6);
  });

  it("leaves the straight eighths alone with swing on: a death's answer reads them", () => {
    clock.wantSwing(true);
    at(4.01);
    at(4.5);
    expect(clock.isOnEighthNote()).toBe(true);
    at(4.3);
    expect(clock.getTimeToNextEighthNote()).toBeCloseTo(100, 6);
  });

  it('matches the straight methods exactly with swing off', () => {
    for (const b of [0.01, 0.2, 0.49, 0.51, 3.97, 6.25]) {
      at(b);
      expect(clock.isOnHeroEighth()).toBe(clock.isOnEighthNote());
      expect(clock.getTimeToNextHeroEighth()).toBeCloseTo(
        clock.getTimeToNextEighthNote(),
        9
      );
    }
  });
});
