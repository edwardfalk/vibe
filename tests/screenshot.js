import { test } from '@playwright/test';
import { bootGame, jumpToLevel } from './helpers/boot.js';

// Parse CLI args from environment (Playwright doesn't pass process.argv easily)
// Usage: LEVEL=3 WAIT=5000 npx playwright test tests/screenshot.js
const TARGET_LEVEL = parseInt(process.env.LEVEL) || 0;
const WAIT_MS = parseInt(process.env.WAIT) || 2000;
const OUTPUT_PATH = 'tests/screenshots/game-screenshot.png';

// Jump to the target level, then give its new enemy types time to spawn
const fastForwardToLevel = async (page, level) => {
  if (level < 2) return;
  await jumpToLevel(page, level);
  await page.waitForTimeout(1500);
};

/**
 * Simulate brief gameplay: move and shoot so screenshot has action.
 */
const simulateGameplay = async (page) => {
  // Move right and shoot
  await page.keyboard.down('d');
  await page.keyboard.down(' ');
  await page.waitForTimeout(800);
  await page.keyboard.up('d');

  // Move up-left and keep shooting
  await page.keyboard.down('w');
  await page.keyboard.down('a');
  await page.waitForTimeout(700);
  await page.keyboard.up('w');
  await page.keyboard.up('a');
  await page.keyboard.up(' ');
};

test('capture game screenshot', async ({ page }) => {
  // Collect console errors
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await bootGame(page);

  if (TARGET_LEVEL > 1) {
    await fastForwardToLevel(page, TARGET_LEVEL);
  }

  await simulateGameplay(page);
  await page.waitForTimeout(WAIT_MS);

  // Capture game state info
  const info = await page.evaluate(() => ({
    level: window.gameState?.level,
    score: window.gameState?.score,
    enemyCount: window.enemies?.filter((e) => !e.markedForRemoval).length,
    playerHealth: window.player?.health,
    frameCount: window.frameCount,
  }));

  await page.screenshot({ path: OUTPUT_PATH, fullPage: true });

  // Print a summary for whoever ran the script
  console.log(`\n📸 Screenshot saved: ${OUTPUT_PATH}`);
  console.log(
    `   Level: ${info.level} | Score: ${info.score} | Enemies: ${info.enemyCount} | Health: ${info.playerHealth} | Frame: ${info.frameCount}`
  );
  if (errors.length > 0) {
    console.log(`   ⚠️ Console errors (${errors.length}):`);
    errors.forEach((e) => console.log(`     - ${e}`));
  }
});
