import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeatClock } from '../../js/audio/BeatClock.js';

// Suppress console.log from BeatClock constructor
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('BeatClock', () => {
  let clock;

  beforeEach(() => {
    clock = new BeatClock(120);
  });

  it('initializes with correct BPM and interval', () => {
    expect(clock.bpm).toBe(120);
    expect(clock.beatInterval).toBe(500);
    expect(clock.beatsPerMeasure).toBe(4);
  });

  it('computes beat interval from BPM', () => {
    const slow = new BeatClock(60);
    expect(slow.beatInterval).toBe(1000);

    const fast = new BeatClock(240);
    expect(fast.beatInterval).toBe(250);
  });

  it('getCurrentBeat returns 0-3 range', () => {
    const beat = clock.getCurrentBeat();
    expect(beat).toBeGreaterThanOrEqual(0);
    expect(beat).toBeLessThan(4);
  });

  it('getTotalBeats returns non-negative integer', () => {
    const total = clock.getTotalBeats();
    expect(total).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(total)).toBe(true);
  });

  it('getTimeToNextBeat is within beat interval', () => {
    const t = clock.getTimeToNextBeat();
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThanOrEqual(clock.beatInterval);
  });

  it('setBPM updates tempo', () => {
    clock.setBPM(60);
    expect(clock.bpm).toBe(60);
    expect(clock.beatInterval).toBe(1000);
  });

  it('reset restarts timing', () => {
    const before = clock.getTotalBeats();
    clock.reset();
    const after = clock.getTotalBeats();
    expect(after).toBeLessThanOrEqual(before);
  });

  it('getBeatPhase returns 0..1', () => {
    const phase = clock.getBeatPhase();
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(1);
  });

  it('getBeatIntensity returns positive value <= 1', () => {
    const intensity = clock.getBeatIntensity();
    expect(intensity).toBeGreaterThan(0);
    expect(intensity).toBeLessThanOrEqual(1);
  });

  it('getMeasurePhase returns 0..1', () => {
    const phase = clock.getMeasurePhase();
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(1);
  });

  it('isOnBeat with beat filter checks specific beats', () => {
    // isOnBeat([...]) should always return boolean
    const result = clock.isOnBeat([1, 3]);
    expect(typeof result).toBe('boolean');
  });

  it('canPlayerShootQuarterBeat returns boolean', () => {
    expect(typeof clock.canPlayerShootQuarterBeat()).toBe('boolean');
  });

  it('getTimeToNextQuarterBeat is positive', () => {
    const t = clock.getTimeToNextQuarterBeat();
    expect(t).toBeGreaterThan(0);
  });

  it('getBeatInfo returns structured object', () => {
    const info = clock.getBeatInfo();
    expect(info).toHaveProperty('currentBeat');
    expect(info).toHaveProperty('totalBeats');
    expect(info).toHaveProperty('timeToNext');
    expect(info).toHaveProperty('onBeat');
    expect(info).toHaveProperty('bpm');
    expect(info.currentBeat).toBeGreaterThanOrEqual(1);
    expect(info.currentBeat).toBeLessThanOrEqual(4);
  });

  it('currentBeat getter matches getCurrentBeat()', () => {
    expect(clock.currentBeat).toBe(clock.getCurrentBeat());
  });
});
