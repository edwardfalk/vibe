/**
 * UIRenderer.js - Handles all UI drawing including HUD, game over screen, pause screen, and bomb indicators
 */

// Requires p5.js for constrain(), random(), lerp(), etc.

import { floor, ceil, min, random } from '@vibe/core';
import {
  createTicket,
  updateTicket,
  loadTicket,
  listTickets,
} from '@vibe/tooling';

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

    this.bugReportButton = null;
    this.bugReportModal = null;
    this.bugReportActive = false;
    this.bugReportKeys = { b: false, r: false };
    this.latestBugReportFolder = null;
    this.screenshotCount = 1;
    this._addBugReportButton();
    this._addBugReportKeyListener();
    this._startBugReportButtonWatcher();

    // Setup bug report log/error capture
    if (!window._bugReportLogs) {
      window._bugReportLogs = [];
      const origLog = console.log;
      const origErr = console.error;
      console.log = function (...args) {
        window._bugReportLogs.push({
          type: 'log',
          msg: args,
          time: Date.now(),
        });
        origLog.apply(console, args);
      };
      console.error = function (...args) {
        window._bugReportLogs.push({
          type: 'error',
          msg: args,
          time: Date.now(),
        });
        window._bugReportLastError = args;
        origErr.apply(console, args);
      };
    }
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

    // Toggle AUDIO DEBUG overlay/logs with F10 key
    if (key === 'F10') {
      const enabled = !(window.DEBUG_AUDIO || window.debug_audio);
      window.DEBUG_AUDIO = enabled;
      window.debug_audio = enabled; // alias
      localStorage.setItem('debugAudio', enabled ? '1' : '0');
      console.log(`🎚️ Audio debug ${enabled ? 'ON' : 'OFF'} (F10 to toggle)`);
      this._showToast(`Audio debug ${enabled ? 'ON' : 'OFF'}`);
      return true;
    }

    // Edge exploration / test suites via function keys
    if (key === 'F6') {
      if (this.testModeManager) {
        this.testModeManager.setEnabled(true);
        this.testModeManager.setMovementPattern('edges');
        this._showToast('Edge exploration test (F6)');
        console.log('🧪 Edge exploration test activated (F6)');
      }
      return true;
    }

    if (key === 'F7') {
      if (this.testModeManager) {
        this.testModeManager.setEnabled(true);
        this.testModeManager.runTestSuite();
        // Auto-disable after 3 min (3*60*60 frames ~ 10800) counted inside test mode? Use timeout.
        setTimeout(() => {
          if (this.testModeManager.enabled) {
            this.testModeManager.setEnabled(false);
            this._showToast('F7 test completed');
          }
        }, 180000); // 3 minutes
        this._showToast('Comprehensive 3-minute test (F7)');
        console.log('🧪 Comprehensive test suite (F7) started');
      }
      return true;
    }

    if (key === 'F8') {
      if (this.testModeManager) {
        this.testModeManager.setEnabled(true);
        this.testModeManager.setMovementPattern('edges');
        this.testModeManager.setEnemySpawnInterval(120);
        this.testModeManager.setShootInterval(5);
        this._showToast('Survival edge test (F8)');
        console.log('🛡️ Survival edge test (F8) activated');
      }
      return true;
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

  _addBugReportButton() {
    if (document.getElementById('bugReportBtn')) return;
    // Robustness: log when button is added
    console.log('🖥️ [UIRenderer] Adding bug report button');
    const btn = document.createElement('button');
    btn.id = 'bugReportBtn';
    btn.innerText = '🐞 Report Bug';
    btn.style.position = 'absolute';
    btn.style.top = '20px';
    btn.style.right = '20px';
    btn.style.zIndex = 10000;
    btn.style.background = '#222';
    btn.style.color = '#fff';
    btn.style.border = '1px solid #888';
    btn.style.padding = '8px 16px';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.onclick = () => this._showBugReportModal();
    document.body.appendChild(btn);
    this.bugReportButton = btn;
  }

  // Robustness: Periodically check and re-add the bug report button if missing
  _startBugReportButtonWatcher() {
    setInterval(() => {
      if (!document.getElementById('bugReportBtn')) {
        console.warn('[UIRenderer] Bug report button missing, re-adding.');
        this._addBugReportButton();
      }
    }, 5000);
  }

  _addBugReportKeyListener() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.key === 'b' || e.key === 'B') this.bugReportKeys.b = true;
      if (e.key === 'r' || e.key === 'R') this.bugReportKeys.r = true;
      if (
        this.bugReportKeys.b &&
        this.bugReportKeys.r &&
        !this.bugReportActive
      ) {
        this._showBugReportModal();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'b' || e.key === 'B') this.bugReportKeys.b = false;
      if (e.key === 'r' || e.key === 'R') this.bugReportKeys.r = false;
    });
  }

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
    // Ticketing UI
    let ticketNameInput = null;
    let ticketSelect = null;
    let relatedToSelect = null;
    let typeSelect = null;
    let isAppending = false;
    // Fetch existing tickets from API
    let tickets = [];
    try {
      tickets = await listTickets();
    } catch (e) {
      console.warn('Could not fetch tickets from API:', e);
    }
    // Ticket type dropdown (always shown for new tickets)
    if (!existingTicket) {
      const typeLabel = document.createElement('label');
      typeLabel.htmlFor = 'ticketTypeSelect';
      typeLabel.innerText = 'Ticket type:';
      typeLabel.style.display = 'block';
      typeLabel.style.marginTop = '8px';
      box.appendChild(typeLabel);
      typeSelect = document.createElement('select');
      typeSelect.id = 'ticketTypeSelect';
      typeSelect.style.width = '100%';
      typeSelect.style.margin = '8px 0';
      ['bug', 'enhancement', 'feature', 'task'].forEach((val) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.innerText = val.charAt(0).toUpperCase() + val.slice(1);
        typeSelect.appendChild(opt);
      });
      box.appendChild(typeSelect);
    }
    // If not appending, show new ticket name input
    if (!existingTicket) {
      box.innerHTML += `<h2>📝 New Ticket</h2>
            <label for='bugTicketName'>Short ticket name (required):</label><br>
            <input id='bugTicketName' type='text' maxlength='32' style='width:100%;margin:8px 0;' placeholder='e.g. player-stuck-dash'><br>`;
      ticketNameInput = document.createElement('input');
      ticketNameInput.id = 'bugTicketName';
      ticketNameInput.type = 'text';
      ticketNameInput.maxLength = 32;
      ticketNameInput.style.width = '100%';
      ticketNameInput.style.margin = '8px 0';
      ticketNameInput.placeholder = 'e.g. player-stuck-dash';
      box.appendChild(ticketNameInput);
    } else {
      isAppending = true;
      box.innerHTML += `<h2>📝 Add to Ticket: <span style='color:#ff0'>${existingTicket.name}_${existingTicket.uid}</span></h2>`;
    }
    // Option to append to existing ticket
    if (tickets.length > 0 && !existingTicket) {
      box.innerHTML += `<label for='bugTicketSelect'>Or add to existing ticket:</label><br>`;
      ticketSelect = document.createElement('select');
      ticketSelect.id = 'bugTicketSelect';
      ticketSelect.style.width = '100%';
      ticketSelect.style.margin = '8px 0';
      ticketSelect.innerHTML =
        `<option value=''>-- Select existing ticket --</option>` +
        tickets
          .map(
            (t) =>
              `<option value='${t.uid || t.id}'>${t.name || t.title}_${t.uid || t.id}</option>`
          )
          .join('');
      box.appendChild(ticketSelect);
    }
    // Option to link to another ticket (relatedTo)
    if (tickets.length > 0) {
      box.innerHTML += `<label for='relatedToSelect'>Link to related ticket (optional):</label><br>`;
      relatedToSelect = document.createElement('select');
      relatedToSelect.id = 'relatedToSelect';
      relatedToSelect.style.width = '100%';
      relatedToSelect.style.margin = '8px 0';
      relatedToSelect.innerHTML =
        `<option value=''>-- None --</option>` +
        tickets
          .map(
            (t) =>
              `<option value='${t.uid || t.id}'>${t.name || t.title}_${t.uid || t.id}</option>`
          )
          .join('');
      box.appendChild(relatedToSelect);
    }
    // Description and controls
    box.innerHTML += `<label for='bugDesc'>Describe what happened:</label><br>
        <textarea id='bugDesc' rows='5' style='width:100%;margin:8px 0;'></textarea><br>
        <button id='bugSaveBtn' style='margin-right:12px;'>Save Report</button>
        <button id='bugScreenshotBtn' style='margin-right:12px;'>Add Screenshot to Ticket</button>
        <button id='bugCancelBtn'>Cancel</button>`;
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
    document.getElementById('bugSaveBtn').onclick = async () => {
      errorMsg.style.display = 'none';
      errorMsg.textContent = '';
      modal.setAttribute('data-status', 'saving');
      window.bugReportModalStatus = 'saving';
      // Determine ticket
      let ticket = existingTicket;
      if (!ticket) {
        // New or selected
        const name = ticketNameInput
          ? ticketNameInput.value.trim().replace(/\s+/g, '-').toLowerCase()
          : '';
        const selectedUid = ticketSelect ? ticketSelect.value : '';
        const type = typeSelect ? typeSelect.value : 'bug';
        if (selectedUid) {
          ticket = tickets.find((t) => (t.uid || t.id) === selectedUid);
          isAppending = true;
        } else if (name) {
          const uid = this._shortUID();
          ticket = { name, uid, type };
        } else {
          this._showToast(
            'Please enter a short ticket name or select a ticket.'
          );
          modal.setAttribute('data-status', 'idle');
          window.bugReportModalStatus = 'idle';
          return;
        }
      }
      // Always ensure type is present
      if (!ticket.type) ticket.type = typeSelect ? typeSelect.value : 'bug';
      // Related to
      const relatedTo = relatedToSelect ? relatedToSelect.value : '';
      try {
        await this._saveBugReport(
          ticket,
          isAppending,
          relatedTo,
          modal,
          errorMsg
        );
        // --- Playwright workflow note ---
        // After clicking Save Report, take a Playwright screenshot to verify the modal closes and the ticket is created.
      } catch (e) {
        // Show backend error message
        errorMsg.textContent =
          e && e.message ? e.message : 'Failed to save bug report!';
        errorMsg.style.display = 'block';
        errorMsg.style.color = '#ff6666';
        modal.setAttribute('data-status', 'error');
        window.bugReportModalStatus = 'error';

        // Auto-close modal after showing error for 3 seconds
        setTimeout(() => {
          console.log('🎫 Auto-closing modal after error');
          this._closeBugReportModal();
          if (modal) modal.setAttribute('data-status', 'closed');
          window.bugReportModalStatus = 'closed';
        }, 3000);
      }
    };
    document.getElementById('bugScreenshotBtn').onclick = () =>
      this._saveAdditionalScreenshot(existingTicket);
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
      if (
        (e.key === 'Enter' && (e.ctrlKey || !isTextarea)) ||
        (e.key === 's' && e.ctrlKey)
      ) {
        e.preventDefault();
        document.getElementById('bugSaveBtn').click();
        return;
      }
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
    return random().toString(36).substr(2, 6);
  }

  async _saveBugReport(ticket, isAppending, relatedTo, modal, errorMsg) {
    const desc = document.getElementById('bugDesc').value;
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    const folder = `tests/bug-reports/${ticket.name || ticket.title}_${ticket.uid || ticket.id}`;
    this.latestBugReportFolder = folder;
    this.screenshotCount = 1;
    // Helper: safely extract serializable state
    function safeGameState(gs) {
      if (!gs) return null;
      return {
        gameState: gs.gameState,
        score: gs.score,
        highScore: gs.highScore,
        level: gs.level,
        killStreak: gs.killStreak,
        totalKills: gs.totalKills,
        accuracy:
          typeof gs.getAccuracy === 'function' ? gs.getAccuracy() : null,
      };
    }
    function safePlayer(p) {
      if (!p) return null;
      return {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        health: p.health,
        maxHealth: p.maxHealth,
        dashCooldownMs: p.dashCooldownMs,
        aimAngle: p.aimAngle,
        isDashing: p.isDashing,
      };
    }
    function safeEnemy(e) {
      return {
        type: e.type,
        x: e.x,
        y: e.y,
        health: e.health,
        state: e.state,
        markedForRemoval: e.markedForRemoval,
      };
    }
    function safeBullet(b) {
      return {
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        damage: b.damage,
        owner: b.owner,
        markedForRemoval: b.markedForRemoval,
      };
    }
    function safeAudio(a) {
      if (!a || typeof a.getDebugState !== 'function') return null;
      return a.getDebugState();
    }
    // Gather state
    const state = {
      frameCount: typeof frameCount !== 'undefined' ? frameCount : null,
      gameState: safeGameState(this.gameState),
      player: safePlayer(this.player),
      enemies: Array.isArray(this.gameState.enemies)
        ? this.gameState.enemies.map(safeEnemy)
        : [],
      playerBullets: Array.isArray(this.gameState.playerBullets)
        ? this.gameState.playerBullets.map(safeBullet)
        : [],
      enemyBullets: Array.isArray(this.gameState.enemyBullets)
        ? this.gameState.enemyBullets.map(safeBullet)
        : [],
      activeBombs: Array.isArray(this.gameState.activeBombs)
        ? this.gameState.activeBombs
        : [],
      audio: safeAudio(this.audio),
      timestamp: Date.now(),
      description: desc,
      url: window.location.href,
      userAgent: navigator.userAgent,
      logs: this._inputHistory.slice(),
      lastError: window._bugReportLastError || null,
      fps: this._getFPS(),
      systemInfo: this._getSystemInfo(),
      ticketName: ticket.name || ticket.title,
      ticketUID: ticket.uid || ticket.id,
      relatedTo,
    };
    // Screenshot (canvas only)
    const screenshotData =
      this._pendingInitialScreenshot || this._captureCanvasScreenshot();
    // Save meta.json (append or create)
    const meta = {
      ticketName: ticket.name || ticket.title,
      ticketUID: ticket.uid || ticket.id,
      description: desc,
      timestamp,
      relatedTo,
      appended: isAppending,
      inputHistory: this._inputHistory.slice(),
      fps: state.fps,
      systemInfo: state.systemInfo,
      url: window.location.href,
    };
    // Save files via ticketManager API
    try {
      if (!isAppending) {
        // Create new ticket
        const ticketData = {
          id: ticket.uid || ticket.id,
          title: ticket.name || ticket.title,
          type: ticket.type || 'bug', // Ensure type is always present
          description: desc,
          timestamp,
          relatedTo,
          state,
          meta,
          artifacts: [screenshotData], // For now, store screenshot as base64; backend can split if needed
          status: 'Open',
          history: [],
          verification: [],
          relatedTickets: relatedTo ? [relatedTo] : [],
        };
        await createTicket(ticketData);
      } else {
        // Update existing ticket (append info/artifacts)
        const updates = {
          description: desc,
          meta,
          artifacts: [screenshotData],
          appended: true,
          relatedTo,
        };
        await updateTicket(ticket.uid || ticket.id, updates);
      }
      // Show success message and close modal after short delay
      if (modal && errorMsg) {
        errorMsg.textContent = 'Ticket created!';
        errorMsg.style.display = 'block';
        errorMsg.style.color = '#66ff66';
        modal.setAttribute('data-status', 'success');
        window.bugReportModalStatus = 'success';
        setTimeout(() => {
          this._closeBugReportModal();
          if (modal) modal.setAttribute('data-status', 'closed');
          window.bugReportModalStatus = 'closed';
        }, 1000);
      } else {
        this._closeBugReportModal();
        if (modal) modal.setAttribute('data-status', 'closed');
        window.bugReportModalStatus = 'closed';
      }
    } catch (e) {
      // Rethrow so the modal can show the error
      throw e;
    }
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

  _saveAdditionalScreenshot(existingTicket) {
    let ticket = existingTicket;
    if (!ticket && this.latestBugReportFolder) {
      // Try to parse from folder name
      const parts = this.latestBugReportFolder.split('/').pop().split('_');
      ticket = {
        name: parts.slice(0, -1).join('_'),
        uid: parts[parts.length - 1],
      };
    }
    if (!ticket) {
      this._showToast('Please save a bug report first!');
      return;
    }
    this.screenshotCount++;
    const screenshotData = this._captureCanvasScreenshot();
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19);
    if (window.mcp && window.mcp.saveBugReportScreenshot) {
      window.mcp.saveBugReportScreenshot(
        `tests/bug-reports/${ticket.name}_${ticket.uid}/additional-info`,
        screenshotData,
        this.screenshotCount
      );
    } else {
      this._downloadScreenshot(
        screenshotData,
        `tests/bug-reports/${ticket.name}_${ticket.uid}/additional-info/screenshot-${this.screenshotCount}_${timestamp}_${ticket.uid}.png`
      );
    }
    this._addScreenshotThumbnail(screenshotData);
    this._showToast(`Screenshot ${this.screenshotCount} saved!`);
  }
}
