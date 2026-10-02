import { describe, it, expect } from 'vitest';
import { RhythmFX } from '../../js/RhythmFX.js';
import { CameraSystem } from '../../js/systems/CameraSystem.js';
import { drawBombs } from '../../js/systems/BombSystem.js';
import { transformP5 } from './helpers/transformP5.js';

// A p5 stand-in that records where circles are drawn
function recordingP5() {
  const shapes = [];
  const record = (x, y) => shapes.push([x, y]);
  return new Proxy(
    {
      width: 800,
      height: 600,
      frameCount: 0,
      sin: Math.sin,
      shapes,
      ellipse: record,
      circle: record,
    },
    { get: (t, k) => (k in t ? t[k] : () => {}) }
  );
}

function cameraAt(x, y, p) {
  const camera = new CameraSystem(p);
  camera.x = x;
  camera.y = y;
  return camera;
}

describe('world-space overlays drawn in screen space', () => {
  it('an attack telegraph is drawn where its enemy is on screen', () => {
    const p = recordingP5();
    const camera = cameraAt(100, 50, p);
    const fx = new RhythmFX({ get: () => ({}) });
    fx.addAttackTelegraph(300, 200, 'grunt', 1);
    fx.drawAttackTelegraphs(p, camera);
    expect(p.shapes[0]).toEqual([
      camera.worldToScreen(300, 200).x,
      camera.worldToScreen(300, 200).y,
    ]);
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
