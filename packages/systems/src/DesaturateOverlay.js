import { LAYERS } from './RenderPipeline.js';

/**
 * DesaturateOverlay – applies a greyscale filter + optional vignette.
 * For now uses p.filter(GRAY) which desaturates the canvas.
 */
export class DesaturateOverlay {
  constructor() {
    this.layer = LAYERS.OVERLAY;
  }

  /**
   * @param {p5} p
   */
  draw(p) {
    p.push();
    p.filter(p.GRAY);
    // Optional subtle colour left: draw translucent overlay.
    p.noStroke();
    p.fill(40, 40, 40, 80);
    p.rect(0, 0, p.width, p.height);
    p.pop();
  }
}
