import { describe, it, expect, vi } from 'vitest';

// Suppress console.log noise from entity constructors and game logic
vi.spyOn(console, 'log').mockImplementation(() => {});

// Mock the Bullet module (imported by BaseEnemy)
vi.mock('../../js/entities/bullet.js', () => ({
  Bullet: { acquire: vi.fn(() => ({ ownerId: null })) },
}));

// Mock glowUtils (imported by BaseEnemy)
vi.mock('../../js/effects/glowUtils.js', () => ({
  drawGlow: vi.fn(),
}));

// Mock BaseEnemyHelpers (imported by BaseEnemy)
vi.mock('../../js/entities/BaseEnemyHelpers.js', () => ({
  getEnemyColors: () => ({
    skinColor: {},
    helmetColor: {},
    weaponColor: {},
    eyeColor: {},
  }),
  getGlowColorForType: vi.fn(),
  getGlowSizeForType: vi.fn(() => 10),
  drawEnemyHealthBar: vi.fn(),
  drawEnemySpeechBubble: vi.fn(),
}));

import { Rusher } from '../../js/entities/Rusher.js';
import { updateEnemiesAndResolveResults } from '../../js/systems/gameplay/EnemyUpdatePipeline.js';

const mockP5 = {
  color: () => ({ levels: [255, 20, 147, 255] }),
  TWO_PI: Math.PI * 2,
  PI: Math.PI,
};

const blastResult = {
  type: 'rusher-explosion',
  x: 0,
  y: 0,
  radius: 150,
  damage: 35,
};

function stub(x, y, died = false) {
  return {
    x,
    y,
    type: 'tank',
    size: 50,
    markedForRemoval: false,
    update: () => null,
    takeDamage: vi.fn(() => died),
  };
}

function exploding(x, y) {
  return {
    ...stub(x, y),
    type: 'rusher',
    update: () => ({ ...blastResult, x, y }),
  };
}

function run(
  enemies,
  gameState = { gameState: 'playing', addKill: vi.fn(), addScore: vi.fn() }
) {
  updateEnemiesAndResolveResults({
    enemies,
    enemyBullets: [],
    player: { x: 5000, y: 5000 },
    deltaTimeMs: 16,
    collisionSystem: {
      handleRusherExplosion: vi.fn(),
      handleEnemyDeath: vi.fn(),
    },
    gameState,
  });
  return gameState;
}

describe('rusher blast vs enemies', () => {
  it('hits each enemy once, even with a corpse ahead of it in the array', () => {
    const corpse = stub(10, 0);
    corpse.markedForRemoval = true;
    const tank = stub(100, 0);
    run([corpse, tank, exploding(0, 0)]);
    expect(tank.takeDamage).toHaveBeenCalledTimes(1);
    expect(tank.takeDamage).toHaveBeenCalledWith(35, null, 'rusher-blast');
  });

  it('counts an enemy whose edge is inside the blast', () => {
    const tank = stub(150 + 40, 0); // centre outside, a 42 px radius reaches in
    tank.hitRadius = 42;
    run([exploding(0, 0), tank]);
    expect(tank.takeDamage).toHaveBeenCalledTimes(1);
  });

  it('misses an enemy wholly outside the blast', () => {
    const tank = stub(150 + 50, 0);
    tank.hitRadius = 42;
    run([exploding(0, 0), tank]);
    expect(tank.takeDamage).not.toHaveBeenCalled();
  });

  it('enemies it kills leave the array before bullets run, scored once', () => {
    const grunt = stub(50, 0, true);
    const enemies = [exploding(0, 0), grunt];
    const gs = run(enemies);
    expect(enemies).not.toContain(grunt);
    expect(gs.addKill).toHaveBeenCalledTimes(1);
  });

  it('no scoring after the blast has ended the game', () => {
    const grunt = stub(50, 0, true);
    const gs = run([exploding(0, 0), grunt], {
      gameState: 'gameOver',
      addKill: vi.fn(),
      addScore: vi.fn(),
    });
    expect(gs.addKill).not.toHaveBeenCalled();
  });

  it('a caught rusher lights its fuse instead of dying; a lit one keeps its fuse', () => {
    const context = { get: () => undefined, set() {} };
    const unlit = new Rusher(60, 0, 'rusher', { context }, mockP5, null);
    const lit = new Rusher(-60, 0, 'rusher', { context }, mockP5, null);
    lit.lightFuse();
    lit.fuseMs = 500;
    const gs = run([exploding(0, 0), unlit, lit]);
    expect(unlit.vibrating).toBe(true);
    expect(lit.fuseMs).toBe(500);
    expect(gs.addKill).not.toHaveBeenCalled();
  });
});
