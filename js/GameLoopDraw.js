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

  if (window.backgroundRenderer) {
    window.backgroundRenderer.drawCosmicAuroraBackground(p);
    window.backgroundRenderer.drawEnhancedSpaceElements(p);
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
        if (window.uiRenderer) {
          window.uiRenderer.updateUI(p);
        }
        break;

      case 'paused':
        drawGame(p);
        break;

      case 'gameOver':
        if (window.testModeManager && window.testModeManager.enabled) {
          window.gameState.gameOverTimer++;
          if (window.gameState.gameOverTimer >= 60) {
            window.gameState.restart();
            console.log('🔄 Auto-restarting game in test mode');
          }
        }
        break;
    }
  }

  if (window.uiRenderer) {
    window.uiRenderer.drawUI(p);
  }

  if (window.rhythmFX) {
    window.rhythmFX.draw(p, window.cameraSystem);
  }
}
