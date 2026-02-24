/**
 * Effects System for Vibe - Screen shake, particles, and visual polish
 */

// Requires p5.js in instance mode: all p5 functions/vars must use the 'p' parameter (e.g., p.ellipse, p.fill)

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
  lerp,
  TWO_PI,
} from './mathUtils.js';
import { drawGlow } from './visualEffects.js';
import { FloatingTextPool } from './FloatingTextPool.js';

class EffectsManager {
  constructor() {
    // Screen shake system
    this.shake = {
      intensity: 0,
      duration: 0,
      x: 0,
      y: 0,
    };

    // Particle systems
    this.particles = [];
    this.trails = [];

    // Screen flash effects
    this.screenFlash = {
      intensity: 0,
      color: [255, 255, 255],
      duration: 0,
    };

    // Time scaling for slow motion
    this.timeScale = 1.0;
    this.targetTimeScale = 1.0;
  }

  update() {
    // Update screen shake
    if (this.shake.duration > 0) {
      this.shake.duration--;
      const progress = this.shake.duration / 30; // 30 frame max duration
      const currentIntensity = this.shake.intensity * progress;

      this.shake.x = (random() - 0.5) * currentIntensity;
      this.shake.y = (random() - 0.5) * currentIntensity;
    } else {
      this.shake.x = 0;
      this.shake.y = 0;
    }

    // Update screen flash
    if (this.screenFlash.duration > 0) {
      this.screenFlash.duration--;
      this.screenFlash.intensity = this.screenFlash.duration / 10; // 10 frame max
    }

    // Update time scale smoothly
    this.timeScale = lerp(this.timeScale, this.targetTimeScale, 0.1);

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.update();

      if (particle.isDead()) {
        this.particles.splice(i, 1);
      }
    }

    // Update trails
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      trail.update();

      if (trail.isDead()) {
        this.trails.splice(i, 1);
      }
    }
  }

  draw(p) {
    // Apply screen shake
    p.push();
    p.translate(this.shake.x, this.shake.y);

    // Draw trails first (behind everything)
    for (const trail of this.trails) {
      trail.draw(p);
    }

    // Draw screen flash
    if (this.screenFlash.duration > 0) {
      p.fill(
        this.screenFlash.color[0],
        this.screenFlash.color[1],
        this.screenFlash.color[2],
        this.screenFlash.intensity * 100
      );
      p.noStroke();
      p.rect(-this.shake.x, -this.shake.y, p.width, p.height);
    }

    p.pop(); // End screen shake translation
  }

  drawParticles(p) {
    // Draw particles (in front of game objects)
    for (const particle of this.particles) {
      particle.draw(p);
    }
  }

  drawScreenEffects(p) {
    // Draw screen flash
    if (this.screenFlash.duration > 0) {
      p.fill(
        this.screenFlash.color[0],
        this.screenFlash.color[1],
        this.screenFlash.color[2],
        this.screenFlash.intensity * 100
      );
      p.noStroke();
      p.rect(-this.shake.x, -this.shake.y, p.width, p.height);
    }

    p.pop(); // End screen shake translation
  }

  // Screen shake methods
  addShake(intensity, duration = 20) {
    this.shake.intensity = max(this.shake.intensity, intensity);
    this.shake.duration = max(this.shake.duration, duration);
  }

  addScreenFlash(color = [255, 255, 255], duration = 8) {
    this.screenFlash.color = color;
    this.screenFlash.duration = duration;
    this.screenFlash.intensity = 1.0;
  }

  // Particle methods
  addExplosionParticles(x, y, count = 20, type = 'normal') {
    const colors =
      type === 'enemy'
        ? [
            [255, 100, 100],
            [255, 150, 50],
            [255, 200, 100],
          ]
        : [
            [100, 150, 255],
            [150, 200, 255],
            [200, 220, 255],
          ];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TWO_PI + random(-0.3, 0.3);
      const speed = random(2, 8);
      const size = random(3, 8);
      const color = random(colors);

      this.particles.push(new Particle(x, y, angle, speed, size, color, 60));
    }
  }

  addBulletTrail(x, y, angle, type = 'player') {
    const color = type === 'player' ? [100, 200, 255] : [255, 100, 150];
    this.trails.push(new Trail(x, y, angle, color, 15));
  }

  // Time effects
  setSlowMotion(scale = 0.3, duration = 60) {
    this.targetTimeScale = scale;
    setTimeout(() => {
      this.targetTimeScale = 1.0;
    }, duration * 16.67); // Convert frames to milliseconds
  }

  getTimeScale() {
    return this.timeScale;
  }
}

