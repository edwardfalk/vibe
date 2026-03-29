import { sin, cos, random } from '../mathUtils.js';
import { ObjectPool } from '../shared/ObjectPool.js';
import { BackgroundEffectsRenderer } from './BackgroundEffectsRenderer.js';

/**
 * Visual effects manager: gameplay particles and screen effects.
 * Background rendering is delegated to BackgroundEffectsRenderer.
 */

const particlePool = new ObjectPool(200);

function acquireParticle(props) {
  return particlePool.acquire(props);
}

function releaseParticle(p) {
  particlePool.release(p);
}

class VisualEffectsManager {
  constructor(backgroundLayers, context = null) {
    this.context = context;
    this.particles = [];

    this.bloomIntensity = 0;
    this._bloomFramesLeft = 0;
    this.chromaticAberration = 0;
    this._chromaticFramesLeft = 0;

    this._background = new BackgroundEffectsRenderer(backgroundLayers);
  }

  // Expose background state for external readers
  get initialized() {
    return this._background.initialized;
  }
  get initFailed() {
    return this._background.initFailed;
  }

  drawEnhancedBackground(p, camera) {
    this._background.drawEnhancedBackground(p, camera);
  }

  /** Stabber-compatible API: addExplosion(x, y, count, color, intensity?, size?, life?) */
  addExplosion(x, y, count = 15, color = [255, 200, 100]) {
    const colors = [color];
    for (let i = 0; i < count; i++) {
      this.particles.push(
        acquireParticle({
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
        })
      );
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

      this.particles.push(
        acquireParticle({
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
        })
      );
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

      this.particles.push(
        acquireParticle({
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
        })
      );
    }
  }

  addMotionTrail(x, y, color, size = 3) {
    this.particles.push(
      acquireParticle({
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
      })
    );
  }

  updateParticles() {
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
        releaseParticle(part);
        const last = this.particles.length - 1;
        if (i < last) {
          this.particles[i] = this.particles[last];
        }
        this.particles.pop();
      }
    }

    this._background.incrementTimeOffset();

    // Decay frame-based screen effects
    if (this._chromaticFramesLeft > 0) {
      this._chromaticFramesLeft--;
      if (this._chromaticFramesLeft <= 0) this.chromaticAberration = 0;
    }
    if (this._bloomFramesLeft > 0) {
      this._bloomFramesLeft--;
      if (this._bloomFramesLeft <= 0) this.bloomIntensity = 0;
    }
  }

  drawParticles(p) {
    if (this._background.initFailed) return;
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

  triggerChromaticAberration(intensity = 0.5, durationFrames = 30) {
    this.chromaticAberration = intensity;
    this._chromaticFramesLeft = durationFrames;
  }

  triggerBloom(intensity = 0.3, durationFrames = 20) {
    this.bloomIntensity = intensity;
    this._bloomFramesLeft = durationFrames;
  }
}

export default VisualEffectsManager;
