---
libraryId: /processing/p5.js
topic: instance mode
lastVerified: 2025-08-12
status: curated
---

# p5.js Instance Mode – Vibe Canonical Cheatsheet

- Always prefix p5 calls with `p.` or `this.p.`.
- Do not use p5 globals; import math from `@vibe/core/mathUtils.js`.
- Keep rendering pure; do not attach game systems to `p`.

## Minimal pattern
```js
export function createSketch(drawFn) {
  return (p) => {
    p.setup = () => {
      p.createCanvas(800, 600);
      p.noSmooth();
    };
    p.draw = () => drawFn(p);
  };
}
```

## Common gotchas
- Arrow methods on `p5.prototype` break `this`; use `function()` if extending.
- Gate probes on readiness (see readiness snippet).
