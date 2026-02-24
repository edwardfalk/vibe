import { sin, cos, random } from './mathUtils.js';

// Advanced Visual Effects System for Vibe
// Leverages p5.js power for stunning graphics

// Requires p5.js in instance mode: all p5 functions/vars must use the 'p' parameter (e.g., p.ellipse, p.fill)

class VisualEffectsManager {
  constructor(backgroundLayers) {
    // Particle systems
    this.particles = [];
    this.cosmicDust = [];
    this.auroras = [];

    // Visual state
    this.bloomIntensity = 0;
    this.chromaticAberration = 0;
    this.timeOffset = 0;
    this.initialized = false;

    // Color palettes
    this.nebulaPalette = [
      [138, 43, 226], // Blue violet
      [75, 0, 130], // Indigo
      [255, 20, 147], // Deep pink
      [0, 191, 255], // Deep sky blue
      [148, 0, 211], // Dark violet
    ];

    this.auroraPalette = [
      [0, 255, 127], // Spring green
      [127, 255, 212], // Aquamarine
      [173, 216, 230], // Light blue
      [221, 160, 221], // Plum
      [255, 182, 193], // Light pink
    ];

    this.backgroundLayers = backgroundLayers;
  }

  // Initialize after p5.js is ready
  init(p) {
    if (this.initialized) return;

    try {
      // Initialize cosmic dust and auroras
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

  // Enhanced background with dynamic nebulae and aurora effects
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

  // Particle system for explosions and effects with beat-reactivity
  addExplosionParticles(x, y, type = 'normal') {
    if (!this.initialized) {
      this.init();
      if (!this.initialized) return;
    }

    // Get beat intensity for enhanced effects on-beat
    const beatIntensity = window.beatClock
      ? window.beatClock.getBeatIntensity(8)
      : 0;
    const isDownbeat = window.beatClock
      ? window.beatClock.getCurrentBeat() === 0
      : false;

    // Increase particle count on beats
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
      // Boost velocities on beats
      let speedBoost = 1;
      if (beatIntensity > 0.3) {
        speedBoost = 1 + beatIntensity * 0.5;
      }

      this.particles.push({
        x: x,
        y: y,
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

    // Add bloom effect on-beat explosions
    if (beatIntensity > 0.4) {
      this.triggerBloom(0.3 + beatIntensity * 0.3, 15);
    }
  }

  addMuzzleFlashParticles(x, y, angle, isPlayer = true) {
    if (!this.initialized) {
      this.init();
      if (!this.initialized) return;
    }

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
        x: x,
        y: y,
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
    if (!this.initialized) {
      this.init();
      if (!this.initialized) return;
    }

    this.particles.push({
      x: x,
      y: y,
      vx: 0,
      vy: 0,
      size: size,
      life: 30,
      maxLife: 30,
      color: color,
      type: 'trail',
      gravity: 0,
      fade: 0.05,
    });
  }

  updateParticles() {
    if (!this.initialized) return;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update position
      p.x += p.vx;
      p.y += p.vy;

      // Apply gravity for explosion particles
      if (p.type === 'explosion') {
        p.vy += p.gravity;
        p.vx *= 0.98; // Air resistance
      }

      // Update life
      p.life -= p.fade * 60;

      // Remove dead particles
      if (p.life <= 0) {
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

  // Screen effects
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

    // Draw multiple offset copies for blur effect
    for (let i = 0; i < 3; i++) {
      p.rect(-i, -i, p.width + i * 2, p.height + i * 2);
    }
    p.pop();
  }

  // Trigger effects
  triggerChromaticAberration(intensity = 0.5, duration = 30) {
    this.chromaticAberration = intensity;
    setTimeout(() => {
      this.chromaticAberration = 0;
    }, duration * 16.67); // Convert frames to milliseconds
  }

  triggerBloom(intensity = 0.3, duration = 20) {
    this.bloomIntensity = intensity;
    setTimeout(() => {
      this.bloomIntensity = 0;
    }, duration * 16.67);
  }
}

// Enhanced glow effect function using additive blending for neon pop
function drawGlow(p, x, y, size, color, intensity = 1) {
  p.push();
  p.blendMode(p.ADD);
  p.noStroke();
  
  // Create a sharp center with a wider faint glow
  const maxLayers = 3;
  for (let i = 0; i < maxLayers; i++) {
    // Inverse exponential dropoff for alpha
    const alpha = (intensity * 255) / p.pow(2, i);
    // Linear growth for size
    const glowSize = size * (0.8 + i * 0.6);
    
    p.fill(p.red(color), p.green(color), p.blue(color), alpha);
    p.ellipse(x, y, glowSize, glowSize);
  }
  
  p.blendMode(p.BLEND);
  p.pop();
}

// Enhanced gradient function
function drawRadialGradient(
  p,
  x,
  y,
  innerRadius,
  outerRadius,
  innerColor,
  outerColor
) {
  p.push();
  p.noStroke();
  for (let r = outerRadius; r > 0; r -= 2) {
    const inter = p.map(r, 0, outerRadius, 0, 1);
    const c = p.lerpColor(innerColor, outerColor, inter);
    p.fill(c);
    p.ellipse(x, y, r * 2, r * 2);
  }
  p.pop();
}

export { drawGlow, drawRadialGradient };
export default VisualEffectsManager;
