import { sin, cos, random } from '../mathUtils.js';

/**
 * Background rendering: space gradient, auroras, nebulae, cosmic dust, enhanced stars.
 * Separated from VisualEffectsManager to isolate background layers from gameplay particles.
 */
export class BackgroundEffectsRenderer {
  constructor(backgroundLayers) {
    this.backgroundLayers = backgroundLayers;
    this.cosmicDust = [];
    this.auroras = [];
    this.timeOffset = 0;
    this.initialized = false;
    this.initFailed = false;
    this._gradientCache = null;
    this._gradientW = 0;
    this._gradientH = 0;

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
      this.initFailed = true;
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
    this._updateAurorasAndDust(p);
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
    if (
      this._gradientCache &&
      this._gradientW === p.width &&
      this._gradientH === p.height
    ) {
      p.image(this._gradientCache, 0, 0);
      return;
    }
    // Rebuild cache
    if (this._gradientCache) {
      this._gradientCache.remove();
    }
    this._gradientCache = p.createGraphics(p.width, p.height);
    this._gradientW = p.width;
    this._gradientH = p.height;

    const g = this._gradientCache;
    g.noFill();
    const c1 = g.color(15, 5, 35);
    const c2 = g.color(60, 30, 80);
    const c3 = g.color(25, 15, 45);
    for (let i = 0; i <= g.height; i += 2) {
      const inter = g.map(i, 0, g.height, 0, 1);
      let currentColor;
      if (inter < 0.5) {
        currentColor = g.lerpColor(c1, c3, inter * 2);
      } else {
        currentColor = g.lerpColor(c3, c2, (inter - 0.5) * 2);
      }
      g.stroke(currentColor);
      g.line(0, i, g.width, i);
    }
    p.image(this._gradientCache, 0, 0);
  }

  _updateAurorasAndDust(p) {
    this.auroras.forEach((aurora) => {
      aurora.angle += aurora.speed;
      aurora.phase += 0.02;
    });
    this.cosmicDust.forEach((dust) => {
      dust.x += cos(dust.angle) * dust.speed;
      dust.y += sin(dust.angle) * dust.speed;
      if (dust.x > p.width + 50) dust.x = -50;
      if (dust.x < -50) dust.x = p.width + 50;
      if (dust.y > p.height + 50) dust.y = -50;
      if (dust.y < -50) dust.y = p.height + 50;
    });
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
      p.noStroke();
      for (let i = 0; i < aurora.width; i += 40) {
        for (let j = 0; j < aurora.height; j += 40) {
          const wave =
            sin(i * 0.01 + aurora.phase) * sin(j * 0.01 + aurora.phase);
          const alpha = p.map(wave, -1, 1, 2, aurora.intensity * 15);
          p.fill(aurora.color[0], aurora.color[1], aurora.color[2], alpha);
          p.ellipse(i - aurora.width / 2, j - aurora.height / 2, 14, 14);
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

  incrementTimeOffset() {
    this.timeOffset++;
  }
}
