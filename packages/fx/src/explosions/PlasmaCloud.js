/**
 * Plasma cloud system for tank death effects
 * Creates dangerous plasma zones that persist and deal area damage
 */
// Requires p5.js for global utility functions: constrain(), random(), lerp(), etc.
import { randomRange as random, sin, dist, TWO_PI } from '@vibe/core';

// Local clamp helper (p5.constrain equivalent)
const clamp = (val, min, max) => (val < min ? min : val > max ? max : val);

export class PlasmaCloud {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 80; // Damage radius
    this.maxRadius = 120; // Visual radius
    this.active = true;
    this.timer = 0;
    this.maxTimer = 300; // 5 seconds at 60fps
    this.damageTimer = 0;
    this.damageInterval = 30; // Damage every 0.5 seconds
    this.damage = 15; // Damage per tick

    // Visual effects
    this.particles = [];
    for (let i = 0; i < 15; i++) {
      this.particles.push({
        angle: random(TWO_PI),
        distance: random(20, this.maxRadius),
        speed: random(0.01, 0.03),
        size: random(3, 8),
        brightness: random(100, 255),
      });
    }
  }

  update() {
    if (!this.active) return null;

    this.timer++;
    this.damageTimer++;

    // Update particles
    for (const particle of this.particles) {
      particle.angle += particle.speed;
      particle.distance += sin(this.timer * 0.05 + particle.angle) * 0.5;
      particle.distance = clamp(particle.distance, 20, this.maxRadius);
    }

    // Check if cloud is finished
    if (this.timer >= this.maxTimer) {
      this.active = false;
      return null;
    }

    // Return damage info if it's time to damage (only while active)
    if (this.damageTimer >= this.damageInterval) {
      this.damageTimer = 0;
      return {
        x: this.x,
        y: this.y,
        radius: this.radius,
        damage: this.damage,
      };
    }

    return null;
  }
  draw(p) {
    if (!this.active) return;

    p.push();
    p.translate(this.x, this.y);

    // Draw pulsing cosmic aurora danger zone
    const pulse = sin(this.timer * 0.1) * 0.3 + 0.7;
    const alpha = p.map(this.timer, 0, this.maxTimer, 150, 50);
    const colorShift = this.timer * 0.02;

    // Outer warning circle - deep pink aurora
    p.fill(255, 20, 147, alpha * 0.3);
    p.noStroke();
    p.ellipse(0, 0, this.maxRadius * 2 * pulse, this.maxRadius * 2 * pulse);

    // Middle aurora ring - blue violet
    p.fill(138, 43, 226, alpha * 0.4);
    p.ellipse(0, 0, this.maxRadius * 1.5 * pulse, this.maxRadius * 1.5 * pulse);

    // Inner damage zone - turquoise energy
    p.fill(64, 224, 208, alpha * 0.5);
    p.ellipse(0, 0, this.radius * 2 * pulse, this.radius * 2 * pulse);

    // Cosmic aurora plasma particles
    for (const particle of this.particles) {
      const x = p.cos(particle.angle) * particle.distance;
      const y = p.sin(particle.angle) * particle.distance;

      // Cycle through cosmic aurora colors
      const colorPhase = (particle.angle + colorShift) % (TWO_PI * 2);
      let particleColor;
      if (colorPhase < TWO_PI * 0.5) {
        particleColor = p.color(138, 43, 226); // Blue violet
      } else if (colorPhase < TWO_PI) {
        particleColor = p.color(64, 224, 208); // Turquoise
      } else if (colorPhase < TWO_PI * 1.5) {
        particleColor = p.color(255, 20, 147); // Deep pink
      } else {
        particleColor = p.color(255, 215, 0); // Gold
      }

      p.fill(
        p.red(particleColor),
        p.green(particleColor),
        p.blue(particleColor),
        particle.brightness * (alpha / 150)
      );
      p.noStroke();
      p.ellipse(x, y, particle.size, particle.size);

      // Enhanced particle glow with aurora colors
      p.fill(
        p.red(particleColor) + 50,
        p.green(particleColor) + 50,
        p.blue(particleColor) + 50,
        particle.brightness * 0.3 * (alpha / 150)
      );
      p.ellipse(x, y, particle.size * 2, particle.size * 2);

      // Add sparkle effect for bright particles
      if (particle.brightness > 200) {
        p.fill(255, 255, 255, particle.brightness * 0.4 * (alpha / 150));
        p.ellipse(x, y, particle.size * 0.5, particle.size * 0.5);
      }
    }

    // Warning text
    if (this.timer < 120) {
      // Show warning for first 2 seconds
      p.fill(255, 255, 255, alpha);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(12);
      p.text('PLASMA HAZARD', 0, -this.maxRadius - 20);
    }

    p.pop();
  }

  checkDamage(target) {
    const distance = dist(this.x, this.y, target.x, target.y);
    return distance < this.radius;
  }
}
