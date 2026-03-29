// tests/unit/FrequencyRedistribution.test.js
import { describe, it, expect } from 'vitest';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';

describe('Frequency redistribution', () => {
  it('player sounds should be in low-mid band (150-250Hz)', () => {
    expect(SOUND_CONFIG.playerShoot.frequency).toBe(220);
    expect(SOUND_CONFIG.playerDash.frequency).toBe(200);
  });

  it('rusher sounds should be in upper-mid band (600-800Hz)', () => {
    expect(SOUND_CONFIG.rusherCharge.frequency).toBe(700);
    expect(SOUND_CONFIG.rusherScream.frequency).toBe(750);
  });

  it('explosion should be deeper to avoid grunt territory', () => {
    expect(SOUND_CONFIG.explosion.frequency).toBe(180);
    expect(SOUND_CONFIG.explosion.sweep.to).toBe(60);
  });

  it('tank sounds should remain in sub-bass (35-100Hz)', () => {
    expect(SOUND_CONFIG.tankEnergy.frequency).toBe(90);
    expect(SOUND_CONFIG.tankCharging.frequency).toBe(70);
  });

  it('stabber sounds should remain in high band (1800-2500Hz)', () => {
    expect(SOUND_CONFIG.stabberChant.frequency).toBe(2000);
    expect(SOUND_CONFIG.stabberKnife.frequency).toBe(2400);
  });

  it('grunt sounds should stay in mid band (300-500Hz)', () => {
    expect(SOUND_CONFIG.gruntAdvance.frequency).toBe(400);
    expect(SOUND_CONFIG.gruntRetreat.frequency).toBe(350);
  });
});
