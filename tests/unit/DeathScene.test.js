import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.stubGlobal('localStorage', {
  _store: {},
  getItem(key) {
    return this._store[key] ?? null;
  },
  setItem(key, value) {
    this._store[key] = String(value);
  },
});
vi.spyOn(console, 'log').mockImplementation(() => {});

const { Player } = await import('../../js/entities/player.js');
const { GameState } = await import('../../js/core/GameState.js');
const { CONFIG } = await import('../../js/config.js');
const { handleKeyPress } = await import('../../js/systems/UIInputHandler.js');
const { UIRenderer } = await import('../../js/systems/UIRenderer.js');
const { Audio } = await import('../../js/Audio.js');
const { drawDudeDeath, drawDudeScene, easeCameraIn } =
  await import('../../js/entities/DudeDeath.js');
const { transformP5 } = await import('./helpers/transformP5.js');

const DEATHS = { ...CONFIG.DEATHS };
const p = {
  color: () => ({}),
  keyIsDown: () => false,
  constrain: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
  cos: Math.cos,
  sin: Math.sin,
  mouseX: 0,
  mouseY: 0,
  width: 800,
  height: 600,
};

// A beat clock on audio time: 120 BPM from 0, the eighths every 0.25 s
function audioClock(t) {
  const clock = {
    t,
    startTime: 0,
    beatInterval: 500,
    nowSec: () => clock.t,
    getBeatPosition: () => clock.t * 2,
    reset() {},
  };
  return clock;
}

// The real GameState and Player, on the globals GameState reads
function world(t = 10.13) {
  const clock = audioClock(t);
  const audio = {
    playSound: vi.fn(),
    speakPlayerLine: vi.fn(),
    playLastBreath: vi.fn(),
    voicebox: { cancelPending: vi.fn() },
    activeTexts: [],
  };
  const gameState = new GameState();
  const player = new Player(p, 100, 100, null, {
    playerBullets: [],
    audio,
    gameState,
    beatClock: clock,
  });
  player.shieldUp = false;
  globalThis.window = { audio, beatClock: clock, player, gameState };
  const deathLines = () =>
    audio.speakPlayerLine.mock.calls.filter(([, c]) => c === 'death');
  const sounds = () => audio.playSound.mock.calls.map(([key]) => key);
  const pressR = () => handleKeyPress('r', { gameState, player, audio });
  return { clock, audio, gameState, player, deathLines, sounds, pressR };
}

