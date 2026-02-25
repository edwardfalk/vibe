/**
 * Plasma cloud system for tank death effects
 * Creates dangerous plasma zones that persist and deal area damage
 */
import { random, TWO_PI, sin, cos, constrain, dist } from '../../mathUtils.js';

export class PlasmaCloud {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 80;
    this.maxRadius = 120;
    this.active = true;
    this.timer = 0;
    this.maxTimer = 300;
    this.damageTimer = 0;
    this.damageInterval = 30;
    this.damage = 15;

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
    this.timer++;
    this.damageTimer++;

    for (const pt of this.particles) {
      pt.angle += pt.speed;
      pt.distance += sin(this.timer * 0.05 + pt.angle) * 0.5;
      pt.distance = constrain(pt.distance, 20, this.maxRadius);
    }

    if (this.timer >= this.maxTimer) {
      this.active = false;
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

    const pulse = sin(this.timer * 0.1) * 0.3 + 0.7;
    const alpha = p.map(this.timer, 0, this.maxTimer, 150, 50);
    const colorShift = this.timer * 0.02;

    p.fill(255, 20, 147, alpha * 0.3);
    p.noStroke();
    p.ellipse(0, 0, this.maxRadius * 2 * pulse);

    p.fill(138, 43, 226, alpha * 0.4);
    p.ellipse(0, 0, this.maxRadius * 1.5 * pulse);

    p.fill(64, 224, 208, alpha * 0.5);
    p.ellipse(0, 0, this.radius * 2 * pulse);

    for (const pt of this.particles) {
      const px = cos(pt.angle) * pt.distance;
      const py = sin(pt.angle) * pt.distance;

      const colorPhase = (pt.angle + colorShift) % (TWO_PI * 2);
      let cr, cg, cb;
      if (colorPhase < TWO_PI * 0.5) {
        cr = 138;
        cg = 43;
        cb = 226;
      } else if (colorPhase < TWO_PI) {
        cr = 64;
        cg = 224;
        cb = 208;
      } else if (colorPhase < TWO_PI * 1.5) {
        cr = 255;
        cg = 20;
        cb = 147;
      } else {
        cr = 255;
        cg = 215;
        cb = 0;
      }

      p.fill(cr, cg, cb, pt.brightness * (alpha / 150));
      p.noStroke();
      p.ellipse(px, py, pt.size);

      p.fill(
        Math.min(cr + 50, 255),
        Math.min(cg + 50, 255),
        Math.min(cb + 50, 255),
        pt.brightness * 0.3 * (alpha / 150)
      );
      p.ellipse(px, py, pt.size * 2);

      if (pt.brightness > 200) {
        p.fill(255, 255, 255, pt.brightness * 0.4 * (alpha / 150));
        p.ellipse(px, py, pt.size * 0.5);
      }
    }

    if (this.timer < 120) {
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
