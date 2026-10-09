/**
 * Basic explosion effects system
 * Handles particle-based explosions for various game events
 */
import { random, TWO_PI } from '../../mathUtils.js';
import {
  getExplosionConfig,
  getParticleParams,
  getParticleColor,
} from './ExplosionConfig.js';

const MIN_FRAMES = 20; // an explosion shows at least this long

export class Explosion {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.particles = [];
    this.active = true;
    this.timer = 0;

    const config = getExplosionConfig(type);
    this.maxTimer = config.maxTimer;

    const params = getParticleParams(type);
    const { vxRange, vyRange, sizeRange, lifeRange } = params;

    for (let i = 0; i < config.particleCount; i++) {
      const life = random(lifeRange[0], lifeRange[1]);
      this.particles.push({
        x: x + random(-3, 3),
        y: y + random(-3, 3),
        vx: random(vxRange[0], vxRange[1]),
        vy: random(vyRange[0], vyRange[1]),
        size: random(sizeRange[0], sizeRange[1]),
        color: getParticleColor(type),
        life,
        maxLife: life,
        rotation: random(TWO_PI),
        rotationSpeed: random(-0.2, 0.2),
        trail: [],
        gravity: random(0.01, 0.05),
        friction: random(0.99, 0.998),
        glow: random(0.2, 0.5),
        sparkle: random() < 0.1,
      });
    }
  }

  update() {
    this.timer++;

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
      p.trail.push({ x: p.x, y: p.y });

      if (p.life <= 0) this.particles.splice(i, 1);
    }

    const timerExpired = this.timer >= this.maxTimer;
    const noParticles = this.particles.length === 0;
    // Gone with its particles, once it has shown for MIN_FRAMES (or its timer)
    if (noParticles && (timerExpired || this.timer > MIN_FRAMES)) {
      this.active = false;
    }
  }

  draw(p) {
    p.push();

    for (const particle of this.particles) {
      const alpha = (particle.life / particle.maxLife) * 255;
      const [r, g, b] = particle.color;

      if (particle.glow > 0) {
        p.fill(r, g, b, alpha * particle.glow * 0.3);
        p.noStroke();
        p.ellipse(particle.x, particle.y, particle.size * 2);
      }

      p.fill(r, g, b, alpha);
      p.noStroke();

      if (particle.sparkle) {
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
