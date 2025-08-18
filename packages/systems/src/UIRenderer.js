/**
 * UIRenderer.js - Handles all UI drawing including HUD, game over screen, pause screen, and bomb indicators
 */

// Requires p5.js for constrain(), random(), lerp(), etc.

import { floor, ceil, min, max, PI } from '@vibe/core';
// import { SettingsMenu } from './SettingsMenu.js'; // Temporarily disabled
// import {
//   createTicket,
//   updateTicket,
//   loadTicket,
//   listTickets,
// } from '@vibe/tooling';

// Ticketing removed – no-op helpers
async function createTicket() {
  return { id: 'disabled' };
}
async function updateTicket() {
  return { ok: true };
}
async function loadTicket() {
  return { status: 'disabled' };
}
async function listTickets() {
  return [];
}

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
    this.settingsMenu = null; // Will be initialized with effectsConfig later
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

    this.bugReportButton = null;
    this.bugReportModal = null;
    this.bugReportActive = false;
    this.bugReportKeys = { b: false, r: false };
    this.latestBugReportFolder = null;
    this.screenshotCount = 1;
    // Bug report UI removed

    // Bug report capture removed
    // Developer options (toggled via secret combo)
    this.devMode = false;

    this._inputHistory = [];
    this._trackInputHistory();
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
    if (scoreEl) scoreEl.textContent = scoreText;

    const healthEl = document.getElementById('health');
    if (healthEl) healthEl.textContent = `Health: ${this.player.health}`;

    let levelEl = document.getElementById('level');
    if (!levelEl) {
      const uiContainer = document.getElementById('ui');
      if (uiContainer) {
        levelEl = document.createElement('div');
        levelEl.id = 'level';
        uiContainer.insertBefore(levelEl, uiContainer.children[2] || null);
      }
    }
    if (levelEl) levelEl.textContent = `Level: ${this.gameState.level}`;

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

    // Center panel
    const panelW = 420;
    const panelH = 260;
    const panelX = p.width / 2 - panelW / 2;
    const panelY = p.height / 2 - panelH / 2 - 40;
    p.fill(20, 20, 40, 220);
    p.stroke(255, 255, 255, 80);
    p.strokeWeight(2);
    p.rect(panelX, panelY, panelW, panelH, 20);
    p.noStroke();

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
    p.stroke(0);
    p.strokeWeight(4);
    const messageIndex =
      floor(this.gameState.score / 50) % this.gameOverMessages.length;
    p.text(this.gameOverMessages[messageIndex], p.width / 2, p.height / 2 - 80);
    p.noStroke();

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
    p.text('Press Esc to resume', p.width / 2, p.height / 2 + 20);

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
    if (!this.gameState.activeBombs) return;

    p.push();

    // Draw bomb countdown indicators
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

    if (key === 'Escape') {
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

    // Developer enemy spawn shortcuts (keys 1-4)
    if (this.devMode && ['1', '2', '3', '4'].includes(key)) {
      const typeMap = { 1: 'grunt', 2: 'rusher', 3: 'tank', 4: 'stabber' };
      const spawnType = typeMap[key];
      if (window.spawnSystem && spawnType) {
        // Use spawn system's spawn logic to find a good position
        let pos = { x: 0, y: 0 };
        if (typeof window.spawnSystem.findSpawnPosition === 'function') {
          pos = window.spawnSystem.findSpawnPosition();
        } else if (this.player) {
          // Fallback: spawn near player if no finder available
          pos = { x: this.player.x + 60, y: this.player.y };
        }
        if (typeof window.spawnSystem.forceSpawn === 'function') {
          window.spawnSystem.forceSpawn(spawnType, pos.x, pos.y);
          console.log(`👾 Manual spawn: ${spawnType}`);
          this._showToast(`Spawned ${spawnType}`);
          return true;
        }
      }
    }

    // Developer toggles and tweaks
    if (this.devMode) {
      if (key === 'i' || key === 'I') {
        if (this.player) {
          this.player.invincible = !this.player.invincible;
          this._showToast(
            `Infinite life ${this.player.invincible ? 'ON' : 'OFF'}`
          );
          return true;
        }
      }
      if (key === '=' || key === '-') {
        const current = window.beatClock?.bpm || 120;
        const delta = key === '=' ? 5 : -5;
        const newBpm = min(max(current + delta, 40), 300);
        window.beatClock?.setBPM(newBpm);
        this._showToast(`BPM ${newBpm}`);
        return true;
      }
      if (key === '[' || key === ']') {
        if (this.player) {
          const delta = key === ']' ? 0.5 : -0.5;
          this.player.speed = Math.max(0.5, this.player.speed + delta);
          this._showToast(
            `Speed ${this.player.speed.toFixed(1)}`
          );
          return true;
        }
      }
    }

    // Arrow keys for aim direction
    if (this.gameState.gameState === 'playing' && this.player) {
      if (key === 'ArrowUp') {
        this.player.aimAngle = -PI / 2;
        return true;
      }
      if (key === 'ArrowDown') {
        this.player.aimAngle = PI / 2;
        return true;
      }
      if (key === 'ArrowLeft') {
        this.player.aimAngle = PI;
        return true;
      }
      if (key === 'ArrowRight') {
        this.player.aimAngle = 0;
        return true;
      }
    }

    // Toggle AUDIO DEBUG overlay/logs with F10 key (dev mode only)
    if (this.devMode && key === 'F10') {
      const enabled = !(window.DEBUG_AUDIO || window.debug_audio);
      window.DEBUG_AUDIO = enabled;
      window.debug_audio = enabled; // alias
      localStorage.setItem('debugAudio', enabled ? '1' : '0');
      console.log(`🎚️ Audio debug ${enabled ? 'ON' : 'OFF'} (F10 to toggle)`);
      this._showToast(`Audio debug ${enabled ? 'ON' : 'OFF'}`);
      return true;
    }

    return false;
  }

  toggleDevMode() {
    this.devMode = !this.devMode;
    console.log(`🛠️ Dev mode ${this.devMode ? 'ENABLED' : 'DISABLED'}`);
    this._showToast(`Dev mode ${this.devMode ? 'ON' : 'OFF'}`);
  }

  // Reset UI renderer
  reset() {
    if (this.dashElement) {
      this.dashElement.remove();
      this.dashElement = null;
    }
  }

  _addBugReportButton() {}

  // Robustness: Periodically check and re-add the bug report button if missing
  _startBugReportButtonWatcher() {}

  _addBugReportKeyListener() {}

  // Toast/banner for confirmations
  _createToast() {
    if (document.getElementById('bugToast')) return;
    const toast = document.createElement('div');
    toast.id = 'bugToast';
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

  async _showBugReportModal(existingTicket = null) {
    if (this.bugReportActive) return;
    this.bugReportActive = true;
    if (this.gameState) this.gameState.setGameState('paused');
    // Modal
    const modal = document.createElement('div');
    modal.id = 'bugReportModal';
    modal.setAttribute('data-status', 'idle'); // Track modal status for AI/automation
    window.bugReportModalStatus = 'idle';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.zIndex = 10001;
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    // Content
    const box = document.createElement('div');
    box.style.background = '#222';
    box.style.color = '#fff';
    box.style.padding = '32px';
    box.style.borderRadius = '10px';
    box.style.boxShadow = '0 2px 16px #000';
    box.style.minWidth = '340px';
    // Screenshot preview area
    const screenshotPreview = document.createElement('div');
    screenshotPreview.id = 'bugScreenshotPreview';
    screenshotPreview.style.gap = '8px';
    screenshotPreview.style.marginBottom = '8px';
    screenshotPreview.style.flexWrap = 'wrap';
    box.appendChild(screenshotPreview);
    // Ticketing UI removed
    // Description and controls
    box.innerHTML += `<label for='bugDesc'>Describe what happened:</label><br>
        <textarea id='bugDesc' rows='5' style='width:100%;margin:8px 0;'></textarea><br>
        <button id='bugCancelBtn'>Close</button>`;
    // Add error message area
    const errorMsg = document.createElement('div');
    errorMsg.id = 'bugModalErrorMsg';
    errorMsg.style.color = '#ff4444';
    errorMsg.style.marginTop = '12px';
    errorMsg.style.display = 'none';
    box.appendChild(errorMsg);
    modal.appendChild(box);
    document.body.appendChild(modal);
    this.bugReportModal = modal;
    // Screenshot thumbnails state
    this._screenshotDataList = [];
    // Focus textarea for immediate typing
    setTimeout(() => {
      const ta = document.getElementById('bugDesc');
      if (ta) ta.focus();
    }, 50);
    // Take initial screenshot immediately
    const initialScreenshot = this._captureCanvasScreenshot();
    this._pendingInitialScreenshot = initialScreenshot;
    if (initialScreenshot) this._addScreenshotThumbnail(initialScreenshot);
    // Button handlers
    // Save removed
    document.getElementById('bugCancelBtn').onclick = () =>
      this._closeBugReportModal();
    // Fix: allow spacebar in textarea
    document.getElementById('bugDesc').addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    // Accessibility: Escape closes modal
    modal.tabIndex = -1;
    modal.focus();
    modal.addEventListener('keydown', (e) => {
      // If focus is in textarea, only handle Escape or Ctrl+Enter
      const isTextarea =
        document.activeElement && document.activeElement.id === 'bugDesc';
      // Save on Enter or Ctrl+Enter (except when Shift is held for newline in textarea)
      // Save functionality has been removed
      // Cancel on Escape or Ctrl+Backspace
      if (e.key === 'Escape' || (e.key === 'Backspace' && e.ctrlKey)) {
        e.preventDefault();
        document.getElementById('bugCancelBtn').click();
        return;
      }
    });
  }

  _addScreenshotThumbnail(dataUrl) {
    if (!this._screenshotDataList) this._screenshotDataList = [];
    this._screenshotDataList.push(dataUrl);
    const preview = document.getElementById('bugScreenshotPreview');
    if (preview) {
      // Clear and re-add all thumbnails
      preview.innerHTML = '';
      this._screenshotDataList.forEach((url, idx) => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = `Screenshot ${idx + 1}`;
        img.style.width = '64px';
        img.style.height = 'auto';
        img.style.border = '1px solid #555';
        img.style.borderRadius = '4px';
        preview.appendChild(img);
      });
    }
  }

  _closeBugReportModal() {
    if (this.bugReportModal) {
      this.bugReportModal.remove();
      this.bugReportModal = null;
    }
    this.bugReportActive = false;
    window.bugReportModalStatus = 'closed';
    // Reset modal state
    this._screenshotDataList = [];
    this._pendingInitialScreenshot = null;
    // Clear textarea for next time
    const ta = document.getElementById('bugDesc');
    if (ta) ta.value = '';
    if (this.gameState && this.gameState.gameState === 'paused') {
      this.gameState.setGameState('playing');
    }
  }

  // Track last 20 user inputs (keys/mouse)
  _trackInputHistory() {
    window.addEventListener('keydown', (e) => {
      this._inputHistory.push({
        type: 'keydown',
        key: e.key,
        time: Date.now(),
      });
      if (this._inputHistory.length > 20) this._inputHistory.shift();
    });
    window.addEventListener('keyup', (e) => {
      this._inputHistory.push({ type: 'keyup', key: e.key, time: Date.now() });
      if (this._inputHistory.length > 20) this._inputHistory.shift();
    });
    window.addEventListener('mousedown', (e) => {
      this._inputHistory.push({
        type: 'mousedown',
        button: e.button,
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
      });
      if (this._inputHistory.length > 20) this._inputHistory.shift();
    });
    window.addEventListener('mouseup', (e) => {
      this._inputHistory.push({
        type: 'mouseup',
        button: e.button,
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
      });
      if (this._inputHistory.length > 20) this._inputHistory.shift();
    });
  }

  // Helper to get FPS (approximate)
  _getFPS() {
    if (
      window.p5 &&
      window.p5.instance &&
      typeof window.p5.instance.frameRate === 'function'
    ) {
      return Math.round(window.p5.instance.frameRate());
    }
    return null;
  }

  // Helper to get system info
  _getSystemInfo() {
    return {
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      language: navigator.language,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight,
      },
      window: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      },
    };
  }

  // Helper to generate a short unique ID
  _shortUID() {
    return Math.random().toString(36).substr(2, 6);
  }

  _captureCanvasScreenshot() {
    // Try to find the p5 instance and canvas
    let canvas = null;
    if (window.p5 && window.p5.instance && window.p5.instance.canvas) {
      canvas = window.p5.instance.canvas;
    } else {
      canvas = document.querySelector('canvas');
    }
    if (canvas) {
      return canvas.toDataURL('image/png');
    }
    return null;
  }

  _downloadScreenshot(dataUrl, filename) {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }

  _saveAdditionalScreenshot() {}
}
