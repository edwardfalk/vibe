import { CONFIG } from '../config.js';
import { sin, cos, dist } from '../mathUtils.js';
import { drawGlow } from '../effects/glowUtils.js';
import { GRUNT_COLORS } from './GruntRenderer.js';
import { TANK_COLORS, drawTankBall } from './TankRenderer.js';

// Requires p5.js in instance mode: all p5 functions/vars must use the 'p' parameter (e.g., p.ellipse, p.fill)

const { WORLD_WIDTH, WORLD_HEIGHT } = CONFIG.GAME_SETTINGS;
const MAX_BULLET_POOL_SIZE = 400;
const PLAYER_GLOW = [255, 255, 100];
const TANK_GLOW = TANK_COLORS.amber;
const ENEMY_GLOW = GRUNT_COLORS.shot; // only grunts fire small shots

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
        drawGlow(p, this.x, this.y, this.size * 2, PLAYER_GLOW, 0.8);
      } else if (this.owner === 'enemy-tank') {
        const energyPercent = Number.isFinite(this.energy)
          ? Math.min(1, Math.max(0, this.energy / 100))
          : 1;
        drawGlow(
          p,
          this.x,
          this.y,
          this.size * 3 * energyPercent,
          TANK_GLOW,
          1.2
        );
      } else {
        drawGlow(p, this.x, this.y, this.size * 1.5, ENEMY_GLOW, 0.5);
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
      // The Bouncer's ball: amber with a white-hot core and an ink rim, so
      // not additive; it shrinks as its energy is spent on aliens it hits
      const energyPercent = Number.isFinite(this.energy)
        ? Math.min(1, Math.max(0, this.energy / 100))
        : 1;
      p.blendMode(p.BLEND);
      drawTankBall(p, this.size * energyPercent, (p.frameCount / 60) * 14);
    } else {
      // A grunt's shot: a coral line with a white core
      p.stroke(...GRUNT_COLORS.shotCore, 210);
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
        p.fill(...TANK_COLORS.amber, alpha);
      } else {
        p.fill(...GRUNT_COLORS.shot, alpha);
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
