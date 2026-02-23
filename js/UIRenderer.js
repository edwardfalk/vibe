/**
 * UIRenderer.js - Handles all UI drawing including HUD, game over screen, pause screen, and bomb indicators
 */

// Requires p5.js for constrain(), random(), lerp(), etc.

import { floor, ceil, min, random } from './mathUtils.js';

/**
 * @param {GameState} gameState - The game state object (dependency injected for modularity)
 * @param {Player} player - The player object (dependency injected for modularity)
 * @param {Audio} audio - The audio system (dependency injected for modularity)
 * @param {CameraSystem} cameraSystem - The camera system (dependency injected for modularity)
 * @param {TestMode} testModeManager - The test mode manager (dependency injected for modularity)
 */
export class UIRenderer {
  constructor(gameState, player, audio, cameraSystem, testModeManager) {
    // UI state
    this.gameState = gameState;
    this.player = player;
    this.audio = audio;
    this.cameraSystem = cameraSystem;
    this.testModeManager = testModeManager;
    this.dashElement = null;
    this.gameOverMessages = [
      'GAME OVER',
      'YOU GOT VIBED',
      'ALIEN SUPERIORITY',
      'SPACE REKT',
      'COSMIC FAIL',
    ];

    this.funnyComments = [
      'The aliens are laughing at you!',
      'Maybe try not getting exploded?',
      'Space is hard, who knew?',
      'The rushers send their regards',
      'Better luck next time, earthling!',
    ];

    this._createToast(); // Add toast/banner for confirmations
  }

  // Update HTML UI elements
  updateUI() {
    if (!this.gameState || !this.player) return;

    // Update main UI elements with enhanced formatting
    const scoreText =
      this.gameState.killStreak >= 5
        ? `Score: ${this.gameState.score.toLocaleString()} (${this.gameState.killStreak}x STREAK!)`
        : `Score: ${this.gameState.score.toLocaleString()}`;

    document.getElementById('score').textContent = scoreText;
    document.getElementById('health').textContent =
      `Health: ${this.player.health}`;
    document.getElementById('level').textContent =
      `Level: ${this.gameState.level}`;

    // Add dash cooldown indicator
    this.updateDashIndicator();

    // Update audio system
    if (this.audio && typeof this.audio.updateTexts === 'function') {
      this.audio.updateTexts();
    }
  }

  // Update dash cooldown indicator
  updateDashIndicator() {
    if (!this.dashElement) {
      this.dashElement = document.createElement('div');
      this.dashElement.id = 'dash';
      this.dashElement.style.cssText =
        'position: absolute; top: 120px; left: 10px; color: white; font-family: monospace; font-size: 14px;';
      document.body.appendChild(this.dashElement);
    }

    if (this.player.dashCooldownMs > 0) {
      const cooldownSeconds = (this.player.dashCooldownMs / 1000).toFixed(1);
      this.dashElement.textContent = `Dash: ${cooldownSeconds}s`;
      this.dashElement.style.color = '#ff6666';
    } else {
      this.dashElement.textContent = 'Dash: READY (E) | Shoot: SPACE or Mouse';
      this.dashElement.style.color = '#66ff66';
    }
  }

