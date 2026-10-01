import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { BaseEnemy } from '../../js/entities/BaseEnemy.js';
import { Grunt } from '../../js/entities/Grunt.js';
import { HEALTH_BAR_HEIGHT_PX } from '../../js/entities/BaseEnemyHelpers.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { transformP5 } from './helpers/transformP5.js';

// A beat clock frozen at a position; it opens no beat windows, so update()
// moves and aims the grunt but never fires
const clockAt = (beats) => ({
  getBeatPosition: () => beats,
  getTotalBeats: () => Math.floor(beats),
  getBeatPhase: () => beats % 1,
  getCurrentBeat: () => Math.floor(beats) % 4,
  isOnBeat: () => false,
  canGruntShoot: () => false,
  beatInterval: 500,
});
const gruntWith = (clock) => {
  const context = {
    get: (k) => (k === 'beatClock' ? clock : undefined),
    set() {},
  };
  const g = new Grunt(0, 0, 'grunt', { context }, createMockP5(), null);
  g.isSpawning = false;
  return g;
};
const HOP_PX = CONFIG.GRUNT_LOOK.HOP_PX;

afterEach(() => {
  CONFIG.GRUNT_LOOK.HOP_PX = HOP_PX;
  vi.restoreAllMocks();
});

describe('making a grunt', () => {
  it("rolls no more of the game's random numbers than any enemy does", () => {
    const spy = vi.spyOn(Math, 'random');
    const config = { size: 26, health: 2, speed: 1.2, color: null };
    new BaseEnemy(0, 0, 'grunt', config, createMockP5(), null);
    const base = spy.mock.calls.length;
    spy.mockClear();
    gruntWith(null);
    expect(spy.mock.calls.length).toBe(base);
  });
});

describe('drawing a grunt', () => {
  it("draws without the game's random numbers, apart from the hit-shake's two", () => {
    for (const clock of [clockAt(17.3), null]) {
      const g = gruntWith(clock);
      g.warnedOnBeat = 17; // draw the wind-up too
      const { p } = transformP5();
      const spy = vi.spyOn(Math, 'random');
      g.draw(p);
      expect(spy).toHaveBeenCalledTimes(0);
      g.hitFlash = 5;
      g.draw(p);
      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    }
  });

  it('turns to face a target on its left by mirroring, not by turning upside down', () => {
    const g = gruntWith(clockAt(17.3));
    g.update(-100, 0); // its target is straight to its left
    expect(g.facing).toBe(-1);
    const { p, shapes } = transformP5();
    g.draw(p);
    // Upright and flipped: x mirrored, y still down. The jelly draws four
    // sprites (plate, nozzle, helmet, gun); the old figure drew none
    const images = shapes.filter((s) => s.kind === 'image');
    expect(images.length).toBe(4);
    for (const { matrix } of images) {
      expect(Math.sign(matrix[0])).toBe(-1);
      expect(matrix[3]).toBeGreaterThan(0);
    }
  });

  it('winds up on the beat it was warned on, and sulks on the beat it held its fire', () => {
    const g = gruntWith(clockAt(16.6));
    g.warnedOnBeat = 16;
    expect(g.pose().charge).toBeCloseTo(0.6);
    g.warnedOnBeat = null;
    g.heldOnBeat = 16;
    expect(g.pose().droop).toBeGreaterThan(0);
    g.pendingStabDeath = true; // while its "ow" plays, no event shows
    expect(g.pose().droop).toBe(0);
    g.warnedOnBeat = 16;
    g.firedAt = 16.5;
    expect(g.pose().charge).toBe(0);
    expect(g.pose().flash).toBe(0);
  });

  it('keeps its health bar clear of its antennae, at any hop', () => {
    for (const hop of [HOP_PX, 12]) {
      CONFIG.GRUNT_LOOK.HOP_PX = hop;
      for (let i = 0; i < 80; i++) {
        const g = gruntWith(clockAt(16 + i / 20));
        g.aimAngle = i % 2 ? 0.4 : Math.PI - 0.4;
        g.facing = i % 2 ? 1 : -1;
        if (i % 4 === 0) g.warnedOnBeat = Math.floor(16 + i / 20);
        if (i % 4 === 1) g.heldOnBeat = Math.floor(16 + i / 20);
        g.health = 1; // damaged, so its health bar shows
        const { p, shapes, calls } = transformP5();
        g.draw(p);
        const top = Math.min(
          ...shapes
            .filter((s) => s.kind === 'ellipse' && s.blend !== 'add')
            .map((s) => s.top)
        );
        // The drawn bar's lower edge sits above everything else it draws
        const [, , barY, , barH] = calls.find(([k]) => k === 'rect');
        expect(barH).toBe(HEALTH_BAR_HEIGHT_PX);
        expect(Number.isFinite(top)).toBe(true);
        expect(top).toBeGreaterThan(barY + barH);
      }
    }
  });
});
