import { expect, test } from 'bun:test';
import { SpawnSystem } from '@vibe/systems/SpawnSystem.js';
import { CONFIG } from '@vibe/core/config.js';

test('elite enemies can spawn at level 6 when enabled', () => {
  CONFIG.GAME_SETTINGS.ENABLE_ELITE_ENEMIES = true;
  global.window = { gameState: { level: 6 } };
  const spawner = new SpawnSystem();
  const results = new Set();
  for (let i = 0; i < 50; i++) {
    results.add(spawner.getEnemyTypeForLevel(window.gameState.level));
  }
  expect([...results].some((type) => type.endsWith('Elite'))).toBe(true);
});