  // Draw game over screen
  drawGameOver(p) {
    if (!this.gameState) return;

    p.push();

    // Semi-transparent overlay
    p.fill(0, 0, 0, 150);
    p.rect(0, 0, p.width, p.height);

    // Check for new high score
    let isNewHighScore = false;
    if (this.gameState.score > this.gameState.highScore) {
      this.gameState.updateHighScore();
      isNewHighScore = true;
    }

    // Game over text with animation
    p.fill(255, 100, 100);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(48 + p.sin(p.frameCount * 0.1) * 4);
    const messageIndex =
      floor(this.gameState.score / 50) % this.gameOverMessages.length;
    p.text(this.gameOverMessages[messageIndex], p.width / 2, p.height / 2 - 80);

    // New high score celebration
    if (isNewHighScore) {
      p.fill(255, 255, 0);
      p.textSize(20 + p.sin(p.frameCount * 0.2) * 3);
      p.text('NEW HIGH SCORE! 🎉', p.width / 2, p.height / 2 - 50);
    }

    // Score and level
    p.fill(255);
    p.textSize(24);
    p.text(
      `Final Score: ${this.gameState.score.toLocaleString()}`,
      p.width / 2,
      p.height / 2 - 10
    );
    p.text(
      `Level Reached: ${this.gameState.level}`,
      p.width / 2,
      p.height / 2 + 20
    );

    // Stats
    p.fill(200, 200, 255);
    p.textSize(16);
    p.text(
      `Enemies Killed: ${this.gameState.totalKills}`,
      p.width / 2,
      p.height / 2 + 45
    );
    const accuracy = this.gameState.getAccuracy();
    p.text(`Accuracy: ${accuracy}%`, p.width / 2, p.height / 2 + 65);

    // High score display
    p.fill(255, 255, 100);
    p.textSize(18);
    p.text(
      `High Score: ${this.gameState.highScore.toLocaleString()}`,
      p.width / 2,
      p.height / 2 + 90
    );

    // Funny comment
    p.fill(255, 255, 100);
    p.textSize(16);
    const commentIndex =
      floor(this.gameState.score / 30) % this.funnyComments.length;
    p.text(this.funnyComments[commentIndex], p.width / 2, p.height / 2 + 115);

    // Restart instruction
    p.fill(255);
    p.textSize(16);
    p.text('Press R to restart', p.width / 2, p.height / 2 + 140);

    p.pop();
  }

  // Draw pause screen
  drawPauseScreen(p) {
    if (!this.gameState) return;

    p.push();

    // Semi-transparent overlay
    p.fill(0, 0, 0, 100);
    p.rect(0, 0, p.width, p.height);

    // Pause text
    p.fill(255, 255, 255);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(48);
    p.text('PAUSED', p.width / 2, p.height / 2 - 40);

    // Instructions
    p.fill(200, 200, 200);
    p.textSize(20);
    p.text('Press P to resume', p.width / 2, p.height / 2 + 20);

    // Current stats
    p.fill(255, 255, 100);
    p.textSize(16);
    p.text(
      `Score: ${this.gameState.score.toLocaleString()}`,
      p.width / 2,
      p.height / 2 + 60
    );
    p.text(
      `Level: ${this.gameState.level} | Kills: ${this.gameState.totalKills}`,
      p.width / 2,
      p.height / 2 + 80
    );

    if (this.gameState.killStreak >= 5) {
      p.fill(255, 100, 100);
      p.text(
        `🔥 ${this.gameState.killStreak}x KILL STREAK! 🔥`,
        p.width / 2,
        p.height / 2 + 100
      );
    }

    p.pop();
  }

  // Draw bomb countdown indicators
  drawBombs(p) {
    if (!window.activeBombs || window.activeBombs.length === 0) return;

    p.push();

    for (const bomb of window.activeBombs) {
      const screenX = bomb.x - (this.cameraSystem ? this.cameraSystem.x : 0);
      const screenY = bomb.y - (this.cameraSystem ? this.cameraSystem.y : 0);

      // Calculate countdown
      const secondsLeft = ceil(bomb.timer / 60);
      const progress = bomb.timer / bomb.maxTimer;

      // Pulsing red warning circle
      const pulseIntensity = 1 + p.sin(p.frameCount * 0.3) * 0.3;
      const warningSize = 60 * pulseIntensity;

      // Warning circle color (red to yellow as time runs out)
      const red = 255;
      const green = progress * 255;
      const blue = 0;

      p.stroke(red, green, blue, 200);
      p.strokeWeight(4);
      p.noFill();
      p.circle(screenX, screenY, warningSize);

      // Countdown text
      p.fill(255, 255, 255);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(24);
      p.strokeWeight(2);
      p.stroke(0, 0, 0);
      p.text(secondsLeft, screenX, screenY);

      // 'TIME BOMB' label (was 'BOMB')
      p.textSize(12);
      p.fill(255, 0, 0);
      p.text('TIME BOMB', screenX, screenY - 35);
    }

    p.pop();
  }

