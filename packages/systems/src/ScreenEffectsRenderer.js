import { LAYERS } from './RenderPipeline.js';

export class ScreenEffectsRenderer {
  constructor(visualEffectsManager) {
    this.visualEffectsManager = visualEffectsManager;
    this.layer = LAYERS.OVERLAY;
  }

  draw(p, dtMs) {
    this.visualEffectsManager?.applyScreenEffects?.(p);
  }
}
