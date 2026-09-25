/**
 * Shared Playwright helpers for the E2E tests and the dev tools
 * (screenshot, playtest, beat assertions).
 */

// Start a run: load, press a key on the title screen, wait until playing
// with core systems and at least one live enemy.
export const bootGame = async (page) => {
  await page.goto('/');
  await page.waitForSelector('canvas', { state: 'attached' });
  // Any key starts the run from the title screen
  await page.keyboard.press(' ');
  await page.waitForFunction(
    () =>
      window.gameState?.gameState === 'playing' &&
      window.player &&
      window.collisionSystem &&
      Array.isArray(window.enemies) &&
      window.enemies.filter((enemy) => !enemy.markedForRemoval).length > 0 &&
      typeof window.frameCount === 'number' &&
      window.frameCount > 0
  );
};

// Jump to a level the way the ?tune panel does: exactly one threshold at a
// time, marked as a practice run so it can't set a high score.
export async function jumpToLevel(page, level) {
  await page.evaluate((target) => {
    const gs = window.gameState;
    if (!('practiceRun' in gs)) {
      throw new Error('practiceRun missing: is play-test-fixes merged?');
    }
    gs.practiceRun = true;
    for (let guard = 0; gs.level < target; guard++) {
      const before = gs.level;
      gs.addScore(gs.nextLevelThreshold - gs.score);
      if (gs.level === before || guard > 50) {
        throw new Error(`level stuck at ${gs.level} (state ${gs.gameState})`);
      }
    }
  }, level);
}
