import {
  CONFIG,
  min,
  max,
  floor,
  ceil,
  round,
  random,
  sin,
  cos,
  atan2,
  PI,
  TWO_PI,
  normalizeAngle,
} from '@vibe/core';

// Requires p5.js in instance mode: all p5 functions/vars must use the 'p' parameter (e.g., p.ellipse, p.fill)

// Defensive config access for world dimensions
const DEFAULT_WORLD_WIDTH = 1920;
const DEFAULT_WORLD_HEIGHT = 1080;

const GAME_SETTINGS = CONFIG.GAME_SETTINGS;
if (!GAME_SETTINGS) {
  console.warn(
    '[Bullet] CONFIG.GAME_SETTINGS missing! Using default world size.'
  );
}

const WORLD_WIDTH = GAME_SETTINGS?.WORLD_WIDTH ?? DEFAULT_WORLD_WIDTH;
const WORLD_HEIGHT = GAME_SETTINGS?.WORLD_HEIGHT ?? DEFAULT_WORLD_HEIGHT;

export class Bullet {
  constructor(x, y, angle, speed, owner) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.angle = angle;
    this.speed = speed;
    this.owner = owner; // 'player' or 'enemy'

    this.velocity = {
      x: cos(angle) * speed,
      y: sin(angle) * speed,
    };

    // Size and damage based on owner type - increased for better visibility
    if (owner === 'player') {
      this.size = 8; // Increased from 6
      this.damage = 1;
    } else if (owner === 'enemy-rusher') {
      this.size = 5; // Increased from 3
      this.damage = 1;
    } else if (owner === 'enemy-tank') {
      this.size = 20; // Made bigger for more impact
      this.damage = 999; // Instant kill
      this.energy = 100; // Energy that decreases when killing enemies
      this.penetrating = true; // Can pass through enemies
    } else {
      this.size = 6; // Increased from 4
      this.damage = 1;
    }
    this.active = true;

