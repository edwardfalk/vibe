import { describe, it, expect } from 'vitest';
import { PsychedelicEffects } from '../src/PsychedelicEffects.js';

class MockP5 {
  constructor() {
    this.translateCalls = [];
    this.strokeCalls = [];
    this.width = 200;
    this.height = 200;
    // mimic p5 constant for colorMode
    this.HSL = 'hsl';
  }
  push() {}
  pop() {}
  noFill() {}
  strokeWeight() {}
  translate(x, y) { this.translateCalls.push({ x, y }); }
  colorMode() {}
  stroke(h, s, l, a) { this.strokeCalls.push({ h, s, l, a }); }
  beginShape() {}
  vertex() {}
  endShape() {}
}

describe('PsychedelicEffects.drawBackgroundWaves', () => {
  it('translates with camera offset and applies muted rainbow stroke', () => {
    const p = new MockP5();
    const fx = new PsychedelicEffects();

    fx.drawBackgroundWaves(p, { x: 100, y: 50 });

    expect(p.translateCalls[0]).toEqual({ x: -10, y: -5 });
    expect(p.strokeCalls.length).toBeGreaterThan(0);
    const first = p.strokeCalls[0];
    expect(first.s).toBe(80);
    expect(first.l).toBe(60);
    expect(first.a).toBe(40);
  });
});

