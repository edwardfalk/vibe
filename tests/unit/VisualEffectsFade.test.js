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
});
