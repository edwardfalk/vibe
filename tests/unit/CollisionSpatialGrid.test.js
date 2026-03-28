import { describe, it, expect } from 'vitest';
import {
  buildEnemySpatialGrid,
  queryNearbyEnemyIndices,
} from '../../js/systems/collision/CollisionSpatialGrid.js';

function makeEnemy(x, y, size = 20) {
  return { x, y, size };
}

function makeBullet(x, y, size = 5, prevX, prevY) {
  return {
    x,
    y,
    size,
    prevX: prevX ?? x,
    prevY: prevY ?? y,
  };
}

describe('buildEnemySpatialGrid', () => {
  it('returns null for empty or missing enemies', () => {
    expect(buildEnemySpatialGrid(null)).toBe(null);
    expect(buildEnemySpatialGrid([])).toBe(null);
  });

  it('builds a grid with correct maxEnemySize', () => {
    const enemies = [makeEnemy(100, 100, 20), makeEnemy(200, 200, 40)];
    const grid = buildEnemySpatialGrid(enemies);
    expect(grid).not.toBe(null);
    expect(grid.maxEnemySize).toBe(40);
    expect(grid.cellSize).toBe(120);
  });

  it('places enemies into correct cells', () => {
    // Two enemies in same cell (both at x<120, y<120)
    const enemies = [makeEnemy(50, 50), makeEnemy(100, 100)];
    const grid = buildEnemySpatialGrid(enemies);

    // Query at the same location should find both
    const bullet = makeBullet(75, 75, 5);
    const indices = queryNearbyEnemyIndices(grid, bullet);
    expect(indices).toContain(0);
    expect(indices).toContain(1);
  });

  it('separates enemies in different cells', () => {
    // Cell size is 120, so 50 and 500 are in different cells
    const enemies = [makeEnemy(50, 50), makeEnemy(500, 500)];
    const grid = buildEnemySpatialGrid(enemies);

    // Query near first enemy only
    const bullet = makeBullet(50, 50, 1);
    const indices = queryNearbyEnemyIndices(grid, bullet);
    expect(indices).toContain(0);
    expect(indices).not.toContain(1);
  });
});

describe('queryNearbyEnemyIndices', () => {
  it('returns empty for null inputs', () => {
    const result = queryNearbyEnemyIndices(null, makeBullet(0, 0));
    expect(result.length).toBe(0);

    const grid = buildEnemySpatialGrid([makeEnemy(0, 0)]);
    const result2 = queryNearbyEnemyIndices(grid, null);
    expect(result2.length).toBe(0);
  });

  it('finds enemies near bullet position', () => {
    const enemies = [makeEnemy(100, 100, 20), makeEnemy(300, 300, 20)];
    const grid = buildEnemySpatialGrid(enemies);

    const bullet = makeBullet(105, 105, 10);
    const indices = queryNearbyEnemyIndices(grid, bullet);
    expect(indices).toContain(0);
  });

  it('uses bullet trajectory (prevX/prevY) to expand search', () => {
    // Enemy at (250, 100), bullet moved from (100,100) to (260,100)
    // The trajectory spans multiple cells
    const enemies = [makeEnemy(250, 100, 20)];
    const grid = buildEnemySpatialGrid(enemies);

    const bullet = makeBullet(260, 100, 5, 100, 100);
    const indices = queryNearbyEnemyIndices(grid, bullet);
    expect(indices).toContain(0);
  });

  it('deduplicates enemy indices across multiple cells', () => {
    // Place enemy right on a cell boundary so it could appear in queries
    // for adjacent cells. With expansion from bullet+enemy size,
    // a bullet near the boundary should still return the index only once.
    const enemies = [makeEnemy(120, 120, 30)];
    const grid = buildEnemySpatialGrid(enemies);

    // Bullet with trajectory spanning the boundary
    const bullet = makeBullet(125, 125, 10, 110, 110);
    const indices = queryNearbyEnemyIndices(grid, bullet);

    // Index 0 should appear exactly once
    const count = indices.filter((i) => i === 0).length;
    expect(count).toBe(1);
  });

  it('handles negative coordinates', () => {
    const enemies = [makeEnemy(-200, -200, 20)];
    const grid = buildEnemySpatialGrid(enemies);

    const bullet = makeBullet(-195, -195, 10);
    const indices = queryNearbyEnemyIndices(grid, bullet);
    expect(indices).toContain(0);
  });

  it('handles enemies with missing size gracefully', () => {
    const enemies = [{ x: 100, y: 100 }]; // no size property
    const grid = buildEnemySpatialGrid(enemies);
    expect(grid.maxEnemySize).toBe(0);

    const bullet = makeBullet(100, 100, 5);
    const indices = queryNearbyEnemyIndices(grid, bullet);
    expect(indices).toContain(0);
  });

  it('handles bullet with non-finite coordinates', () => {
    const enemies = [makeEnemy(0, 0, 20)];
    const grid = buildEnemySpatialGrid(enemies);

    const bullet = { x: NaN, y: undefined, size: 5 };
    // Should not throw, falls back to 0,0
    const indices = queryNearbyEnemyIndices(grid, bullet);
    expect(indices).toContain(0);
  });
});
