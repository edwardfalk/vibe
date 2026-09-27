import { describe, it, expect, vi } from 'vitest';
import { CollisionSystem } from '../../js/systems/CollisionSystem.js';
import { Bullet } from '../../js/entities/bullet.js';
import { CONFIG } from '../../js/config.js';

const contextOf = (values) => ({ get: (key) => values[key], set: () => {} });

function hitHeroWith(owner) {
  const player = { x: 0, y: 0, size: 30, hurt: vi.fn() };
  const bullet = Bullet.acquire(0, 0, 0, 8, owner);
  new CollisionSystem(
    contextOf({ enemyBullets: [bullet], player }),
    {}
  ).checkEnemyBulletsVsPlayer();
  return player.hurt.mock.calls[0][0];
}

describe('damage enemy shots do to the hero', () => {
  it('a grunt bullet takes CONFIG.PLAYER.DAMAGE_GRUNT_BULLET', () => {
    expect(hitHeroWith('enemy-grunt')).toBe(CONFIG.PLAYER.DAMAGE_GRUNT_BULLET);
  });

  it('a tank ball takes CONFIG.PLAYER.DAMAGE_TANK_BALL', () => {
    // Not the ball's own 50, so the test tells the two apart
    const saved = CONFIG.PLAYER.DAMAGE_TANK_BALL;
    CONFIG.PLAYER.DAMAGE_TANK_BALL = 37;
    try {
      expect(hitHeroWith('enemy-tank')).toBe(37);
    } finally {
      CONFIG.PLAYER.DAMAGE_TANK_BALL = saved;
    }
  });

  it('a grunt bullet still does its own 1 to another enemy', () => {
    expect(Bullet.acquire(0, 0, 0, 8, 'enemy-grunt').damage).toBe(1);
  });
});
