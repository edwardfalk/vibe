// A p5 stand-in for drawing tests. It keeps the transform matrix the way p5
// does (push, pop, translate, rotate, scale) and records each ellipse and
// image with where it lands on screen. Any other call (fill, arc, rect, ...)
// is recorded by name in `calls`. createGraphics returns a plain recorder
// that notes whether it was removed.
// A raw canvas context stand-in: properties set on it (globalAlpha,
// fillStyle, ...) read back; save() and restore() keep and bring back that
// state, as a canvas does; every fill, stroke and image notes the alpha it
// was drawn at, in alphasDrawn; any other call does nothing
function rawContext() {
  const state = { globalAlpha: 1 };
  const saved = [];
  const alphasDrawn = [];
  const DRAWS = new Set(['fill', 'stroke', 'fillRect', 'drawImage']);
  return new Proxy(state, {
    get: (t, k) => {
      if (k === 'save') return () => saved.push({ ...t });
      if (k === 'restore') return () => Object.assign(t, saved.pop());
      if (k === 'alphasDrawn') return alphasDrawn;
      if (k in t) return t[k];
      if (DRAWS.has(k)) return () => alphasDrawn.push(t.globalAlpha);
      return () => {};
    },
  });
}

export function transformP5() {
  // [a, b, c, d, e, f]: screen x = a·x + c·y + e, screen y = b·x + d·y + f
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  let blend = 'blend';
  const shapes = [];
  const calls = [];
  const graphics = [];
  const apply = ([A, B, C, D, E, F]) => {
    const [a, b, c, d, e, f] = m;
    m = [
      a * A + c * B,
      b * A + d * B,
      a * C + c * D,
      b * C + d * D,
      a * E + c * F + e,
      b * E + d * F + f,
    ];
  };
  const at = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  // The highest screen y an ellipse (w by h, centred on x, y) reaches
  const topOf = (x, y, w, h) => {
    let top = Infinity;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * 2 * Math.PI;
      top = Math.min(
        top,
        at(x + (Math.cos(a) * w) / 2, y + (Math.sin(a) * h) / 2)[1]
      );
    }
    return top;
  };
  const recorder = () =>
    new Proxy(
      {
        CHORD: 'chord',
        removed: false,
        drawingContext: new Proxy({}, { get: () => () => {} }),
        remove() {
          this.removed = true;
        },
      },
      { get: (t, k) => t[k] ?? (() => {}) }
    );
  const p = {
    CHORD: 'chord',
    CLOSE: 'close',
    ADD: 'add',
    BLEND: 'blend',
    TWO_PI: 2 * Math.PI,
    frameCount: 7,
    drawingContext: rawContext(),
    push: () => stack.push(m),
    pop: () => {
      m = stack.pop();
    },
    translate: (x, y) => apply([1, 0, 0, 1, x, y]),
    rotate: (r) =>
      apply([Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]),
    scale: (x, y = x) => {
      calls.push(['scale', x, y]);
      apply([x, 0, 0, y, 0, 0]);
    },
    blendMode: (mode) => {
      blend = mode;
    },
    ellipse: (x, y, w, h = w) =>
      shapes.push({
        kind: 'ellipse',
        centre: at(x, y),
        top: topOf(x, y, w, h),
        blend,
      }),
    image: (g, x, y, w = 0, h = 0) => {
      const corners = [at(x, y), at(x + w, y), at(x, y + h), at(x + w, y + h)];
      shapes.push({
        kind: 'image',
        g,
        origin: at(x, y),
        matrix: m,
        blend,
        alpha: p.drawingContext.globalAlpha,
        top: Math.min(...corners.map(([, cy]) => cy)),
      });
    },
    createGraphics: () => {
      const g = recorder();
      graphics.push(g);
      return g;
    },
  };
  const proxy = new Proxy(p, {
    get: (t, k) =>
      k in t
        ? t[k]
        : (...args) => {
            calls.push([k, ...args]);
          },
  });
  return { p: proxy, shapes, calls, graphics };
}
