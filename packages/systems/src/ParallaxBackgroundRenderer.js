import { LAYERS } from './RenderPipeline.js';

/**
 * Renders camera-relative parallax background layers and interactive effects.
 */
export class ParallaxBackgroundRenderer {
  /**
   * @param {import('./BackgroundRenderer.js').BackgroundRenderer} bgRenderer
   * @param {import('@vibe/core').GameState} gameState
   */
  constructor(bgRenderer, gameState) {
    this.bgRenderer = bgRenderer;
    this.gameState = gameState;
    this.layer = LAYERS.BACKGROUND_MID;
  }

  draw(p, dtMs) {
    this.bgRenderer?.drawParallaxBackground?.(p);
    if (this.gameState?.gameState === 'playing') {
      this.bgRenderer?.drawInteractiveBackgroundEffects?.(p);
    }
  }
}
