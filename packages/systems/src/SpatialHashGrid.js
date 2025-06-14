/* SpatialHashGrid.js - Simple uniform grid for fast proximity queries.
 * Not a full QuadTree but good enough for hundreds of entities.
 */
import { floor } from '@vibe/core/mathUtils.js';

export class SpatialHashGrid {
  constructor(cellSize = 120) {
    this.cellSize = cellSize;
    this.map = new Map();
  }

  _hash(x, y) {
    const ix = floor(x / this.cellSize);
    const iy = floor(y / this.cellSize);
    return `${ix},${iy}`;
  }

  insert(obj) {
    const hash = this._hash(obj.x, obj.y);
    let cell = this.map.get(hash);
    if (!cell) {
      cell = [];
      this.map.set(hash, cell);
    }
    cell.push(obj);
  }

  neighbors(x, y) {
    const cs = this.cellSize;
    const ix = floor(x / cs);
    const iy = floor(y / cs);
    const out = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cell = this.map.get(`${ix + dx},${iy + dy}`);
        if (cell) out.push(...cell);
      }
    }
    return out;
  }
} 