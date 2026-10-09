// tests/unit/FrequencyRedistribution.test.js
import { describe, it, expect } from 'vitest';
import { SOUND_CONFIG } from '../../js/audio/SoundConfig.js';
import { CONFIG } from '../../js/config.js';
import { hz, ROOTS } from '../../js/audio/Harmony.js';

describe('Frequency redistribution', () => {
  it('player sounds should be in low-mid band (150-250Hz)', () => {
    expect(SOUND_CONFIG.playerShoot.frequency).toBe(220);
    expect(SOUND_CONFIG.playerDash.bandHz).toBe(200);
  });

  it('rusher sounds: the charge in the upper mids, the crash above the stabbers and the kick click', () => {
    expect(SOUND_CONFIG.rusherCharge.frequency).toBe(700);
    expect(SOUND_CONFIG.rusherCrash.highpassHz).toBeGreaterThan(2500);
  });

  it('explosion should be deeper to avoid grunt territory', () => {
    expect(SOUND_CONFIG.explosion.frequency).toBe(180);
    expect(SOUND_CONFIG.explosion.sweep.to).toBe(60);
  });

  it('tank sounds should remain in sub-bass (35-100Hz)', () => {
    expect(SOUND_CONFIG.tankEnergy.frequency).toBe(90);
    expect(SOUND_CONFIG.tankCharging.frequency).toBe(70);
  });

  it("stabber sounds stay in the high band: his strings' b5 in octave 6 is 1.8 to 2.5 kHz at every root", () => {
    const root = CONFIG.HUM.ROOT;
    try {
      for (const r of Object.keys(ROOTS)) {
        CONFIG.HUM.ROOT = r;
        expect(hz(['b5', 6])).toBeGreaterThan(1800);
        expect(hz(['b5', 6])).toBeLessThan(2500);
      }
    } finally {
      CONFIG.HUM.ROOT = root;
    }
  });

  it('grunt sounds should stay in mid band (300-500Hz)', () => {
    expect(SOUND_CONFIG.gruntAdvance.frequency).toBe(400);
    expect(SOUND_CONFIG.gruntRetreat.frequency).toBe(350);
  });
});
