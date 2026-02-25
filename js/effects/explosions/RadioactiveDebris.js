/**
 * Radioactive debris system for bomb explosion effects
 * Creates long-lasting contamination zones with lower damage than plasma clouds
 */
import { random, TWO_PI, sin, cos, constrain, dist } from '../../mathUtils.js';

export class RadioactiveDebris {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 60;
    this.maxRadius = 90;
    this.active = true;
    this.timer = 0;
    this.maxTimer = 900;
    this.damageTimer = 0;
    this.damageInterval = 45;
    this.damage = 8;

    this.particles = [];
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        angle: random(TWO_PI),
        distance: random(15, this.maxRadius),
        speed: random(0.005, 0.015),
        size: random(2, 6),
        brightness: random(80, 200),
        glowPhase: random(TWO_PI),
      });
    }
  }

  update() {
    this.timer++;
    this.damageTimer++;

    for (const pt of this.particles) {
      pt.angle += pt.speed;
      pt.glowPhase += 0.08;
      pt.distance += sin(this.timer * 0.02 + pt.angle) * 0.3;
      pt.distance = constrain(pt.distance, 15, this.maxRadius);
    }

    if (this.timer >= this.maxTimer) {
      this.active = false;
      return null;
    }

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

    const pulse = sin(this.timer * 0.15) * 0.2 + 0.8;
    const alpha = p.map(this.timer, 0, this.maxTimer, 120, 30);
    const radioactiveShift = this.timer * 0.03;

    p.fill(50, 205, 50, alpha * 0.25);
    p.noStroke();
    p.ellipse(0, 0, this.maxRadius * 2 * pulse);

    p.fill(154, 205, 50, alpha * 0.35);
    p.ellipse(0, 0, this.maxRadius * 1.4 * pulse);

    p.fill(255, 255, 0, alpha * 0.4);
    p.ellipse(0, 0, this.radius * 2 * pulse);

    for (const pt of this.particles) {
      const px = cos(pt.angle) * pt.distance;
      const py = sin(pt.angle) * pt.distance;

      const colorPhase = (pt.angle + radioactiveShift) % TWO_PI;
      let cr, cg, cb;
      if (colorPhase < TWO_PI * 0.33) {
        cr = 50;
        cg = 205;
        cb = 50;
      } else if (colorPhase < TWO_PI * 0.66) {
        cr = 255;
        cg = 255;
        cb = 0;
      } else {
        cr = 154;
        cg = 205;
        cb = 50;
      }

      const glowIntensity = sin(pt.glowPhase) * 0.3 + 0.7;

      p.fill(cr, cg, cb, pt.brightness * glowIntensity * (alpha / 120));
      p.noStroke();
      p.ellipse(px, py, pt.size);

      p.fill(
        Math.min(cr + 30, 255),
        Math.min(cg + 30, 255),
        Math.min(cb + 30, 255),
        pt.brightness * 0.4 * glowIntensity * (alpha / 120)
      );
      p.ellipse(px, py, pt.size * 1.8);

      if (pt.brightness > 150) {
        p.fill(
          255,
          255,
          255,
          pt.brightness * 0.5 * glowIntensity * (alpha / 120)
        );
        p.ellipse(px, py, pt.size * 0.4);
      }
    }

    if (this.timer < 180) {
      p.fill(255, 255, 0, alpha);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(10);
      p.text('☢ RADIOACTIVE DEBRIS ☢', 0, -this.maxRadius - 15);
    }

    p.pop();
  }

  checkDamage(target) {
    if (!this.active) return false;
    const distance = dist(this.x, this.y, target.x, target.y);
    return distance < this.radius;
  }
}
