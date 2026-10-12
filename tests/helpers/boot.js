/**
 * Shared Playwright helpers for the E2E tests and the dev tools
 * (screenshot, playtest, beat assertions).
 */

// Start a run: load (url, e.g. '/?tune'), press a key on the title screen,
// wait until playing with core systems and at least one live enemy.
export const bootGame = async (page, url = '/') => {
  await page.goto(url);
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

// Point the mouse at the nearest live enemy (the canvas is CSS-scaled, so
// canvas pixels are converted to page pixels). `box` is the canvas's
// bounding box.
export const aimAtNearestEnemy = async (page, box) => {
  const target = await page.evaluate(() => {
    const p = window.player;
    let best = null;
    let bestDist = Infinity;
    for (const e of window.enemies ?? []) {
      if (e.markedForRemoval) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best ? window.cameraSystem.worldToScreen(best.x, best.y) : null;
  });
  if (!target) return;
  const scale = box.width / 800;
  await page.mouse.move(box.x + target.x * scale, box.y + target.y * scale);
};
