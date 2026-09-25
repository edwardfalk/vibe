import { describe, it, expect } from 'vitest';
import { SOUND_CONFIG, TONE_ATTACK_SEC } from '../../js/audio/SoundConfig.js';

describe('SOUND_CONFIG', () => {
  it('every tone is long enough for its attack plus a decay', () => {
    // playTone varies duration by ±10%
    for (const [name, cfg] of Object.entries(SOUND_CONFIG)) {
      expect(cfg.duration * 0.9, name).toBeGreaterThanOrEqual(
        3 * TONE_ATTACK_SEC
      );
    }
  });
});
