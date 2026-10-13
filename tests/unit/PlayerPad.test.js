import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../../js/entities/player.js';
import { heroMuzzle } from '../../js/entities/PlayerRenderer.js';
import { CONFIG } from '../../js/config.js';

// A hero at (0, 0), no keys down, the mouse straight below him; `pad` is
// what InputHandlers.pollGamepad wrote
function hero(pad, keys = []) {
  const p = {
    color: () => ({}),
    keyIsDown: (code) => keys.includes(code),
    constrain: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    cos: Math.cos,
    sin: Math.sin,
    mouseX: 0,
    mouseY: 100,
  };
  globalThis.window = { playerIsShooting: false, ...pad };
  return new Player(p, 0, 0, null, { playerBullets: [] });
}

const FRAME = CONFIG.GAME_SETTINGS.FRAME_TIME_MS;
const W = 87;

describe('Player on a controller', () => {
  beforeEach(() => {
    globalThis.window = {};
  });

  it('the left stick moves him its way, at his one speed', () => {
    const h = hero({ padMove: { x: 0.6, y: -0.8 } });
    h.update(FRAME);
    expect(h.isMoving).toBe(true);
    expect(h.x).toBeCloseTo(0.6 * h.speed);
    expect(h.y).toBeCloseTo(-0.8 * h.speed);
  });

  it('WASD wins over the stick', () => {
    const h = hero({ padMove: { x: 0.6, y: -0.8 } }, [W]);
    h.update(FRAME);
    expect(h.x).toBeCloseTo(0);
    expect(h.y).toBeCloseTo(-h.speed);
  });

  it('the right stick aims; without it the mouse does', () => {
    const h = hero({ padAim: 2.7 });
    h.update(FRAME);
    expect(h.aimAngle).toBeCloseTo(2.7);
    window.padAim = null;
    h.update(FRAME);
    expect(Math.cos(h.aimAngle)).toBeCloseTo(0, 1); // down, to the mouse
    expect(Math.sin(h.aimAngle)).toBeGreaterThan(0);
  });

  it('the right stick turns him round: his shot leaves the gun on that side', () => {
    const h = hero({ padAim: Math.PI });
    h.update(FRAME);
    expect(h.facing).toBe(-1);
    const b = h.fireBullet();
    const m = heroMuzzle(h.x, h.y, Math.PI, -1, h.drawnSize());
    expect(b.x).toBeCloseTo(m.x, 6);
    expect(b.y).toBeCloseTo(m.y, 6);
  });

  it('the arrow keys win over a kept right-stick aim', () => {
    const h = hero({ padAim: 2.7, arrowUpPressed: true });
    h.update(FRAME);
    expect(h.aimAngle).toBeCloseTo(-Math.PI / 2);
  });

  it('he dashes along the left stick, else along the right stick', () => {
    let h = hero({ padMove: { x: 0.6, y: -0.8 }, padAim: 2.7 });
    expect(h.dash()).toBe(true);
    expect(h.dashVelocity.x).toBeCloseTo(0.6 * h.dashSpeed);
    expect(h.dashVelocity.y).toBeCloseTo(-0.8 * h.dashSpeed);
    h = hero({ padMove: null, padAim: 2.7 });
    expect(h.dash()).toBe(true);
    expect(h.dashVelocity.x).toBeCloseTo(Math.cos(2.7) * h.dashSpeed);
    expect(h.dashVelocity.y).toBeCloseTo(Math.sin(2.7) * h.dashSpeed);
  });
});
