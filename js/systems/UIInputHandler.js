/**
 * Input handling extracted from UIRenderer.
 * Dispatches key presses to game actions (restart, pause, sound, dash, shoot, aim).
 */

export function handleKeyPress(
  key,
  { gameState, player, audio, cameraSystem }
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
      console.log('⏸️ Game paused');
      return true;
    } else if (gameState.gameState === 'paused') {
      gameState.setGameState('playing');
      console.log('▶️ Game resumed');
      return true;
    }
  }

  if (key === 'm' || key === 'M') {
    if (audio) {
      const soundEnabled = audio.toggle();
      console.log('🎵 Sound ' + (soundEnabled ? 'enabled' : 'disabled'));
      document.getElementById('soundStatus').textContent = soundEnabled
        ? '🔊 Sound ON (M to toggle)'
        : '🔇 Sound OFF (M to toggle)';
      return true;
    }
  }

  if (key === 'e' || key === 'E') {
    // Dash with E
    if (gameState.gameState === 'playing' && player && player.dash()) {
      console.log('💨 Player dash activated!');
      if (cameraSystem) {
        cameraSystem.addShake(6, 12);
      }
      return true;
    }
  }

  if (key === ' ') {
    // Shoot with spacebar
    if (gameState.gameState === 'playing' && player) {
      const bullet = player.shoot();
      if (bullet) {
        // Ensure playerBullets array exists before pushing new bullet
        // Prevents shots from vanishing if array was uninitialized
        if (!gameState.playerBullets) {
          gameState.playerBullets = [];
        }
        gameState.playerBullets.push(bullet);
        if (gameState) {
          gameState.addShotFired();
        }
        if (audio) {
          audio.playPlayerShoot(player.x, player.y);
        }
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
