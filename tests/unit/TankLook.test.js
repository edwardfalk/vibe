import { describe, it, expect, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { Tank } from '../../js/entities/Tank.js';
import {
  tankParts,
  tankMuzzle,
  MUZZLE,
} from '../../js/entities/TankRenderer.js';
import { HEALTH_BAR_HEIGHT_PX } from '../../js/entities/BaseEnemyHelpers.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { transformP5 } from './helpers/transformP5.js';

const LOOK = { ...CONFIG.TANK_LOOK };
afterEach(() => Object.assign(CONFIG.TANK_LOOK, LOOK));

// A tank posed at a beat position, without updating it
const tankAt = (beats, facing = 0) => {
  const clock = { getBeatPosition: () => beats, beatInterval: 500 };
  const context = { get: (k) => (k === 'beatClock' ? clock : undefined) };
  const t = new Tank(200, 150, 'tank', { context }, createMockP5(), null);
  t.isSpawning = false;
  t.facing = facing;
  t.turn = { from: facing, to: facing, at: null };
  t.poseBeats = beats;
  return t;
};
const drawnSize = () => 50 * CONFIG.TANK_LOOK.ART_SCALE;
const imageOf = (shapes, part) =>
  shapes.find((sh) => sh.kind === 'image' && sh.g === part.g);
const near = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe('drawing the tank', () => {
  it('turns his whole body with his facing', () => {
    for (const facing of [0, 1, 2.5, -2]) {
      const t = tankAt(18, facing); // beat 3, at rest: no swagger yet
      const { p, shapes } = transformP5();
      t.draw(p);
      const slab = imageOf(shapes, tankParts(p, drawnSize()).slab);
      expect(
        near(Math.atan2(slab.matrix[1], slab.matrix[0]), facing)
      ).toBeLessThan(1e-6);
    }
  });

  it('draws his cannon where his shot leaves it, across his whole arc', () => {
    for (const [facing, gunRel] of [
      [0, 0],
      [0.8, -0.9],
      [-2.4, 1.1],
      [0.3, 1.5], // past the prototype's own ±1.25 clamp: an AIM_ARC_DEG of 90
    ]) {
      const t = tankAt(18, facing);
      t.gunRel = gunRel;
      const { p, shapes } = transformP5();
      t.draw(p);
      const s = drawnSize();
      const [a, b, , , e, f] = imageOf(shapes, tankParts(p, s).cannon).matrix;
      const X = MUZZLE * s; // the muzzle in the cannon's own frame
      const shot = tankMuzzle(t.x, t.y, s, facing, gunRel);
      expect(Math.hypot(a * X + e - shot.x, b * X + f - shot.y)).toBeLessThan(
        0.5
      );
    }
  });

  it('keeps his health bar above his body, shoulders and cannon, whichever way he faces and however he strains', () => {
    for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.7]) {
      for (const beats of [18, 24.5, 27.9]) {
        // At rest; mid-charge; the charge's last half-beat, angry
        const t = tankAt(beats, facing);
        t.chargingShot = beats > 20;
        t.chargeStartBeat = 20;
        t.isAngry = beats === 27.9;
        t.health = 1; // damaged, so the bar shows
        const { p, shapes, calls } = transformP5();
        t.draw(p);
        // Jets flare past it only on a lurch, and chunks only when a plate
        // breaks; these poses do neither (the spec allows both)
        const top = Math.min(
          ...shapes.filter((sh) => sh.blend !== 'add').map((sh) => sh.top)
        );
        const [, , barY, , barH] = calls.find(
          ([k, , , w, h]) =>
            k === 'rect' && h === HEALTH_BAR_HEIGHT_PX && w === t.size * 1.2
        );
        expect(Number.isFinite(top)).toBe(true);
        expect(top, `facing ${facing}, beat ${beats}`).toBeGreaterThan(
          barY + barH
        );
      }
    }
  });

  it('rebuilds his sprites when his drawn size changes, and removes the old ones', () => {
    const t = tankAt(18);
    const { p, graphics } = transformP5();
    t.draw(p);
    const first = graphics.length;
    CONFIG.TANK_LOOK.ART_SCALE = 1.2;
    t.draw(p);
    expect(graphics.length).toBeGreaterThan(first);
    expect(graphics.slice(0, first).every((g) => g.removed)).toBe(true);
  });

  it('stays solid when hit, and fades in whole while he spawns, overlays included', () => {
    const hit = tankAt(17.3);
    hit.hitFlash = 5;
    const a = transformP5();
    hit.draw(a.p);
    expect(
      a.shapes.filter((sh) => sh.kind === 'image').every((sh) => sh.alpha === 1)
    ).toBe(true);

    const spawning = tankAt(17.3);
    spawning.chargingShot = true; // veins and a flush: overlays drawn at their own alpha
    spawning.chargeStartBeat = 12;
    spawning.isSpawning = true;
    spawning.spawnTimer = spawning.spawnDuration / 2;
    const b = transformP5();
    spawning.draw(b.p);
    const images = b.shapes.filter((sh) => sh.kind === 'image');
    expect(images[0].alpha).toBeCloseTo(0.5, 2); // the slab at the fade's alpha
    // None reset to 1: BaseEnemy rounds the fade to 1/255 steps, so compare
    // with the slab's own alpha
    expect(images.every((sh) => sh.alpha <= images[0].alpha + 1e-9)).toBe(true);
  });
});
