import { describe, it, expect } from 'vitest';
import { spriteParts } from '../../js/entities/spriteCache.js';
import { transformP5 } from './helpers/transformP5.js';

const tableA = { dot: [[-1, -1, 1, 1], (g, s) => g.ellipse(0, 0, s, s)] };
const tableB = { box: [[-1, -1, 1, 1], (g, s) => g.rect(0, 0, s, s)] };

describe('the sprite cache', () => {
  it('builds a table once per size, keeps tables apart, and removes a table’s old sprites only', () => {
    const { p, graphics } = transformP5();
    const a = spriteParts(p, tableA, 10);
    expect(spriteParts(p, tableA, 10)).toBe(a); // reused, not rebuilt
    const b = spriteParts(p, tableB, 20);
    expect(spriteParts(p, tableA, 10)).toBe(a); // B didn't evict A
    const a2 = spriteParts(p, tableA, 12);
    expect(a2).not.toBe(a);
    expect(a.dot.g.removed).toBe(true);
    expect(b.box.g.removed).toBe(false);
    expect(graphics).toHaveLength(3);
  });
});