  // Draw level progress indicator
  drawLevelProgress(p) {
    if (!this.gameState) return;
    p.push();
    const progress = this.gameState.getProgressToNextLevel();
    const barWidth = 200;
    const barHeight = 8;
    const barX = p.width - barWidth - 20;
    const barY = 20;
    // Background bar
    p.fill(50, 50, 50, 150);
    p.noStroke();
    p.rect(barX, barY, barWidth, barHeight);
    // Progress bar
    p.fill(100, 255, 100, 200);
    p.rect(barX, barY, barWidth * progress, barHeight);
    // Border
    p.stroke(255, 255, 255, 100);
    p.strokeWeight(1);
    p.noFill();
    p.rect(barX, barY, barWidth, barHeight);
    // Label
    p.fill(255, 255, 255);
    p.textAlign(p.RIGHT, p.TOP);
    p.textSize(12);
    p.noStroke();
    p.text(
      `Level ${this.gameState.level} Progress`,
      barX + barWidth,
      barY - 15
    );
    p.pop();
  }

  // Draw kill streak indicator
  drawKillStreakIndicator(p) {
    if (!this.gameState || this.gameState.killStreak < 3) return;
    p.push();
    const streak = this.gameState.killStreak;
    const x = p.width / 2;
    const y = 80;
    // Pulsing effect for high streaks
    const pulse = p.sin(p.frameCount * 0.2) * 0.5 + 0.5;
    const intensity = Math.min(streak / 10, 1);
    // Background glow
    p.fill(255, 100, 100, 50 + pulse * 50 * intensity);
    p.noStroke();
    p.ellipse(x, y, 120 + pulse * 20, 40 + pulse * 10);
    // Text
    p.fill(255, 255, 255);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(16 + pulse * 4);
    p.text(`${streak}x KILL STREAK!`, x, y);
    // Fire effects for high streaks
    if (streak >= 10) {
      p.fill(255, 150, 0, 100 + pulse * 100);
      p.textSize(20 + pulse * 6);
      p.text('🔥 ON FIRE! 🔥', x, y + 25);
    }
    p.pop();
  }

  // Draw health bar
  drawHealthBar(p) {
    if (!this.player) return;
    p.push();
    const healthPercent = this.player.health / this.player.maxHealth;
    const barWidth = 150;
    const barHeight = 12;
    const barX = 20;
    const barY = p.height - 40;
    // Background bar
    p.fill(50, 50, 50, 150);
    p.noStroke();
    p.rect(barX, barY, barWidth, barHeight);
    // Health bar color based on health level
    if (healthPercent > 0.6) {
      p.fill(100, 255, 100, 200); // Green
    } else if (healthPercent > 0.3) {
      p.fill(255, 255, 100, 200); // Yellow
    } else {
      p.fill(255, 100, 100, 200); // Red
    }
    p.rect(barX, barY, barWidth * healthPercent, barHeight);
    // Border
    p.stroke(255, 255, 255, 100);
    p.strokeWeight(1);
    p.noFill();
    p.rect(barX, barY, barWidth, barHeight);
    // Health text
    p.fill(255, 255, 255);
    p.textAlign(p.LEFT, p.BOTTOM);
    p.textSize(12);
    p.noStroke();
    p.text(
      `Health: ${this.player.health}/${this.player.maxHealth}`,
      barX,
      barY - 5
    );
    p.pop();
  }

