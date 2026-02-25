/**
 * Effects manager: screen shake, particles, trails, screen flash.
 * Requires p5.js instance mode.
 */

import { max, random, sin, cos, lerp, TWO_PI } from '../mathUtils.js';

const SHAKE_MAX_DURATION_FRAMES = 30;
const SCREEN_FLASH_MAX_FRAMES = 10;

class EffectsManager {
  constructor() {
    this.shake = {
      intensity: 0,
      duration: 0,
      x: 0,
      y: 0,
    };

    this.particles = [];
    this.trails = [];

    this.screenFlash = {
      intensity: 0,
      color: [255, 255, 255],
      duration: 0,
    };

    this.timeScale = 1.0;
    this.targetTimeScale = 1.0;
  }

  update() {
    if (this.shake.duration > 0) {
      this.shake.duration--;
      const progress = this.shake.duration / SHAKE_MAX_DURATION_FRAMES;
      const currentIntensity = this.shake.intensity * progress;

      this.shake.x = (random() - 0.5) * currentIntensity;
      this.shake.y = (random() - 0.5) * currentIntensity;
    } else {
      this.shake.x = 0;
      this.shake.y = 0;
    }

    if (this.screenFlash.duration > 0) {
      this.screenFlash.duration--;
      this.screenFlash.intensity =
        this.screenFlash.duration / SCREEN_FLASH_MAX_FRAMES;
    }

    this.timeScale = lerp(this.timeScale, this.targetTimeScale, 0.1);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.update();

      if (particle.isDead()) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      trail.update();

      if (trail.isDead()) {
        this.trails.splice(i, 1);
      }
    }
  }

  draw(p) {
    p.push();
    p.translate(this.shake.x, this.shake.y);

    for (const trail of this.trails) {
      trail.draw(p);
    }

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

    p.pop();
  }

  drawParticles(p) {
    for (const particle of this.particles) {
      particle.draw(p);
    }
  }

  drawScreenEffects(p) {
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
  }

  addShake(intensity, duration = 20) {
    this.shake.intensity = max(this.shake.intensity, intensity);
    this.shake.duration = max(this.shake.duration, duration);
  }

  addScreenFlash(color = [255, 255, 255], duration = 8) {
    this.screenFlash.color = color;
    this.screenFlash.duration = duration;
    this.screenFlash.intensity = 1.0;
  }

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

  setSlowMotion(scale = 0.3, duration = 60) {
    this.targetTimeScale = scale;
    setTimeout(() => {
      this.targetTimeScale = 1.0;
    }, duration * 16.67);
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
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.vy += 0.1;
    this.life--;
    this.rotation += this.rotationSpeed;

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

    for (let i = 0; i < segments; i++) {
      this.points.push({
        x: x - cos(angle) * i * 3,
        y: y - sin(angle) * i * 3,
        life: segments - i,
      });
    }
  }

  update() {
    for (const point of this.points) {
      point.life--;
    }

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

export { EffectsManager };
