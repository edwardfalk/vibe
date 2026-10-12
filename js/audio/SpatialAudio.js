export function calculatePanForPosition(x, playerX) {
  if (x === null || x === undefined) return 0;
  return Math.max(-1, Math.min(1, (x - playerX) / 400));
}

// How far a sound is from the hero: 0 at him, 1 at 600 px and beyond
export function distanceShare(x, y, playerX, playerY) {
  const distance = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
  return Math.min(distance / 600, 1);
}

// How loud: 1 at the hero, falling to 0.4 at 600 px
export function calculateVolumeForPosition(x, y, playerX, playerY) {
  return 1.0 - distanceShare(x, y, playerX, playerY) * 0.6;
}
