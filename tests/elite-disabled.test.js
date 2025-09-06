import { expect, test } from 'bun:test';
import { SpawnSystem } from '@vibe/systems/SpawnSystem.js';
import { CONFIG } from '@vibe/core/config.js';

test('elite enemies do not spawn when disabled', () => {
  CONFIG.GAME_SETTINGS.ENABLE_ELITE_ENEMIES = false;
  global.window = { gameState: { level: 6 } };
  const spawner = new SpawnSystem();
  const results = new Set();
  for (let i = 0; i < 50; i++) {
    results.add(spawner.getEnemyTypeForLevel(window.gameState.level));
  }
  expect([...results].every((type) => !type.endsWith('Elite'))).toBe(true);
});

