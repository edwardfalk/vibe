import { LAYERS } from './RenderPipeline.js';

/**
 * HudRenderer – draws the level progress bar on the p5 canvas.
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

    // Level progress bar on right side
    const progress = this.gameState.getProgressToNextLevel?.() ?? 0;
    const barWidth = 200;
    const barHeight = 8;
    const barX = p.width - barWidth - 20;
    const barY = 20;

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

    // Label
    p.fill(255, 255, 255);
    p.textAlign(p.RIGHT, p.TOP);
    p.textSize(12);
    p.noStroke();
    p.text(`Level ${this.gameState.level} Progress`, barX + barWidth, barY - 15);

    p.pop();
  }
}
