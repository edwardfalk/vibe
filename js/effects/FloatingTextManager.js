/**
 * Floating text system for damage numbers, kill text, combo indicators.
 * Rendered in world space (inside camera transform).
 * Enhanced with momentum physics, merging, and beat-synced effects.
 */

import { FloatingTextPool } from './FloatingTextPool.js';

const FLOATING_TEXT_POOL_SIZE = 200;
const DAMAGE_MERGE_RADIUS = 60;

export class FloatingTextManager {
  constructor(context = null) {
    this.context = context;
    this.texts = [];
    this.textPool = new FloatingTextPool(FLOATING_TEXT_POOL_SIZE);
    this.damageMergeRadius = DAMAGE_MERGE_RADIUS;
    this.lastDamageTime = 0;
    this.damageAccumulator = 0;
    this.accumulatorPos = { x: 0, y: 0 };
    this.accumulatorTimer = 0;
  }

  acquireText(initialState) {
    return this.textPool.acquire(initialState);
  }

  releaseText(text) {
    this.textPool.release(text);
  }

  addDamage(x, y, amount) {
    const now = Date.now();
    const timeSinceLast = now - this.lastDamageTime;
    const distFromLast = Math.sqrt(
      Math.pow(x - this.accumulatorPos.x, 2) +
        Math.pow(y - this.accumulatorPos.y, 2)
    );

    if (
      timeSinceLast < 300 &&
      distFromLast < this.damageMergeRadius &&
      this.damageAccumulator > 0
    ) {
      this.damageAccumulator += amount;
      this.accumulatorPos.x = (this.accumulatorPos.x + x) / 2;
      this.accumulatorPos.y = (this.accumulatorPos.y + y) / 2;
      this.accumulatorTimer = 10;

      const existing = this.texts.find((t) => t.isAccumulated);
      if (existing) {
        existing.text = `-${this.damageAccumulator}`;
        existing.size = 14 + Math.min(this.damageAccumulator * 1.5, 16);
        existing.life = 40;
        existing.x = this.accumulatorPos.x;
        existing.y = this.accumulatorPos.y;
      }
    } else {
      this.damageAccumulator = amount;
      this.accumulatorPos = { x, y };
      this.accumulatorTimer = 10;

      const beatClock = this.context?.get?.('beatClock') ?? window.beatClock;
      const beatPulse = beatClock ? beatClock.getBeatIntensity(8) : 0;
      const isOnBeat = beatPulse > 0.5;

      this.texts.push(
        this.acquireText({
          x,
          y,
          text: `-${amount}`,
          color: isOnBeat ? [255, 150, 150] : [255, 255, 255],
          size: 14 + Math.min(amount * 2, 10) + (isOnBeat ? 3 : 0),
          vy: -2 - Math.min(amount * 0.1, 1),
          vx: (Math.random() - 0.5) * 0.5,
          life: 40,
          maxLife: 40,
          isAccumulated: true,
          momentum: 1.0,
        })
      );
    }

    this.lastDamageTime = now;
  }

  addKill(x, y, enemyType, streak = 0) {
    const typeColors = {
      grunt: [50, 255, 50],
      rusher: [255, 50, 150],
      tank: [150, 100, 255],
      stabber: [255, 215, 0],
    };
    const color = typeColors[enemyType] || [255, 255, 255];

    const beatClock = this.context?.get?.('beatClock') ?? window.beatClock;
    const beatPulse = beatClock ? beatClock.getBeatIntensity(6) : 0;
    const sizeBonus = streak >= 5 ? 4 : streak >= 3 ? 2 : 0;

    this.texts.push(
      this.acquireText({
        x,
        y: y - 10,
        text: 'KILL!',
        color,
        size: 18 + sizeBonus + beatPulse * 2,
        vy: -2.5,
        vx: 0,
        life: 50,
        maxLife: 50,
        scale: 1.5,
        targetScale: 1.0,
        isKill: true,
        momentum: 0.95,
      })
    );

    if (streak >= 3) {
      this.texts.push(
        this.acquireText({
          x,
          y: y - 35,
          text: `${streak}x STREAK!`,
          color: [255, 200, 50],
          size: 14 + Math.min(streak, 8) + beatPulse * 2,
          vy: -3,
          vx: 0,
          life: 70,
          maxLife: 70,
          scale: 0.5,
          targetScale: 1.2,
          isStreak: true,
          momentum: 0.92,
        })
      );

      if (streak >= 5) {
        this.texts.push(
          this.acquireText({
            x: x + 30,
            y: y - 35,
            text: '✦',
            color: [255, 255, 100],
            size: 20,
            vy: -2,
            vx: 0.5,
            life: 40,
            maxLife: 40,
            scale: 1,
            momentum: 0.9,
            rotate: true,
            rotation: 0,
          })
        );
      }
    }
  }

