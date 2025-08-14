---
libraryId: /processing/p5.js
topic: additive blending
lastVerified: 2025-08-12
status: curated
---

# p5.js – Additive Blending for Flash/Glow

- Use `p.blendMode(p.ADD)` for bright additive passes, then restore `p.BLEND`.
- Keep particle alpha low to avoid overblow; draw inner core last.

## Pattern
```js
function drawFlash(p, x, y, size, color) {
  p.push();
  p.blendMode(p.ADD);
  p.noStroke();
  p.fill(color.levels[0], color.levels[1], color.levels[2], 60);
  p.ellipse(x, y, size * 2);
  p.fill(255, 255, 255, 180);
  p.ellipse(x, y, size * 0.5);
  p.blendMode(p.BLEND);
  p.pop();
}
```
