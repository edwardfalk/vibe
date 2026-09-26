import { describe, it, expect } from 'vitest';
import { EnemyFragmentExplosion } from '../../js/effects/explosions/EnemyFragmentExplosion.js';

// A p5 Color stand-in: an object, not an array, with its RGBA in .levels
const color = (r, g, b) => ({ levels: [r, g, b, 255] });

function recordingP5() {
  const fills = [];
  const noop = () => {};
  return {
    fills,
    fill: (...args) => fills.push(args),
    map: (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c),
    noStroke: noop,
    ellipse: noop,
    push: noop,
    pop: noop,
    translate: noop,
    rotate: noop,
    beginShape: noop,
    vertex: noop,
    endShape: noop,
    rect: noop,
    CLOSE: 'close',
  };
}

describe('EnemyFragmentExplosion colours', () => {
  it('draws fragments in the enemy colours, fading with life', () => {
    const enemy = {
      type: 'grunt',
      size: 20,
      bodyColor: color(1, 2, 3),
      skinColor: color(4, 5, 6),
      helmetColor: color(7, 8, 9),
      weaponColor: color(10, 11, 12),
    };
    const explosion = new EnemyFragmentExplosion(0, 0, enemy);
    for (const f of explosion.fragments) f.life = f.maxLife / 2;
    const p = recordingP5();
    explosion.centralExplosion.particles = [];
    explosion.draw(p);

    const fragmentFills = p.fills.filter((args) => args[0] !== 255);
    expect(fragmentFills.length).toBe(explosion.fragments.length);
    for (const args of fragmentFills) {
      expect(args.slice(0, 3).every(Number.isFinite)).toBe(true);
      expect(args[3]).toBeCloseTo(127.5);
    }
    expect(fragmentFills.map((args) => args[0])).toEqual(
      expect.arrayContaining([1, 4, 7, 10])
    );
  });
});
