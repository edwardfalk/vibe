/**
 * GameLoopDraw - Top-level draw loop and state dispatch.
 * Extracted from GameLoop.js for file-size split (~500 line guideline).
 */

/**
 * Run main draw loop. Calls updateGame and drawGame when appropriate.
 * @param {p5} p - p5 instance
 * @param {Function} updateGame - (p) => void
 * @param {Function} drawGame - (p) => void
 */
export function runDraw(p, updateGame, drawGame) {
  window.frameCount = p.frameCount;
  // Before the state switch, so speech on the game-over screen can't stick.
  // (Pauses in a hidden tab with the draw loop; the 5 s cap still applies.)
  window.audio?.syncDuck?.();

  if (window.backgroundRenderer) {
    window.backgroundRenderer.drawCosmicAuroraBackground(p);
  }

  if (window.backgroundRenderer) {
    window.backgroundRenderer.drawParallaxBackground(p);
    if (window.gameState && window.gameState.gameState === 'playing') {
      window.backgroundRenderer.drawInteractiveBackgroundEffects(p);
    }
  }

  if (window.gameState) {
    switch (window.gameState.gameState) {
      case 'playing':
        updateGame(p);
        drawGame(p);
        break;

      case 'paused':
        drawGame(p);
        break;

      case 'gameOver':
        break;
    }
  }

  if (window.uiRenderer) {
    window.uiRenderer.drawUI(p);
  }

  if (window.rhythmFX) {
    window.rhythmFX.draw(p, window.cameraSystem ?? null);
  }
}
