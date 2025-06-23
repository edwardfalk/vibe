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

  /**
   * Queries for objects within a cone.
   * @param {number} x The starting X coordinate of the cone.
   * @param {number} y The starting Y coordinate of the cone.
   * @param {number} angle The center angle of the cone in radians.
   * @param {number} range The length of the cone.
   * @param {number} coneAngle The total angle of the cone in radians.
   * @returns {Array} An array of objects found within the cone.
   */
  coneQuery(x, y, angle, range, coneAngle) {
    const results = new Set();
    const stepSize = this.cellSize / 2;
    const numSteps = Math.ceil(range / stepSize);

    for (let i = 0; i <= numSteps; i++) {
      const distance = i * stepSize;
      const pointX = x + Math.cos(angle) * distance;
      const pointY = y + Math.sin(angle) * distance;

      // Also check points to the side to simulate the cone width
      const spread = distance * Math.tan(coneAngle / 2);
      const anglePerp = angle + Math.PI / 2;
      const pointLeftX = pointX - Math.cos(anglePerp) * spread;
      const pointLeftY = pointY - Math.sin(anglePerp) * spread;
      const pointRightX = pointX + Math.cos(anglePerp) * spread;
      const pointRightY = pointY + Math.sin(anglePerp) * spread;

      const cellKeyCenter = this._hash(pointX, pointY);
      const cellKeyLeft = this._hash(pointLeftX, pointLeftY);
      const cellKeyRight = this._hash(pointRightX, pointRightY);

      if (this.map.has(cellKeyCenter)) {
        this.map.get(cellKeyCenter).forEach(item => results.add(item));
      }
      if (this.map.has(cellKeyLeft)) {
        this.map.get(cellKeyLeft).forEach(item => results.add(item));
      }
      if (this.map.has(cellKeyRight)) {
        this.map.get(cellKeyRight).forEach(item => results.add(item));
      }
    }

    return Array.from(results);
  }
}
