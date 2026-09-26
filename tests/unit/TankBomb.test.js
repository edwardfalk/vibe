import { describe, it, expect } from 'vitest';
import { handleContactCollisions } from '../../js/systems/combat/PlayerContactHandlers.js';

const touchingTank = (id) => ({
  id,
  type: 'tank',
  x: 0,
  y: 0,
  checkCollision: () => true,
});

describe('Tank bombs', () => {
  it('a tank touching the hero frame after frame plants one bomb', () => {
    const activeBombs = [];
    const contact = { player: {}, enemies: [touchingTank(1)], activeBombs };
    for (let frame = 0; frame < 10; frame++) handleContactCollisions(contact);
    expect(activeBombs).toHaveLength(1);
  });

  it('each tank plants its own', () => {
    const activeBombs = [];
    const enemies = [touchingTank(1), touchingTank(2)];
    for (let frame = 0; frame < 10; frame++) {
      handleContactCollisions({ player: {}, enemies, activeBombs });
    }
    expect(activeBombs.map((b) => b.tankId).sort()).toEqual([1, 2]);
  });
});
