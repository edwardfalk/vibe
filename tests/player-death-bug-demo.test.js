import { test, expect } from '@playwright/test';
import { DebugLogger } from '../packages/tooling/src/DebugLogger.js';

/**
 * Player-death bug demo
 *
 * Demonstrates the current defect: setting the player's health to 0 via
 * `player.takeDamage()` does NOT automatically transition `gameState` to
 * `gameOver`.  This test is expected to FAIL until the bug is fixed, making it
 * a living example of how the probes catch regressions.
 *
 * NOTE: Marked with `test.fail()` so CI will not break; remove the flag once
 * the underlying logic is corrected.
 */

test('Player health 0 should trigger gameOver (bug demo)', async ({ page }) => {
  test.fail(true, 'Known bug: gameOver not triggered when player.takeDamage() used');

  await page.goto('/index.html');
  await page.waitForSelector('canvas');

  // Unlock audio (click)
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    canvas && canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  await page.waitForFunction(() => window.player && window.gameState);

  // Apply lethal damage in-page
  await page.evaluate(() => {
    if (window.player && typeof window.player.takeDamage === 'function') {
      window.player.takeDamage(window.player.health + 5, 'probe-bug-demo');
    }
  });

  // Wait a short moment to allow potential gameOver change
  await page.waitForTimeout(500);

  const status = await page.evaluate(() => ({
    health: window.player.health,
    state: window.gameState.gameState,
  }));

  // Assert – this currently fails (state remains 'playing')
  expect(status.health).toBe(0);
  expect(status.state).toBe('gameOver');
});
