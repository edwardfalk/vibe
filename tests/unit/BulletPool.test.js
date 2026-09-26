import { describe, it, expect } from 'vitest';
import { Bullet } from '../../js/entities/bullet.js';

// The trail slots keep stale positions, but _trailCount = 0 means none is read
const observable = (b) => ({ ...b, _trailSlots: undefined });

describe('Bullet pool', () => {
  it('a recycled bullet is not still marked for removal', () => {
    const first = Bullet.acquire(0, 0, 0, 5, 'player');
    first._remove = true; // what the collision code does on a hit
    Bullet.release(first);
    const next = Bullet.acquire(0, 0, 0, 5, 'player');
    expect(next).toBe(first); // the pool reuses it
    expect(next._remove).toBe(false);
  });

  it('a recycled tank bullet equals a fresh player bullet', () => {
    const tank = Bullet.acquire(100, 100, 1, 4, 'enemy-tank');
    tank.ownerId = 7;
    tank.type = 'tankEnergy';
    tank.energy = 40;
    tank.update();
    tank.update();
    tank._remove = true;
    Bullet.release(tank);

    const recycled = Bullet.acquire(200, 300, 0.5, 8, 'player');
    expect(recycled).toBe(tank); // the pool reuses it
    const fresh = new Bullet(200, 300, 0.5, 8, 'player');
    expect(observable(recycled)).toEqual(observable(fresh));
  });
});
