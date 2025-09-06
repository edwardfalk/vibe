import { describe, it, expect } from 'vitest';
import VisualEffectsManager from '../src/visualEffects.js';
import { getDominantEnemyColor } from '../src/VFXDispatcher.js';

describe('chromatic aberration color handling', () => {
  it('sets chromatic color via triggerChromaticAberration', () => {
    const manager = new VisualEffectsManager([]);
    manager.triggerChromaticAberration(0.7, 40, [1, 2, 3]);
    expect(manager.chromaticColor).toEqual([1, 2, 3]);
    expect(manager.chromaticAberration).toBe(0.7);
    expect(manager.chromaticAberrationFrames).toBe(40);
  });

  it('maps dominant enemy types to colors', () => {
    const enemies = [
      { type: 'rusher' },
      { type: 'rusher' },
      { type: 'stabber' },
    ];
    expect(getDominantEnemyColor(enemies)).toEqual([255, 0, 0]);
  });
});
