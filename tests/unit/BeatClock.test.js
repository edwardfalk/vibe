import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeatClock } from '../../js/audio/BeatClock.js';

// Suppress console.log from BeatClock constructor
vi.spyOn(console, 'log').mockImplementation(() => {});

/**
 * Helper: create a mock AudioContext with controllable currentTime.
 */
function createMockAudioContext(initialTime = 0) {
  return { currentTime: initialTime };
}

describe('BeatClock', () => {
  let clock;
  let mockCtx;

  beforeEach(() => {
    mockCtx = createMockAudioContext(0);
    clock = new BeatClock(120, mockCtx);
  });

  it('initializes with correct BPM and interval', () => {
    expect(clock.bpm).toBe(120);
    expect(clock.beatInterval).toBe(500);
    expect(clock.beatsPerMeasure).toBe(4);
  });

  it('computes beat interval from BPM', () => {
    const slow = new BeatClock(60, mockCtx);
    expect(slow.beatInterval).toBe(1000);

    const fast = new BeatClock(240, mockCtx);
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

  it('getTimeToNextEighthNote returns positive value within half-beat', () => {
    mockCtx.currentTime = 0.01;
    clock.update(true);
    const t = clock.getTimeToNextEighthNote();
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThanOrEqual(clock.beatInterval / 2);
  });

  it('isOnEighthNote returns boolean', () => {
    expect(typeof clock.isOnEighthNote()).toBe('boolean');
  });

  // --- New AudioContext-based tests ---

  describe('AudioContext clock source', () => {
    it('uses AudioContext.currentTime when provided', () => {
      expect(clock.audioContext).toBe(mockCtx);
      // Advance mock time by 1 second = 2 beats at 120bpm
      mockCtx.currentTime = 1.0;
      clock.update(true);
      expect(clock.cache.totalBeats).toBe(2);
    });

    it('getCurrentBeat cycles 0-3 across a full measure', () => {
      // 120 BPM = 0.5s per beat
      // Beat 0: t=0.0s, Beat 1: t=0.5s, Beat 2: t=1.0s, Beat 3: t=1.5s
      mockCtx.currentTime = 0.0;
      clock.update(true);
      expect(clock.getCurrentBeat()).toBe(0);

      mockCtx.currentTime = 0.5;
      clock.update(true);
      expect(clock.getCurrentBeat()).toBe(1);

      mockCtx.currentTime = 1.0;
      clock.update(true);
      expect(clock.getCurrentBeat()).toBe(2);

      mockCtx.currentTime = 1.5;
      clock.update(true);
      expect(clock.getCurrentBeat()).toBe(3);

      // Wraps back to 0
      mockCtx.currentTime = 2.0;
      clock.update(true);
      expect(clock.getCurrentBeat()).toBe(0);
    });

    it('canGruntShoot returns true on beats 2 and 4 (0-indexed: 1 and 3)', () => {
      // At beat boundaries, timeToNextBeat = beatInterval, which is within tolerance
      mockCtx.currentTime = 0.5; // beat 1 (0-indexed)
      clock.update(true);
      expect(clock.canGruntShoot()).toBe(true);

      mockCtx.currentTime = 1.5; // beat 3 (0-indexed)
      clock.update(true);
      expect(clock.canGruntShoot()).toBe(true);

      // Should NOT fire on beat 0 or 2
      mockCtx.currentTime = 0.0; // beat 0
      clock.update(true);
      expect(clock.canGruntShoot()).toBe(false);

      mockCtx.currentTime = 1.0; // beat 2
      clock.update(true);
      expect(clock.canGruntShoot()).toBe(false);
    });

    it('canTankShoot returns true only on beat 1 (0-indexed: 0)', () => {
      mockCtx.currentTime = 0.0; // beat 0
      clock.update(true);
      expect(clock.canTankShoot()).toBe(true);

      mockCtx.currentTime = 2.0; // beat 0 again (new measure)
      clock.update(true);
      expect(clock.canTankShoot()).toBe(true);

      // Should NOT fire on other beats
      mockCtx.currentTime = 0.5; // beat 1
      clock.update(true);
      expect(clock.canTankShoot()).toBe(false);

      mockCtx.currentTime = 1.0; // beat 2
      clock.update(true);
      expect(clock.canTankShoot()).toBe(false);

      mockCtx.currentTime = 1.5; // beat 3
      clock.update(true);
      expect(clock.canTankShoot()).toBe(false);
    });

    it('canRusherExplode returns true on beats 1 and 3 (0-indexed: 0 and 2)', () => {
      mockCtx.currentTime = 0.0; // beat 0
      clock.update(true);
      expect(clock.canRusherExplode()).toBe(true);

      mockCtx.currentTime = 1.0; // beat 2
      clock.update(true);
      expect(clock.canRusherExplode()).toBe(true);

      // Should NOT fire on beats 1 and 3
      mockCtx.currentTime = 0.5; // beat 1
      clock.update(true);
      expect(clock.canRusherExplode()).toBe(false);

      mockCtx.currentTime = 1.5; // beat 3
      clock.update(true);
      expect(clock.canRusherExplode()).toBe(false);
    });

    it('falls back to Date.now when no audioContext provided', () => {
      const fallbackClock = new BeatClock(120);
      expect(fallbackClock.audioContext).toBeNull();
      // Should still work — just uses Date.now
      const beat = fallbackClock.getCurrentBeat();
      expect(beat).toBeGreaterThanOrEqual(0);
      expect(beat).toBeLessThan(4);
    });

    it('reset restarts timing from current AudioContext time', () => {
      mockCtx.currentTime = 5.0; // 10 beats elapsed
      clock.update(true);
      expect(clock.cache.totalBeats).toBe(10);

      clock.reset();
      // After reset, elapsed should be 0 (startTime = current _now())
      expect(clock.cache.totalBeats).toBe(0);
    });

    it('getBeatPhase correctness (0.25s at 120bpm = phase 0.5)', () => {
      // At 120 BPM, beat interval = 0.5s
      // 0.25s into a beat = phase 0.5
      mockCtx.currentTime = 0.25;
      clock.update(true);
      expect(clock.getBeatPhase()).toBeCloseTo(0.5, 5);
    });

    it('getMeasurePhase correctness (1.0s at 120bpm = phase 0.5)', () => {
      // Full measure = 4 beats = 2.0s at 120 BPM
      // 1.0s = half a measure = phase 0.5
      mockCtx.currentTime = 1.0;
      clock.update(true);
      expect(clock.getMeasurePhase()).toBeCloseTo(0.5, 5);
    });
  });
});
