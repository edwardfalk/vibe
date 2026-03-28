const SPATIAL_GRID_CELL_SIZE = 120;

// Encode cell coordinates into a single numeric key to avoid string allocation.
// Offset by 10000 to handle negative cell coordinates without collision.
const CELL_KEY_STRIDE = 100003;
function cellKey(cx, cy) {
  return (cx + 10000) * CELL_KEY_STRIDE + (cy + 10000);
}

// Reusable grid state to avoid per-frame allocation
const _grid = new Map();
const _spatialResult = {
  grid: _grid,
  cellSize: SPATIAL_GRID_CELL_SIZE,
  maxEnemySize: 0,
};

export function buildEnemySpatialGrid(enemies) {
  if (!enemies || enemies.length === 0) return null;

  const cellSize = SPATIAL_GRID_CELL_SIZE;
  // Clear and reuse existing Map - avoids allocating a new one each frame
  _grid.clear();
  let maxEnemySize = 0;

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    const key = cellKey(
      Math.floor(enemy.x / cellSize),
      Math.floor(enemy.y / cellSize)
    );

    let bucket = _grid.get(key);
    if (bucket === undefined) {
      bucket = [];
      _grid.set(key, bucket);
    }
    bucket.push(i);
    maxEnemySize = Math.max(maxEnemySize, enemy.size || 0);
  }

  _spatialResult.maxEnemySize = maxEnemySize;
  return _spatialResult;
}

// Reusable buffers for query results
const _queryResult = [];
const _seen = new Set();

export function queryNearbyEnemyIndices(spatialGrid, bullet) {
  _queryResult.length = 0;
  if (!spatialGrid || !bullet) return _queryResult;

  const currentX = Number.isFinite(bullet.x) ? bullet.x : 0;
  const currentY = Number.isFinite(bullet.y) ? bullet.y : 0;
  const prevX = Number.isFinite(bullet.prevX) ? bullet.prevX : currentX;
  const prevY = Number.isFinite(bullet.prevY) ? bullet.prevY : currentY;
  const bulletSize = bullet.size || 0;
  const expansion = bulletSize + spatialGrid.maxEnemySize;

  const minX = Math.min(prevX, currentX) - expansion;
  const maxX = Math.max(prevX, currentX) + expansion;
  const minY = Math.min(prevY, currentY) - expansion;
  const maxY = Math.max(prevY, currentY) + expansion;
  const cs = spatialGrid.cellSize;
  const minCellX = Math.floor(minX / cs);
  const maxCellX = Math.floor(maxX / cs);
  const minCellY = Math.floor(minY / cs);
  const maxCellY = Math.floor(maxY / cs);

  // Single-cell fast path: no dedup needed
  if (minCellX === maxCellX && minCellY === maxCellY) {
    const bucket = spatialGrid.grid.get(cellKey(minCellX, minCellY));
    if (bucket) {
      for (let i = 0; i < bucket.length; i++) {
        _queryResult.push(bucket[i]);
      }
    }
    return _queryResult;
  }

  // Multi-cell: dedup with reusable Set (numeric keys, no allocation)
  _seen.clear();

  for (let cx = minCellX; cx <= maxCellX; cx++) {
    for (let cy = minCellY; cy <= maxCellY; cy++) {
      const bucket = spatialGrid.grid.get(cellKey(cx, cy));
      if (!bucket) continue;

      for (let i = 0; i < bucket.length; i++) {
        const idx = bucket[i];
        if (!_seen.has(idx)) {
          _seen.add(idx);
          _queryResult.push(idx);
        }
      }
    }
  }

  return _queryResult;
}
