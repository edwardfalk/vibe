import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock browser globals that GameState uses
vi.stubGlobal('window', {
  player: null,
  enemies: [],
  playerBullets: [],
  enemyBullets: [],
  activeBombs: [],
  cameraSystem: null,
  explosionManager: null,
  spawnSystem: null,
  audio: null,
  testModeManager: null,
  gameState: null,
});
vi.stubGlobal('localStorage', {
  _store: {},
  getItem(key) {
    return this._store[key] ?? null;
  },
  setItem(key, value) {
    this._store[key] = String(value);
  },
  clear() {
    this._store = {};
  },
});

vi.spyOn(console, 'log').mockImplementation(() => {});

const { GameState } = await import('../../js/core/GameState.js');

describe('GameState', () => {
  let gs;

  beforeEach(() => {
    localStorage.clear();
    gs = new GameState();
  });

  it('initializes with correct defaults', () => {
    expect(gs.score).toBe(0);
    expect(gs.level).toBe(1);
    expect(gs.killStreak).toBe(0);
    expect(gs.totalKills).toBe(0);
    expect(gs.gameState).toBe('playing');
  });

  it('addScore increases score', () => {
    gs.addScore(100);
    expect(gs.score).toBe(100);
  });

  it('addKill increments kills and streak', () => {
    gs.addKill();
    gs.addKill();
    expect(gs.totalKills).toBe(2);
    expect(gs.killStreak).toBe(2);
  });

  it('resetKillStreak zeroes streak but keeps total', () => {
    gs.addKill();
    gs.addKill();
    gs.resetKillStreak();
    expect(gs.killStreak).toBe(0);
    expect(gs.totalKills).toBe(2);
  });

  it('level progresses at threshold', () => {
    gs.addScore(150);
    expect(gs.level).toBe(2);
  });

  it('high score persists in localStorage', () => {
    gs.addScore(500);
    // High score is debounced; flush explicitly to verify persistence
    gs._flushHighScore();
    expect(localStorage.getItem('vibeHighScore')).toBe('500');
  });

  it('setGameState transitions correctly', () => {
    gs.setGameState('paused');
    expect(gs.gameState).toBe('paused');

    gs.setGameState('playing');
    expect(gs.gameState).toBe('playing');

    gs.setGameState('gameOver');
    expect(gs.gameState).toBe('gameOver');
    expect(gs.killStreak).toBe(0);
  });

  it('restart resets all state', () => {
    gs.addScore(500);
    gs.addKill();
    gs.addKill();
    gs.restart();

    expect(gs.score).toBe(0);
    expect(gs.level).toBe(1);
    expect(gs.killStreak).toBe(0);
    expect(gs.totalKills).toBe(0);
    expect(gs.gameState).toBe('playing');
  });

  it('getAccuracy calculates correctly', () => {
    gs.shotsFired = 10;
    gs.totalKills = 3;
    expect(gs.getAccuracy()).toBe(30);
  });

  it('getAccuracy returns 0 with no shots', () => {
    expect(gs.getAccuracy()).toBe(0);
  });

  it('addShotFired increments counter', () => {
    gs.addShotFired();
    gs.addShotFired();
    expect(gs.shotsFired).toBe(2);
  });
});
