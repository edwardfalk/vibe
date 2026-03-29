import { describe, it, expect } from 'vitest';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';

describe('Call-and-response sound configs', () => {
  it('gruntResponse should be an alarmed chirp at 380Hz', () => {
    expect(SOUND_CONFIG.gruntResponse).toBeDefined();
    expect(SOUND_CONFIG.gruntResponse.frequency).toBe(380);
    expect(SOUND_CONFIG.gruntResponse.type).toBe('square');
    expect(SOUND_CONFIG.gruntResponse.duration).toBe(0.1);
  });

  it('tankResponse should be a low acknowledgment at 70Hz', () => {
    expect(SOUND_CONFIG.tankResponse).toBeDefined();
    expect(SOUND_CONFIG.tankResponse.frequency).toBe(70);
    expect(SOUND_CONFIG.tankResponse.type).toBe('sine');
    expect(SOUND_CONFIG.tankResponse.duration).toBe(0.3);
  });

  it('stabberResponse should be a sharp hiss at 2300Hz', () => {
    expect(SOUND_CONFIG.stabberResponse).toBeDefined();
    expect(SOUND_CONFIG.stabberResponse.frequency).toBe(2300);
    expect(SOUND_CONFIG.stabberResponse.type).toBe('triangle');
    expect(SOUND_CONFIG.stabberResponse.duration).toBe(0.06);
  });

  it('rusherResponse should be an agitated whine sweeping 720->500Hz', () => {
    expect(SOUND_CONFIG.rusherResponse).toBeDefined();
    expect(SOUND_CONFIG.rusherResponse.frequency).toBe(720);
    expect(SOUND_CONFIG.rusherResponse.type).toBe('sawtooth');
    expect(SOUND_CONFIG.rusherResponse.duration).toBe(0.15);
  });
});
