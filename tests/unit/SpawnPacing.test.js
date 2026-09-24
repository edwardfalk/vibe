import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpawnSystem, nextNewEnemyType } from '../../js/systems/SpawnSystem.js';
import { CONFIG } from '../../js/config.js';

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
