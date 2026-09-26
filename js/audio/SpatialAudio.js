export function calculatePanForPosition(x, playerX) {
  if (x === null || x === undefined) return 0;
  return Math.max(-1, Math.min(1, (x - playerX) / 400));
}

export function calculateVolumeForPosition(x, y, playerX, playerY) {
  if (x == null || y == null) return 1.0;

  const distance = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
  const normalizedDistance = Math.max(0, Math.min(distance / 600, 1));
  return Math.max(0.3, 1.0 - normalizedDistance * 0.6);
}