class Particle {
  constructor(x, y, angle, speed, size, color, life) {
    this.x = x;
    this.y = y;
    this.vx = cos(angle) * speed;
    this.vy = sin(angle) * speed;
    this.size = size;
    this.maxSize = size;
    this.color = color;
    this.life = life;
    this.maxLife = life;
    this.rotation = random(TWO_PI);
    this.rotationSpeed = random(-0.2, 0.2);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.95; // Slow down over time
    this.vy *= 0.95;
    this.vy += 0.1; // Gravity
    this.life--;
    this.rotation += this.rotationSpeed;

    // Shrink over time
    const lifePercent = this.life / this.maxLife;
    this.size = this.maxSize * lifePercent;
  }

  draw(p) {
    const lifePercent = this.life / this.maxLife;
    const alpha = lifePercent * 255;

    p.push();
    p.translate(this.x, this.y);
    p.rotate(this.rotation);

    p.fill(this.color[0], this.color[1], this.color[2], alpha);
    p.noStroke();

    // Draw as a small polygon for more interesting shapes
    p.beginShape();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * p.TWO_PI;
      const radius = i % 2 === 0 ? this.size : this.size * 0.6;
      const x = p.cos(angle) * radius;
      const y = p.sin(angle) * radius;
      p.vertex(x, y);
    }
    p.endShape(p.CLOSE);

    p.pop();
  }

  isDead() {
    return this.life <= 0;
  }
}

class Trail {
  constructor(x, y, angle, color, segments) {
    this.points = [];
    this.color = color;
    this.maxSegments = segments;

    // Initialize trail points
    for (let i = 0; i < segments; i++) {
      this.points.push({
        x: x - cos(angle) * i * 3,
        y: y - sin(angle) * i * 3,
        life: segments - i,
      });
    }
  }

  update() {
    // Fade all points
    for (const point of this.points) {
      point.life--;
    }

    // Remove dead points
    this.points = this.points.filter((point) => point.life > 0);
  }

  draw(p) {
    if (this.points.length < 2) return;

    p.noFill();
    for (let i = 1; i < this.points.length; i++) {
      const point = this.points[i];
      const prevPoint = this.points[i - 1];
      const alpha = (point.life / this.maxSegments) * 150;
      const thickness = (point.life / this.maxSegments) * 3;

      p.stroke(this.color[0], this.color[1], this.color[2], alpha);
      p.strokeWeight(thickness);
      p.line(prevPoint.x, prevPoint.y, point.x, point.y);
    }
  }

  isDead() {
    return this.points.length === 0;
  }
}

// Enhanced explosion manager with better effects
class EnhancedExplosionManager {
  constructor(context = null) {
    this.context = context;
    this.explosions = [];
  }

  _getEffects() {
    const vfx =
      this.context?.get?.('visualEffectsManager') ??
      window.visualEffectsManager;
    const cam = this.context?.get?.('cameraSystem') ?? window.cameraSystem;
    return { visualEffectsManager: vfx, cameraSystem: cam };
  }

  addExplosion(x, y, type = 'normal', size = 1.0) {
    this.explosions.push(new EnhancedExplosion(x, y, type, size));

    const { visualEffectsManager, cameraSystem } = this._getEffects();
    if (visualEffectsManager) {
      if (type === 'enemy') {
        if (cameraSystem) cameraSystem.addShake(8, 15);
        visualEffectsManager.addExplosionParticles(x, y, 'enemy');
      } else if (type === 'rusher-explosion') {
        if (cameraSystem) cameraSystem.addShake(15, 25);
        visualEffectsManager.addExplosionParticles(x, y, 'rusher-explosion');
      } else {
        if (cameraSystem) cameraSystem.addShake(4, 10);
        visualEffectsManager.addExplosionParticles(x, y);
      }
    }
  }

  update() {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].update();
      if (this.explosions[i].isDead()) {
        this.explosions.splice(i, 1);
      }
    }
  }

  draw(p) {
    for (const explosion of this.explosions) {
      explosion.draw(p);
    }
  }
}

class EnhancedExplosion {
  constructor(x, y, type, size) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.size = size;
    this.life = 30;
    this.maxLife = 30;
    this.rings = [];

