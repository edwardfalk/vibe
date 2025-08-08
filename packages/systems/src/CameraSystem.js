// Requires p5.js for constrain(), random(), lerp(), etc. (moved to @vibe/systems)
import { CONFIG } from '@vibe/core/config.js';
import { randomRange } from '@vibe/core/mathUtils.js';
import { max } from '@vibe/core';

export class CameraSystem {
  constructor(p) {
    this.p = p;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.screenShake = { intensity: 0, duration: 0 };
    this.sensitivity = 0.4;
    this.maxOffset = 400;
    this.interpolationSpeed = 0.15;
  }
  addShake(intensity, duration = 20) {
    this.screenShake.intensity = max(
      this.screenShake.intensity,
      intensity
    );
    this.screenShake.duration = max(this.screenShake.duration, duration);
  }
  update() {
    if (!window.player) return;
    const p = this.p;
    const playerVelocity = window.player.velocity || { x: 0, y: 0 };
    this.targetX = window.player.x + playerVelocity.x * 50 * this.sensitivity;
    this.targetY = window.player.y + playerVelocity.y * 50 * this.sensitivity;
    const { WORLD_WIDTH, WORLD_HEIGHT } = CONFIG.GAME_SETTINGS;
    const VIEWPORT_WIDTH = p.width;
    const VIEWPORT_HEIGHT = p.height;
    const cameraMaxX = WORLD_WIDTH / 2 - VIEWPORT_WIDTH / 2;
    const cameraMaxY = WORLD_HEIGHT / 2 - VIEWPORT_HEIGHT / 2;
    this.targetX = p.constrain(this.targetX, -cameraMaxX, cameraMaxX);
    this.targetY = p.constrain(this.targetY, -cameraMaxY, cameraMaxY);
    this.x = p.lerp(this.x, this.targetX, this.interpolationSpeed);
    this.y = p.lerp(this.y, this.targetY, this.interpolationSpeed);
  }
  applyTransform() {
    const p = this.p;
    p.push();
    if (this.screenShake.duration > 0) {
      this.screenShake.duration--;
      p.translate(
        randomRange(-this.screenShake.intensity, this.screenShake.intensity),
        randomRange(-this.screenShake.intensity, this.screenShake.intensity)
      );
    }
    p.translate(p.width / 2 - this.x, p.height / 2 - this.y);
  }
  removeTransform() {
    this.p.pop();
  }
  worldToScreen(worldX, worldY) {
    const p = this.p;
    return {
      x: worldX - this.x + p.width / 2,
      y: worldY - this.y + p.height / 2,
    };
  }
  screenToWorld(screenX, screenY) {
    const p = this.p;
    return {
      x: screenX + this.x - p.width / 2,
      y: screenY + this.y - p.height / 2,
    };
  }
  isVisible(worldX, worldY, margin = 50) {
    const p = this.p;
    const screen = this.worldToScreen(worldX, worldY);
    return (
      screen.x >= -margin &&
      screen.x <= p.width + margin &&
      screen.y >= -margin &&
      screen.y <= p.height + margin
    );
  }
  getBounds() {
    const p = this.p;
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(p.width, p.height);
    return {
      left: topLeft.x,
      top: topLeft.y,
      right: bottomRight.x,
      bottom: bottomRight.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }
  reset() {
    this.x = this.y = this.targetX = this.targetY = 0;
    this.screenShake = { intensity: 0, duration: 0 };
  }
}
