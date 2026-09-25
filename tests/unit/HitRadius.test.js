import { describe, it, expect } from 'vitest';
import { Bullet } from '../../js/entities/bullet.js';
import { BaseEnemy } from '../../js/entities/BaseEnemy.js';
import { CONFIG } from '../../js/config.js';

// A player bullet (size 8) that flew 8 px along +x this frame
function bulletPassingAt(offsetY) {
  const b = Bullet.acquire(0, offsetY, 0, 8, 'player');
  b.prevX = -8;
  b.prevY = offsetY;
  b.x = 0;
  b.y = offsetY;
  return b;
}

describe('hit radius', () => {
  it('enemies take their radius from CONFIG.HITBOX', () => {
    const g = Object.assign(Object.create(BaseEnemy.prototype), {
      type: 'grunt',
      size: 26,
    });
    expect(g.hitRadius).toBe(CONFIG.HITBOX.grunt);
  });

  it('a bullet grazing a grunt beyond size/2 but inside its hit radius hits', () => {
    const grunt = { x: 0, y: 0, size: 26, hitRadius: CONFIG.HITBOX.grunt };
    expect(bulletPassingAt(17).checkCollision(grunt)).toBe(true); // old threshold 17
  });

  it('targets without hitRadius (the player) keep size/2', () => {
    const player = { x: 0, y: 0, size: 32 };
    expect(bulletPassingAt(21).checkCollision(player)).toBe(false);
    expect(bulletPassingAt(19).checkCollision(player)).toBe(true);
  });
});
