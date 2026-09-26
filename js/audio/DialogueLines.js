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
