import { BackgroundEffectsRenderer } from './BackgroundEffectsRenderer.js';

/**
 * Visual effects manager: screen effects (bloom, chromatic aberration).
 * Background rendering is delegated to BackgroundEffectsRenderer.
 */

class VisualEffectsManager {
  constructor(backgroundLayers, context = null) {
    this.context = context;

    this.bloomIntensity = 0;
    this._bloomFramesLeft = 0;
    this.chromaticAberration = 0;
    this._chromaticFramesLeft = 0;

    this._background = new BackgroundEffectsRenderer(backgroundLayers);
  }

  // Expose background state for external readers
  get initialized() {
    return this._background.initialized;
  }
  get initFailed() {
    return this._background.initFailed;
  }

  drawEnhancedBackground(p, camera) {
    this._background.drawEnhancedBackground(p, camera);
  }

  /** Stabber-compatible API: addExplosion(x, y, count, color, intensity?, size?, life?) */
  applyScreenEffects(p) {
    if (this.chromaticAberration > 0) {
      this.drawChromaticAberration(p);
    }

    if (this.bloomIntensity > 0) {
      this.drawBloom(p);
    }
  }

  drawChromaticAberration(p) {
    p.push();
    p.blendMode(p.MULTIPLY);
    p.fill(255, 0, 0, this.chromaticAberration * 10);
    p.rect(0, 0, p.width, p.height);
    p.pop();
  }

  drawBloom(p) {
    p.push();
    p.blendMode(p.SCREEN);
    p.fill(255, 255, 255, this.bloomIntensity * 20);
    p.noStroke();

    for (let i = 0; i < 3; i++) {
      p.rect(-i, -i, p.width + i * 2, p.height + i * 2);
    }
    p.pop();
  }

  triggerChromaticAberration(intensity = 0.5, durationFrames = 30) {
    this.chromaticAberration = intensity;
    this._chromaticFramesLeft = durationFrames;
  }

  triggerBloom(intensity = 0.3, durationFrames = 20) {
    this.bloomIntensity = intensity;
    this._bloomFramesLeft = durationFrames;
  }
}

export default VisualEffectsManager;
