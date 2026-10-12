import { describe, it, expect, vi } from 'vitest';
import { CameraSystem } from '../../js/systems/CameraSystem.js';
import { BaseEnemy } from '../../js/entities/BaseEnemy.js';

// A p5 stand-in that records the moves drawing makes, on frame `frameCount`
function moves(frameCount = 0) {
  const calls = [];
  const p = {
    width: 800,
    height: 600,
    frameCount,
    push() {},
    pop() {},
    translate: (x, y) => calls.push(['translate', x, y]),
    scale: (x, y) => calls.push(['scale', x, y]),
  };
  return { p, calls };
}

describe('a pause holds the shakes still', () => {
  it("the camera's shake neither moves the world nor runs down while paused", () => {
    const { p, calls } = moves();
    const camera = new CameraSystem(p);
    camera.addShake(8, 12);
    const left = camera.screenShake.duration;
    camera.applyTransform(false);
    camera.applyTransform(false);
    expect(calls).toEqual([
      ['translate', 400, 300],
      ['translate', 400, 300],
    ]);
    expect(camera.screenShake.duration).toBe(left);
    calls.length = 0;
    camera.applyTransform();
    expect(calls).toHaveLength(2); // the shake, then the camera
    expect(camera.screenShake.duration).toBeLessThan(left);
  });

  it("an enemy's hit shake draws the same on every frame nothing updates", () => {
    const enemy = new BaseEnemy(
      0,
      0,
      'grunt',
      { size: 30, health: 3, speed: 1 },
      {},
      null
    );
    enemy.hitFlash = 6;
    const random = vi.spyOn(Math, 'random');
    try {
      const a = moves(10);
      enemy.applyHitShake(a.p);
      const b = moves(11);
      enemy.applyHitShake(b.p);
      expect(random).not.toHaveBeenCalled();
      expect(b.calls).toEqual(a.calls);
      expect(a.calls[0][1]).not.toBe(0); // it does shake
    } finally {
      random.mockRestore();
    }
  });
});