describe("the Dude's death scene", () => {
  afterEach(() => Object.assign(CONFIG.DEATHS, DEATHS));

  it('the fatal hit ends the run and starts his scene once: one breath, one line, forced past the cooldown', () => {
    const w = world();
    w.player.hurt(500, 'test');
    expect(w.gameState.gameState).toBe('gameOver');
    expect(w.gameState.scene.at).toBe(10.13);
    expect(w.audio.playLastBreath).toHaveBeenCalledWith(10.13);
    expect(w.audio.voicebox.cancelPending).toHaveBeenCalledTimes(1);
    expect(w.deathLines()).toEqual([[w.player, 'death', true]]);
    // A second fatal hit in the same frame changes nothing
    const scene = w.gameState.scene;
    w.player.hurt(500, 'test');
    w.gameState.setGameState('gameOver');
    expect(w.gameState.scene).toBe(scene);
    expect(w.audio.playLastBreath).toHaveBeenCalledTimes(1);
    expect(w.deathLines()).toHaveLength(1);
    expect(w.sounds()).not.toContain('gameOver');
  });

  it('GAME OVER, its sound and R wait for the first eighth at least four beats after the hit', () => {
    const w = world(10.13); // the scene ends at 12.13; the eighth after is 12.25
    w.player.hurt(500, 'test');
    for (const t of [10.5, 12.13, 12.24]) {
      w.clock.t = t;
      w.gameState.updateScene();
      expect(w.gameState.overlayUp()).toBe(false);
      expect(w.pressR()).toBe(false);
    }
    expect(w.gameState.gameState).toBe('gameOver');
    expect(w.sounds()).not.toContain('gameOver');
    w.clock.t = 12.25;
    w.gameState.updateScene();
    w.gameState.updateScene();
    expect(w.gameState.overlayUp()).toBe(true);
    expect(w.sounds().filter((k) => k === 'gameOver')).toHaveLength(1);
    expect(w.pressR()).toBe(true);
    expect(w.gameState.gameState).toBe('playing');
    expect(w.gameState.scene).toBe(null);
  });

  it('GAME OVER is drawn only once it is up', () => {
    const w = world(10.13);
    w.player.hurt(500, 'test');
    const ui = Object.assign(Object.create(UIRenderer.prototype), {
      gameState: w.gameState,
      drawScore() {},
      drawLevelProgress() {},
      drawKillStreakIndicator() {},
      drawHealthBar() {},
      drawDashStatus() {},
      drawGameOver: vi.fn(),
    });
    ui.drawUI({});
    expect(ui.drawGameOver).not.toHaveBeenCalled();
    w.clock.t = 12.25;
    w.gameState.updateScene();
    ui.drawUI({});
    expect(ui.drawGameOver).toHaveBeenCalledTimes(1);
  });

  it('runs as many beats as ?tune says, read when it starts', () => {
    CONFIG.DEATHS.SCENE_BEATS = 8;
    const w = world(10.13);
    w.player.hurt(500, 'test');
    CONFIG.DEATHS.SCENE_BEATS = 4; // too late for this one
    expect(w.gameState.scene.overlayAt).toBe(14.25);
  });

  it('a game over that lands on an eighth comes up on it', () => {
    const w = world(10);
    w.gameState.setGameState('gameOver'); // as the browser tests do: no hit
    expect(w.gameState.scene.overlayAt).toBe(12);
  });

  it('his earlier bubbles go as his death line takes over, and so do the just-cancelled lines’ bubbles still waiting; the aliens’ showing stay', () => {
    const w = world();
    const grunt = { x: 0, y: 0 };
    w.audio.textTime = 10;
    const showing = { entity: grunt, showsAt: 9 };
    w.audio.activeTexts.push(
      { entity: w.player, showsAt: null },
      showing,
      { entity: grunt, showsAt: 10.4 } // its line was waiting: cancelled
    );
    w.player.hurt(500, 'test');
    expect(w.audio.activeTexts).toEqual([showing]);
  });

  it('starts the audio before it reads the clock, so the scene is on the clock that ends it', () => {
    const w = world(10.13);
    // Starting the audio moves the beat clock onto audio time
    w.audio.ensureAudioContext = vi.fn(() => (w.clock.t = 3.13));
    w.player.hurt(500, 'test');
    expect(w.gameState.scene.at).toBe(3.13);
    expect(w.gameState.scene.overlayAt).toBe(5.25);
  });

  it('R during his scene doesn’t restart, but asks a suspended audio clock to run again', () => {
    const w = world();
    w.player.hurt(500, 'test');
    w.audio.wake = vi.fn();
    expect(w.pressR()).toBe(false);
    expect(w.audio.wake).toHaveBeenCalledTimes(1);
    expect(w.gameState.gameState).toBe('gameOver');
  });

  it('waking the audio resumes a suspended or interrupted context, muted or not; not a running one, nor one a pause holds', () => {
    const audioWith = (state, o = {}) => {
      const audio = Object.assign(Object.create(Audio.prototype), {
        audioContext: { state, resume: vi.fn(async () => {}) },
        enabled: false, // muted: mute is gains, the clock runs on
        _pausedByGame: false,
        ...o,
      });
      audio.wake();
      return audio.audioContext.resume;
    };
    expect(audioWith('suspended')).toHaveBeenCalledTimes(1);
    expect(audioWith('interrupted')).toHaveBeenCalledTimes(1);
    expect(audioWith('running')).not.toHaveBeenCalled();
    expect(
      audioWith('suspended', { _pausedByGame: true })
    ).not.toHaveBeenCalled();
  });

  it('GAME OVER waits for an eighth of the clock’s own grid, wherever it starts', () => {
    const w = world(10.13);
    w.clock.startTime = 100; // its eighths at 0.1 + k × 0.25
    w.player.hurt(500, 'test');
    expect(w.gameState.scene.overlayAt).toBeCloseTo(12.35, 9);
  });

  it('a hit that is not fatal still speaks as before, and a fatal one says nothing of its own', () => {
    const w = world();
    w.player.hurt(10, 'test');
    expect(w.audio.speakPlayerLine).toHaveBeenCalledWith(w.player, 'damage');
    w.audio.speakPlayerLine.mockClear();
    w.player.hurt(500, 'test');
    expect(w.audio.speakPlayerLine.mock.calls).toEqual([
      [w.player, 'death', true],
    ]);
  });

  it('with no clock to time it by, GAME OVER comes at once', () => {
    const w = world();
    delete globalThis.window.beatClock;
    w.gameState.setGameState('gameOver');
    expect(w.gameState.overlayUp()).toBe(true);
    expect(w.sounds()).toContain('gameOver');
  });

  it('a restart clears it', () => {
    const w = world();
    w.player.hurt(500, 'test');
    w.gameState.restart();
    expect(w.gameState.scene).toBe(null);
    expect(w.gameState.overlayUp()).toBe(false);
  });
});

