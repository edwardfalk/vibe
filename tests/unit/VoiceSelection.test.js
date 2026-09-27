import { describe, it, expect } from 'vitest';
import { selectVoice } from '../../js/audio/VoiceSelection.js';

const voice = (name, lang = 'en-US') => ({ name, lang });

describe('selectVoice', () => {
  it('gives a speaker the same voice on every line', () => {
    const voices = [
      voice('Zira'),
      voice('Samantha'),
      voice('Karen'),
      voice('Moira'),
    ];
    const picks = new Set(
      Array.from({ length: 20 }, () => selectVoice(voices, 'rusher'))
    );
    expect(picks.size).toBe(1);
  });

  it("matches hints as whole words: 'male' is not 'Female'", () => {
    const voices = [
      voice('Google US English Female'),
      voice('Google US English Male'),
    ];
    // The hero picks first; his 'male' hint must skip the Female voice
    expect(selectVoice(voices, 'player').name).toBe('Google US English Male');
  });

  it('spreads speakers over the list when no name matches a hint', () => {
    const voices = ['a', 'b', 'c', 'd', 'e'].map((n) =>
      voice(`English (America) ${n}`)
    );
    const picks = ['player', 'tank', 'stabber', 'rusher', 'grunt'].map(
      (type) => selectVoice(voices, type).name
    );
    expect(new Set(picks).size).toBe(5);
  });

  it("doesn't give two speakers the same voice while others are free", () => {
    const voices = [
      'Google US English',
      'English (America)',
      'English (America, New York City)',
      'Alex',
      'Samantha',
    ].map((n) => voice(n));
    const picks = ['player', 'tank', 'stabber', 'rusher', 'grunt'].map(
      (type) => selectVoice(voices, type).name
    );
    expect(new Set(picks).size).toBe(5);
  });

  it('prefers US voices and returns null with none', () => {
    expect(selectVoice([voice('UK', 'en-GB'), voice('US')]).name).toBe('US');
    expect(selectVoice([], 'grunt')).toBeNull();
  });
});