    // Trail effect
    this.trail = [];
    this.maxTrailLength = 5;
  }

  update() {
    // Remember previous position for collision checking
    this.prevX = this.x;
    this.prevY = this.y;
    // Store position for trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }

    // Move bullet
    this.x += this.velocity.x;
    this.y += this.velocity.y;

    // Use centralized world bounds check
    if (this._isOutOfWorldBounds()) {
      this.active = false;
      console.log(
        `🗑️ Removing bullet (off-world): ${this.x.toFixed(0)}, ${this.y.toFixed(0)}`
      );
    }
  }

  draw(p) {
    if (!this.active) return;

    // Draw enhanced glow effect
    if (typeof drawGlow !== 'undefined') {
      try {
        if (this.owner === 'player') {
          drawGlow(
            p,
            this.x,
            this.y,
            this.size * 2,
            p.color(255, 255, 100),
            0.8
          );
        } else if (this.owner === 'enemy-tank') {
          const energyPercent = this.energy ? this.energy / 100 : 1;
          drawGlow(
            p,
            this.x,
            this.y,
            this.size * 3 * energyPercent,
            p.color(150, 100, 255),
            1.2
          );
        } else {
          drawGlow(
            p,
            this.x,
            this.y,
            this.size * 1.5,
            p.color(255, 100, 255),
            0.5
          );
        }
      } catch (error) {
        console.log('⚠️ Bullet glow error:', error);
      }
    }

    // Draw trail
    this.drawTrail(p);

    // Draw bullet
    p.push();
    p.translate(this.x, this.y);
    p.rotate(this.angle);

    if (this.owner === 'player') {
      // Player bullet - cosmic turquoise energy
      p.fill(64, 224, 208);
      p.noStroke();
      p.ellipse(0, 0, this.size);

      // Bright core
      p.fill(255, 255, 255, 180);
      p.ellipse(0, 0, this.size * 0.6);

      // Outer glow
      p.fill(0, 255, 255, 80);
      p.ellipse(0, 0, this.size * 1.4);
    } else if (this.owner === 'enemy-rusher') {
      // Rusher bullet - small, fast, pink
      p.fill(255, 150, 200);
      p.noStroke();
      p.ellipse(0, 0, this.size);

      // Small glow
      p.fill(255, 200, 220, 120);
      p.ellipse(0, 0, this.size * 1.3);
    } else if (this.owner === 'enemy-tank') {
      // Tank bullet - massive, devastating energy ball with vibrating pulse
      const energyPercent = this.energy ? this.energy / 100 : 1;
      const vibration = sin(p.frameCount * 0.8) * 2; // Fast vibration
      const pulse = sin(p.frameCount * 0.5) * 0.4 + 0.6; // Slower pulse

      p.push();
      p.translate(vibration, vibration * 0.5); // Vibrating effect

      // Main energy ball - size based on remaining energy
      p.fill(150 * energyPercent, 100 * energyPercent, 255);
      p.noStroke();
      p.ellipse(0, 0, this.size * energyPercent);

      // Massive plasma glow
      p.fill(200 * energyPercent, 150 * energyPercent, 255, 120 * pulse);
      p.ellipse(0, 0, this.size * 2.2 * energyPercent);

      // Pulsing outer aura with vibration
      p.fill(255, 200 * energyPercent, 255, 60 * pulse * energyPercent);
      p.ellipse(0, 0, this.size * 3 * energyPercent);

      // Bright inner core
      p.fill(255, 255, 255, 200 * energyPercent);
      p.ellipse(0, 0, this.size * 0.4 * energyPercent);

      p.pop();
    } else {
      // Standard enemy bullet - purple/pink energy
      p.fill(255, 100, 255);
      p.noStroke();
      p.ellipse(0, 0, this.size);

      // Energy glow
      p.fill(255, 150, 255, 100);
      p.ellipse(0, 0, this.size * 1.5);
    }

    p.pop();
  }

  drawTrail(p) {
    if (this.trail.length < 2) return;

    for (let i = 0; i < this.trail.length - 1; i++) {
      const alpha = (i / this.trail.length) * 150;
      const size = (i / this.trail.length) * this.size * 0.5;

      if (this.owner === 'player') {
        p.fill(255, 255, 100, alpha);
      } else if (this.owner === 'enemy-rusher') {
        p.fill(255, 150, 200, alpha);
      } else if (this.owner === 'enemy-tank') {
        p.fill(150, 100, 255, alpha);
      } else {
        p.fill(255, 100, 255, alpha);
      }

      p.noStroke();
      p.ellipse(this.trail[i].x, this.trail[i].y, size);
    }
  }

  checkCollision(target) {
    if (!this.active) return false;

    const threshold = (this.size + target.size) * 0.5;
    const thresholdSq = threshold * threshold;
    const distanceSq = this._pointSegmentDistanceSq(
      target.x,
      target.y,
      this.prevX,
      this.prevY,
      this.x,
      this.y
    );
    return distanceSq < thresholdSq;
  }

  destroy() {
    this.active = false;
  }

  // Check if bullet is off screen
  isOffScreen() {
    // Use centralized world bounds check
    return this._isOutOfWorldBounds();
  }

  /**
   * Returns true if the bullet is outside the world bounds (with margin).
   * Centralizes boundary logic for update() and isOffScreen().
   */
  _isOutOfWorldBounds() {
    const margin = 40; // Margin beyond world edges before removal
    const left = -WORLD_WIDTH / 2 - margin;
    const right = WORLD_WIDTH / 2 + margin;
    const top = -WORLD_HEIGHT / 2 - margin;
    const bottom = WORLD_HEIGHT / 2 + margin;
    return this.x < left || this.x > right || this.y < top || this.y > bottom;
  }

  /**
   * Squared distance from point (px,py) to segment (x1,y1)-(x2,y2)
   * Avoids costly Math.sqrt; suitable for threshold comparisons.
   */
  _pointSegmentDistanceSq(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) {
      const dx1 = px - x1;
      const dy1 = py - y1;
      return dx1 * dx1 + dy1 * dy1;
    }
    const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    const clamped = max(0, min(1, t));
    const lx = x1 + clamped * dx;
    const ly = y1 + clamped * dy;
    const dx2 = px - lx;
    const dy2 = py - ly;
    return dx2 * dx2 + dy2 * dy2;
  }
}
