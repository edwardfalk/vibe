/**
 * UIRenderer.js - Handles all UI drawing including HUD, game over screen, pause screen, and bomb indicators
 */

import { floor, ceil, max, abs, sin } from '../mathUtils.js';
import {
  DASH_INDICATOR,
  LEVEL_PROGRESS,
  HEALTH_BAR,
  KILL_STREAK_Y,
  BOMB_WARNING_SIZE,
  TOAST,
} from './UIConstants.js';
import { drawGameOver, drawPauseScreen } from './UIOverlays.js';
import { handleKeyPress as handleKeyPressImpl } from './UIInputHandler.js';

/**
 * @param {GameState} gameState - The game state object (dependency injected for modularity)
 * @param {Player} player - The player object (dependency injected for modularity)
 * @param {Audio} audio - The audio system (dependency injected for modularity)
 * @param {CameraSystem} cameraSystem - The camera system (dependency injected for modularity)
 */
export class UIRenderer {
  constructor(gameState, player, audio, cameraSystem) {
    // UI state
    this.gameState = gameState;
    this.player = player;
    this.audio = audio;
    this.cameraSystem = cameraSystem;
    this.dashElement = null;
    // Cache DOM refs to avoid getElementById() every frame
    this._scoreEl = document.getElementById('score');
    this._healthEl = document.getElementById('health');
    this._levelEl = document.getElementById('level');
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

    if (this._scoreEl) this._scoreEl.textContent = scoreText;
    if (this._healthEl)
      this._healthEl.textContent = `Health: ${this.player?.health ?? 0}`;
    if (this._levelEl)
      this._levelEl.textContent = `Level: ${this.gameState?.level ?? 1}`;

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
      this.dashElement.style.cssText = `position: absolute; top: ${DASH_INDICATOR.top}px; left: ${DASH_INDICATOR.left}px; color: white; font-family: monospace; font-size: 14px; text-shadow: 0 0 5px currentColor;`;
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

  // Draw game over screen (delegated to UIOverlays)
  drawGameOver(p) {
    drawGameOver(p, this.gameState);
  }

  // Draw pause screen (delegated to UIOverlays)
  drawPauseScreen(p) {
    drawPauseScreen(p, this.gameState);
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

      const pulseIntensity = 1 + p.sin(p.frameCount * 0.3) * 0.3;
      const warningSize = BOMB_WARNING_SIZE * pulseIntensity;

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
    const { barWidth, barHeight, marginRight, marginTop } = LEVEL_PROGRESS;
    const barX = p.width - barWidth - marginRight;
    const barY = marginTop;

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
    const y = KILL_STREAK_Y;

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
    const { barWidth, barHeight, marginLeft, marginBottom } = HEALTH_BAR;
    const barX = marginLeft;
    const barY = p.height - marginBottom;

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

  // Handle key presses for UI (delegated to UIInputHandler)
  handleKeyPress(key) {
    return handleKeyPressImpl(key, {
      gameState: this.gameState,
      player: this.player,
      audio: this.audio,
      cameraSystem: this.cameraSystem,
    });
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
    toast.style.bottom = `${TOAST.bottom}px`;
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
    }, TOAST.durationMs);
  }
}