    // Create multiple expanding rings
    const ringCount = type === 'rusher-explosion' ? 4 : 2;
    for (let i = 0; i < ringCount; i++) {
      this.rings.push({
        radius: 0,
        maxRadius: (20 + i * 15) * size,
        speed: 2 + i * 0.5,
        color: type === 'enemy' ? [255, 100, 50] : [100, 150, 255],
        delay: i * 5,
      });
    }
  }

  update() {
    this.life--;

    for (const ring of this.rings) {
      if (this.life < this.maxLife - ring.delay) {
        ring.radius += ring.speed;
      }
    }
  }

  draw(p) {
    const lifePercent = this.life / this.maxLife;

    p.push();
    p.translate(this.x, this.y);

    for (const ring of this.rings) {
      if (ring.radius > 0) {
        const alpha =
          max(0, 1 - ring.radius / ring.maxRadius) * lifePercent * 100;
        p.fill(ring.color[0], ring.color[1], ring.color[2], alpha);
        p.noStroke();
        p.ellipse(0, 0, ring.radius * 2);

        // Inner bright core
        if (ring.radius < ring.maxRadius * 0.3) {
          p.fill(255, 255, 255, alpha * 0.8);
          p.ellipse(0, 0, ring.radius);
        }
      }
    }

    if (this.type === 'energy') {
      drawGlow(p, this.x, this.y, this.size * 2, p.color(100, 255, 255), 0.7);
    } else if (this.type === 'debris') {
      drawGlow(p, this.x, this.y, this.size * 1.5, p.color(200, 200, 200), 0.3);
    }

    p.pop();
  }

  isDead() {
    return this.life <= 0;
  }
}

/**
 * Floating text system for damage numbers, kill text, combo indicators.
 * Rendered in world space (inside camera transform).
 * Enhanced with momentum physics, merging, and beat-synced effects.
 */
class FloatingTextManager {
  constructor(context = null) {
    this.context = context;
    this.texts = [];
    this.textPool = new FloatingTextPool(200);
    this.damageMergeRadius = 60; // Distance to merge damage numbers
    this.lastDamageTime = 0;
    this.damageAccumulator = 0;
    this.accumulatorPos = { x: 0, y: 0 };
    this.accumulatorTimer = 0;
  }

  acquireText(initialState) {
    return this.textPool.acquire(initialState);
  }

  releaseText(text) {
    this.textPool.release(text);
  }

  addDamage(x, y, amount) {
    // Damage accumulation: if damage happens close in time and space, merge it
    const now = Date.now();
    const timeSinceLast = now - this.lastDamageTime;
    const distFromLast = Math.sqrt(
      Math.pow(x - this.accumulatorPos.x, 2) +
        Math.pow(y - this.accumulatorPos.y, 2)
    );

    if (
      timeSinceLast < 300 &&
      distFromLast < this.damageMergeRadius &&
      this.damageAccumulator > 0
    ) {
      // Merge with accumulated damage
      this.damageAccumulator += amount;
      this.accumulatorPos.x = (this.accumulatorPos.x + x) / 2;
      this.accumulatorPos.y = (this.accumulatorPos.y + y) / 2;
      this.accumulatorTimer = 10; // Reset accumulator timer

      // Find and update the existing accumulated text
      const existing = this.texts.find((t) => t.isAccumulated);
      if (existing) {
        existing.text = `-${this.damageAccumulator}`;
        existing.size = 14 + Math.min(this.damageAccumulator * 1.5, 16);
        existing.life = 40; // Refresh life
        existing.x = this.accumulatorPos.x;
        existing.y = this.accumulatorPos.y;
      }
    } else {
      // Create new damage text
      this.damageAccumulator = amount;
      this.accumulatorPos = { x, y };
      this.accumulatorTimer = 10;

      const beatClock = this.context?.get?.('beatClock') ?? window.beatClock;
      const beatPulse = beatClock ? beatClock.getBeatIntensity(8) : 0;
      const isOnBeat = beatPulse > 0.5;

      this.texts.push(
        this.acquireText({
          x,
          y,
          text: `-${amount}`,
          color: isOnBeat ? [255, 150, 150] : [255, 255, 255], // Warm on beat
          size: 14 + Math.min(amount * 2, 10) + (isOnBeat ? 3 : 0),
          vy: -2 - Math.min(amount * 0.1, 1), // Faster for bigger damage
          vx: (Math.random() - 0.5) * 0.5, // Slight horizontal drift
          life: 40,
          maxLife: 40,
          isAccumulated: true,
          momentum: 1.0, // Physics momentum
        })
      );
    }

    this.lastDamageTime = now;
  }

