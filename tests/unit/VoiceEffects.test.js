import { describe, it, expect, vi, afterEach } from 'vitest';
import { applyVoiceEffects } from '../../js/audio/VoiceEffects.js';
import { VOICE_CONFIG } from '../../js/config.js';

// An utterance as Audio.speak() sets it up: the voice's base rate and pitch
function speak(voiceType, text) {
  const utterance = { ...VOICE_CONFIG[voiceType] };
  applyVoiceEffects(utterance, voiceType, text, VOICE_CONFIG);
  return utterance;
}

describe('Voice effects on aggressive lines', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a grunt goes higher, the hero deeper, never outside the API range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // no jitter
    const grunt = speak('grunt', 'KILL HUMAN!');
    expect(grunt.pitch).toBeGreaterThan(VOICE_CONFIG.grunt.pitch);
    expect(grunt.pitch).toBeLessThanOrEqual(2);

    const hero = speak('player', 'TIME TO KILL!');
    expect(hero.pitch).toBeLessThan(VOICE_CONFIG.player.pitch);
    expect(hero.pitch).toBeGreaterThanOrEqual(0);
  });
});
