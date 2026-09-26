import { describe, it, expect } from 'vitest';
import { RhythmFX } from '../../js/RhythmFX.js';
import { UIRenderer } from '../../js/systems/UIRenderer.js';
import { CameraSystem } from '../../js/systems/CameraSystem.js';

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

  it('a bomb countdown ring is drawn where the bomb is on screen', () => {
    const p = recordingP5();
    const camera = cameraAt(100, 50, p);
    const ui = Object.create(UIRenderer.prototype);
    ui.cameraSystem = camera;
    ui.gameState = {
      activeBombs: [{ x: 300, y: 200, timer: 120, maxTimer: 180 }],
    };
    ui.drawBombs(p);
    expect(p.shapes[0]).toEqual([
      camera.worldToScreen(300, 200).x,
      camera.worldToScreen(300, 200).y,
    ]);
  });
});
