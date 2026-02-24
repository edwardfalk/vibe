export const AMBIENT_SOUNDS = new Set([
  'enemyIdle',
  'stabberChant',
  'gruntAdvance',
  'gruntRetreat',
  'stabberStalk',
  'gruntMalfunction',
  'gruntBeep',
  'gruntWhir',
  'gruntError',
  'gruntGlitch',
]);

export function resolveSoundSourcePosition(x, y, playerX, playerY) {
  const hasValidPosition = Number.isFinite(x) && Number.isFinite(y);
  const sourceX = hasValidPosition ? x : playerX;
  const sourceY = hasValidPosition ? y : playerY;
  return { sourceX, sourceY };
}
