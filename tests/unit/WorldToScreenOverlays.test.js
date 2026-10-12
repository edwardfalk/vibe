import { describe, it, expect } from 'vitest';
import { RhythmFX } from '../../js/RhythmFX.js';
import { CameraSystem } from '../../js/systems/CameraSystem.js';
import { drawBombs } from '../../js/systems/BombSystem.js';
import { transformP5 } from './helpers/transformP5.js';

function cameraAt(x, y, p) {
  const camera = new CameraSystem(p);
  camera.x = x;
  camera.y = y;
  return camera;
}

describe('world-space overlays drawn under the camera', () => {
  it('an attack telegraph moves with the camera and its shake, as its grunt does', () => {
    const { p, shapes } = transformP5();
    p.width = 800;
    p.height = 600;
    const camera = cameraAt(100, 50, p);
    camera.addShake(8, 12);
    const fx = new RhythmFX({ get: () => ({}) });
    const grunt = { x: 300, y: 200 };
    fx.addAttackTelegraph(grunt.x, grunt.y, 'grunt', 1, grunt);
    camera.applyTransform();
    p.ellipse(grunt.x, grunt.y, 10); // the grunt, drawn in the world
    // Handed the camera as its old screen-space call was, it must not move
    // the ring a second time
    fx.drawAttackTelegraphs(p, camera);
    camera.removeTransform();
    const [body, ring] = shapes.map((sh) => sh.centre);
    expect(ring).toEqual(body);
    const { x, y } = camera.worldToScreen(grunt.x, grunt.y);
    // The shake moved both, by no more than its intensity
    expect(Math.abs(ring[0] - x)).toBeLessThanOrEqual(8);
    expect(Math.abs(ring[1] - y)).toBeLessThanOrEqual(8);
  });

  it('a bomb is drawn at its world position under the camera', () => {
    const { p, shapes } = transformP5();
    p.width = 800;
    p.height = 600;
    const camera = cameraAt(100, 50, p);
    camera.applyTransform();
    drawBombs(p, [
      {
        x: 300,
        y: 200,
        facing: 0,
        plantedAt: 0,
        seenAt: 0.2,
        beatSec: 0.5,
        said: 0,
      },
    ]);
    camera.removeTransform();
    const { x, y } = camera.worldToScreen(300, 200);
    expect(
      shapes.some(
        (sh) => Math.hypot(sh.centre?.[0] - x, sh.centre?.[1] - y) < 1e-6
      )
    ).toBe(true);
  });
});
