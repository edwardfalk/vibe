import { describe, it, expect } from 'vitest';
import { Bullet } from '../../js/entities/bullet.js';

describe('Bullet pool', () => {
  it('a recycled bullet is not still marked for removal', () => {
    const first = Bullet.acquire(0, 0, 0, 5, 'player');
    first._remove = true; // what the collision code does on a hit
    Bullet.release(first);
    const next = Bullet.acquire(0, 0, 0, 5, 'player');
    expect(next).toBe(first); // the pool reuses it
    expect(next._remove).toBe(false);
  });
});
