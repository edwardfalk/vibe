import { sin, cos, random } from '../mathUtils.js';

/**
 * Visual effects manager: particles, cosmic dust, auroras, screen effects.
 * Requires p5.js instance mode.
 */

class VisualEffectsManager {
  constructor(backgroundLayers, context = null) {
    this.context = context;
    this.particles = [];
    this.cosmicDust = [];
    this.auroras = [];

    this.bloomIntensity = 0;
    this.chromaticAberration = 0;
    this.timeOffset = 0;
    this.initialized = false;

    this.nebulaPalette = [
      [138, 43, 226],
      [75, 0, 130],
      [255, 20, 147],
      [0, 191, 255],
      [148, 0, 211],
    ];

    this.auroraPalette = [
      [0, 255, 127],
      [127, 255, 212],
      [173, 216, 230],
      [221, 160, 221],
      [255, 182, 193],
    ];

    this.backgroundLayers = backgroundLayers;
  }

  init(p) {
    if (this.initialized) return;

    try {
      this.initCosmicDust(p);
      this.initAuroras(p);
      this.initialized = true;
      console.log('✨ Visual effects fully initialized');
    } catch (error) {
      console.log('⚠️ Visual effects initialization failed:', error);
    }
  }

  initCosmicDust(p) {
    for (let i = 0; i < 50; i++) {
      this.cosmicDust.push({
        x: random(-p.width, p.width * 2),
        y: random(-p.height, p.height * 2),
        z: random(0.1, 1),
        size: random(0.5, 2),
        alpha: random(20, 60),
        speed: random(0.05, 0.2),
        angle: random(p.TWO_PI),
        color: random(this.nebulaPalette),
      });
    }
  }

  initAuroras(p) {
    for (let i = 0; i < 3; i++) {
      this.auroras.push({
        x: random(-p.width, p.width * 2),
        y: random(-p.height, p.height * 2),
        width: random(150, 300),
        height: random(80, 150),
        angle: random(p.TWO_PI),
        speed: random(0.002, 0.008),
        intensity: random(0.1, 0.3),
        color: random(this.auroraPalette),
        phase: random(p.TWO_PI),
      });
    }
  }

  drawEnhancedBackground(p, camera) {
    if (!this.initialized) {
      this.init(p);
    }
    this.drawSpaceGradient(p);
    if (this.initialized) {
      this.drawAuroras(p, camera);
      this.drawNebulae(p, camera);
      this.drawCosmicDust(p, camera);
      this.drawEnhancedStars(p, camera);
    }
    p.blendMode(p.BLEND);
  }

  drawSpaceGradient(p) {
    p.push();
    p.noFill();
    for (let i = 0; i <= p.height; i += 2) {
      const inter = p.map(i, 0, p.height, 0, 1);
      const c1 = p.color(15, 5, 35);
      const c2 = p.color(60, 30, 80);
      const c3 = p.color(25, 15, 45);
      let currentColor;
      if (inter < 0.5) {
        currentColor = p.lerpColor(c1, c3, inter * 2);
      } else {
        currentColor = p.lerpColor(c3, c2, (inter - 0.5) * 2);
      }
      p.stroke(currentColor);
      p.line(0, i, p.width, i);
    }
    p.pop();
  }

  drawAuroras(p, camera) {
    p.push();
    p.blendMode(p.SCREEN);
    this.auroras.forEach((aurora) => {
      p.push();
      const parallaxX = aurora.x - camera.x * 0.1;
      const parallaxY = aurora.y - camera.y * 0.1;
      p.translate(parallaxX, parallaxY);
      p.rotate(aurora.angle);
      aurora.angle += aurora.speed;
      aurora.phase += 0.02;
      p.noStroke();
      for (let i = 0; i < aurora.width; i += 20) {
        for (let j = 0; j < aurora.height; j += 20) {
          const wave =
            sin(i * 0.01 + aurora.phase) * sin(j * 0.01 + aurora.phase);
          const alpha = p.map(wave, -1, 1, 2, aurora.intensity * 15);
          p.fill(aurora.color[0], aurora.color[1], aurora.color[2], alpha);
          p.ellipse(i - aurora.width / 2, j - aurora.height / 2, 8, 8);
        }
      }
      p.pop();
    });
    p.blendMode(p.BLEND);
    p.pop();
  }

