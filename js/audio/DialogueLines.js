// The Dude, looking for his carpet (docs/superpowers/specs/2026-10-03-dude-hero-design.md).
// Every line ducks the band while it plays and holds the one speech slot,
// so the ones said in the fight (damage, lowHealth, levelUp) are at most
// MAX_FIGHT_WORDS words
export const MAX_FIGHT_WORDS = 4;
export const PLAYER_LINES = {
  // The run starts
  start: [
    "WHERE'S MY CARPET?!",
    'THAT CARPET REALLY TIED THE ROOM TOGETHER.',
    'SOMEBODY HAS MY CARPET, MAN.',
    'WHICH ONE OF YOU HAS IT?',
    'I JUST WANT MY CARPET BACK.',
  ],
  // A new level: the next place he looks
  levelUp: [
    'NO CARPET HERE EITHER.',
    'KEEP LOOKING, MAN.',
    'NOT HERE. NEXT.',
    'ANYBODY SEEN A CARPET?',
    "IT'S AROUND HERE SOMEWHERE.",
  ],
  damage: [
    'HEY! CAREFUL, MAN!',
    'NOT THE ROBE!',
    'MY DRINK!',
    'NOT COOL, MAN.',
    "WHERE'S MY CARPET?!",
    'OUT OF YOUR ELEMENT!',
  ],
  lowHealth: [
    'NOT ABIDING, MAN!',
    'THIS WILL NOT STAND!',
    "I'M NOT CALM ANYMORE.",
    'MY CARPET, MAN!',
    'I NEED ANOTHER DRINK.',
  ],
  death: [
    '...THE CARPET...',
    'IT REALLY TIED THE ROOM TOGETHER...',
    'SOMEBODY FIND MY CARPET...',
    'WHAT A DAY, MAN...',
  ],
};

export const GRUNT_LINES = [
  'KILL HUMAN!',
  'DESTROY TARGET!',
  'ELIMINATE!',
  'ATTACK MODE!',
  'HOSTILE DETECTED!',
  'ENGAGE ENEMY!',
  'FIRE WEAPONS!',
  'DEATH TO HUMANS!',
  'WAIT WHAT?',
  'I FORGOT SOMETHING!',
  'WHERE AM I?',
  'HELP!',
  'WRONG PLANET?',
  'NEED BACKUP!',
  'LOST AGAIN!',
  'OOPS!',
  'MY HELMET IS TIGHT!',
  'WIFI PASSWORD?',
  'MOMMY?',
  'SCARED!',
  'IS THAT MY TARGET?',
  'WHICH BUTTON?',
  "I'M CONFUSED!",
];

export const RUSHER_LINES = [
  'KAMIKAZE TIME!',
  'SUICIDE RUN!',
  'INCOMING!',
  'BOOM!',
  'EXPLOSIVE DIARRHEA!',
  'LEEROY JENKINS!',
  'WHEEE!',
  "CAN'T STOP!",
  'YOLO!',
  'KAMIKAZE PIZZA PARTY!',
  // The stuntman (docs/superpowers/specs/2026-10-02-stuntman-rusher-design.md)
  'WATCH THIS!',
  'NO HANDS!',
  'TA-DA!',
];

export const RUSHER_BATTLE_CRIES = [
  'INCOMING!',
  'BOOM!',
  'KAMIKAZE!',
  'WHEEE!',
  'YOLO!',
  "CAN'T STOP!",
  'EXPLOSIVE DIARRHEA!',
  'LEEROY JENKINS!',
  'KAMIKAZE PIZZA PARTY!',
];

export const STABBER_LINES = [
  'STAB!',
  'SLICE!',
  'CUT!',
  'POKE!',
  'ACUPUNCTURE!',
  'LITTLE PRICK!',
  'STABBY MCSTABFACE!',
  'NEEDLE THERAPY!',
  'I COLLECT BELLY BUTTONS!',
];

export const STAB_WARNINGS = [
  'STAB TIME!',
  'SLICE AND DICE!',
  'ACUPUNCTURE TIME!',
  'STABBY MCSTABFACE!',
  // The shiv's, polite about it
  'HOLD STILL, PLEASE!',
  "THIS WON'T HURT!",
  'ONE LITTLE POKE!',
  'YOU LOOK SQUISHY!',
];

export const TANK_ANGER_LINES = [
  'ENOUGH! YOU DIE FIRST!',
  'TARGETING TRAITORS!',
  'FRIENDLY FIRE? NOT ANYMORE!',
  'YOU MADE ME MAD!',
  'TURNING GUNS ON YOU!',
];

export const TANK_CALM_LINES = [
  'BACK TO NORMAL TARGETS',
  'ANGER SUBSIDING',
  'RETURNING TO MISSION',
  'FOCUS ON HUMAN AGAIN',
];

export const TANK_LINES = [
  'HEAVY ARTILLERY!',
  'SIEGE MODE!',
  'CRUSH!',
  'PULVERIZE!',
  'DEVASTATE!',
  'DO YOU LIFT BRO?',
  'SIZE MATTERS!',
  'BIG MUSCLES!',
  'ALPHA MALE!',
  'NOT ON THE LIST!',
  "YOU'RE NOT GETTING IN!",
  'NO SNEAKERS!',
];

function pickRandomLine(lines, randomFn = Math.random, floorFn = Math.floor) {
  return lines[floorFn(randomFn() * lines.length)];
}

export function getPlayerDialogueLine(
  context = 'start',
  randomFn = Math.random,
  floorFn = Math.floor
) {
  const lines = PLAYER_LINES[context] || PLAYER_LINES.start;
  return pickRandomLine(lines, randomFn, floorFn);
}

// Said directly at their call sites
export const GRUNT_OW = 'ow';
export const TANK_FIRE = 'FIRE!';
export const TANK_CHARGING = 'CHARGING!';
// The hero shouts as he plants his bomb, then counts it down, 3, 2, 1, on
// its beats (BombSystem.js)
export const BOMB_PLANTED = 'TIMEBOMB!';
export const COUNTDOWN = ['3', '2', '1'];
// The tank, the beat before the bomb on his back blows (the comma makes his
// voice say it in two: "UH OH" slurs into one vowel)
export const TANK_UH_OH = 'UH, OH';
const distinct = (...lists) => [...new Set(lists.flat())];

// Every fixed line, by the speaker who says it: the voice playground plays
// them all, which is how an engine's mispronunciations get found
export const SPEAKER_LINES = {
  player: distinct(...Object.values(PLAYER_LINES), [BOMB_PLANTED], COUNTDOWN),
  grunt: distinct(GRUNT_LINES, [GRUNT_OW]),
  stabber: distinct(STABBER_LINES, STAB_WARNINGS),
  rusher: distinct(RUSHER_LINES, RUSHER_BATTLE_CRIES),
  tank: distinct(TANK_LINES, TANK_ANGER_LINES, TANK_CALM_LINES, [
    TANK_FIRE,
    TANK_CHARGING,
    TANK_UH_OH,
  ]),
};
