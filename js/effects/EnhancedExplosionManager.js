/**
 * Enhanced explosion effects with expanding rings and particle integration.
 */

import { max } from '../mathUtils.js';
import { drawGlow } from './glowUtils.js';

class EnhancedExplosionManager {
  constructor(context = null) {
    this.context = context;
    this.explosions = [];
  }

  _getEffects() {
    const vfx =
      this.context?.get?.('visualEffectsManager') ??
      window.visualEffectsManager;
    const cam = this.context?.get?.('cameraSystem') ?? window.cameraSystem;
    return { visualEffectsManager: vfx, cameraSystem: cam };
  }

  addExplosion(x, y, type = 'normal', size = 1.0) {
    this.explosions.push(new EnhancedExplosion(x, y, type, size));

    const { visualEffectsManager, cameraSystem } = this._getEffects();
    if (visualEffectsManager) {
      if (type === 'enemy') {
        if (cameraSystem) cameraSystem.addShake(8, 15);
        visualEffectsManager.addExplosionParticles(x, y, 'enemy');
      } else if (type === 'rusher-explosion') {
        if (cameraSystem) cameraSystem.addShake(15, 25);
        visualEffectsManager.addExplosionParticles(x, y, 'rusher-explosion');
      } else {
        if (cameraSystem) cameraSystem.addShake(4, 10);
        visualEffectsManager.addExplosionParticles(x, y);
      }
    }
  }

  update() {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].update();
      if (this.explosions[i].isDead()) {
        this.explosions.splice(i, 1);
      }
    }
  }

  draw(p) {
    for (const explosion of this.explosions) {
      explosion.draw(p);
    }
  }
}

class EnhancedExplosion {
  constructor(x, y, type, size) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.size = Math.max(1, size);
    this.life = 30;
    this.maxLife = 30;
    this.rings = [];

    const ringCount = type === 'rusher-explosion' ? 4 : 2;
    for (let i = 0; i < ringCount; i++) {
      const color =
        type === 'enemy' || type === 'rusher-explosion'
          ? [255, 100, 50]
          : [100, 150, 255];
      this.rings.push({
        radius: 0,
        maxRadius: (20 + i * 15) * this.size,
        speed: 2 + i * 0.5,
        color,
        delay: i * 5,
      });
    }
  }

  update() {
    this.life--;

    for (const ring of this.rings) {
      if (this.life < this.maxLife - ring.delay) {
        ring.radius += ring.speed;
      }
    }
  }

  draw(p) {
    const lifePercent = this.life / this.maxLife;

    p.push();
    p.translate(this.x, this.y);

    for (const ring of this.rings) {
      if (ring.radius > 0) {
        const alpha =
          max(0, 1 - ring.radius / ring.maxRadius) * lifePercent * 255;
        p.fill(ring.color[0], ring.color[1], ring.color[2], alpha);
        p.noStroke();
        p.ellipse(0, 0, ring.radius * 2);

        if (ring.radius < ring.maxRadius * 0.3) {
          p.fill(255, 255, 255, alpha * 0.8);
          p.ellipse(0, 0, ring.radius);
        }
      }
    }

    if (this.type === 'energy') {
      drawGlow(p, 0, 0, this.size * 2, p.color(100, 255, 255), 0.7);
    } else if (this.type === 'debris') {
      drawGlow(p, 0, 0, this.size * 1.5, p.color(200, 200, 200), 0.3);
    }

    p.pop();
  }

  isDead() {
    return this.life <= 0;
  }
}

export { EnhancedExplosionManager, EnhancedExplosion };
