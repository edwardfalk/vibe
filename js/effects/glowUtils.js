/**
 * Glow and gradient drawing utilities for visual effects.
 */

export function drawGlow(p, x, y, size, color, intensity = 1) {
  p.push();
  p.blendMode(p.ADD);
  p.noStroke();

  const maxLayers = 3;
  for (let i = 0; i < maxLayers; i++) {
    const alpha = (intensity * 255) / p.pow(2, i);
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
  for (let r = outerRadius; r > 0; r -= 2) {
    const inter = p.map(r, 0, outerRadius, 0, 1);
    const c = p.lerpColor(innerColor, outerColor, inter);
    p.fill(c);
    p.ellipse(x, y, r * 2, r * 2);
  }
  p.pop();
}
