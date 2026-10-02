import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { BaseEnemy } from '../../js/entities/BaseEnemy.js';
import { Grunt } from '../../js/entities/Grunt.js';
import { Tank } from '../../js/entities/Tank.js';
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
const DEFAULTS = { ...CONFIG.GRUNT_LOOK };

afterEach(() => {
  Object.assign(CONFIG.GRUNT_LOOK, DEFAULTS);
  vi.restoreAllMocks();
});

const tankWith = (clock) => {
  const context = {
    get: (k) => (k === 'beatClock' ? clock : undefined),
    set() {},
  };
  const t = new Tank(0, 0, 'tank', { context }, createMockP5(), null);
  t.isSpawning = false;
  return t;
};
const KINDS = [
  {
    kind: 'grunt',
    make: gruntWith,
    base: ['grunt', { size: 26, health: 2, speed: 1.2, color: null }],
    busy: (g) => {
      g.warnedOnBeat = 17; // the wind-up
    },
  },
  {
    kind: 'tank',
    make: tankWith,
    base: ['tank', { size: 50, health: 60, speed: 0.2, color: null }],
    busy: (t) => {
      t.chargingShot = true; // the second bar of his charge
      t.chargeStartBeat = 12;
      t.poseBeats = 17.3;
    },
  },
];

describe.each(KINDS)('a $kind', ({ make, base, busy }) => {
  it("rolls no more of the game's random numbers than any enemy does", () => {
    const spy = vi.spyOn(Math, 'random');
    new BaseEnemy(0, 0, base[0], base[1], createMockP5(), null);
    const plain = spy.mock.calls.length;
    spy.mockClear();
    make(null);
    expect(spy.mock.calls.length).toBe(plain);
  });

  it("draws without the game's random numbers, apart from the hit-shake's two", () => {
    for (const clock of [clockAt(17.3), null]) {
      const e = make(clock);
      busy(e);
      const { p } = transformP5();
      const spy = vi.spyOn(Math, 'random');
      e.draw(p);
      expect(spy).toHaveBeenCalledTimes(0);
      e.hitFlash = 5;
      e.draw(p);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(p.drawingContext.globalAlpha).toBe(1); // restored after drawing
      spy.mockRestore();
    }
  });

  it('stops dancing while the game is paused, and moves on when it updates again', () => {
    let beats = 17.1;
    const clock = { ...clockAt(17.1), getBeatPosition: () => beats };
    const e = make(clock);
    e.update(100, 0);
    const before = e.pose();
    beats = 17.4; // the beat moves on, but the game is paused: no update
    expect(e.pose()).toEqual(before);
    e.update(100, 0);
    expect(e.pose().t).toBeGreaterThan(before.t);
  });
});

describe('drawing a grunt', () => {
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

  it('keeps its health bar clear of its antennae, at any hop and size', () => {
    for (const [hop, scale] of [
      [DEFAULTS.HOP_PX, DEFAULTS.ART_SCALE],
      [12, DEFAULTS.ART_SCALE],
      [12, 0.8],
      [12, 1.6],
      [DEFAULTS.HOP_PX, 1.6],
    ]) {
      CONFIG.GRUNT_LOOK.HOP_PX = hop;
      CONFIG.GRUNT_LOOK.ART_SCALE = scale;
      for (let i = 0; i < 80; i++) {
        const g = gruntWith(clockAt(16 + i / 20));
        g.aimAngle = i % 2 ? 0.4 : Math.PI - 0.4;
        g.facing = i % 2 ? 1 : -1;
        if (i % 4 === 0) g.warnedOnBeat = Math.floor(16 + i / 20);
        if (i % 4 === 1) g.heldOnBeat = Math.floor(16 + i / 20);
        // Every other one fired on its last snare (beats 2 and 4 are odd
        // here): those do the full hop, which lifts the antennae highest
        if (i % 2 === 0) g.firedAt = Math.floor((16 + i / 20 - 1) / 2) * 2 + 1;
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
