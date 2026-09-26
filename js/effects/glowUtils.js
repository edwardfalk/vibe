/**
 * Glow and gradient drawing utilities for visual effects.
 * Requires p5.js for pow(), map(), lerpColor(), blendMode(), etc.
 */

import { constrain } from '../mathUtils.js';

// rgb is an [r, g, b] array
export function drawGlow(p, x, y, size, rgb, intensity = 1) {
  if (intensity < 0.05) return;

  p.push();
  p.blendMode(p.ADD);
  p.noStroke();

  const clampedIntensity = constrain(intensity, 0, 1);
  const maxLayers = 2;
  for (let i = 0; i < maxLayers; i++) {
    const alpha = Math.min(255, (clampedIntensity * 255) / Math.pow(2, i));
    const glowSize = size * (0.8 + i * 0.6);

    p.fill(rgb[0], rgb[1], rgb[2], alpha);
    p.ellipse(x, y, glowSize, glowSize);
  }

  p.blendMode(p.BLEND);
  p.pop();
}
