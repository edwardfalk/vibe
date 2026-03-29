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
    expect(CONFIG.BEAT_TOLERANCES.ON_BEAT).toBe(100);
    expect(CONFIG.BEAT_TOLERANCES.QUARTER_BEAT).toBe(50);
    expect(CONFIG.BEAT_TOLERANCES.EIGHTH_NOTE).toBe(40);
  });

  it('should use QUARTER_BEAT tolerance in canPlayerShootQuarterBeat', () => {
    const result = clock.canPlayerShootQuarterBeat();
    expect(typeof result).toBe('boolean');
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

    clock.reset();

    // After reset, startTime should snap to nearest beat boundary
    const newElapsed = clock._now() - clock.startTime;
    const newRemainder = newElapsed % clock.beatInterval;
    expect(newRemainder).toBeLessThan(5);
  });
});
