import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpawnSystem, nextNewEnemyType } from '../../js/systems/SpawnSystem.js';
import { CONFIG } from '../../js/config.js';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { CameraSystem } from '../../js/systems/CameraSystem.js';

vi.spyOn(console, 'log').mockImplementation(() => {});
const original = structuredClone(CONFIG.PACING);

// A SpawnSystem on a fake context; returns what each spawn wave produced.
function waves({ level, progress }, count) {
  const gameState = {
    gameState: 'playing',
    level,
    getProgressToNextLevel: () => progress,
  };
  let beats = 0;
  const system = new SpawnSystem({
    gameState,
    enemies: [],
    beatClock: { isOnBeat: () => true, getTotalBeats: () => beats },
  });
  const spawned = [];
  vi.spyOn(system, 'spawnEnemies').mockImplementation((n, type = null) => {
    spawned.push(type ?? 'regular');
  });
  for (let i = 0; i < count; i++) {
    system.update();
    beats += 100; // always past the spawn interval
  }
  return spawned;
}

describe('Spawn pacing', () => {
  beforeEach(() => {
    CONFIG.PACING = structuredClone(original);
  });
  afterEach(() => {
    CONFIG.PACING = structuredClone(original);
  });

  it('knows which enemy type is introduced next', () => {
    expect(nextNewEnemyType(1)).toBe('stabber');
    expect(nextNewEnemyType(2)).toBe('rusher');
    expect(nextNewEnemyType(3)).toBe('tank');
    expect(nextNewEnemyType(4)).toBe('tank');
    expect(nextNewEnemyType(5)).toBeNull();
  });

  it('previews the next new type once, halfway through the level', () => {
    expect(waves({ level: 1, progress: 0.3 }, 3)).toEqual([
      'regular',
      'regular',
      'regular',
    ]);
    expect(waves({ level: 1, progress: 0.6 }, 3)).toEqual([
      'stabber',
      'regular',
      'regular',
    ]);
    expect(waves({ level: 2, progress: 0.6 }, 2)).toEqual([
      'rusher',
      'regular',
    ]);
  });

  it('previews again after a restart (reset)', () => {
    const gameState = {
      gameState: 'playing',
      level: 1,
      getProgressToNextLevel: () => 0.6,
    };
    let beats = 0;
    const system = new SpawnSystem({
      gameState,
      enemies: [],
      beatClock: { isOnBeat: () => true, getTotalBeats: () => beats },
    });
    const spawned = [];
    vi.spyOn(system, 'spawnEnemies').mockImplementation((n, type = null) => {
      spawned.push(type ?? 'regular');
    });
    system.update();
    system.reset();
    beats += 100;
    system.update();
    expect(spawned).toEqual(['stabber', 'stabber']);
  });

  it('spaces waves by the configured beats, getting faster by level', () => {
    // Real BeatClock on a fake audio clock, stepped at 60 fps for 30 s
    function waveGaps(level) {
      let ms = 0;
      const beatClock = new BeatClock(120, {
        get currentTime() {
          return ms / 1000;
        },
      });
      const system = new SpawnSystem({
        gameState: {
          gameState: 'playing',
          level,
          getProgressToNextLevel: () => 0,
        },
        enemies: [],
        beatClock,
      });
      const waveBeats = [];
      system.spawnEnemies = () => waveBeats.push(beatClock.getTotalBeats());
      for (ms = 0; ms < 30000; ms += 1000 / 60) system.update();
      return [...new Set(waveBeats.slice(1).map((b, i) => b - waveBeats[i]))];
    }
    // 6 beats, 0.5 sooner per level, whole beats, minimum 4
    expect(waveGaps(1)).toEqual([6]);
    expect(waveGaps(3)).toEqual([5]);
    expect(waveGaps(5)).toEqual([4]);
    expect(waveGaps(9)).toEqual([4]);
  });

  it('previews nothing when switched off or when every type is in', () => {
    CONFIG.PACING.PREVIEW_NEW_ENEMY = false;
    expect(waves({ level: 1, progress: 0.9 }, 2)).toEqual([
      'regular',
      'regular',
    ]);
    CONFIG.PACING.PREVIEW_NEW_ENEMY = true;
    expect(waves({ level: 6, progress: 0.9 }, 2)).toEqual([
      'regular',
      'regular',
    ]);
  });
});

describe('spawn position', () => {
  const p = { width: 800, height: 600 };

  it('is just outside the camera view and inside the world', () => {
    const halfW = CONFIG.GAME_SETTINGS.WORLD_WIDTH / 2;
    const halfH = CONFIG.GAME_SETTINGS.WORLD_HEIGHT / 2;
    // Centred, and pushed as far as the camera goes, where the view's
    // right and bottom edges are the world's
    for (const [camX, camY] of [
      [0, 0],
      [halfW - p.width / 2, halfH - p.height / 2],
    ]) {
      const cameraSystem = new CameraSystem(p);
      cameraSystem.x = camX;
      cameraSystem.y = camY;
      const values = { player: { x: camX, y: camY, p }, cameraSystem };
      const system = new SpawnSystem(null);
      system.getContextValue = (key) => values[key];
      const view = {
        left: camX - p.width / 2,
        right: camX + p.width / 2,
        top: camY - p.height / 2,
        bottom: camY + p.height / 2,
      };
      for (let i = 0; i < 200; i++) {
        const { x, y } = system.findSpawnPosition();
        const outside =
          x < view.left || x > view.right || y < view.top || y > view.bottom;
        expect(outside).toBe(true);
        expect(Math.abs(x)).toBeLessThanOrEqual(halfW);
        expect(Math.abs(y)).toBeLessThanOrEqual(halfH);
      }
    }
  });

  it('keeps a good spot found on the last attempt', () => {
    const player = { x: 0, y: 0, p };
    const cameraSystem = new CameraSystem(p);
    // Every spot is next to an enemy until the 50th attempt
    let lookups = 0;
    const crowd = [{ x: 999, y: 0 }];
    const system = new SpawnSystem(null);
    system.getContextValue = (key) => {
      if (key === 'player') return player;
      if (key === 'cameraSystem') return cameraSystem;
      lookups++;
      return lookups < 50 ? crowd : [];
    };
    system.getDistance = (x1, y1, x2, y2) => (x2 === player.x ? 1000 : 0);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    system.findSpawnPosition();

    expect(lookups).toBe(50);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
