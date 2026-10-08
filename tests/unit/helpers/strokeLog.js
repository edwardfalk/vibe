// A canvas context that logs each stroke's style; any other call does nothing.
// p is a p5 stand-in holding it; colours() is the set of styles stroked
export function strokeLog() {
  const styles = [];
  const state = { globalAlpha: 1 };
  const ctx = new Proxy(state, {
    get: (t, k) => {
      if (k === 'stroke') return () => styles.push(t.strokeStyle);
      if (k in t) return t[k];
      return () => {};
    },
  });
  return { p: { drawingContext: ctx }, colours: () => new Set(styles) };
}
