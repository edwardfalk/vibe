/**
 * Input handling extracted from UIRenderer.
 * Dispatches key presses to game actions (restart, pause, sound, dash).
 */

export function handleKeyPress(
  key,
  { gameState, player, audio, cameraSystem, showToast }
) {
  if (!gameState) return false;

  if (key === 'r' || key === 'R') {
    // Once GAME OVER is up: a quick R can't cut his death scene short
    if (gameState.overlayUp()) {
      gameState.restart();
      return true;
    }
    // His scene runs on the audio clock: if the browser suspended it, a key
    // press is the gesture that lets it run again
    if (gameState.gameState === 'gameOver') audio?.wake?.();
  }

  if (key === 'p' || key === 'P') {
    if (gameState.gameState === 'playing') {
      gameState.setGameState('paused');
    } else if (gameState.gameState === 'paused') {
      gameState.setGameState('playing');
    } else {
      return false;
    }
    // At once, not on the next frame: a sound due in between stays silent
    audio?.syncPause?.(gameState.gameState === 'paused');
    return true;
  }

  if (key === 'm' || key === 'M') {
    if (audio) {
      const soundEnabled = audio.toggle();
      showToast?.(soundEnabled ? 'Sound on' : 'Sound off');
      return true;
    }
  }

  if (key === 'e' || key === 'E') {
    // Dash with E
    if (gameState.gameState === 'playing' && player && player.dash()) {
      if (cameraSystem) {
        cameraSystem.addShake(6, 12);
      }
      return true;
    }
  }

  return false;
}
