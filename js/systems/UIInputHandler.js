/**
 * Input handling extracted from UIRenderer.
 * Dispatches key presses to game actions (restart, pause, sound, dash, aim).
 */

export function handleKeyPress(
  key,
  { gameState, player, audio, cameraSystem, showToast }
) {
  if (!gameState) return false;

  if (key === 'r' || key === 'R') {
    if (gameState.gameState === 'gameOver') {
      gameState.restart();
      return true;
    }
  }

  if (key === 'p' || key === 'P') {
    if (gameState.gameState === 'playing') {
      gameState.setGameState('paused');
      return true;
    } else if (gameState.gameState === 'paused') {
      gameState.setGameState('playing');
      return true;
    }
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

  // Arrow keys for aim direction
  if (gameState.gameState === 'playing' && player) {
    if (key === 'ArrowUp') {
      player.aimAngle = -Math.PI / 2;
      return true;
    }
    if (key === 'ArrowDown') {
      player.aimAngle = Math.PI / 2;
      return true;
    }
    if (key === 'ArrowLeft') {
      player.aimAngle = Math.PI;
      return true;
    }
    if (key === 'ArrowRight') {
      player.aimAngle = 0;
      return true;
    }
  }

  return false;
}
