import { describe, it, expect, vi } from 'vitest';
import { CONFIG } from '../../js/config.js';
import {
  drawGrunt,
  gruntMuzzle,
  gruntPose,
  nextFacing,
  SHOULDER,
} from '../../js/entities/GruntRenderer.js';
import { transformP5 } from './helpers/transformP5.js';

const SIZE = 26;
const S = SIZE * CONFIG.GRUNT_LOOK.ART_SCALE;
const AIMS = [0, 0.6, Math.PI - 0.6, -Math.PI / 2 + 0.3, 2.5];
const pose = (aimAngle, o = {}) =>
  gruntPose({
    beats: 17.02,
    beatSec: 0.5,
    seed: 0.3,
    aimAngle,
    facing: nextFacing(1, aimAngle),
    size: S,
    ...o,
  });
// drawGrunt draws the gun last, so the last image is the gun
const gunOf = (shapes) => shapes.filter((s) => s.kind === 'image').at(-1);
const angleBetween = (a, b) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

describe("the grunt's gun", () => {
  it('points where its shot goes, through the wind-up and the shot', () => {
    for (const aim of AIMS) {
      for (const events of [{ warn: 0.7 }, { sinceShot: 0.02 }]) {
        const { p, shapes } = transformP5();
        drawGrunt(p, S, pose(aim, events));
        const [a, b] = gunOf(shapes).matrix;
        expect(angleBetween(Math.atan2(b, a), aim)).toBeLessThan(1e-9);
      }
    }
  });

  it('stays on its shoulder as it dances, floats and leans', () => {
    for (let i = 0; i < 40; i++) {
      for (const aim of [0.3, Math.PI - 0.3]) {
        const { p, shapes } = transformP5();
        drawGrunt(p, S, pose(aim, { beats: 16 + i / 10 }));
        // The nozzle is drawn straight under the body's transforms
        const [a, b, c, d, e, f] = shapes.filter((s) => s.kind === 'image')[1]
          .matrix;
        const [x, y] = [SHOULDER[0] * S, SHOULDER[1] * S];
        const gun = gunOf(shapes).matrix;
        expect(gun[4]).toBeCloseTo(a * x + c * y + e, 6);
        expect(gun[5]).toBeCloseTo(b * x + d * y + f, 6);
      }
    }
  });

  it('ends where its shot starts', () => {
    for (const aim of AIMS) {
      // At rest, charging: the charge glows at the drawn muzzle
      const rest = { ...pose(aim, { beats: null }), charge: 1 };
      const { p, shapes } = transformP5();
      drawGrunt(p, S, rest);
      const gun = shapes.indexOf(gunOf(shapes));
      const charge = shapes.slice(gun).find((s) => s.blend === 'add');
      const muzzle = gruntMuzzle(0, 0, SIZE, aim, rest.face);
      expect(charge.centre[0]).toBeCloseTo(muzzle.x, 6);
      expect(charge.centre[1]).toBeCloseTo(muzzle.y, 6);
    }
  });
});

describe('drawing a grunt', () => {
  it('mirrors every part of it to face a target on its left', () => {
    for (const facing of [1, -1]) {
      const aim = facing === 1 ? 0.2 : Math.PI - 0.2;
      const { p, shapes } = transformP5();
      drawGrunt(p, S, pose(aim, { warn: 0.7 }));
      // Plate, nozzle, helmet and gun: each drawn flipped when it faces left
      const images = shapes.filter((s) => s.kind === 'image');
      expect(images.length).toBe(4);
      for (const { matrix } of images) {
        expect(Math.sign(matrix[0])).toBe(facing);
      }
    }
  });

  it("draws without the game's random numbers", () => {
    const spy = vi.spyOn(Math, 'random');
    const { p } = transformP5();
    drawGrunt(p, S, pose(Math.PI, { warn: 0.7 }));
    drawGrunt(p, S, pose(Math.PI, { sinceShot: 0.02 }));
    drawGrunt(p, S, pose(0, { sulk: 0.2 }));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('rebuilds its sprites once when its size changes, and drops the old ones', () => {
    const { p, graphics } = transformP5();
    drawGrunt(p, S, pose(0));
    const first = graphics.slice();
    drawGrunt(p, S * 1.3, pose(0)); // the ?tune size slider moved
    drawGrunt(p, S * 1.3, pose(0));
    expect(graphics.length).toBe(first.length * 2);
    expect(first.every((g) => g.removed)).toBe(true);
    expect(graphics.slice(first.length).some((g) => g.removed)).toBe(false);
  });

  it('builds its sprites once, not every frame', () => {
    const { p, graphics } = transformP5();
    drawGrunt(p, S, pose(0));
    const built = graphics.length;
    drawGrunt(p, S, pose(0));
    expect(built).toBeGreaterThan(0);
    expect(graphics.length).toBe(built);
  });
});