  addKill(x, y, enemyType, streak = 0) {
    const typeColors = {
      grunt: [50, 255, 50],
      rusher: [255, 50, 150],
      tank: [150, 100, 255],
      stabber: [255, 215, 0],
    };
    const color = typeColors[enemyType] || [255, 255, 255];

    const beatClock = this.context?.get?.('beatClock') ?? window.beatClock;
    const beatPulse = beatClock ? beatClock.getBeatIntensity(6) : 0;
    const sizeBonus = streak >= 5 ? 4 : streak >= 3 ? 2 : 0;

    this.texts.push(
      this.acquireText({
        x,
        y: y - 10,
        text: 'KILL!',
        color,
        size: 18 + sizeBonus + beatPulse * 2,
        vy: -2.5,
        vx: 0,
        life: 50,
        maxLife: 50,
        scale: 1.5, // Start bigger and shrink
        targetScale: 1.0,
        isKill: true,
        momentum: 0.95,
      })
    );

    if (streak >= 3) {
      // Streak text with dramatic entrance
      this.texts.push(
        this.acquireText({
          x,
          y: y - 35,
          text: `${streak}x STREAK!`,
          color: [255, 200, 50],
          size: 14 + Math.min(streak, 8) + beatPulse * 2,
          vy: -3,
          vx: 0,
          life: 70,
          maxLife: 70,
          scale: 0.5, // Start small and grow
          targetScale: 1.2,
          isStreak: true,
          momentum: 0.92,
        })
      );

      // Add sparkle effect text for high streaks
      if (streak >= 5) {
        this.texts.push(
          this.acquireText({
            x: x + 30,
            y: y - 35,
            text: '✦',
            color: [255, 255, 100],
            size: 20,
            vy: -2,
            vx: 0.5,
            life: 40,
            maxLife: 40,
            scale: 1,
            momentum: 0.9,
            rotate: true,
            rotation: 0,
          })
        );
      }
    }
  }

  addScorePopup(x, y, score, isCombo = false) {
    const beatClock = this.context?.get?.('beatClock') ?? window.beatClock;
    const beatPulse = beatClock ? beatClock.getBeatIntensity(6) : 0;

    this.texts.push(
      this.acquireText({
        x,
        y,
        text: `+${score}`,
        color: isCombo ? [255, 215, 0] : [100, 255, 100],
        size: isCombo ? 20 : 16,
        vy: -2.2,
        vx: Math.random() - 0.5,
        life: 50,
        maxLife: 50,
        scale: 0.8 + beatPulse * 0.2,
        targetScale: 1.0,
        momentum: 0.96,
        isScore: true,
      })
    );
  }

  addText(x, y, text, color = [255, 255, 255], size = 14) {
    this.texts.push(
      this.acquireText({
        x,
        y,
        text,
        color,
        size,
        vy: -1.5,
        vx: 0,
        life: 45,
        maxLife: 45,
        scale: 1,
        momentum: 0.98,
      })
    );
  }

  update() {
    // Decrease accumulator timer
    if (this.accumulatorTimer > 0) {
      this.accumulatorTimer--;
      if (this.accumulatorTimer <= 0) {
        this.damageAccumulator = 0;
      }
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];

      // Apply velocity with momentum
      t.y += t.vy;
      t.x += t.vx || 0;

      // Apply momentum (deceleration)
      if (t.momentum) {
        t.vy *= t.momentum;
        if (t.vx) t.vx *= t.momentum;
      } else {
        t.vy *= 0.97;
        if (t.vx) t.vx *= 0.97;
      }

      // Scale animation (pop in/out)
      if (t.targetScale !== undefined && t.scale !== undefined) {
        t.scale += (t.targetScale - t.scale) * 0.15;
      }

      // Rotation for sparkle effects
      if (t.rotate) {
        t.rotation = (t.rotation || 0) + 0.1;
      }

      t.life--;
      if (t.life <= 0) {
        const lastIndex = this.texts.length - 1;
        this.releaseText(t);
        if (i !== lastIndex) {
          this.texts[i] = this.texts[lastIndex];
        }
        this.texts.pop();
      }
    }
  }

  draw(p) {
    for (const t of this.texts) {
      const lifePercent = t.life / t.maxLife;
      const alpha = lifePercent * 255;

      // Fade out in last 20% of life
      const fadeStart = 0.2;
      let displayAlpha = alpha;
      if (lifePercent < fadeStart) {
        displayAlpha = alpha * (lifePercent / fadeStart);
      }

      // Scale with life for pop effect
      let displayScale = t.scale || 1;
      if (lifePercent > 0.8 && t.isKill) {
        // Initial pop for kills
        displayScale = 1 + (1 - lifePercent) * 0.5;
      }

      p.push();
      p.translate(t.x, t.y);
      p.scale(displayScale);

      if (t.rotate && t.rotation) {
        p.rotate(t.rotation);
      }

      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(t.size);

      // Drop shadow
      p.fill(0, 0, 0, displayAlpha * 0.5);
      p.noStroke();
      p.text(t.text, 2, 2);

      // Main text
      p.fill(t.color[0], t.color[1], t.color[2], displayAlpha);
      p.text(t.text, 0, 0);

      // Glow for streaks and combos
      if (t.isStreak || t.isKill) {
        p.fill(t.color[0], t.color[1], t.color[2], displayAlpha * 0.3);
        p.text(t.text, 0, 0);
      }

      p.pop();
    }
  }
}

export { EffectsManager, FloatingTextManager };
