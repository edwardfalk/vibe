// Minimal runtime check to ensure Player.update uses this.p.frameCount without ReferenceError
import { CONFIG } from '../packages/core/src/index.js';
import { Player } from '../packages/entities/src/player.js';

// Enable the debug path that logs once per 60 frames
CONFIG.GAME_SETTINGS = CONFIG.GAME_SETTINGS || {};
CONFIG.GAME_SETTINGS.DEBUG_COLLISIONS = true;

// Stub p5 instance methods used by Player in this code path
const p = {
  color: () => ({}),
  keyIsDown: () => false,
  constrain: (v, min, max) => Math.min(Math.max(v, min), max),
  mouseX: 0,
  mouseY: 0,
  frameCount: 120, // divisible by 60 → should trigger the log branch
};

// Stub camera system so update() takes the camera-aware aiming branch
const cameraSystem = {
  screenToWorld: () => ({ x: 10, y: 20 }),
};

try {
  const player = new Player(p, 0, 0, cameraSystem);
  player.update(16.7);
  console.log(
    'OK: Player.update executed without ReferenceError for frameCount'
  );
} catch (err) {
  console.error('ERROR during Player.update:', err);
  process.exitCode = 1;
}
