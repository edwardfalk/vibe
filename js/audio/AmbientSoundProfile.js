export const AMBIENT_SOUNDS = new Set(['gruntAdvance', 'gruntRetreat']);

export function resolveSoundSourcePosition(x, y, playerX, playerY) {
  const hasValidPosition = Number.isFinite(x) && Number.isFinite(y);
  const sourceX = hasValidPosition ? x : playerX;
  const sourceY = hasValidPosition ? y : playerY;
  return { sourceX, sourceY };
}
