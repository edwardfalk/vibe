// Utility wrapper to execute drawing code with a temporary blendMode then restore the default
export function withBlendMode(p, mode, drawFn) {
  if (!p || typeof p.blendMode !== 'function') return drawFn?.();
  const DEFAULT_MODE = p.BLEND; // p5 does not expose getter for current mode; assume BLEND baseline
  p.blendMode(mode);
  try {
    drawFn?.();
  } finally {
    p.blendMode(DEFAULT_MODE);
  }
}
