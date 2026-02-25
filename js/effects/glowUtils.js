/**
 * Glow and gradient drawing utilities for visual effects.
 * Requires p5.js for pow(), map(), lerpColor(), blendMode(), etc.
 */

import { mapRange, constrain } from '../mathUtils.js';

export function drawGlow(p, x, y, size, color, intensity = 1) {
  p.push();
  p.blendMode(p.ADD);
  p.noStroke();

  const clampedIntensity = constrain(intensity, 0, 1);
  const maxLayers = 3;
  for (let i = 0; i < maxLayers; i++) {
    const alpha = Math.min(255, (clampedIntensity * 255) / Math.pow(2, i));
    const glowSize = size * (0.8 + i * 0.6);

    p.fill(p.red(color), p.green(color), p.blue(color), alpha);
    p.ellipse(x, y, glowSize, glowSize);
  }

  p.blendMode(p.BLEND);
  p.pop();
}

export function drawRadialGradient(
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
  for (let r = outerRadius; r > innerRadius; r -= 2) {
    const inter =
      outerRadius > innerRadius
        ? mapRange(r, innerRadius, outerRadius, 0, 1)
        : 0;
    const c = p.lerpColor(innerColor, outerColor, inter);
    p.fill(c);
    p.ellipse(x, y, r * 2, r * 2);
  }
  if (innerRadius > 0) {
    p.fill(innerColor);
    p.ellipse(x, y, innerRadius * 2, innerRadius * 2);
  }
  p.pop();
}
