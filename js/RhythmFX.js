/**
 * RhythmFX - Beat-synced visual effects and enemy attack telegraphs
 *
 * Provides:
 * - Enemy attack telegraph rings (warning when enemies are about to attack)
 */

import { sin, min, max, abs } from './mathUtils.js';

export class RhythmFX {
  constructor(context = null) {
    this.context = context;
    // Attack telegraphs for enemies
    this.telegraphs = []; // {x, y, type, beatsUntil, intensity, owner}

    // Early-warning ring colour per enemy type
    this.enemyTypeConfig = {
      grunt: { color: [50, 255, 50] },
      stabber: { color: [255, 215, 0] },
      rusher: { color: [255, 50, 150] },
    };
  }

  _getBeatClock() {
    if (this.context && typeof this.context.get === 'function') {
      return this.context.get('beatClock');
    }
    return window.beatClock;
  }

  /**
   * Update beat visualization state
   */
  update(deltaTimeMs = 16.67) {
    const beatClock = this._getBeatClock();
    // Decay telegraphs using actual deltaTime
    const beatsPerFrame = beatClock
      ? deltaTimeMs / beatClock.beatInterval
      : deltaTimeMs / 500; // fallback assumes 120 BPM
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.beatsUntil -= beatsPerFrame;
      // A dead enemy's warning would mislead: it goes with the enemy
      if (t.beatsUntil <= 0 || t.owner?.markedForRemoval) {
        this.telegraphs.splice(i, 1);
      }
    }
  }

  /**
   * Register an enemy attack telegraph
   * @param {number} x - Enemy X position
   * @param {number} y - Enemy Y position
   * @param {string} type - Enemy type ('grunt', 'stabber', 'rusher'; the tank's chain counts his charge instead)
   * @param {number} beatsUntil - How many beats until attack (0.0 to 4.0)
   * @param {object} [owner] - The enemy: one ring per enemy, drawn where it
   *   is now, so a moving enemy doesn't leave a trail of rings
   */
  addAttackTelegraph(x, y, type, beatsUntil, owner = null) {
    const existing = this.telegraphs.find((t) =>
      owner
        ? t.owner === owner
        : !t.owner && abs(t.x - x) < 5 && abs(t.y - y) < 5 && t.type === type
    );

    if (existing) {
      existing.beatsUntil = beatsUntil;
    } else {
      this.telegraphs.push({ x, y, type, beatsUntil, owner });
    }
  }

  /**
   * Draw enemy attack telegraph rings
   */
  drawAttackTelegraphs(p, cameraSystem) {
    if (!this._getBeatClock() || this.telegraphs.length === 0) return;

    p.push();

    for (const telegraph of this.telegraphs) {
      // Convert world position to screen position
      const at = telegraph.owner ?? telegraph;
      const { x: screenX, y: screenY } = cameraSystem
        ? cameraSystem.worldToScreen(at.x, at.y)
        : at;

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
      const alpha = (1 - progress) * 200;
      p.noFill();
      p.stroke(r, g, b, alpha);
      p.strokeWeight(2 + progress * 2);
      p.ellipse(screenX, screenY, currentRadius * 2, currentRadius * 2);

      // Draw inner dot pulsing
      const pulse = sin(Date.now() * 0.01) * 0.3 + 0.7;
      p.fill(r, g, b, alpha * pulse);
      p.noStroke();
      p.ellipse(screenX, screenY, 6 * pulse, 6 * pulse);
    }

    p.pop();
  }
}

export default RhythmFX;
