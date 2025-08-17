import { LAYERS } from './RenderPipeline.js';

/**
 * HudRenderer – draws minimal HUD text directly on the p5 canvas.
 * Replaces missing level indicator and provides redundant score/health for probe use.
 */
export class HudRenderer {
  /**
   * @param {import('@vibe/core').GameState} gameState
   * @param {any} player
   */
  constructor(gameState, player) {
    this.gameState = gameState;
    this.player = player;
    this.layer = LAYERS.HUD;
  }

  draw(p) {
    if (!this.gameState || !this.player) return;
    p.push();
    p.resetMatrix(); // ensure screen-space

    p.textAlign(p.LEFT, p.TOP);
    p.fill(255);
    p.noStroke();
    p.textSize(14);
    const scoreTxt = `Score: ${this.gameState.score}`;
    const healthTxt = `Health: ${this.player.health}`;
    const levelTxt = `Level: ${this.gameState.level}`;

    p.text(scoreTxt, 10, 10);
    p.text(healthTxt, 10, 28);
    p.text(levelTxt, 10, 46);

    // Level progress bar
    const progress = this.gameState.getProgressToNextLevel?.() ?? 0;
    const barWidth = 120;
    const barHeight = 8;
    const barX = 10;
    const barY = 64;

    // Background bar
    p.fill(50, 50, 50, 150);
    p.rect(barX, barY, barWidth, barHeight);

    // Progress fill
    p.fill(100, 255, 100, 200);
    p.rect(barX, barY, barWidth * progress, barHeight);

    // Border
    p.stroke(255, 255, 255, 100);
    p.strokeWeight(1);
    p.noFill();
    p.rect(barX, barY, barWidth, barHeight);

    p.pop();
  }
}