  // Draw all UI elements
  drawUI(p) {
    // Draw in-game UI elements
    this.drawLevelProgress(p);
    this.drawKillStreakIndicator(p);
    this.drawHealthBar(p);
    this.drawBombs(p);

    // Draw overlays based on game state
    if (this.gameState) {
      switch (this.gameState.gameState) {
        case 'gameOver':
          this.drawGameOver(p);
          break;
        case 'paused':
          this.drawPauseScreen(p);
          break;
      }
    }
  }

  // Handle key presses for UI
  handleKeyPress(key) {
    if (!this.gameState) return false;

    if (key === 'r' || key === 'R') {
      if (this.gameState.gameState === 'gameOver') {
        this.gameState.restart();
        return true;
      }
    }

    if (key === 'p' || key === 'P') {
      if (this.gameState.gameState === 'playing') {
        this.gameState.setGameState('paused');
        console.log('⏸️ Game paused');
        return true;
      } else if (this.gameState.gameState === 'paused') {
        this.gameState.setGameState('playing');
        console.log('▶️ Game resumed');
        return true;
      }
    }

    if (key === 'm' || key === 'M') {
      if (this.audio) {
        const soundEnabled = this.audio.toggle();
        console.log('🎵 Sound ' + (soundEnabled ? 'enabled' : 'disabled'));
        document.getElementById('soundStatus').textContent = soundEnabled
          ? '🔊 Sound ON (M to toggle)'
          : '🔇 Sound OFF (M to toggle)';
        return true;
      }
    }

    if (key === 't' || key === 'T') {
      // Toggle test mode using the new modular system
      if (this.testModeManager) {
        const enabled = this.testModeManager.toggle();
        return true;
      }
    }

    if (key === 'e' || key === 'E') {
      // Dash with E
      if (
        this.gameState.gameState === 'playing' &&
        this.player &&
        this.player.dash()
      ) {
        console.log('💨 Player dash activated!');
        if (this.cameraSystem) {
          this.cameraSystem.addShake(6, 12);
        }
        return true;
      }
    }

    if (key === ' ') {
      // Shoot with spacebar
      if (this.gameState.gameState === 'playing' && this.player) {
        const bullet = this.player.shoot();
        if (bullet) {
          // Ensure playerBullets array exists before pushing new bullet
          // Prevents shots from vanishing if array was uninitialized
          if (!this.gameState.playerBullets) {
            this.gameState.playerBullets = [];
          }
          this.gameState.playerBullets.push(bullet);
          if (this.gameState) {
            this.gameState.addShotFired();
          }
          if (this.audio) {
            this.audio.playPlayerShoot(this.player.x, this.player.y);
          }
        }
        return true;
      }
    }

    // Arrow keys for aim direction
    if (this.gameState.gameState === 'playing' && this.player) {
      if (key === 'ArrowUp') {
        this.player.aimAngle = -Math.PI / 2;
        return true;
      }
      if (key === 'ArrowDown') {
        this.player.aimAngle = Math.PI / 2;
        return true;
      }
      if (key === 'ArrowLeft') {
        this.player.aimAngle = Math.PI;
        return true;
      }
      if (key === 'ArrowRight') {
        this.player.aimAngle = 0;
        return true;
      }
    }

    return false;
  }

  // Reset UI renderer
  reset() {
    if (this.dashElement) {
      this.dashElement.remove();
      this.dashElement = null;
    }
  }

  // Toast/banner for confirmations
  _createToast() {
    if (document.getElementById('statusToast')) return;
    const toast = document.createElement('div');
    toast.id = 'statusToast';
    toast.style.position = 'fixed';
    toast.style.bottom = '32px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = '#222';
    toast.style.color = '#fff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 2px 8px #000';
    toast.style.fontSize = '16px';
    toast.style.zIndex = 10002;
    toast.style.display = 'none';
    document.body.appendChild(toast);
    this.toast = toast;
  }
  _showToast(msg) {
    if (!this.toast) this._createToast();
    this.toast.textContent = msg;
    this.toast.style.display = 'block';
    setTimeout(() => {
      this.toast.style.display = 'none';
    }, 2200);
  }
}