describe('the Dude, lying back', () => {
  beforeEach(() => {
    globalThis.window = {};
  });

  // A pose as Player#pose gives it, from his last look
  const LOOK = {
    t: 3,
    side: -1,
    aimRel: 0.2,
    kick: 0.5,
    kickAge: 0.1,
    prevKickAge: 0.6,
  };

  it('draws at every moment of it, without the game’s random numbers, and restores the canvas', () => {
    for (const a of [0, 0.1, 0.35, 0.7, 1.3, 2, 3.5]) {
      const { p } = transformP5();
      const spy = vi.spyOn(Math, 'random');
      expect(() => drawDudeDeath(p, 50, 60, LOOK, a, 32)).not.toThrow();
      expect(spy).toHaveBeenCalledTimes(0);
      const ctx = p.drawingContext;
      expect(ctx.alphasDrawn.length).toBeGreaterThan(0);
      expect(ctx.depth).toBe(0); // every save restored
      expect(ctx.moved).toBe(0);
      expect(ctx.globalAlpha).toBe(1);
      expect(ctx.globalCompositeOperation).toBe('source-over');
      // The hit's flash brightens him at first, then not
      expect(ctx.opsDrawn.includes('lighter')).toBe(a < 0.18);
      spy.mockRestore();
    }
  });

  it('in his scene, his pose is taken on the live beat, so he dips with each kick', () => {
    const clock = audioClock(20);
    const player = {
      x: 5,
      y: 6,
      drawnSize: () => 32,
      poseAt: vi.fn(() => LOOK),
    };
    drawDudeScene(transformP5().p, player, { at: 19 }, clock);
    expect(player.poseAt).toHaveBeenCalledWith(40);
  });

  describe('the camera', () => {
    afterEach(() => Object.assign(CONFIG.DEATHS, DEATHS));
    // The camera puts world (x, y) on screen at (x + 100, y + 50)
    const camera = { worldToScreen: (x, y) => ({ x: x + 100, y: y + 50 }) };
    const player = { x: 30, y: 40 }; // on screen at (130, 90)
    // Where he lands on screen `since` s into his scene, and how big
    const landed = (since) => {
      const { p, shapes, calls } = transformP5();
      Object.assign(p, { width: 800, height: 600 });
      easeCameraIn(p, camera, player, { at: 50 }, audioClock(50 + since));
      p.ellipse(player.x, player.y, 10);
      const [x, y] = shapes[0].centre;
      const scale = calls.find(([n]) => n === 'scale')?.[1] ?? 1;
      return { x: x + 100, y: y + 50, scale };
    };

    it('eases in over two beats to SCENE_ZOOM round him, bringing him to the centre, then holds', () => {
      expect(landed(0)).toEqual({ x: 130, y: 90, scale: 1 });
      const mid = landed(0.5);
      expect(mid.scale).toBeGreaterThan(1);
      expect(mid.scale).toBeLessThan(CONFIG.DEATHS.SCENE_ZOOM);
      expect(mid.x).toBeGreaterThan(130);
      expect(mid.x).toBeLessThan(400);
      for (const since of [1, 5]) {
        const end = landed(since);
        expect(end.scale).toBeCloseTo(CONFIG.DEATHS.SCENE_ZOOM, 9);
        expect(end.x).toBeCloseTo(400, 9);
        expect(end.y).toBeCloseTo(300, 9);
      }
    });

    it('at zoom 1 does nothing at all', () => {
      CONFIG.DEATHS.SCENE_ZOOM = 1;
      expect(landed(1)).toEqual({ x: 130, y: 90, scale: 1 });
    });
  });
});
