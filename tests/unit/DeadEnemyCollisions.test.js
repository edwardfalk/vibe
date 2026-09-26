import { describe, it, expect, vi } from 'vitest';
import { CollisionSystem } from '../../js/systems/CollisionSystem.js';
import { handleContactCollisions } from '../../js/systems/combat/PlayerContactHandlers.js';
import { updateBombs } from '../../js/systems/BombSystem.js';
import { Bullet } from '../../js/entities/bullet.js';

// An enemy killed earlier this frame, still in the array until compaction
function deadEnemy(type) {
  return {
    id: 1,
    type,
    x: 0,
    y: 0,
    size: 30,
    hitRadius: 15,
    markedForRemoval: true,
    takeDamage: vi.fn(() => 'died'),
    checkCollision: () => true,
  };
}

function contextOf(values) {
  return { get: (key) => values[key], set: () => {} };
}

describe('enemies killed this frame', () => {
  it('are not hit by player bullets', () => {
    const enemy = deadEnemy('grunt');
    const bullet = Bullet.acquire(0, 0, 0, 8, 'player');
    const system = new CollisionSystem(
      contextOf({ playerBullets: [bullet], enemies: [enemy] }),
      { handleEnemyDeath: vi.fn() }
    );
    system.checkPlayerBulletsVsEnemies();
    expect(enemy.takeDamage).not.toHaveBeenCalled();
    expect(bullet._remove).toBeFalsy();
  });

  it('are not hit by enemy bullets', () => {
    const enemy = deadEnemy('grunt');
    const bullet = Bullet.acquire(0, 0, 0, 8, 'enemy-grunt');
    bullet.ownerId = 99;
    const handleEnemyDeath = vi.fn();
    const system = new CollisionSystem(
      contextOf({ enemyBullets: [bullet], enemies: [enemy] }),
      { handleEnemyDeath }
    );
    system.checkEnemyBulletsVsEnemies();
    expect(enemy.takeDamage).not.toHaveBeenCalled();
    expect(handleEnemyDeath).not.toHaveBeenCalled();
  });

  it('do not hurt the player or plant a bomb on contact', () => {
    const player = { x: 0, y: 0, hurt: vi.fn() };
    const activeBombs = [];
    handleContactCollisions({
      player,
      enemies: [deadEnemy('grunt'), deadEnemy('tank')],
      activeBombs,
    });
    expect(player.hurt).not.toHaveBeenCalled();
    expect(activeBombs).toEqual([]);
  });

  it('are not hit by a bomb going off', () => {
    const enemy = deadEnemy('grunt');
    const gameState = { addKill: vi.fn(), addScore: vi.fn() };
    updateBombs({
      activeBombs: [{ x: 0, y: 0, timer: 1, tankId: 2, tankRef: null }],
      enemies: [enemy],
      gameState,
    });
    expect(enemy.takeDamage).not.toHaveBeenCalled();
    expect(gameState.addScore).not.toHaveBeenCalled();
  });
});
