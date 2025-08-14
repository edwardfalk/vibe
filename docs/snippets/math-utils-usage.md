---
libraryId: internal
topic: math utils usage
lastVerified: 2025-08-12
status: curated
---

# Math Utils Usage – Deterministic Angles/Trig/Distance

- Import from `@vibe/core/mathUtils.js`:
```js
import { PI, TWO_PI, dist, sin, cos, atan2, sqrt, min, max } from '@vibe/core';
```
- Forbid `Math.PI`, `2 * Math.PI`, p5 global `dist/sin/cos`.
- Angle wrap/compare must use `PI`/`TWO_PI` consistently.

## Distance + angle example
```js
import { dist, atan2, PI } from '@vibe/core';

function aim(fromX, fromY, toX, toY) {
  const d = dist(fromX, fromY, toX, toY);
  const angle = atan2(toY - fromY, toX - fromX);
  const clamped = d < 1 ? 0 : d;
  return { d: clamped, angle: angle % (2 * PI) };
}
```