  addScorePopup(x, y, score, isCombo = false) {
    const beatClock = this.context?.get?.('beatClock') ?? window.beatClock;
    const beatPulse = beatClock ? beatClock.getBeatIntensity(6) : 0;

    this.texts.push(
      this.acquireText({
        x,
        y,
        text: `+${score}`,
        color: isCombo ? [255, 215, 0] : [100, 255, 100],
        size: isCombo ? 20 : 16,
        vy: -2.2,
        vx: Math.random() - 0.5,
        life: 50,
        maxLife: 50,
        scale: 0.8 + beatPulse * 0.2,
        targetScale: 1.0,
        momentum: 0.96,
        isScore: true,
      })
    );
  }

  addText(x, y, text, color = [255, 255, 255], size = 14) {
    this.texts.push(
      this.acquireText({
        x,
        y,
        text,
        color,
        size,
        vy: -1.5,
        vx: 0,
        life: 45,
        maxLife: 45,
        scale: 1,
        momentum: 0.98,
      })
    );
  }

  update() {
    if (this.accumulatorTimer > 0) {
      this.accumulatorTimer--;
      if (this.accumulatorTimer <= 0) {
        this.damageAccumulator = 0;
      }
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];

      t.y += t.vy;
      t.x += t.vx || 0;

      if (t.momentum) {
        t.vy *= t.momentum;
        if (t.vx) t.vx *= t.momentum;
      } else {
        t.vy *= 0.97;
        if (t.vx) t.vx *= 0.97;
      }

      if (t.targetScale !== undefined && t.scale !== undefined) {
        t.scale += (t.targetScale - t.scale) * 0.15;
      }

      if (t.rotate) {
        t.rotation = (t.rotation || 0) + 0.1;
      }

      t.life--;
      if (t.life <= 0) {
        const lastIndex = this.texts.length - 1;
        this.releaseText(t);
        if (i !== lastIndex) {
          this.texts[i] = this.texts[lastIndex];
        }
        this.texts.pop();
      }
    }
  }

  draw(p) {
    for (const t of this.texts) {
      const lifePercent = t.life / t.maxLife;
      const alpha = lifePercent * 255;

      const fadeStart = 0.2;
      let displayAlpha = alpha;
      if (lifePercent < fadeStart) {
        displayAlpha = alpha * (lifePercent / fadeStart);
      }

      let displayScale = t.scale || 1;
      if (lifePercent > 0.8 && t.isKill) {
        displayScale = 1 + (1 - lifePercent) * 0.5;
      }

      p.push();
      p.translate(t.x, t.y);
      p.scale(displayScale);

      if (t.rotate && t.rotation) {
        p.rotate(t.rotation);
      }

      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(t.size);

      p.fill(0, 0, 0, displayAlpha * 0.5);
      p.noStroke();
      p.text(t.text, 2, 2);

      p.fill(t.color[0], t.color[1], t.color[2], displayAlpha);
      p.text(t.text, 0, 0);

      if (t.isStreak || t.isKill) {
        p.fill(t.color[0], t.color[1], t.color[2], displayAlpha * 0.3);
        p.text(t.text, 0, 0);
      }

      p.pop();
    }
  }
}
