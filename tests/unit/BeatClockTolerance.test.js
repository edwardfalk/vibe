import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { CONFIG } from '../../js/config.js';

describe('BeatClock tolerance constants', () => {
  let clock;

  beforeEach(() => {
    clock = new BeatClock(120, null);
  });

  it('should expose TOLERANCE_BASE derived from config', () => {
    expect(CONFIG.BEAT_TOLERANCES).toBeDefined();
    // Tolerances are now fractions of beat/subdivision interval
    expect(CONFIG.BEAT_TOLERANCES.ON_BEAT).toBe(0.2);
    expect(CONFIG.BEAT_TOLERANCES.EIGHTH_NOTE).toBe(0.08);

    // At 120 BPM (500ms beat), computed ms values should match prior defaults
    expect(clock.tolerance).toBe(100); // 0.20 * 500ms
    expect(clock.eighthNoteTolerance).toBe(20); // 0.08 * 250ms
  });

  it('should use EIGHTH_NOTE tolerance in isOnEighthNote', () => {
    const result = clock.isOnEighthNote();
    expect(typeof result).toBe('boolean');
  });
});

describe('BeatClock reset with beat alignment', () => {
  let clock;

  beforeEach(() => {
    clock = new BeatClock(120, null);
  });

  it('should align startTime to beat grid on reset', () => {
    clock.reset();
    const now = clock._now();
    const elapsed = now - clock.startTime;
    const remainder = elapsed % clock.beatInterval;
    expect(remainder).toBeLessThan(5); // Within 5ms of a beat boundary
  });

  it('should preserve beat grid continuity when called mid-beat', () => {
    // Manually offset startTime to simulate being mid-beat
    clock.startTime = clock._now() - 250; // 250ms into a beat at 120 BPM (500ms interval)
    const oldBeatPhase = (clock._now() - clock.startTime) % clock.beatInterval;
    expect(oldBeatPhase).toBeGreaterThan(200); // Confirm we're mid-beat

    const oldStart = clock.startTime;
    clock.reset();

    // The grid moves by whole beats (beat times unchanged, bar renumbered),
    // and elapsed time stays non-negative. (This used to pass on a negative
    // remainder: a future origin that made isOnBeat() fire early.)
    const shift = clock.startTime - oldStart;
    const offGrid = Math.abs(
      shift - Math.round(shift / clock.beatInterval) * clock.beatInterval
    );
    expect(offGrid).toBeLessThan(1);
    expect(clock._now() - clock.startTime).toBeGreaterThanOrEqual(0);
  });
});
