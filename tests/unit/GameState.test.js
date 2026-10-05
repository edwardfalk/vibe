import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
const { CONFIG } = await import('../../js/config.js');

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

  it('a run that is over earns no more score or kills', () => {
    gs.gameState = 'gameOver';
    gs.addScore(100);
    gs.addKill();
    expect(gs.score).toBe(0);
    expect(gs.totalKills).toBe(0);
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

  it('a practice run (tune panel jumps) never sets a high score', () => {
    gs.practiceRun = true;
    gs.addScore(100000);
    expect(gs.highScore).toBe(0);
    gs.restart();
    expect(gs.practiceRun).toBe(false);
  });

  it("restart starts the hero's look clean, and ends a dash he died in", () => {
    const player = {
      maxHealth: 100,
      shotAt: 3.6,
      hurtAt: 3.6,
      shieldBackAt: 3.6,
      footfalls: [{ x: 1, y: 2, at: 3.5, foot: 1 }],
      lastEighth: 7,
      isDashing: true,
      dashTimerMs: 120,
    };
    window.player = player;
    try {
      gs.restart();
      expect([player.shotAt, player.hurtAt, player.shieldBackAt]).toEqual([
        null,
        null,
        null,
      ]);
      expect(player.footfalls).toEqual([]);
      expect(player.lastEighth).toBe(null);
      expect([player.isDashing, player.dashTimerMs]).toEqual([false, 0]);
    } finally {
      window.player = null;
    }
  });

  it('says a levelUp line on a new level: the next place he looks', () => {
    const player = {};
    window.audio = { playSound: vi.fn(), speakPlayerLine: vi.fn() };
    window.player = player;
    try {
      gs.addScore(CONFIG.PACING.FIRST_LEVEL_POINTS);
      expect(window.audio.speakPlayerLine).toHaveBeenCalledWith(
        player,
        'levelUp'
      );
    } finally {
      window.audio = null;
      window.player = null;
    }
  });

  it('level progresses at threshold', () => {
    gs.addScore(CONFIG.PACING.FIRST_LEVEL_POINTS);
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

const { drawGameOver } = await import('../../js/systems/UIOverlays.js');

describe('game over screen', () => {
  function textsDrawn(gs) {
    const texts = [];
    const p = new Proxy(
      { width: 800, height: 600, frameCount: 0, sin: Math.sin },
      {
        get: (target, key) =>
          key in target
            ? target[key]
            : key === 'text'
              ? (s) => texts.push(s)
              : () => {},
      }
    );
    drawGameOver(p, gs);
    return texts;
  }

  beforeEach(() => localStorage.clear());

  it('says NEW HIGH SCORE when the run beat the old one', () => {
    localStorage.setItem('vibeHighScore', '100');
    const gs = new GameState();
    gs.restart();
    gs.addScore(150);
    expect(textsDrawn(gs)).toContain('NEW HIGH SCORE! 🎉');
  });

  it('stays quiet when the run did not beat it', () => {
    localStorage.setItem('vibeHighScore', '100');
    const gs = new GameState();
    gs.restart();
    gs.addScore(50);
    expect(textsDrawn(gs)).not.toContain('NEW HIGH SCORE! 🎉');
  });

  it('stays quiet on a practice run', () => {
    const gs = new GameState();
    gs.restart();
    gs.practiceRun = true;
    gs.addScore(100000);
    expect(textsDrawn(gs)).not.toContain('NEW HIGH SCORE! 🎉');
  });
});

const { CameraSystem } = await import('../../js/systems/CameraSystem.js');
const { GameContext } = await import('../../js/core/GameContext.js');

describe('restart', () => {
  const leftovers = ['floatingText', 'audio', 'rhythmFX', 'cameraSystem'];

  afterEach(() => {
    for (const key of leftovers) window[key] = null;
    window.explosionManager = null;
  });

  it("clears the last run's effects, texts, waiting lines, hitstop and shake", () => {
    const gs = new GameState();
    gs.gameContext = new GameContext();
    gs.gameContext.set('hitStopFrames', 7);
    window.explosionManager = { fragmentExplosions: [{}] };
    window.floatingText = { texts: [{}] };
    const voicebox = { cancelPending: vi.fn() };
    window.audio = { activeTexts: [{}], speakPlayerLine: () => {}, voicebox };
    window.rhythmFX = { telegraphs: [{}] };
    window.cameraSystem = new CameraSystem({});
    window.cameraSystem.addShake(20, 40);

    gs.restart();
    clearTimeout(gs.startSpeechTimer);

    expect(window.explosionManager.fragmentExplosions).toEqual([]);
    expect(window.floatingText.texts).toEqual([]);
    expect(window.audio.activeTexts).toEqual([]);
    expect(voicebox.cancelPending).toHaveBeenCalledTimes(1);
    expect(window.rhythmFX.telegraphs).toEqual([]);
    expect(window.cameraSystem.screenShake.intensity).toBe(0);
    expect(gs.gameContext.get('hitStopFrames')).toBe(0);
  });
});
