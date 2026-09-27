// Each speaker gets one voice and keeps it line to line. A voice named in
// CONFIG.VOICES (the ?tune dropdowns) wins; 'auto' or a name this browser
// doesn't have means pick one. Picked voices are handed out together, in
// SPEAKERS order, around the named ones: each speaker takes the first voice
// nobody has yet whose name has one of its hint words (earlier hints win),
// else the first free voice from its fixed spot in the list. Speakers only
// share a voice once every voice is taken. Hints are whole words, so 'male'
// doesn't match 'Female'.
export const SPEAKERS = ['player', 'tank', 'stabber', 'rusher', 'grunt'];

// The voices the game speaks with: English, US or GB
export const englishVoicesOf = (voices) =>
  voices.filter(
    (voice) =>
      voice.lang.startsWith('en-') &&
      (voice.lang.includes('US') || voice.lang.includes('GB'))
  );
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

function assignVoices(voices, named) {
  const taken = new Set(Object.values(named));
  const byType = { ...named };
  for (const type of SPEAKERS) {
    if (byType[type]) continue;
    const free = voices.filter((voice) => !taken.has(voice));
    let pick;
    for (const word of VOICE_HINTS[type]) {
      pick = free.find((voice) => hasWord(voice, word));
      if (pick) break;
    }
    if (!pick) {
      const start = Math.min(
        voices.length - 1,
        Math.floor(FALLBACK_AT[type] * voices.length)
      );
      const order = [...voices.slice(start), ...voices.slice(0, start)];
      pick = order.find((voice) => !taken.has(voice)) ?? voices[start];
    }
    taken.add(pick);
    byType[type] = pick;
  }
  return byType;
}

export function selectVoice(
  englishVoices = [],
  voiceType = 'player',
  chosen = {}
) {
  if (englishVoices.length === 0) return null;
  const named = {};
  for (const type of SPEAKERS) {
    const voice = englishVoices.find((v) => v.name === chosen[type]);
    if (voice) named[type] = voice;
  }
  const usVoices = englishVoices.filter((voice) => voice.lang.includes('US'));
  const voices = usVoices.length > 0 ? usVoices : englishVoices;
  const byType = assignVoices(voices, named);
  return byType[voiceType] ?? byType.player;
}
