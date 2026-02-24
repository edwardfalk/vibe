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

const GRUNT_LINES = [
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

const RUSHER_LINES = [
  'INCOMING!',
  'KAMIKAZE TIME!',
  'SUICIDE RUN!',
  'BOOM BOOM!',
  'DIE WITH ME!',
  'EXPLOSIVE DEATH!',
  'RAMPAGE MODE!',
  'BERSERKER!',
  'DEATH RUSH!',
  'BLAST RADIUS!',
  'DETONATE!',
  'KABOOM!',
  'WHEEEEE!',
  'YOLO BOMB!',
  'CANNONBALL!',
  'ZOOM ZOOM!',
  'TOO FAST!',
  "CAN'T STOP!",
  'EXPLOSIVE DIARRHEA!',
  'REGRET NOTHING!',
  'WITNESS ME!',
  'LEEROY JENKINS!',
  'OOPS BOOM!',
];

const TANK_LINES = [
  'CRUSH ENEMIES!',
  'HEAVY ARTILLERY!',
  'DEVASTATE ALL!',
  'SIEGE MODE!',
  'BIG GUN READY!',
  'UNSTOPPABLE FORCE!',
  'FORTRESS ONLINE!',
  'APOCALYPSE!',
  'OVERWHELMING POWER!',
  'JUGGERNAUT!',
  'PULVERIZE!',
  'DOMINATE!',
  'DO YOU LIFT BRO?',
  'BIG MUSCLES!',
  'ALPHA MALE!',
  'COMPENSATING!',
  'SIZE MATTERS!',
  'PROTEIN POWER!',
  'HULK SMASH!',
  'BEAST MODE!',
  'MY GUN IS BIGGER!',
  'MAXIMUM TESTOSTERONE!',
];

const STABBER_LINES = [
  'STAB TIME!',
  'SLICE AND DICE!',
  'PRECISION CUT!',
  'BLADE READY!',
  'SURGICAL STRIKE!',
  'SHARP DEATH!',
  'KNIFE WORK!',
  'CARVE YOU UP!',
  'CUTTING EDGE!',
  'STABBING SPREE!',
  'DISSECTION!',
  'PIERCE!',
  'ACUPUNCTURE TIME!',
  'JUST A PRICK!',
  'SURGERY!',
  'POKE POKE!',
  'NEEDLE THERAPY!',
  'OOPS SORRY!',
  'STABBY MCSTABFACE!',
  'HUMAN PINCUSHION!',
  'LITTLE SCRATCH!',
  'POINTY DEATH!',
];

const ENEMY_LINE_POOLS = {
  grunt: GRUNT_LINES,
  rusher: RUSHER_LINES,
  tank: TANK_LINES,
  stabber: STABBER_LINES,
};

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

export function getEnemyDialogueLine(
  voiceType,
  randomFn = Math.random,
  floorFn = Math.floor
) {
  const lines = ENEMY_LINE_POOLS[voiceType] || GRUNT_LINES;
  return pickRandomLine(lines, randomFn, floorFn);
}
