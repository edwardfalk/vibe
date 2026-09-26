import { CONFIG } from '../config.js';
import { sin, cos, PI, dist } from '../mathUtils.js';
import { drawGlow } from '../effects/glowUtils.js';

// Requires p5.js in instance mode: all p5 functions/vars must use the 'p' parameter (e.g., p.ellipse, p.fill)

const { WORLD_WIDTH, WORLD_HEIGHT } = CONFIG.GAME_SETTINGS;
const MAX_BULLET_POOL_SIZE = 400;

export class Bullet {
  constructor(x, y, angle, speed, owner) {
    this.maxTrailLength = 5;
    this._trailSlots = Array.from({ length: this.maxTrailLength }, () => ({
      x: 0,
      y: 0,
    }));
    this._trailHead = 0;
    this._trailCount = 0;
    this.reset(x, y, angle, speed, owner);
  }

  /** Returns a bullet from pool or creates new; never returns null. Callers should still guard for null for defensive robustness. */
  static acquire(x, y, angle, speed, owner) {
    let bullet;
    if (Bullet.pool.length > 0) {
      bullet = Bullet.pool.pop();
      bullet._inPool = false;
      bullet.reset(x, y, angle, speed, owner);
    } else {
      bullet = new Bullet(x, y, angle, speed, owner);
    }
    return bullet;
  }

  static release(bullet) {
    if (!bullet || bullet._inPool) return;
    if (Bullet.pool.length >= MAX_BULLET_POOL_SIZE) return;
    bullet._inPool = true;
    bullet.active = false;
    bullet._trailHead = 0;
    bullet._trailCount = 0;
    Bullet.pool.push(bullet);
  }

  reset(x, y, angle, speed, owner) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.angle = angle;
    this.speed = speed;
    this.owner = owner; // 'player' or 'enemy'
    this.ownerId = undefined;
    this.type = undefined;
    this.energy = undefined;
    this._inPool = false;
    this._remove = false; // a hit marks it; a recycled bullet starts clean

    this.velocity = {
      x: cos(angle) * speed,
      y: sin(angle) * speed,
    };

    // Size and damage based on owner type - increased for better visibility
    if (owner === 'player') {
      this.size = 8;
      this.damage = 1;
    } else if (owner === 'enemy-tank') {
      this.size = 26;
      this.damage = 50;
      this.energy = 100;
    } else {
      this.size = 6;
      this.damage = 1;
    }
    this.active = true;
    this._trailHead = 0;
    this._trailCount = 0;
  }

  update() {
    // Remember previous position for collision checking
    this.prevX = this.x;
    this.prevY = this.y;
    // Store position for trail (ring buffer)
    const slot = this._trailSlots[this._trailHead];
    slot.x = this.x;
    slot.y = this.y;
    this._trailHead = (this._trailHead + 1) % this.maxTrailLength;
    if (this._trailCount < this.maxTrailLength) this._trailCount++;

    // Move bullet
    this.x += this.velocity.x;
    this.y += this.velocity.y;

    // Use centralized world bounds check
    if (this._isOutOfWorldBounds()) {
      this.active = false;
    }
  }

  draw(p) {
    if (!this.active) return;

    try {
      if (this.owner === 'player') {
        drawGlow(p, this.x, this.y, this.size * 2, p.color(255, 255, 100), 0.8);
      } else if (this.owner === 'enemy-tank') {
        const energyPercent = Number.isFinite(this.energy)
          ? Math.min(1, Math.max(0, this.energy / 100))
          : 1;
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
      console.warn('⚠️ Bullet glow error:', error);
    }

    // Draw trail
    this.drawTrail(p);

    // Draw bullet
    p.push();
    p.translate(this.x, this.y);
    p.rotate(this.angle);

    // Synthwave bright core with thick neon glow
    p.blendMode(p.ADD);

    if (this.owner === 'player') {
      // Player bullet - neon cyan line
      p.stroke(0, 255, 255, 200);
      p.strokeWeight(this.size);
      p.line(-this.size, 0, this.size, 0);

      p.stroke(255, 255, 255);
      p.strokeWeight(this.size * 0.4);
      p.line(-this.size * 0.5, 0, this.size * 0.5, 0);
    } else if (this.owner === 'enemy-tank') {
      // Tank bullet - massive vibrating neon purple hexagon
      const energyPercent = Number.isFinite(this.energy)
        ? Math.min(1, Math.max(0, this.energy / 100))
        : 1;
      const vibration = sin(p.frameCount * 0.8) * 2; // Fast vibration

      p.translate(vibration, vibration * 0.5);

      p.stroke(138, 43, 226, 200);
      p.strokeWeight(this.size * 0.5 * energyPercent);
      p.fill(255, 255, 255);

      p.beginShape();
      for (let i = 0; i < 6; i++) {
        p.vertex(
          cos((i * PI) / 3) * this.size * energyPercent,
          sin((i * PI) / 3) * this.size * energyPercent
        );
      }
      p.endShape(p.CLOSE);

      // Lightning bolts crackling out of the core, new each frame
      p.blendMode(p.ADD);
      p.noFill();
      p.stroke(190, 140, 255, 230);
      p.strokeWeight(1.5);
      for (let bolt = 0; bolt < 4; bolt++) {
        const ang = Math.random() * PI * 2;
        const along = { x: cos(ang), y: sin(ang) };
        p.beginShape();
        for (let k = 0; k <= 5; k++) {
          const r = this.size * energyPercent * (0.9 + k * 0.2);
          const jag =
            k === 0
              ? 0
              : (Math.random() - 0.5) * this.size * energyPercent * 0.5;
          p.vertex(along.x * r - along.y * jag, along.y * r + along.x * jag);
        }
        p.endShape();
      }
    } else {
      // Standard enemy bullet - neon green line
      p.stroke(0, 255, 0, 200);
      p.strokeWeight(this.size);
      p.line(-this.size, 0, this.size, 0);

      p.stroke(255, 255, 255);
      p.strokeWeight(this.size * 0.4);
      p.line(-this.size * 0.5, 0, this.size * 0.5, 0);
    }

    p.blendMode(p.BLEND);
    p.pop();
  }

  drawTrail(p) {
    if (this._trailCount < 2) return;

    for (let i = 0; i < this._trailCount - 1; i++) {
      const idx =
        (this._trailHead - this._trailCount + i + this.maxTrailLength) %
        this.maxTrailLength;
      const slot = this._trailSlots[idx];
      const alpha = (i / this._trailCount) * 150;
      const size = (i / this._trailCount) * this.size * 0.5;

      if (this.owner === 'player') {
        p.fill(255, 255, 100, alpha);
      } else if (this.owner === 'enemy-tank') {
        p.fill(150, 100, 255, alpha);
      } else {
        p.fill(255, 100, 255, alpha);
      }

      p.noStroke();
      p.ellipse(slot.x, slot.y, size);
    }
  }

  checkCollision(target) {
    if (!this.active) return false;
    if (!target || typeof target.size !== 'number') return false;

    const threshold = this.size / 2 + (target.hitRadius ?? target.size / 2);
    const distance = this._pointSegmentDistance(
      target.x,
      target.y,
      this.prevX,
      this.prevY,
      this.x,
      this.y
    );
    return distance < threshold;
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
   * Distance from point (px,py) to segment (x1,y1)-(x2,y2)
   */
  _pointSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) {
      return dist(px, py, x1, y1);
    }
    const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    const clamped = Math.max(0, Math.min(1, t));
    const lx = x1 + clamped * dx;
    const ly = y1 + clamped * dy;
    return dist(px, py, lx, ly);
  }
}

Bullet.pool = [];
