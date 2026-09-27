// Each speaker gets one voice and keeps it line to line: the first voice
// whose name has one of its hint words (earlier hints win), else a fixed
// place in the list, spread out so the speakers sound different.
// Hints are whole words, so 'male' doesn't match 'Female'.
const VOICE_HINTS = {
  player: [
    'deep',
    'bass',
    'rich',
    'low',
    'resonant',
    'male',
    'david',
    'alex',
    'james',
    'john',
    'michael',
    'mark',
    'paul',
    'daniel',
    'tom',
    'sam',
  ],
  grunt: ['high', 'child', 'junior', 'squeaky', 'zira', 'flo', 'grandma'],
  rusher: [
    'female',
    'high',
    'fast',
    'excited',
    'energetic',
    'zira',
    'samantha',
    'karen',
    'moira',
  ],
  tank: [
    'deep',
    'bass',
    'low',
    'heavy',
    'strong',
    'male',
    'david',
    'daniel',
    'alex',
  ],
  stabber: [
    'clear',
    'precise',
    'clinical',
    'sharp',
    'articulate',
    'google',
    'reed',
    'compact',
  ],
};

// Where in the list each speaker falls back to, as a share of its length
const FALLBACK_AT = {
  player: 0,
  tank: 0.25,
  stabber: 0.5,
  rusher: 0.75,
  grunt: 1,
};

const hasWord = (voice, word) =>
  new RegExp(`\\b${word}\\b`).test(voice.name.toLowerCase());

export function selectVoice(englishVoices = [], voiceType = 'player') {
  if (englishVoices.length === 0) return null;
  const usVoices = englishVoices.filter((voice) => voice.lang.includes('US'));
  const voices = usVoices.length > 0 ? usVoices : englishVoices;

  for (const word of VOICE_HINTS[voiceType] ?? []) {
    const match = voices.find((voice) => hasWord(voice, word));
    if (match) return match;
  }
  const at = FALLBACK_AT[voiceType] ?? 0;
  return voices[Math.min(voices.length - 1, Math.floor(at * voices.length))];
}
