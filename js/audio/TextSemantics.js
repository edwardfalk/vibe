const AGGRESSIVE_WORDS = [
  'KILL',
  'DEATH',
  'DESTROY',
  'BLOOD',
  'TEAR',
  'CRUSH',
  'OBLITERATE',
  'VIOLENCE',
  'CARNAGE',
  'ANNIHILATION',
  'CARVE',
  'SLICE',
  'BUTCHER',
];

const CONFUSED_WORDS = [
  'WAIT',
  'UH',
  'THINK',
  'MAYBE',
  'PROBABLY',
  '?',
  'FORGOT',
  'LOST',
];

export function isAggressiveText(text = '') {
  return AGGRESSIVE_WORDS.some((word) => text.includes(word));
}

export function isConfusedText(text = '') {
  return CONFUSED_WORDS.some((word) => text.includes(word));
}

export function isScreamingText(text = '') {
  return text.includes('!') || text.includes('AHHH') || text.includes('WHEEE');
}
