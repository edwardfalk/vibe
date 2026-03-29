import { describe, it, expect } from 'vitest';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';

describe('Enemy hit reaction sounds', () => {
  it('tankHit should be a deep thud at 55Hz', () => {
    expect(SOUND_CONFIG.tankHit).toBeDefined();
    expect(SOUND_CONFIG.tankHit.frequency).toBe(55);
    expect(SOUND_CONFIG.tankHit.type).toBe('sine');
    expect(SOUND_CONFIG.tankHit.duration).toBe(0.2);
  });

  it('stabberHit should be a metallic ping at 2100Hz', () => {
    expect(SOUND_CONFIG.stabberHit).toBeDefined();
    expect(SOUND_CONFIG.stabberHit.frequency).toBe(2100);
    expect(SOUND_CONFIG.stabberHit.type).toBe('triangle');
    expect(SOUND_CONFIG.stabberHit.duration).toBe(0.04);
  });

  it('rusherHit should be an angry buzz at 650Hz', () => {
    expect(SOUND_CONFIG.rusherHit).toBeDefined();
    expect(SOUND_CONFIG.rusherHit.frequency).toBe(650);
    expect(SOUND_CONFIG.rusherHit.type).toBe('sawtooth');
    expect(SOUND_CONFIG.rusherHit.duration).toBe(0.08);
  });

  it('gruntHit should be a surprised beep at 450Hz', () => {
    expect(SOUND_CONFIG.gruntHit).toBeDefined();
    expect(SOUND_CONFIG.gruntHit.frequency).toBe(450);
    expect(SOUND_CONFIG.gruntHit.type).toBe('square');
    expect(SOUND_CONFIG.gruntHit.duration).toBe(0.06);
  });
});
