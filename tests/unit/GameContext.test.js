import { describe, it, expect, vi } from 'vitest';

vi.stubGlobal('window', {});

const { GameContext } = await import('../../js/core/GameContext.js');

describe('GameContext', () => {
  it('stores and retrieves values', () => {
    const ctx = new GameContext();
    ctx.set('foo', 42);
    expect(ctx.get('foo')).toBe(42);
  });

  it('initializes from constructor argument', () => {
    const ctx = new GameContext({ a: 1, b: 2 });
    expect(ctx.get('a')).toBe(1);
    expect(ctx.get('b')).toBe(2);
  });

  it('assign merges multiple values', () => {
    const ctx = new GameContext({ x: 1 });
    ctx.assign({ y: 2, z: 3 });
    expect(ctx.get('x')).toBe(1);
    expect(ctx.get('y')).toBe(2);
    expect(ctx.get('z')).toBe(3);
  });

  it('toObject returns shallow copy', () => {
    const ctx = new GameContext({ a: 1 });
    const obj = ctx.toObject();
    expect(obj).toEqual({ a: 1 });
    obj.a = 999;
    expect(ctx.get('a')).toBe(1);
  });

  it('returns undefined for missing keys', () => {
    const ctx = new GameContext();
    expect(ctx.get('nonexistent')).toBeUndefined();
  });

  it('set returns the value', () => {
    const ctx = new GameContext();
    const result = ctx.set('k', 'v');
    expect(result).toBe('v');
  });
});
