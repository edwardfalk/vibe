/**
 * Basic explosion effects system
 * Handles particle-based explosions for various game events
 */
import { random, TWO_PI } from '../mathUtils.js';
import {
  getExplosionConfig,
  getParticleParams,
  getParticleColor,
} from './ExplosionConfig.js';

/** Max alpha for shockwave stroke fade (100 = full opacity at center) */
const SHOCKWAVE_ALPHA_SCALE = 100;

export class Explosion {
  constructor(x, y, type = 'enemy') {
    this.x = x;
    this.y = y;
    this.type = type;
    this.particles = [];
    this.active = true;
    this.timer = 0;

    const config = getExplosionConfig(type);
    this.maxTimer = config.maxTimer;
    this.screenShake = 0;
    this.flashIntensity = config.flashIntensity;
    this.sparkles = [];
    this.trails = [];

    this.hasShockwave = config.hasShockwave;
    this.shockwaveRadius = 0;
    this.maxShockwaveRadius = config.maxShockwaveRadius;

    this.hasElectricalArcs = false;
    this.hasSpeedTrails = false;
    this.hasArmorFragments = config.hasArmorFragments;
    this.hasBladeFragments = false;
    this.hasEnergyDischarge = config.hasEnergyDischarge;
    this.hasEnergyRings = config.hasEnergyRings;
    this.hasEnergyBlades = false;

    const params = getParticleParams(type);
    const { vxRange, vyRange, sizeRange, lifeRange } = params;

    for (let i = 0; i < config.particleCount; i++) {
      this.particles.push({
        x: x + random(-3, 3),
        y: y + random(-3, 3),
        vx: random(vxRange[0], vxRange[1]),
        vy: random(vyRange[0], vyRange[1]),
        size: random(sizeRange[0], sizeRange[1]),
        color: getParticleColor(type),
        life: random(lifeRange[0], lifeRange[1]),
        maxLife: random(lifeRange[0], lifeRange[1]),
        rotation: random(TWO_PI),
        rotationSpeed: random(-0.2, 0.2),
        trail: [],
        gravity: random(0.01, 0.05),
        friction: random(0.99, 0.998),
        glow: random(0.2, 0.5),
        sparkle: random() < 0.1,
        isArmor: false,
      });
    }

    if (config.hasArmorFragments) {
      this.createArmorFragments();
    }
    if (config.hasEnergyRings) {
      this.createEnergyRings();
    }
  }

  createArmorFragments() {
    for (let i = 0; i < 5; i++) {
      this.particles.push({
        x: this.x + random(-10, 10),
        y: this.y + random(-10, 10),
        vx: random(-3, 3),
        vy: random(-2, 4),
        size: random(8, 16),
        color: [100, 100, 120],
        life: random(60, 90),
        maxLife: random(60, 90),
        rotation: random(TWO_PI),
        rotationSpeed: random(-0.2, 0.2),
        trail: [],
        gravity: 0.15,
        friction: 0.95,
        glow: 0.2,
        sparkle: false,
        isArmor: true,
      });
    }
  }

  createEnergyRings() {
    for (let i = 0; i < 3; i++) {
      this.sparkles.push({
        x: this.x,
        y: this.y,
        radius: 10 + i * 15,
        maxRadius: 80 + i * 20,
        life: random(40, 60),
        maxLife: random(40, 60),
        intensity: random(0.6, 0.9),
        type: 'energyRing',
        ringIndex: i,
      });
    }
  }

  update() {
    this.timer++;

    if (this.hasShockwave && this.shockwaveRadius < this.maxShockwaveRadius) {
      this.shockwaveRadius += this.maxShockwaveRadius / 20;
      if (this.shockwaveRadius >= this.maxShockwaveRadius) {
        this.shockwaveRadius = this.maxShockwaveRadius;
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.life--;

      if (p.trail.length > 5) p.trail.shift();
      p.trail.push({ x: p.x, y: p.y, alpha: p.life / p.maxLife });

      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.life--;
      if (s.type === 'energyRing') {
        s.radius += (s.maxRadius - s.radius) * 0.1;
        if (s.radius >= s.maxRadius) s.radius = s.maxRadius;
      }
      if (s.life <= 0) this.sparkles.splice(i, 1);
    }

    const shockwaveFinished =
      !this.hasShockwave || this.shockwaveRadius >= this.maxShockwaveRadius;
    const timerExpired = this.timer >= this.maxTimer;
    const noParticles = this.particles.length === 0;
    const noSparkles = this.sparkles.length === 0;

    if (
      (timerExpired && noParticles && noSparkles) ||
      (shockwaveFinished && noParticles && noSparkles && this.timer > 20)
    ) {
      this.active = false;
    }
  }

  draw(p) {
    p.push();

    if (this.hasShockwave && this.shockwaveRadius > 0) {
      p.stroke(
        255,
        255,
        255,
        SHOCKWAVE_ALPHA_SCALE *
          (1 - this.shockwaveRadius / this.maxShockwaveRadius)
      );
      p.strokeWeight(3);
      p.noFill();
      p.ellipse(this.x, this.y, this.shockwaveRadius * 2);
    }

    for (const s of this.sparkles) {
      if (s.type === 'energyRing') {
        const alpha = (s.life / s.maxLife) * s.intensity * 255;
        p.stroke(138, 43, 226, alpha);
        p.strokeWeight(2 + s.ringIndex);
        p.noFill();
        p.ellipse(s.x, s.y, s.radius * 2);
      }
    }

    for (const particle of this.particles) {
      const alpha = (particle.life / particle.maxLife) * 255;
      const r = Array.isArray(particle.color)
        ? particle.color[0]
        : p.red(particle.color);
      const g = Array.isArray(particle.color)
        ? particle.color[1]
        : p.green(particle.color);
      const b = Array.isArray(particle.color)
        ? particle.color[2]
        : p.blue(particle.color);

      if (particle.glow > 0) {
        p.fill(r, g, b, alpha * particle.glow * 0.3);
        p.noStroke();
        p.ellipse(particle.x, particle.y, particle.size * 2);
      }

      p.fill(r, g, b, alpha);
      p.noStroke();

      if (particle.isArmor) {
        p.push();
        p.translate(particle.x, particle.y);
        p.rotate(particle.rotation);
        p.rect(
          -particle.size / 2,
          -particle.size / 2,
          particle.size,
          particle.size
        );
        p.pop();
      } else if (particle.sparkle) {
        p.push();
        p.translate(particle.x, particle.y);
        p.rotate(particle.rotation);
        p.stroke(r, g, b, alpha);
        p.strokeWeight(1);
        p.line(-particle.size, 0, particle.size, 0);
        p.line(0, -particle.size, 0, particle.size);
        p.pop();
      } else {
        p.push();
        p.translate(particle.x, particle.y);
        p.rotate(particle.rotation);
        p.triangle(
          0,
          -particle.size,
          -particle.size * 0.8,
          particle.size * 0.5,
          particle.size * 0.8,
          particle.size * 0.5
        );
        p.pop();
      }

      if (particle.trail.length > 1) {
        p.stroke(r, g, b, alpha * 0.5);
        p.strokeWeight(1);
        p.noFill();
        p.beginShape();
        for (const t of particle.trail) {
          p.vertex(t.x, t.y);
        }
        p.endShape();
      }
    }

    p.pop();
  }
}
