import { test, expect } from '@playwright/test';

test('tanks can spawn at level 4', async ({ page }) => {
  await page.goto('http://localhost:5500');

  await page.waitForFunction(
    () =>
      window.player &&
      window.gameState &&
      window.gameState.gameState === 'playing'
  );

  const result = await page.evaluate(() => {
    window.gameState.level = 4;
    window.gameState.enemies = [];
    // Spawn many enemies to account for random selection
    for (let i = 0; i < 50; i++) {
      window.spawnSystem.spawnEnemies(1);
    }
    const types = window.gameState.enemies.map((e) => e.type);
    const tankCount = types.filter((t) => t === 'tank').length;
    return { types, tankCount };
  });

  console.log('Spawned enemy types at level 4:', result.types);
  expect(result.tankCount).toBeGreaterThan(0);
});
