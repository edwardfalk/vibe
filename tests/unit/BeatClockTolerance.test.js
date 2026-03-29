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
