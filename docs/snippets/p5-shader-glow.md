---
libraryId: /processing/p5.js
topic: shader-based glow (WEBGL)
lastVerified: 2025-08-12
status: curated
---

# p5.js – Shader-based Glow (WEBGL)

- For high-quality glow/bloom, use WEBGL and a simple two-pass blur approximation or additive rings.

## Minimal additive rings (cheap)
```js
function drawGlowRings(p, x, y, baseSize, rings = 3) {
  p.push();
  p.blendMode(p.ADD);
  for (let i = 0; i < rings; i++) {
    const a = 90 - i * 25;
    p.fill(255, 255, 200, a);
    p.noStroke();
    p.ellipse(x, y, baseSize * (1 + i * 0.6));
  }
  p.blendMode(p.BLEND);
  p.pop();
}
```

## Tip
- For real bloom, render to offscreen buffer and blur, then composite additively.
