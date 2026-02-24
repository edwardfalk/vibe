import { CONFIG } from '../config.js';
import {
  max,
  min,
  floor,
  ceil,
  round,
  random,
  sin,
  cos,
  atan2,
  sqrt,
  PI,
  TWO_PI,
  normalizeAngle,
  dist,
} from '../mathUtils.js';
import { drawGlow } from '../visualEffects.js';

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
    Bullet.poolStats.acquired++;
    let bullet;
    if (Bullet.pool.length > 0) {
      bullet = Bullet.pool.pop();
      bullet._inPool = false;
      bullet.reset(x, y, angle, speed, owner);
      Bullet.poolStats.reused++;
    } else {
      bullet = new Bullet(x, y, angle, speed, owner);
      Bullet.poolStats.created++;
    }
    Bullet.poolStats.inUse++;
    Bullet.poolStats.peakInUse = Math.max(
      Bullet.poolStats.peakInUse,
      Bullet.poolStats.inUse
    );
    return bullet;
  }

  static release(bullet) {
    if (!bullet || bullet._inPool) return;
    if (Bullet.pool.length >= MAX_BULLET_POOL_SIZE) {
      Bullet.poolStats.inUse = Math.max(0, Bullet.poolStats.inUse - 1);
      return;
    }
    bullet._inPool = true;
    bullet.active = false;
    bullet._trailHead = 0;
    bullet._trailCount = 0;
    Bullet.pool.push(bullet);
    Bullet.poolStats.released++;
    Bullet.poolStats.inUse = Math.max(0, Bullet.poolStats.inUse - 1);
    Bullet.poolStats.peakPoolSize = Math.max(
      Bullet.poolStats.peakPoolSize,
      Bullet.pool.length
    );
  }

  static getPoolStats() {
    return {
      ...Bullet.poolStats,
      poolSize: Bullet.pool.length,
      maxPoolSize: MAX_BULLET_POOL_SIZE,
    };
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
    this.penetrating = false;
    this._inPool = false;

    this.velocity = {
      x: cos(angle) * speed,
      y: sin(angle) * speed,
    };

    // Size and damage based on owner type - increased for better visibility
    if (owner === 'player') {
      this.size = 8;
      this.damage = 1;
    } else if (owner === 'enemy-rusher') {
      this.size = 5;
      this.damage = 1;
    } else if (owner === 'enemy-tank') {
      this.size = 20;
      this.damage = 999;
      this.energy = 100;
      this.penetrating = true;
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
      console.log('⚠️ Bullet glow error:', error);
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
    } else if (this.owner === 'enemy-rusher') {
      // Rusher bullet - hot pink shard
      p.fill(255, 255, 255);
      p.stroke(255, 20, 147, 200);
      p.strokeWeight(this.size * 0.8);
      p.triangle(
        this.size,
        0,
        -this.size,
        -this.size * 0.5,
        -this.size,
        this.size * 0.5
      );
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
      } else if (this.owner === 'enemy-rusher') {
        p.fill(255, 150, 200, alpha);
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

    const threshold = (this.size + target.size) * 0.5;
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

  destroy() {
    this.active = false;
    Bullet.release(this);
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
Bullet.poolStats = {
  acquired: 0,
  released: 0,
  created: 0,
  reused: 0,
  inUse: 0,
  peakInUse: 0,
  peakPoolSize: 0,
};
