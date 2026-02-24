/**
 * RhythmFX - Beat-synced visual effects and enemy attack telegraphs
 *
 * Provides:
 * - Enemy attack telegraph rings (warning when enemies are about to attack)
 * - Screen pulse effects tied to beat phase
 * - Edge flash on strong beats
 */

import { sin, min, max, abs } from './mathUtils.js';

export class RhythmFX {
  constructor() {
    // Attack telegraphs for enemies
    this.telegraphs = []; // {x, y, type, beatsUntil, intensity}

    // Screen effects
    this.pulseIntensity = 0;
    this.edgeFlashIntensity = 0;
    this.lastBeat = -1;
    this.beatJustHit = false;

    // Enemy type icons and colors
    this.enemyTypeConfig = {
      grunt: { icon: '●', color: [50, 255, 50], beatPattern: [2, 4] },
      tank: { icon: '■', color: [150, 100, 255], beatPattern: [1] },
      stabber: { icon: '▲', color: [255, 215, 0], beatPattern: [3.5] },
      rusher: { icon: '◆', color: [255, 50, 150], beatPattern: [1, 3] },
    };
  }

  /**
   * Update beat visualization state
   */
  update() {
    // Check if we just hit a new beat
    if (window.beatClock) {
      const currentBeat = window.beatClock.getCurrentBeat();
      if (currentBeat !== this.lastBeat) {
        this.beatJustHit = true;
        this.lastBeat = currentBeat;
        // Trigger pulse on beat hit
        this.pulseIntensity = currentBeat === 0 ? 1.0 : 0.5; // Stronger on downbeat
      } else {
        this.beatJustHit = false;
      }

      // Decay pulse intensity
      this.pulseIntensity *= 0.92;

      // Update edge flash based on beat
      const beatPhase = window.beatClock.getBeatPhase();
      const isDownbeat = currentBeat === 0;
      if (beatPhase < 0.15 && isDownbeat) {
        this.edgeFlashIntensity = (1 - beatPhase / 0.15) * 0.6;
      } else {
        this.edgeFlashIntensity *= 0.9;
      }
    }

    // Clean up old telegraphs
    this.telegraphs = this.telegraphs.filter((t) => t.beatsUntil > -0.5);
  }

  /**
   * Register an enemy attack telegraph
   * @param {number} x - Enemy X position
   * @param {number} y - Enemy Y position
   * @param {string} type - Enemy type ('grunt', 'tank', 'stabber', 'rusher')
   * @param {number} beatsUntil - How many beats until attack (0.0 to 4.0)
   */
  addAttackTelegraph(x, y, type, beatsUntil) {
    // Find existing telegraph for this position and update it, or add new
    const existing = this.telegraphs.find(
      (t) => abs(t.x - x) < 5 && abs(t.y - y) < 5 && t.type === type
    );

    if (existing) {
      existing.beatsUntil = beatsUntil;
      existing.intensity = 1.0;
    } else {
      this.telegraphs.push({
        x,
        y,
        type,
        beatsUntil,
        intensity: 1.0,
        id: Math.random().toString(36).substr(2, 9),
      });
    }
  }

  /**
   * Draw enemy attack telegraph rings
   */
  drawAttackTelegraphs(p, cameraSystem) {
    if (!window.beatClock || this.telegraphs.length === 0) return;

    const cameraX = cameraSystem ? cameraSystem.x : 0;
    const cameraY = cameraSystem ? cameraSystem.y : 0;

    p.push();

    for (const telegraph of this.telegraphs) {
      // Convert world position to screen position
      const screenX = telegraph.x - cameraX;
      const screenY = telegraph.y - cameraY;

      // Calculate ring size based on beats until attack
      const progress = 1 - min(1, max(0, telegraph.beatsUntil / 2));
      const maxRadius = 50;
      const currentRadius = progress * maxRadius;

      // Color based on urgency
      let r, g, b;
      if (telegraph.beatsUntil < 0.5) {
        // Critical - red flash
        r = 255;
        g = 50;
        b = 50;
      } else if (telegraph.beatsUntil < 1.0) {
        // Warning - orange
        r = 255;
        g = 150;
        b = 50;
      } else {
        // Early warning - enemy color
        const config = this.enemyTypeConfig[telegraph.type];
        [r, g, b] = config ? config.color : [200, 200, 200];
      }

      // Draw expanding ring
      const alpha = (1 - progress) * 200 * telegraph.intensity;
      p.noFill();
      p.stroke(r, g, b, alpha);
      p.strokeWeight(2 + progress * 2);
      p.ellipse(screenX, screenY, currentRadius * 2, currentRadius * 2);

      // Draw inner dot pulsing
      const pulse = sin(Date.now() * 0.01) * 0.3 + 0.7;
      p.fill(r, g, b, alpha * pulse);
      p.noStroke();
      p.ellipse(screenX, screenY, 6 * pulse, 6 * pulse);

      // Decay intensity
      telegraph.intensity *= 0.98;
      telegraph.beatsUntil -= 1 / 60; // Decrement by frame at 60fps
    }

    p.pop();
  }

  /**
   * Draw screen pulse effect
   */
  drawScreenPulse(p) {
    if (this.pulseIntensity < 0.01) return;

    p.push();

    // Subtle vignette pulse
    const ctx = p.drawingContext;
    ctx.save();
    const gradient = ctx.createRadialGradient(
      p.width / 2,
      p.height / 2,
      0,
      p.width / 2,
      p.height / 2,
      p.width * 0.7
    );

    const intensity = this.pulseIntensity * 0.15;
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.7, `rgba(200, 180, 255, ${intensity * 0.3})`);
    gradient.addColorStop(1, `rgba(138, 43, 226, ${intensity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, p.width, p.height);
    ctx.restore();

    p.pop();
  }

  /**
   * Draw edge flash on strong beats
   */
  drawEdgeFlash(p) {
    if (this.edgeFlashIntensity < 0.01) return;

    p.push();

    const intensity = this.edgeFlashIntensity;
    const weight = 3 + intensity * 5;

    p.noFill();
    p.stroke(255, 200, 100, intensity * 255);
    p.strokeWeight(weight);

    // Draw glowing border
    const inset = weight / 2;
    p.rect(inset, inset, p.width - weight, p.height - weight);

    p.pop();
  }

  /**
   * Draw all beat visualization elements
   */
  draw(p, cameraSystem) {
    this.drawScreenPulse(p);
    this.drawEdgeFlash(p);
    this.drawAttackTelegraphs(p, cameraSystem);
  }
}

export default RhythmFX;