  drawNebulae(p, camera) {
    p.push();
    for (let i = 0; i < 3; i++) {
      const x =
        sin(this.timeOffset * 0.001 + i) * p.width * 0.2 - camera.x * 0.05;
      const y =
        cos(this.timeOffset * 0.0007 + i) * p.height * 0.2 - camera.y * 0.05;
      const size = 200 + sin(this.timeOffset * 0.002 + i) * 50;
      const nebulaColor = this.nebulaPalette[i % this.nebulaPalette.length];
      for (let r = size; r > 0; r -= 20) {
        const alpha = p.map(r, 0, size, 8, 0);
        p.fill(nebulaColor[0], nebulaColor[1], nebulaColor[2], alpha);
        p.noStroke();
        p.ellipse(x + p.width / 2, y + p.height / 2, r, r);
      }
    }
    p.pop();
  }

  drawCosmicDust(p, camera) {
    p.push();
    p.blendMode(p.SCREEN);
    this.cosmicDust.forEach((dust) => {
      dust.x += cos(dust.angle) * dust.speed;
      dust.y += sin(dust.angle) * dust.speed;
      if (dust.x > p.width + 50) dust.x = -50;
      if (dust.x < -50) dust.x = p.width + 50;
      if (dust.y > p.height + 50) dust.y = -50;
      if (dust.y < -50) dust.y = p.height + 50;
      const parallaxX = dust.x - camera.x * dust.z * 0.3;
      const parallaxY = dust.y - camera.y * dust.z * 0.3;
      p.fill(
        dust.color[0],
        dust.color[1],
        dust.color[2],
        dust.alpha * dust.z * 0.3
      );
      p.noStroke();
      p.ellipse(parallaxX, parallaxY, dust.size * dust.z, dust.size * dust.z);
    });
    p.blendMode(p.BLEND);
    p.pop();
  }

  drawEnhancedStars(p, camera) {
    p.push();
    p.blendMode(p.ADD);
    if (this.backgroundLayers && this.backgroundLayers[1]) {
      this.backgroundLayers[1].forEach((star) => {
        if (star.brightness > 0.8) {
          const parallaxX = star.x - camera.x * 0.3;
          const parallaxY = star.y - camera.y * 0.3;
          const twinkle = sin(p.frameCount * 0.1 + star.x * 0.01) * 0.5 + 0.5;
          const glowSize = star.size * (2 + twinkle);
          p.fill(255, 255, 255, 30 * twinkle);
          p.noStroke();
          p.ellipse(parallaxX, parallaxY, glowSize, glowSize);
          if (star.brightness > 0.9) {
            p.stroke(255, 255, 255, 50 * twinkle);
            p.strokeWeight(1);
            p.line(
              parallaxX - glowSize / 2,
              parallaxY,
              parallaxX + glowSize / 2,
              parallaxY
            );
            p.line(
              parallaxX,
              parallaxY - glowSize / 2,
              parallaxX,
              parallaxY + glowSize / 2
            );
          }
        }
      });
    }
    p.blendMode(p.BLEND);
    p.pop();
  }

