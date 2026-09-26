import { describe, it, expect } from 'vitest';
import { BackgroundRenderer } from '../../js/systems/BackgroundRenderer.js';

// A p5 stand-in whose drawing calls do nothing except count ellipses
function mockP() {
  const drawn = { ellipses: 0 };
  const known = {
    width: 800,
    height: 600,
    TWO_PI: Math.PI * 2,
    drawingContext: {},
    millis: () => 1000,
    sin: Math.sin,
    cos: Math.cos,
    floor: Math.floor,
    ellipse: () => drawn.ellipses++,
    createGraphics: () => mockP().p,
  };
  const p = new Proxy(known, {
    get: (t, k) => (k in t ? t[k] : () => {}),
  });
  return { p, drawn };
}

describe('Parallax background', () => {
  it('skips stars off the canvas, and debris off it keeps spinning', () => {
    const { p, drawn } = mockP();
    const beatClock = { getBeatIntensity: () => 0, getMeasurePhase: () => 0 };
    const context = { get: () => beatClock };
    const camera = { x: 0, y: 0 };
    const renderer = new BackgroundRenderer(p, camera, null, null, context);
    renderer.createParallaxBackground(p);
    const layers = renderer.parallaxLayers;
    for (const layer of layers) layer.elements = [];
    const [stars, debris] = [layers[1], layers[8]];
    stars.elements = [
      { x: 100, y: 100, size: 2, brightness: 1, twinkleSpeed: 0.02 },
      { x: -700, y: 100, size: 2, brightness: 1, twinkleSpeed: 0.02 },
    ];
    const offView = { x: -700, y: 100, size: 5, rotation: 0 };
    debris.elements = [{ ...offView, rotationSpeed: 0.01, shape: 'square' }];

    renderer.drawParallaxBackground(p);

    expect(drawn.ellipses).toBe(1);
    expect(debris.elements[0].rotation).toBeCloseTo(0.01);
  });
});
