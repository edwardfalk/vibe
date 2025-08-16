import { LAYERS } from './RenderPipeline.js';
import { coreDrawGame } from '../../game/src/core/CoreDraw.js';

/**
 * WorldRenderer – wraps coreDrawGame so it participates in the RenderPipeline.
 * Draws world-space entities, bullets, explosions etc. (layer WORLD).
 */
export class WorldRenderer {
  constructor() {
    this.layer = LAYERS.WORLD;
  }

  /**
   * @param {p5} p
   * @param {number} dtMs
   */
  draw(p, dtMs) {
    coreDrawGame(p);
  }
}
