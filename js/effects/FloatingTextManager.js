/**
 * Floating text system for damage numbers, kill text, combo indicators.
 * Rendered in world space (inside camera transform).
 * Enhanced with momentum physics, merging, and beat-synced effects.
 */

const DAMAGE_MERGE_RADIUS = 60;

export class FloatingTextManager {
  constructor(context = null) {
    this.context = context;
    this.texts = [];
    this.damageMergeRadius = DAMAGE_MERGE_RADIUS;
    this.lastDamageTime = 0;
    this.damageAccumulator = 0;
    this.accumulatorPos = { x: 0, y: 0 };
    this.accumulatorTimer = 0;
    this.accumulatedTextRef = null;
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

      // The text outlives the accumulator (life 40 vs 10 frames), so while
      // damage is still accumulating its text is always on screen.
      const t = this.accumulatedTextRef;
      t.text = `-${this.damageAccumulator}`;
      t.size = 14 + Math.min(this.damageAccumulator * 1.5, 16);
      t.life = 40;
      t.x = this.accumulatorPos.x;
      t.y = this.accumulatorPos.y;
    } else {
      this.damageAccumulator = amount;
      this.accumulatorPos = { x, y };
      this.accumulatorTimer = 10;

      const beatClock = this.context?.get?.('beatClock') ?? window.beatClock;
      const beatPulse = beatClock ? beatClock.getBeatIntensity(8) : 0;
      const isOnBeat = beatPulse > 0.5;

      const t = {
        x,
        y,
        text: `-${amount}`,
        color: isOnBeat ? [255, 150, 150] : [255, 255, 255],
        size: 14 + Math.min(amount * 2, 10) + (isOnBeat ? 3 : 0),
        vy: -2 - Math.min(amount * 0.1, 1),
        vx: (Math.random() - 0.5) * 0.5,
        life: 40,
        maxLife: 40,
        momentum: 1.0,
      };
      this.accumulatedTextRef = t;
      this.texts.push(t);
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

    const killText = {
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
    };
    this.texts.push(killText);

    if (streak >= 3) {
      const streakText = {
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
      };
      this.texts.push(streakText);

      if (streak >= 5) {
        const starText = {
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
        };
        this.texts.push(starText);
      }
    }
  }

  addText(x, y, text, color = [255, 255, 255], size = 14) {
    const t = {
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
    };
    this.texts.push(t);
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
      t.x += t.vx;
      t.vy *= t.momentum;
      t.vx *= t.momentum;

      if (t.targetScale !== undefined && t.scale !== undefined) {
        t.scale += (t.targetScale - t.scale) * 0.15;
      }

      if (t.rotate) {
        t.rotation += 0.1;
      }

      t.life--;
      if (t.life <= 0) {
        if (t === this.accumulatedTextRef) {
          this.accumulatedTextRef = null;
        }
        const lastIndex = this.texts.length - 1;
        if (i !== lastIndex) {
          this.texts[i] = this.texts[lastIndex];
        }
        this.texts.pop();
      }
    }
  }

  draw(p) {
    p.textAlign(p.CENTER, p.CENTER);
    p.noStroke();

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
        displayScale = Math.max(displayScale, 1 + (1 - lifePercent) * 0.5);
      }

      // Scaled or rotating texts draw in their own frame, around (0, 0)
      const needsTransform = (t.rotate && t.rotation) || displayScale !== 1;
      let x = t.x;
      let y = t.y;
      if (needsTransform) {
        p.push();
        p.translate(t.x, t.y);
        p.scale(displayScale);
        if (t.rotate && t.rotation) {
          p.rotate(t.rotation);
        }
        x = 0;
        y = 0;
      }

      p.textSize(t.size);

      if (t.isStreak || t.isKill) {
        p.fill(t.color[0], t.color[1], t.color[2], displayAlpha * 0.3);
        p.text(t.text, x, y);
      }
      p.fill(0, 0, 0, displayAlpha * 0.5);
      p.text(t.text, x + 2, y + 2);

      p.fill(t.color[0], t.color[1], t.color[2], displayAlpha);
      p.text(t.text, x, y);

      if (needsTransform) p.pop();
    }
  }
}
