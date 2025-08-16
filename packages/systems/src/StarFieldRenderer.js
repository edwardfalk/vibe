import { LAYERS } from './RenderPipeline.js';

/**
 * Renders far-background cosmic aurora and subtle star field.
 * Delegates actual drawing to existing BackgroundRenderer instance for now.
 */
export class StarFieldRenderer {
  /**
   * @param {import('./BackgroundRenderer.js').BackgroundRenderer} bgRenderer
   */
  constructor(bgRenderer) {
    this.bgRenderer = bgRenderer;
    this.layer = LAYERS.BACKGROUND_FAR;
  }

  /**
   * @param {p5} p
   * @param {number} dtMs
   */
  draw(p, dtMs) {
    this.bgRenderer?.drawCosmicAuroraBackground?.(p);
    this.bgRenderer?.drawSubtleSpaceElements?.(p);
  }
}
