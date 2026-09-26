/**
 * Hazard cloud: a zone that lingers and deals area damage. Two kinds:
 * PLASMA (a tank's death and its bomb) and DEBRIS (the bomb's longer-lasting
 * radioactive fallout). Balance numbers live in CONFIG[kind]; how each kind
 * looks lives in LOOKS[kind].
 */
import { random, TWO_PI, sin, cos, constrain } from '../../mathUtils.js';
import { CONFIG } from '../../config.js';

// Particle colours come in bands of `colorPhase`: the first band whose end
// (in turns, times TWO_PI) the phase is below. FLICKER makes each particle
// pulse on its own phase.
const LOOKS = {
  PLASMA: {
    PARTICLES: 15,
    MIN_DISTANCE: 20,
    SPEED: [0.01, 0.03],
    SIZE: [3, 8],
    BRIGHTNESS: [100, 255],
    FLICKER: false,
    WOBBLE_RATE: 0.05,
    WOBBLE: 0.5,
    PULSE_RATE: 0.1,
    PULSE: 0.3,
    PULSE_BASE: 0.7,
    ALPHA: [150, 50],
    COLOR_SHIFT: 0.02,
    COLOR_TURNS: 2,
    DISCS: [
      [255, 20, 147, 0.3],
      [138, 43, 226, 0.4],
      [64, 224, 208, 0.5],
    ],
    MIDDLE_DISC: 1.5,
    BANDS: [
      [0.5, [138, 43, 226]],
      [1, [64, 224, 208]],
      [1.5, [255, 20, 147]],
      [Infinity, [255, 215, 0]],
    ],
    HALO_LIFT: 50,
    HALO_SIZE: 2,
    HALO_ALPHA: 0.3,
    CORE_ABOVE: 200,
    CORE_SIZE: 0.5,
    CORE_ALPHA: 0.4,
    LABEL: 'PLASMA HAZARD',
    LABEL_FRAMES: 120,
    LABEL_COLOR: [255, 255, 255],
    LABEL_SIZE: 12,
    LABEL_GAP: 20,
  },
  DEBRIS: {
    PARTICLES: 20,
    MIN_DISTANCE: 15,
    SPEED: [0.005, 0.015],
    SIZE: [2, 6],
    BRIGHTNESS: [80, 200],
    FLICKER: true,
    WOBBLE_RATE: 0.02,
    WOBBLE: 0.3,
    PULSE_RATE: 0.15,
    PULSE: 0.2,
    PULSE_BASE: 0.8,
    ALPHA: [120, 30],
    COLOR_SHIFT: 0.03,
    COLOR_TURNS: 1,
    DISCS: [
      [50, 205, 50, 0.25],
      [154, 205, 50, 0.35],
      [255, 255, 0, 0.4],
    ],
    MIDDLE_DISC: 1.4,
    BANDS: [
      [0.33, [50, 205, 50]],
      [0.66, [255, 255, 0]],
      [Infinity, [154, 205, 50]],
    ],
    HALO_LIFT: 30,
    HALO_SIZE: 1.8,
    HALO_ALPHA: 0.4,
    CORE_ABOVE: 150,
    CORE_SIZE: 0.4,
    CORE_ALPHA: 0.5,
    LABEL: '☢ RADIOACTIVE DEBRIS ☢',
    LABEL_FRAMES: 180,
    LABEL_COLOR: [255, 255, 0],
    LABEL_SIZE: 10,
    LABEL_GAP: 15,
  },
};

export class HazardCloud {
  /** @param {'PLASMA' | 'DEBRIS'} kind */
  constructor(x, y, kind) {
    const config = CONFIG[kind];
    const look = LOOKS[kind];
    this.look = look;
    this.x = x;
    this.y = y;
    this.radius = config.RADIUS;
    this.maxRadius = config.MAX_RADIUS;
    this.active = true;
    this.timer = 0;
    this.maxTimer = config.DURATION;
    this.damageTimer = 0;
    this.damageInterval = config.DAMAGE_INTERVAL;
    this.damage = config.DAMAGE;

    this.particles = [];
    for (let i = 0; i < look.PARTICLES; i++) {
      this.particles.push({
        angle: random(TWO_PI),
        distance: random(look.MIN_DISTANCE, this.maxRadius),
        speed: random(look.SPEED[0], look.SPEED[1]),
        size: random(look.SIZE[0], look.SIZE[1]),
        brightness: random(look.BRIGHTNESS[0], look.BRIGHTNESS[1]),
        glowPhase: look.FLICKER ? random(TWO_PI) : 0,
      });
    }
  }

  update() {
    const look = this.look;
    this.timer++;
    this.damageTimer++;

    for (const pt of this.particles) {
      pt.angle += pt.speed;
      pt.glowPhase += 0.08;
      pt.distance +=
        sin(this.timer * look.WOBBLE_RATE + pt.angle) * look.WOBBLE;
      pt.distance = constrain(pt.distance, look.MIN_DISTANCE, this.maxRadius);
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
    const look = this.look;
    const [alphaStart, alphaEnd] = look.ALPHA;

    p.push();
    p.translate(this.x, this.y);

    const pulse =
      sin(this.timer * look.PULSE_RATE) * look.PULSE + look.PULSE_BASE;
    const alpha = p.map(this.timer, 0, this.maxTimer, alphaStart, alphaEnd);
    const colorShift = this.timer * look.COLOR_SHIFT;

    const [outer, middle, inner] = look.DISCS;
    p.fill(outer[0], outer[1], outer[2], alpha * outer[3]);
    p.noStroke();
    p.ellipse(0, 0, this.maxRadius * 2 * pulse);

    p.fill(middle[0], middle[1], middle[2], alpha * middle[3]);
    p.ellipse(0, 0, this.maxRadius * look.MIDDLE_DISC * pulse);

    p.fill(inner[0], inner[1], inner[2], alpha * inner[3]);
    p.ellipse(0, 0, this.radius * 2 * pulse);

    for (const pt of this.particles) {
      const px = cos(pt.angle) * pt.distance;
      const py = sin(pt.angle) * pt.distance;

      const colorPhase = (pt.angle + colorShift) % (TWO_PI * look.COLOR_TURNS);
      const [, [cr, cg, cb]] = look.BANDS.find(
        ([end]) => colorPhase < TWO_PI * end
      );
      const glow = look.FLICKER ? sin(pt.glowPhase) * 0.3 + 0.7 : 1;
      const fade = alpha / alphaStart;

      p.fill(cr, cg, cb, pt.brightness * glow * fade);
      p.noStroke();
      p.ellipse(px, py, pt.size);

      p.fill(
        Math.min(cr + look.HALO_LIFT, 255),
        Math.min(cg + look.HALO_LIFT, 255),
        Math.min(cb + look.HALO_LIFT, 255),
        pt.brightness * look.HALO_ALPHA * glow * fade
      );
      p.ellipse(px, py, pt.size * look.HALO_SIZE);

      if (pt.brightness > look.CORE_ABOVE) {
        p.fill(255, 255, 255, pt.brightness * look.CORE_ALPHA * glow * fade);
        p.ellipse(px, py, pt.size * look.CORE_SIZE);
      }
    }

    if (this.timer < look.LABEL_FRAMES) {
      const [lr, lg, lb] = look.LABEL_COLOR;
      p.fill(lr, lg, lb, alpha);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(look.LABEL_SIZE);
      p.text(look.LABEL, 0, -this.maxRadius - look.LABEL_GAP);
    }

    p.pop();
  }
}
