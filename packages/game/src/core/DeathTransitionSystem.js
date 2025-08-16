// DeathTransitionSystem.js – handles slow-motion limbo and restart after player death
// eslint-disable-next-line max-classes-per-file

import { floor } from '@vibe/core/mathUtils.js';
import { DesaturateOverlay } from '@vibe/systems';

/**
 * DeathTransitionSystem orchestrates the post-death limbo:
 * 1. Slow-motion & greyscale.
 * 2. Enemies shoot the corpse for 3 s, then get bored and attack each other.
 * 3. Overlay prompt to restart (R key or left click).
 */
export default class DeathTransitionSystem {
  constructor({ p, gameState, beatClock, renderPipeline, audio }) {
    this.p = p;
    this.gameState = gameState;
    this.beatClock = beatClock;
    this.renderPipeline = renderPipeline;
    this.audio = audio;

    this.active = false;
    this.timerMs = 0;
    this.stage = 'initial'; // 'initial' -> 'bored' -> 'prompt'

    // Overlay prompt text (can be localised later)
    this.promptLines = [
      '🌌  THE COSMOS CLAIMS ANOTHER  🪦',
      'Press R or Click to Respawn',
    ];

    // Bind input listeners once
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.key === 'r' || e.key === 'R') this._handleRestart();
    });
    window.addEventListener('mousedown', () => {
      if (this.active) this._handleRestart();
    });
  }

  /** Call when lethal damage is detected. */
  onPlayerDeath() {
    if (this.active) return;
    this.active = true;
    this.timerMs = 0;
    this.stage = 'initial';

    // Slow-motion: 0.25× time
    if (typeof this.beatClock.setTimeScale === 'function') {
      this.beatClock.setTimeScale(0.25);
    }
    window.timeScale = 0.25; // Fallback for modules that inspect this global

    // Greyscale/muffle flags
    this._applyGreyscale(true);
    this.audio?.applyMuffle?.(0.4);
    if (this.audio) this._prevSpeech = this.audio.speechEnabled;
    if (this.audio) this.audio.speechEnabled = false;

    // Disable input & player shooting
    window.controlsDisabled = true;
    window.playerIsShooting = false;
    window.arrowUpPressed = false;
    window.arrowDownPressed = false;
    window.arrowLeftPressed = false;
    window.arrowRightPressed = false;
  }

  /** Per-frame update – pass deltaTimeMs from p5 instance. */
  update(dtMs) {
    if (!this.active) return;
    this.timerMs += dtMs;

    if (this.stage === 'initial' && this.timerMs >= 3000) {
      this.stage = 'bored';
      // Allow friendly fire
      if (window.collisionSystem)
        window.collisionSystem.friendlyFireEnabled = true;
    }
    if (this.stage === 'bored' && this.timerMs >= 6000) {
      this.stage = 'prompt';
    }
  }

  /** Draw overlay & apply greyscale tint. */
  draw(p) {
    if (!this.active) return;

    // Greyscale overlay with slight colour (opacity proportional to limbo time)
    p.push();
    const alpha = p.map(this.timerMs, 0, 3000, 0, 180, true);
    p.noStroke();
    p.fill(50, 50, 50, alpha);
    p.rect(0, 0, p.width, p.height);
    p.pop();

    if (this.stage === 'prompt') {
      p.push();
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(24);
      p.fill(255);
      p.stroke(0);
      p.strokeWeight(4);
      p.text(this.promptLines[0], p.width / 2, p.height / 2 - 20);
      p.textSize(14);
      p.strokeWeight(2);
      p.text(this.promptLines[1], p.width / 2, p.height / 2 + 20);
      p.pop();
    }
  }

  /** Clean up and restore normal gameplay. */
  dispose() {
    this.active = false;
    this._applyGreyscale(false);
    this.audio?.applyMuffle?.(1);
    if (typeof this.beatClock.setTimeScale === 'function') {
      this.beatClock.setTimeScale(1);
    }
    window.timeScale = 1;
    if (window.collisionSystem)
      window.collisionSystem.friendlyFireEnabled = false;

    window.controlsDisabled = false;
    if (this.audio && this._prevSpeech !== undefined) {
      this.audio.speechEnabled = this._prevSpeech;
    }
  }

  /* --------------------------------------------------------------------- */
  _handleRestart() {
    if (!this.active || this.stage !== 'prompt') return;
    this.dispose();
    // Standard robust restart
    if (typeof this.gameState.restart === 'function') {
      this.gameState.restart();
    }
  }

  _applyGreyscale(enable) {
    if (!this.renderPipeline) return;
    if (enable) {
      if (!this._desatRenderer) {
        this._desatRenderer = new DesaturateOverlay();
        this.renderPipeline.addRenderer(this._desatRenderer);
      }
    } else if (this._desatRenderer) {
      const idx = this.renderPipeline.renderers.indexOf(this._desatRenderer);
      if (idx !== -1) this.renderPipeline.renderers.splice(idx, 1);
      this._desatRenderer = null;
    }
  }
}
