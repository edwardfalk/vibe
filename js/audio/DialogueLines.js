const PLAYER_LINES = {
  start: [
    'RISE!',
    'CRUSH!',
    'BLOOD MOON!',
    'CHAOS!',
    'DANCE DEATH!',
    'COSMIC!',
    'LAUGH!',
    'RIOT!',
  ],
  damage: [
    'PAIN!',
    'BROKEN!',
    'HA!',
    'YOU MISS!',
    'TRY AGAIN!',
    'BITTER!',
    'BLEED!',
    'MAD!',
  ],
  lowHealth: [
    'MORE!',
    'STILL HERE!',
    'NO FEAR!',
    'DEEP CUT!',
    'GASP!',
    'WE CONTINUE!',
    'HOLD FAST!',
    'NEVER DONE!',
  ],
  death: [
    'FALLING...',
    'FAREWELL!',
    'DARKNESS...',
    'SEE YOU...',
    'I END...',
    'GOODBYE...',
    'VOID CALLS!',
    'FADING...',
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
// BombSystem counts the bomb down (WARNING_SECONDS = 3) in the hero's voice
const COUNTDOWN = ['3', '2', '1'];
const distinct = (...lists) => [...new Set(lists.flat())];

// Every fixed line, by the speaker who says it: the voice playground plays
// them all, which is how an engine's mispronunciations get found
export const SPEAKER_LINES = {
  player: distinct(...Object.values(PLAYER_LINES), COUNTDOWN),
  grunt: distinct(GRUNT_LINES, [GRUNT_OW]),
  stabber: distinct(STABBER_LINES, STAB_WARNINGS),
  rusher: distinct(RUSHER_LINES, RUSHER_BATTLE_CRIES),
  tank: distinct(TANK_LINES, TANK_ANGER_LINES, TANK_CALM_LINES, [
    TANK_FIRE,
    TANK_CHARGING,
  ]),
};
