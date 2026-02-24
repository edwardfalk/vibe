/**
 * UIRenderer.js - Handles all UI drawing including HUD, game over screen, pause screen, and bomb indicators
 */

// Requires p5.js for constrain(), random(), lerp(), etc.

import { floor, ceil, min, max, abs, sin, random } from '../mathUtils.js';

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

    const scoreEl = document.getElementById('score');
    const healthEl = document.getElementById('health');
    const levelEl = document.getElementById('level');
    if (scoreEl) scoreEl.textContent = scoreText;
    if (healthEl) healthEl.textContent = `Health: ${this.player?.health ?? 0}`;
    if (levelEl) levelEl.textContent = `Level: ${this.gameState?.level ?? 1}`;

    // Add dash cooldown indicator
    this.updateDashIndicator();

    // Update audio system
    if (this.audio && typeof this.audio.updateTexts === 'function') {
      this.audio.updateTexts();
    }
  }

  // Update dash cooldown indicator
  updateDashIndicator() {
    if (!this.player) return;
    if (!this.dashElement) {
      this.dashElement = document.createElement('div');
      this.dashElement.id = 'dash';
      this.dashElement.style.cssText =
        'position: absolute; top: 120px; left: 10px; color: white; font-family: monospace; font-size: 14px; text-shadow: 0 0 5px currentColor;';
      document.body.appendChild(this.dashElement);
    }

    if (this.player.dashCooldownMs > 0) {
      const cooldownSeconds = (this.player.dashCooldownMs / 1000).toFixed(1);
      this.dashElement.textContent = `DASH RECHARGING: ${cooldownSeconds}S`;
      this.dashElement.style.color = '#ff1493'; // Hot pink
    } else {
      this.dashElement.textContent =
        'DASH: READY [E] | SHOOT: [SPACE] OR MOUSE';
      this.dashElement.style.color = '#00ffff'; // Cyan
    }
  }

  // Draw game over screen
  drawGameOver(p) {
    if (!this.gameState) return;

    p.push();

    // Semi-transparent overlay
    p.fill(0, 0, 0, 150);
    p.rect(0, 0, p.width, p.height);

    const messageIndex =
      floor(this.gameState.score / 50) % this.gameOverMessages.length;
    const isNewHighScore = this.gameState.score > this.gameState.highScore;

    // Game over text with animation
    p.textFont('monospace');
    p.fill(255, 20, 147); // Hot pink
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(48 + p.sin(p.frameCount * 0.1) * 4);

    // Additive glow for title
    p.blendMode(p.ADD);
    p.text(this.gameOverMessages[messageIndex], p.width / 2, p.height / 2 - 80);
    p.blendMode(p.BLEND);

    p.stroke(255, 255, 255);
    p.strokeWeight(2);
    p.text(this.gameOverMessages[messageIndex], p.width / 2, p.height / 2 - 80);
    p.noStroke();

    // New high score celebration
    if (isNewHighScore) {
      p.fill(0, 255, 255); // Cyan
      p.textSize(20 + p.sin(p.frameCount * 0.2) * 3);
      p.text('NEW HIGH SCORE! 🎉', p.width / 2, p.height / 2 - 50);
    }

    // Score and level
    p.fill(255);
    p.textSize(24);
    p.text(
      `FINAL SCORE: ${this.gameState.score.toLocaleString()}`,
      p.width / 2,
      p.height / 2 - 10
    );
    p.text(
      `LEVEL REACHED: ${this.gameState.level}`,
      p.width / 2,
      p.height / 2 + 20
    );

    // Stats
    p.fill(0, 255, 255); // Cyan
    p.textSize(16);
    p.text(
      `ENEMIES KILLED: ${this.gameState.totalKills}`,
      p.width / 2,
      p.height / 2 + 45
    );
    const accuracy = this.gameState.getAccuracy();
    p.text(`ACCURACY: ${accuracy}%`, p.width / 2, p.height / 2 + 65);

    // High score display
    p.fill(255, 215, 0); // Gold
    p.textSize(18);
    p.text(
      `HIGH SCORE: ${this.gameState.highScore.toLocaleString()}`,
      p.width / 2,
      p.height / 2 + 90
    );

    // Funny comment
    p.fill(255, 20, 147); // Pink
    p.textSize(16);
    const commentIndex =
      floor(this.gameState.score / 30) % this.funnyComments.length;
    p.text(this.funnyComments[commentIndex], p.width / 2, p.height / 2 + 115);

    // Restart instruction
    p.fill(255);
    p.textSize(16);
    // Blinking effect
    if (p.frameCount % 60 < 40) {
      p.text('PRESS R TO RESTART', p.width / 2, p.height / 2 + 145);
    }

    p.pop();
  }

  // Draw pause screen
  drawPauseScreen(p) {
    if (!this.gameState) return;

    p.push();
    p.textFont('monospace');

    // Semi-transparent overlay
    p.fill(5, 2, 15, 200); // Darker blue-purple tint
    p.rect(0, 0, p.width, p.height);

    // Pause text with synthwave style
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(48);

    // Cyan glow layer
    p.blendMode(p.ADD);
    p.fill(0, 255, 255, 150);
    p.text('PAUSED', p.width / 2, p.height / 2 - 40);
    p.blendMode(p.BLEND);

    // Sharp white core text with cyan border
    p.stroke(0, 255, 255);
    p.strokeWeight(2);
    p.fill(255, 255, 255);
    p.text('PAUSED', p.width / 2, p.height / 2 - 40);
    p.noStroke();

    // Instructions
    p.fill(0, 255, 255);
    p.textSize(20);
    if (p.frameCount % 60 < 40) {
      p.text('PRESS P TO RESUME', p.width / 2, p.height / 2 + 20);
    }

    // Current stats
    p.fill(255, 20, 147); // Hot pink
    p.textSize(16);
    p.text(
      `SCORE: ${this.gameState.score.toLocaleString()}`,
      p.width / 2,
      p.height / 2 + 60
    );
    p.text(
      `LEVEL: ${this.gameState.level} | KILLS: ${this.gameState.totalKills}`,
      p.width / 2,
      p.height / 2 + 80
    );

    if (this.gameState.killStreak >= 5) {
      p.fill(255, 215, 0); // Gold for streak
      p.text(
        `⚡ ${this.gameState.killStreak}X KILL STREAK! ⚡`,
        p.width / 2,
        p.height / 2 + 100
      );
    }

    p.pop();
  }

  // Draw bomb countdown indicators
  drawBombs(p) {
    if (
      !this.gameState ||
      !this.gameState.activeBombs ||
      this.gameState.activeBombs.length === 0
    )
      return;

    p.push();

    for (const bomb of this.gameState.activeBombs) {
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

    // Use a retro/monospace font if available
    p.textFont('monospace');

    // Synthwave Neon style
    // Background bar
    p.fill(10, 5, 20, 200);
    p.stroke(255, 20, 147, 100); // Hot pink faint border
    p.strokeWeight(1);
    p.rect(barX, barY, barWidth, barHeight);

    // Progress bar (Neon Pink)
    p.fill(255, 20, 147, 220);
    p.noStroke();
    p.rect(barX, barY, barWidth * progress, barHeight);

    // Add additive glow
    p.blendMode(p.ADD);
    p.fill(255, 20, 147, 100);
    p.rect(barX, barY - 2, barWidth * progress, barHeight + 4);
    p.blendMode(p.BLEND);

    // Sharp Border
    p.stroke(255, 20, 147);
    p.strokeWeight(1.5);
    p.noFill();
    p.rect(barX, barY, barWidth, barHeight);

    // Label
    p.fill(255, 255, 255);
    p.textAlign(p.RIGHT, p.TOP);
    p.textSize(12);
    p.noStroke();
    p.text(
      `LEVEL ${this.gameState.level} PROGRESS`,
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

    p.textFont('monospace');

    // Pulsing effect for high streaks
    const pulse = p.sin(p.frameCount * 0.2) * 0.5 + 0.5;
    const intensity = Math.min(streak / 10, 1);

    p.blendMode(p.ADD);
    // Background glow (Neon Cyan to Pink depending on streak)
    const glowColor =
      streak >= 10 ? p.color(255, 20, 147) : p.color(0, 255, 255);

    p.fill(
      p.red(glowColor),
      p.green(glowColor),
      p.blue(glowColor),
      50 + pulse * 50 * intensity
    );
    p.noStroke();
    p.ellipse(x, y, 120 + pulse * 20, 40 + pulse * 10);
    p.blendMode(p.BLEND);

    // Text
    p.fill(255, 255, 255);
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(16 + pulse * 4);
    p.stroke(p.red(glowColor), p.green(glowColor), p.blue(glowColor));
    p.strokeWeight(2);
    p.text(`[ ${streak}X STREAK ]`, x, y);
    p.noStroke();

    // Fire effects for high streaks -> Synthwave "OVERLOAD"
    if (streak >= 10) {
      p.fill(255, 20, 147, 150 + pulse * 105);
      p.textSize(20 + pulse * 6);
      p.text('OVERLOAD', x, y + 25);
    }
    p.pop();
  }

  // Draw health bar with smooth damage animation (chunk loss)
  drawHealthBar(p) {
    if (!this.player) return;
    p.push();

    p.textFont('monospace');

    // Initialize animated health value if not set
    if (this.animatedHealth === undefined) {
      this.animatedHealth = this.player.health;
    }

    // Smoothly interpolate animated health toward actual health
    const healthDiff = this.player.health - this.animatedHealth;
    if (abs(healthDiff) > 0.1) {
      // Damage loses health quickly, healing gains slowly
      const lerpSpeed = healthDiff < 0 ? 0.15 : 0.05;
      this.animatedHealth += healthDiff * lerpSpeed;
    } else {
      this.animatedHealth = this.player.health;
    }

    const healthPercent = this.player.health / this.player.maxHealth;
    const animatedPercent = max(0, this.animatedHealth / this.player.maxHealth);
    const barWidth = 150;
    const barHeight = 12;
    const barX = 20;
    const barY = p.height - 40;

    // Synthwave Style Health Bar
    // Background bar (dark)
    p.fill(5, 5, 15, 200);
    p.noStroke();
    p.rect(barX, barY, barWidth, barHeight);

    // "Ghost" bar showing the damage chunk (health that's been lost but still animating)
    if (this.animatedHealth > this.player.health) {
      p.fill(255, 20, 147, 150); // Neon pink for damage chunk
      p.rect(barX, barY, barWidth * animatedPercent, barHeight);
    }

    // Actual health bar color based on health level
    let healthColor;
    if (healthPercent > 0.6) {
      healthColor = p.color(0, 255, 255); // Neon Cyan
    } else if (healthPercent > 0.3) {
      healthColor = p.color(255, 215, 0); // Neon Gold
    } else {
      // Red that pulses when critical
      const pulse = sin(Date.now() * 0.01) * 0.3 + 0.7;
      healthColor = p.color(255 * pulse, 20 * pulse, 147 * pulse); // Pulsing Hot Pink
    }

    p.fill(healthColor);
    p.rect(barX, barY, barWidth * healthPercent, barHeight);

    // Additive glow on the health bar edge
    if (healthPercent > 0) {
      p.blendMode(p.ADD);
      p.fill(
        p.red(healthColor),
        p.green(healthColor),
        p.blue(healthColor),
        100
      );
      p.rect(barX + barWidth * healthPercent - 2, barY - 2, 4, barHeight + 4);
      p.blendMode(p.BLEND);
    }

    // Sharp Border
    p.stroke(healthColor);
    p.strokeWeight(1.5);
    p.noFill();
    p.rect(barX, barY, barWidth, barHeight);

    // Health text with icon
    p.fill(255, 255, 255);
    p.textAlign(p.LEFT, p.BOTTOM);
    p.textSize(12);
    p.noStroke();

    // Health text (no heart icon, more sci-fi)
    p.text(
      `SYS.INTEGRITY [${floor(this.player.health)}/${this.player.maxHealth}]`,
      barX,
      barY - 5
    );

    // Show damage number if recently damaged
    if (this.player.hitFlash > 0) {
      p.fill(255, 20, 147, this.player.hitFlash * 30); // Pink damage text
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(14);
      p.text(
        `-${ceil(this.player.maxHealth - this.player.health)}`,
        barX + barWidth / 2,
        barY - 20
      );
    }

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
    this.animatedHealth = undefined;
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
    if (this._toastTimeout) clearTimeout(this._toastTimeout);
    this.toast.textContent = msg;
    this.toast.style.display = 'block';
    this._toastTimeout = setTimeout(() => {
      this._toastTimeout = null;
      this.toast.style.display = 'none';
    }, 2200);
  }
}
