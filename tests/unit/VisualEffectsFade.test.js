import { describe, it, expect } from 'vitest';
import VisualEffectsManager from '../../js/effects/VisualEffectsManager.js';

describe('VisualEffectsManager fade', () => {
  it('chromatic aberration fades to zero over its duration', () => {
    const vfx = new VisualEffectsManager();
    vfx.triggerChromaticAberration(0.8, 4);
    vfx.update();
    expect(vfx.chromaticAberration).toBeCloseTo(0.6);
    vfx.update();
    vfx.update();
    vfx.update();
    expect(vfx.chromaticAberration).toBe(0);
    vfx.update();
    expect(vfx.chromaticAberration).toBe(0);
  });

  it('bloom fades to zero over its duration', () => {
    const vfx = new VisualEffectsManager();
    vfx.triggerBloom(0.4, 2);
    vfx.update();
    expect(vfx.bloomIntensity).toBeCloseTo(0.2);
    vfx.update();
    expect(vfx.bloomIntensity).toBe(0);
  });

  it("a weaker chroma trigger doesn't cut short a stronger flash", () => {
    const vfx = new VisualEffectsManager();
    vfx.triggerChromaticAberration(0.8, 45);
    vfx.triggerChromaticAberration(0.3, 20);
    expect(vfx.chromaticAberration).toBe(0.8);
    vfx.update();
    expect(vfx.chromaticAberration).toBeCloseTo((0.8 * 44) / 45);
  });

  it('reset clears a flash in progress', () => {
    const vfx = new VisualEffectsManager();
    vfx.triggerChromaticAberration(0.8, 45);
    vfx.triggerBloom(0.4, 20);
    vfx.reset();
    vfx.update();
    expect(vfx.chromaticAberration).toBe(0);
    expect(vfx.bloomIntensity).toBe(0);
  });
});
