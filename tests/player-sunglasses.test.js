import { describe, it, expect, vi } from 'vitest';
import { Player } from '../packages/entities/src/player.js';

vi.mock('@vibe/fx/visualEffects.js', () => ({
  drawGlow: vi.fn(),
}));

describe('Player sunglasses', () => {
  it('remain visible at low health while dashing', () => {
    const calls = [];
    const p = new Proxy(
      {
        frameCount: 0,
        BLEND: 'BLEND',
        ADD: 'ADD',
      },
      {
        get(target, prop) {
          if (prop in target) return target[prop];
          if (prop === 'sin') return Math.sin;
          if (prop === 'cos') return Math.cos;
          if (['rect', 'ellipse', 'stroke', 'strokeWeight', 'noTint'].includes(prop)) {
            return (...args) => calls.push({ method: prop, args });
          }
          return () => {};
        },
      }
    );

    const player = new Player(p, 0, 0, null);
    player.health = 5; // low health
    player.isDashing = true;
    player.isMoving = true; // triggers reflections
    player.draw(p);

    expect(calls.some((c) => c.method === 'noTint')).toBe(true);
    expect(
      calls.some(
        (c) => c.method === 'stroke' && c.args[0] === 255 && c.args.length === 1
      )
    ).toBe(true);
    const ellipseCount = calls.filter((c) => c.method === 'ellipse').length;
    expect(ellipseCount).toBeGreaterThanOrEqual(4);
  });
});