  /** Stabber-compatible API: addExplosion(x, y, count, color, intensity?, size?, life?) */
  addExplosion(x, y, count = 15, color = [255, 200, 100]) {
    const colors = [color];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: random(-8, 8),
        vy: random(-8, 8),
        size: random(3, 8),
        life: 60,
        maxLife: 60,
        color: random(colors),
        type: 'explosion',
        gravity: 0.1,
        fade: random(0.02, 0.05),
      });
    }
  }

  addExplosionParticles(x, y, type = 'normal') {
    const bc = this.context?.get?.('beatClock');
    const beatClock =
      bc !== undefined
        ? bc
        : typeof window !== 'undefined' && window.beatClock !== undefined
          ? window.beatClock
          : null;
    const beatIntensity = beatClock ? beatClock.getBeatIntensity(8) : 0;
    const isDownbeat = beatClock ? beatClock.getCurrentBeat() === 0 : false;

    let particleCount = type === 'rusher-explosion' ? 25 : 15;
    if (beatIntensity > 0.3) {
      particleCount = Math.floor(particleCount * (isDownbeat ? 1.6 : 1.3));
    }

    const colors =
      type === 'tank'
        ? [
            [100, 50, 200],
            [150, 100, 255],
            [200, 150, 255],
          ]
        : [
            [255, 100, 50],
            [255, 150, 100],
            [255, 200, 150],
          ];

    for (let i = 0; i < particleCount; i++) {
      let speedBoost = 1;
      if (beatIntensity > 0.3) {
        speedBoost = 1 + beatIntensity * 0.5;
      }

      this.particles.push({
        x,
        y,
        vx: random(-8, 8) * speedBoost,
        vy: random(-8, 8) * speedBoost,
        size: random(3, 8) * (beatIntensity > 0.3 ? 1.2 : 1),
        life: 60,
        maxLife: 60,
        color: random(colors),
        type: 'explosion',
        gravity: 0.1,
        fade: random(0.02, 0.05),
        beatBoost: beatIntensity,
      });
    }

    if (beatIntensity > 0.4) {
      this.triggerBloom(0.3 + beatIntensity * 0.3, 15);
    }
  }

  addMuzzleFlashParticles(x, y, angle, isPlayer = true) {
    const colors = isPlayer
      ? [
          [255, 255, 100],
          [255, 200, 50],
          [255, 150, 0],
        ]
      : [
          [100, 255, 255],
          [50, 200, 255],
          [0, 150, 255],
        ];

    for (let i = 0; i < 8; i++) {
      const spreadAngle = angle + random(-0.3, 0.3);
      const speed = random(3, 6);

      this.particles.push({
        x,
        y,
        vx: cos(spreadAngle) * speed,
        vy: sin(spreadAngle) * speed,
        size: random(2, 5),
        life: 20,
        maxLife: 20,
        color: random(colors),
        type: 'muzzle',
        gravity: 0,
        fade: 0.1,
      });
    }
  }

  addMotionTrail(x, y, color, size = 3) {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size,
      life: 30,
      maxLife: 30,
      color,
      type: 'trail',
      gravity: 0,
      fade: 0.05,
    });
  }

  updateParticles() {
    if (!this.initialized) return;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];

      part.x += part.vx;
      part.y += part.vy;

      if (part.type === 'explosion') {
        part.vy += part.gravity;
        part.vx *= 0.98;
      }

      part.life -= part.fade * 60;

      if (part.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    this.timeOffset++;
  }

  drawParticles(p) {
    p.push();
    p.blendMode(p.ADD);
    this.particles.forEach((part) => {
      const alpha = p.map(part.life, 0, part.maxLife, 0, 255);
      p.fill(part.color[0], part.color[1], part.color[2], alpha);
      p.noStroke();
      if (part.type === 'trail') {
        p.ellipse(
          part.x,
          part.y,
          part.size * (part.life / part.maxLife),
          part.size * (part.life / part.maxLife)
        );
      } else {
        p.ellipse(part.x, part.y, part.size, part.size);
        if (part.type === 'explosion') {
          p.fill(part.color[0], part.color[1], part.color[2], alpha * 0.3);
          p.ellipse(part.x, part.y, part.size * 2, part.size * 2);
        }
      }
    });
    p.blendMode(p.BLEND);
    p.pop();
  }

  applyScreenEffects(p) {
    if (this.chromaticAberration > 0) {
      this.drawChromaticAberration(p);
    }

    if (this.bloomIntensity > 0) {
      this.drawBloom(p);
    }
  }

  drawChromaticAberration(p) {
    p.push();
    p.blendMode(p.MULTIPLY);
    p.tint(255, 0, 0, 100);
    p.fill(255, 0, 0, this.chromaticAberration * 10);
    p.rect(0, 0, p.width, p.height);
    p.pop();
  }

  drawBloom(p) {
    p.push();
    p.blendMode(p.SCREEN);
    p.fill(255, 255, 255, this.bloomIntensity * 20);
    p.noStroke();

    for (let i = 0; i < 3; i++) {
      p.rect(-i, -i, p.width + i * 2, p.height + i * 2);
    }
    p.pop();
  }

  triggerChromaticAberration(intensity = 0.5, duration = 30) {
    this.chromaticAberration = intensity;
    setTimeout(() => {
      this.chromaticAberration = 0;
    }, duration * 16.67);
  }

  triggerBloom(intensity = 0.3, duration = 20) {
    this.bloomIntensity = intensity;
    setTimeout(() => {
      this.bloomIntensity = 0;
    }, duration * 16.67);
  }
}

export default VisualEffectsManager;
