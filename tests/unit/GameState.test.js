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

  it("restart starts the hero's look clean, ends a dash he died in, and drops its cooldown and his queued shot", () => {
    const player = {
      maxHealth: 100,
      shotAt: 3.6,
      hurtAt: 3.6,
      shieldBackAt: 3.6,
      plantedAt: 3.6,
      footfalls: [{ x: 1, y: 2, at: 3.5, foot: 1 }],
      lastEighth: 7,
      isDashing: true,
      dashTimerMs: 120,
      dashCooldownMs: 2400,
      queuedShot: { timerMs: 80 },
      // Fire held through the restart
      shootCooldownMs: 150,
      isCurrentlyShooting: true,
      firstShotFired: true,
    };
    window.player = player;
    try {
      gs.restart();
      expect([
        player.shotAt,
        player.hurtAt,
        player.shieldBackAt,
        player.plantedAt,
      ]).toEqual([null, null, null, null]);
      expect(player.footfalls).toEqual([]);
      expect(player.lastEighth).toBe(null);
      expect([player.isDashing, player.dashTimerMs]).toEqual([false, 0]);
      expect(player.dashCooldownMs).toBe(0);
      expect(player.queuedShot).toBe(null);
      // His next run's first shot is immediate, as any burst's is
      expect([
        player.shootCooldownMs,
        player.isCurrentlyShooting,
        player.firstShotFired,
      ]).toEqual([0, false, false]);
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

  describe('the level-up sound, on the bar line', () => {
    // Bars of 2 s from 0.37 s, heard one 40 ms lead behind the game's now
    // (not the game's lead, so the code must read the clock's)
    let now;
    const clock = {
      beatInterval: 500,
      beatsPerMeasure: 4,
      startTime: 370,
      aheadSec: 0.04,
      nowSec: () => now,
      reset: () => {},
    };
    const levelUps = () =>
      window.audio.playSound.mock.calls.filter(([name]) => name === 'levelUp');

    beforeEach(() => {
      window.beatClock = clock;
      window.audio = {
        playSound: vi.fn(),
        speakPlayerLine: vi.fn(),
        playLastBreath: vi.fn(),
      };
      window.cameraSystem = { addShake: vi.fn(), reset: () => {} };
    });
    afterEach(() => {
      window.beatClock = null;
      window.audio = null;
      window.cameraSystem = null;
      clearTimeout(gs.startSpeechTimer);
    });

    it('waits for the next beat 1, then books the sound and the shake on it', () => {
      now = 3;
      gs.addScore(CONFIG.PACING.FIRST_LEVEL_POINTS);
      expect(gs.level).toBe(2); // the level itself rises at once
      now = 4.36;
      gs.updateLevelUp();
      expect(levelUps()).toEqual([]);
      expect(window.cameraSystem.addShake).not.toHaveBeenCalled();
      now = 4.38;
      gs.updateLevelUp();
      gs.updateLevelUp();
      expect(levelUps()).toEqual([['levelUp', null, null, { at: 4.37 }]]);
      expect(window.cameraSystem.addShake).toHaveBeenCalledTimes(1);
      // The sky breathes deeper on it (BackgroundRenderer), until a restart
      expect(gs.lastLevelUpAt).toBe(4.37);
      gs.restart();
      expect(gs.lastLevelUpAt).toBe(null);
    });

    it('takes a beat 1 the game has passed but you have not heard yet', () => {
      now = 4.38; // heard: 4.34, before the bar line at 4.37
      gs.addScore(CONFIG.PACING.FIRST_LEVEL_POINTS);
      gs.updateLevelUp();
      expect(levelUps()).toEqual([['levelUp', null, null, { at: 4.37 }]]);
    });

    it('a bar line passed with no frame to play it moves to the next one', () => {
      now = 3;
      gs.addScore(CONFIG.PACING.FIRST_LEVEL_POINTS);
      now = 4.37 + 0.13; // over a quarter beat late: a hidden tab
      gs.updateLevelUp();
      expect(levelUps()).toEqual([]);
      now = 6.38;
      gs.updateLevelUp();
      expect(levelUps()).toEqual([['levelUp', null, null, { at: 6.37 }]]);
    });

    it('a slow frame, under a quarter beat late, still plays it', () => {
      now = 3;
      gs.addScore(CONFIG.PACING.FIRST_LEVEL_POINTS);
      now = 4.37 + 0.12;
      gs.updateLevelUp();
      expect(levelUps()).toEqual([['levelUp', null, null, { at: 4.37 }]]);
    });

    it('reaches the sky in the frame it plays, which breathes deeper on it', async () => {
      const { runDraw } = await import('../../js/GameLoopDraw.js');
      let seen;
      window.gameState = gs;
      window.backgroundRenderer = {
        drawSky: () => (seen = gs.lastLevelUpAt),
        drawInteractiveBackgroundEffects: () => {},
      };
      try {
        now = 3;
        gs.addScore(CONFIG.PACING.FIRST_LEVEL_POINTS);
        now = 4.38;
        runDraw(
          { frameCount: 1 },
          () => {},
          () => {}
        );
        expect(seen).toBe(4.37);
      } finally {
        window.gameState = null;
        window.backgroundRenderer = null;
      }
    });

    it("a level risen in a frame's update plays in that frame when its beat 1 is due", async () => {
      const { runDraw } = await import('../../js/GameLoopDraw.js');
      window.gameState = gs;
      try {
        now = 4.38; // heard: 4.34, before the bar line at 4.37
        const rise = () => gs.addScore(CONFIG.PACING.FIRST_LEVEL_POINTS);
        runDraw({ frameCount: 1 }, rise, () => {});
        expect(levelUps()).toEqual([['levelUp', null, null, { at: 4.37 }]]);
      } finally {
        window.gameState = null;
      }
    });

    it('an update that earns a level, then ends the run, plays nothing', async () => {
      const { runDraw } = await import('../../js/GameLoopDraw.js');
      window.gameState = gs;
      try {
        now = 4.38; // its beat 1 at 4.37 is due, as above
        const riseThenDie = () => {
          gs.addScore(CONFIG.PACING.FIRST_LEVEL_POINTS);
          gs.setGameState('gameOver');
        };
        runDraw({ frameCount: 1 }, riseThenDie, () => {});
        expect(levelUps()).toEqual([]);
        expect(window.cameraSystem.addShake).not.toHaveBeenCalled();
      } finally {
        window.gameState = null;
      }
    });

    it('plays once for two levels risen in one bar', () => {
      now = 3;
      gs.addScore(CONFIG.PACING.FIRST_LEVEL_POINTS);
      now = 3.5;
      gs.addScore(gs.nextLevelThreshold - gs.score);
      expect(gs.level).toBe(3);
      now = 4.38;
      gs.updateLevelUp();
      expect(levelUps()).toHaveLength(1);
    });

    it('a death before the bar line drops it, and the next run never plays it', () => {
      now = 3;
      gs.addScore(CONFIG.PACING.FIRST_LEVEL_POINTS);
      gs.setGameState('gameOver');
      gs.restart();
      now = 4.38;
      gs.updateLevelUp();
      expect(levelUps()).toEqual([]);
    });
  });

  it('level progresses at threshold', () => {
    gs.addScore(CONFIG.PACING.FIRST_LEVEL_POINTS);
    expect(gs.level).toBe(2);
  });

  it('each level costs its number times LEVEL_POINTS_PER_LEVEL more; a restart starts the count over', () => {
    const { FIRST_LEVEL_POINTS, LEVEL_POINTS_PER_LEVEL } = CONFIG.PACING;
    // Values no constant uses, so a mix-up between them shows
    CONFIG.PACING.FIRST_LEVEL_POINTS = 70;
    CONFIG.PACING.LEVEL_POINTS_PER_LEVEL = 37;
    try {
      const run = new GameState();
      const steps = [];
      for (let level = 2; level <= 4; level++) {
        run.addScore(run.nextLevelThreshold - run.score);
        steps.push([
          run.level,
          run.previousLevelThreshold,
          run.nextLevelThreshold,
        ]);
      }
      expect(steps).toEqual([
        [2, 70, 70 + 2 * 37],
        [3, 144, 144 + 3 * 37],
        [4, 255, 255 + 4 * 37],
      ]);
      run.restart();
      expect([run.previousLevelThreshold, run.nextLevelThreshold]).toEqual([
        0, 70,
      ]);
      run.addScore(69);
      expect(run.level).toBe(1);
      run.addScore(1);
      expect(run.level).toBe(2);
    } finally {
      CONFIG.PACING.FIRST_LEVEL_POINTS = FIRST_LEVEL_POINTS;
      CONFIG.PACING.LEVEL_POINTS_PER_LEVEL = LEVEL_POINTS_PER_LEVEL;
    }
  });

  it('high score persists in localStorage', () => {
    gs.addScore(500);
    // High score is debounced; flush explicitly to verify persistence
    gs._flushHighScore();
    expect(localStorage.getItem('vibeHighScore')).toBe('500');
  });

  it('a browser that blocks site data still starts and ends a run, and says so once', () => {
    const blocked = () => {
      throw new Error('SecurityError: access is denied');
    };
    const get = vi.spyOn(localStorage, 'getItem').mockImplementation(blocked);
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation(blocked);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const run = new GameState();
      expect(run.highScore).toBe(0);
      run.addScore(500);
      expect(() => run.setGameState('gameOver')).not.toThrow();
      expect(run.highScore).toBe(500);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      get.mockRestore();
      set.mockRestore();
      warn.mockRestore();
    }
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

  it("accuracy is the hero's shots that landed, whatever else kills", () => {
    gs.shotsFired = 10;
    gs.addShotHit();
    gs.addShotHit();
    gs.addShotHit();
    // A bomb's or a tank ball's kills are not his shots
    for (let i = 0; i < 8; i++) gs.addKill();
    expect(gs.getAccuracy()).toBe(30);
    gs.restart();
    expect(gs.shotsHit).toBe(0);
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
const { ExplosionManager } =
  await import('../../js/effects/explosions/ExplosionManager.js');
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
    // Its own reset empties every list, whichever kinds it holds
    window.explosionManager = new ExplosionManager();
    const lists = [
      'explosions',
      'plasmaClouds',
      'radioactiveDebris',
      'fragmentExplosions',
      'smokes',
      'bangs',
    ];
    for (const list of lists) window.explosionManager[list].push({});
    // A cloud still burning stops its sound
    const smoke = { end: vi.fn() };
    window.explosionManager.smokes[0] = smoke;
    window.floatingText = { texts: [{}] };
    const voicebox = { cancelPending: vi.fn() };
    window.audio = { activeTexts: [{}], speakPlayerLine: () => {}, voicebox };
    window.rhythmFX = { telegraphs: [{}] };
    window.cameraSystem = new CameraSystem({});
    window.cameraSystem.addShake(20, 40);

    gs.restart();
    clearTimeout(gs.startSpeechTimer);

    for (const list of lists) expect(window.explosionManager[list]).toEqual([]);
    expect(smoke.end).toHaveBeenCalledTimes(1);
    expect(window.floatingText.texts).toEqual([]);
    expect(window.audio.activeTexts).toEqual([]);
    expect(voicebox.cancelPending).toHaveBeenCalledTimes(1);
    expect(window.rhythmFX.telegraphs).toEqual([]);
    expect(window.cameraSystem.screenShake.intensity).toBe(0);
    expect(gs.gameContext.get('hitStopFrames')).toBe(0);
  });
});
