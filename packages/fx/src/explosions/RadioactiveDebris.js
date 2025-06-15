// Requires p5.js for global utility functions: constrain(), random(), lerp(), etc.
import { randomRange as random, sin, dist, TWO_PI } from '@vibe/core';

// Local clamp helper (p5.constrain equivalent)
const clamp = (val, min, max) => (val < min ? min : val > max ? max : val);

/**
 * Radioactive debris system for bomb explosion effects
 * Creates long-lasting contamination zones with lower damage than plasma clouds
 */
export class RadioactiveDebris {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 60; // Damage radius - smaller than plasma clouds
    this.maxRadius = 90; // Visual radius
    this.active = true;
    this.timer = 0;
    this.maxTimer = 900; // 15 seconds at 60fps - longer than plasma clouds
    this.damageTimer = 0;
    this.damageInterval = 45; // Damage every 0.75 seconds - slower than plasma
    this.damage = 8; // Lower damage per tick than plasma

    // Visual effects - radioactive particles
    this.particles = [];
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        angle: random(TWO_PI),
        distance: random(15, this.maxRadius),
        speed: random(0.005, 0.015), // Slower than plasma
        size: random(2, 6),
        brightness: random(80, 200),
        glowPhase: random(TWO_PI), // For pulsing glow effect
      });
    }
  }

  update() {
    this.timer++;
    this.damageTimer++;

    // Update particles with radioactive drift
    for (const particle of this.particles) {
      particle.angle += particle.speed;
      particle.glowPhase += 0.08; // Pulsing glow
      // Radioactive particles drift outward slowly
      particle.distance += sin(this.timer * 0.02 + particle.angle) * 0.3;
      particle.distance = clamp(particle.distance, 15, this.maxRadius);
    }

    // Check if debris is finished
    if (this.timer >= this.maxTimer) {
      this.active = false;
    }

    // Return damage info if it's time to damage
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

    // Radioactive pulsing effect
    const pulse = sin(this.timer * 0.15) * 0.2 + 0.8;
    const alpha = p.map(this.timer, 0, this.maxTimer, 120, 30); // Fades slower than plasma
    const radioactiveShift = this.timer * 0.03;

    // Outer radioactive warning zone - sickly green
    p.fill(50, 205, 50, alpha * 0.25);
    p.noStroke();
    p.ellipse(0, 0, this.maxRadius * 2 * pulse);

    // Middle contamination ring - yellow-green
    p.fill(154, 205, 50, alpha * 0.35);
    p.ellipse(0, 0, this.maxRadius * 1.4 * pulse);

    // Inner damage zone - bright toxic yellow
    p.fill(255, 255, 0, alpha * 0.4);
    p.ellipse(0, 0, this.radius * 2 * pulse);

    // Radioactive debris particles
    for (const particle of this.particles) {
      const x = p.cos(particle.angle) * particle.distance;
      const y = p.sin(particle.angle) * particle.distance;

      // Cycle through radioactive colors (green/yellow spectrum)
      const colorPhase = (particle.angle + radioactiveShift) % TWO_PI;
      let particleColor;
      if (colorPhase < TWO_PI * 0.33) {
        particleColor = p.color(50, 205, 50); // Lime green
      } else if (colorPhase < TWO_PI * 0.66) {
        particleColor = p.color(255, 255, 0); // Yellow
      } else {
        particleColor = p.color(154, 205, 50); // Yellow-green
      }

      // Pulsing glow effect
      const glowIntensity = p.sin(particle.glowPhase) * 0.3 + 0.7;

      p.fill(
        p.red(particleColor),
        p.green(particleColor),
        p.blue(particleColor),
        particle.brightness * glowIntensity * (alpha / 120)
      );
      p.noStroke();
      p.ellipse(x, y, particle.size);

      // Radioactive glow
      p.fill(
        p.red(particleColor) + 30,
        p.green(particleColor) + 30,
        p.blue(particleColor) + 30,
        particle.brightness * 0.4 * glowIntensity * (alpha / 120)
      );
      p.ellipse(x, y, particle.size * 1.8);

      // Bright radioactive core for intense particles
      if (particle.brightness > 150) {
        p.fill(
          255,
          255,
          255,
          particle.brightness * 0.5 * glowIntensity * (alpha / 120)
        );
        p.ellipse(x, y, particle.size * 0.4);
      }
    }

    // Warning text with radioactive symbol
    if (this.timer < 180) {
      // Show warning for first 3 seconds
      p.fill(255, 255, 0, alpha);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(10);
      p.text('☢ RADIOACTIVE DEBRIS ☢', 0, -this.maxRadius - 15);
    }

    p.pop();
  }

  checkDamage(target) {
    const distance = dist(this.x, this.y, target.x, target.y);
    return distance < this.radius;
  }
}
