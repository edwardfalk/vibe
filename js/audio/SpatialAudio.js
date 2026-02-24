export function calculatePanForPosition(x, playerX = 400) {
  if (x === null || x === undefined) return 0;
  return Math.max(-1, Math.min(1, (x - playerX) / 400));
}

export function calculateVolumeForPosition(x, y, playerX = 400, playerY = 300) {
  if (x === null || y === null) return 1.0;

  const distance = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
  const normalizedDistance = Math.min(distance / 600, 1);
  return Math.max(0.3, 1.0 - normalizedDistance * 0.6);
}
