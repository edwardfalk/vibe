const SPATIAL_GRID_CELL_SIZE = 120;

export function buildEnemySpatialGrid(enemies) {
  if (!enemies || enemies.length === 0) return null;

  const cellSize = SPATIAL_GRID_CELL_SIZE;
  const grid = new Map();
  let maxEnemySize = 0;

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    const cellX = Math.floor(enemy.x / cellSize);
    const cellY = Math.floor(enemy.y / cellSize);
    const key = `${cellX},${cellY}`;

    if (!grid.has(key)) {
      grid.set(key, []);
    }
    grid.get(key).push(i);
    maxEnemySize = Math.max(maxEnemySize, Number(enemy.size) || 0);
  }

  return { grid, cellSize, maxEnemySize };
}

export function queryNearbyEnemyIndices(spatialGrid, bullet) {
  if (!spatialGrid || !bullet) return [];

  const currentX = Number.isFinite(bullet.x) ? bullet.x : 0;
  const currentY = Number.isFinite(bullet.y) ? bullet.y : 0;
  const prevX = Number.isFinite(bullet.prevX) ? bullet.prevX : currentX;
  const prevY = Number.isFinite(bullet.prevY) ? bullet.prevY : currentY;
  const bulletSize = Number(bullet.size) || 0;
  const expansion = bulletSize + spatialGrid.maxEnemySize;

  const minX = Math.min(prevX, currentX) - expansion;
  const maxX = Math.max(prevX, currentX) + expansion;
  const minY = Math.min(prevY, currentY) - expansion;
  const maxY = Math.max(prevY, currentY) + expansion;
  const minCellX = Math.floor(minX / spatialGrid.cellSize);
  const maxCellX = Math.floor(maxX / spatialGrid.cellSize);
  const minCellY = Math.floor(minY / spatialGrid.cellSize);
  const maxCellY = Math.floor(maxY / spatialGrid.cellSize);

  const uniqueIndices = new Set();

  for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
    for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
      const key = `${cellX},${cellY}`;
      const bucket = spatialGrid.grid.get(key);
      if (!bucket) continue;

      for (let i = 0; i < bucket.length; i++) {
        uniqueIndices.add(bucket[i]);
      }
    }
  }

  return Array.from(uniqueIndices).sort((a, b) => b - a);
}
