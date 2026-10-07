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
  // Pausing holds the sound; checked every frame, so ?tune's box takes at once
  window.audio?.syncPause?.(window.gameState?.gameState === 'paused');

  if (window.backgroundRenderer) {
    window.backgroundRenderer.drawSky(p);
    if (window.gameState && window.gameState.gameState === 'playing') {
      window.backgroundRenderer.drawInteractiveBackgroundEffects(p);
    }
  }

  if (window.gameState) {
    switch (window.gameState.gameState) {
      case 'playing':
        updateGame(p);
        drawGame(p);
        // Under the HUD; not while paused or over, when they would freeze
        window.rhythmFX?.drawAttackTelegraphs(p, window.cameraSystem ?? null);
        break;

      case 'paused':
        drawGame(p);
        break;

      case 'gameOver':
        // His death scene, until GAME OVER: the world drawn as it was, only
        // the bubbles and the screen effects fading
        window.gameState.updateScene();
        if (!window.gameState.overlayUp()) {
          window.audio?.updateTexts();
          window.visualEffectsManager?.update();
          drawGame(p);
        }
        break;
    }
  }

  if (window.uiRenderer) {
    window.uiRenderer.drawUI(p);
  }
}
