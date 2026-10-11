import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { DAMAGE_RESULT } from '../../js/shared/DamageResult.js';
import {
  handleDamageResult,
  STABBER_KILL_POINTS,
  killPoints,
} from '../../js/shared/DamageResultHandler.js';
import { applyKillFeedback } from '../../js/systems/combat/KillFeedback.js';
import { handleTankEnergyBallHit } from '../../js/systems/collision/BulletCollisionResolvers.js';
import { plantBomb, updateBombs } from '../../js/systems/BombSystem.js';
import { createMockAudio } from './helpers/enemyMocks.js';

const PACING = structuredClone(CONFIG.PACING);
afterEach(() => {
  CONFIG.PACING = structuredClone(PACING);
  vi.restoreAllMocks();
});

const GRUNT = () => CONFIG.PACING.GRUNT_KILL_POINTS;
// A game state that keeps its streak and records what it was given
const scoreboard = (killStreak = 0) => ({
  killStreak,
  addKill: vi.fn(),
  addScore: vi.fn(),
});
const enemyOf = (type) => ({
  type,
  x: 0,
  y: 0,
  size: 26,
  health: 1,
  maxHealth: 2,
  markedForRemoval: false,
});

describe("a grunt kill's points, whatever killed him", () => {
  it('a grunt’s base points are GRUNT_KILL_POINTS; the others keep their route’s', () => {
    expect(killPoints(enemyOf('grunt'), 15)).toBe(GRUNT());
    expect(killPoints(enemyOf('stabber'), 15)).toBe(15);
    CONFIG.PACING.GRUNT_KILL_POINTS = 7;
    expect(killPoints(enemyOf('grunt'), 20)).toBe(7);
  });

  it('the hero’s shot: the grunt’s points, with its streak bonus', () => {
    for (const [streak, times] of [
      [0, 1],
      [5, 2],
      [10, 3],
    ]) {
      const gameState = scoreboard(streak);
      applyKillFeedback({
        gameState,
        enemy: enemyOf('grunt'),
        enemyType: 'grunt',
      });
      expect(gameState.addScore).toHaveBeenCalledWith(GRUNT() * times);
    }
    const gameState = scoreboard();
    applyKillFeedback({ gameState, enemy: enemyOf('tank'), enemyType: 'tank' });
    expect(gameState.addScore).toHaveBeenCalledWith(10);
  });

  it('a stab, a blast, the bomb’s cloud, another enemy’s bullet (handleDamageResult)', () => {
    for (const scorePoints of [STABBER_KILL_POINTS, 10, 8, undefined]) {
      const gameState = scoreboard();
      handleDamageResult(DAMAGE_RESULT.DIED, enemyOf('grunt'), {
        gameState,
        scorePoints,
      });
      expect(gameState.addScore).toHaveBeenCalledWith(GRUNT());
    }
    const gameState = scoreboard();
    handleDamageResult(DAMAGE_RESULT.DIED, enemyOf('rusher'), {
      gameState,
      scorePoints: 8,
    });
    expect(gameState.addScore).toHaveBeenCalledWith(8);
  });

  it('a tank’s ball: the grunt’s points, with the ball’s streak rule', () => {
    for (const [streak, times] of [
      [0, 1],
      [5, 2],
      [10, 3],
    ]) {
      const gameState = scoreboard(streak);
      const values = { gameState, audio: createMockAudio() };
      handleTankEnergyBallHit({ x: 0, y: 0, angle: 0 }, enemyOf('grunt'), {
        getContextValue: (k) => values[k],
        handleEnemyDeath: vi.fn(),
      });
      expect(gameState.addScore).toHaveBeenCalledWith(GRUNT() * times);
    }
  });

  it('the bomb’s blast: the grunt’s points, not the bomb’s 20', () => {
    let beats = 10.3;
    const beatClock = { getBeatPosition: () => beats, beatInterval: 500 };
    const tank = {
      id: 't',
      type: 'tank',
      x: 0,
      y: 0,
      size: 50,
      facing: 0,
      markedForRemoval: false,
      takeDamage: vi.fn(() => DAMAGE_RESULT.DAMAGED),
    };
    const grunt = {
      ...enemyOf('grunt'),
      x: 20,
      hitRadius: 13,
      takeDamage: vi.fn(() => DAMAGE_RESULT.DIED),
    };
    const activeBombs = [];
    plantBomb(activeBombs, tank, beatClock);
    const gameState = scoreboard();
    const explosionManager = {
      addExplosion: vi.fn(),
      addBombBlast: vi.fn(),
      addBombCloud: vi.fn(),
    };
    for (let b = 10.5; b <= 20 && !grunt.markedForRemoval; b += 0.25) {
      beats = b;
      updateBombs({
        activeBombs,
        enemies: [tank, grunt],
        audio: createMockAudio(),
        beatClock,
        explosionManager,
        gameState,
        enemyDeathHandler: { handleEnemyDeath: vi.fn() },
      });
    }
    expect(grunt.markedForRemoval).toBe(true);
    expect(gameState.addScore).toHaveBeenCalledWith(GRUNT());
    expect(gameState.addScore).not.toHaveBeenCalledWith(20);
  });
});
