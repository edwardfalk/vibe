/**
 * Visual effects manager: screen effects (bloom, chromatic aberration).
 */

class VisualEffectsManager {
  constructor() {
    this.bloomIntensity = 0;
    this._bloomFramesLeft = 0;
    this._bloomPeak = 0;
    this._bloomDuration = 0;
    this.chromaticAberration = 0;
    this._chromaticFramesLeft = 0;
    this._chromaticPeak = 0;
    this._chromaticDuration = 0;
  }

  /** Called once per game-update frame (not while paused or in hitstop). */
  update() {
    if (this._chromaticFramesLeft > 0) this._chromaticFramesLeft--;
    this.chromaticAberration =
      this._chromaticDuration > 0
        ? (this._chromaticPeak * this._chromaticFramesLeft) /
          this._chromaticDuration
        : 0;
    if (this._bloomFramesLeft > 0) this._bloomFramesLeft--;
    this.bloomIntensity =
      this._bloomDuration > 0
        ? (this._bloomPeak * this._bloomFramesLeft) / this._bloomDuration
        : 0;
  }

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
    this._chromaticPeak = intensity;
    this._chromaticFramesLeft = durationFrames;
    this._chromaticDuration = durationFrames;
  }

  triggerBloom(intensity = 0.3, durationFrames = 20) {
    this.bloomIntensity = intensity;
    this._bloomPeak = intensity;
    this._bloomFramesLeft = durationFrames;
    this._bloomDuration = durationFrames;
  }
}

export default VisualEffectsManager;
