// InputBootstrap.js - Houses legacy global input flags & InputSystem init
import { InputSystem } from '@vibe/systems';

// Ensure flags exist (matches values previously seeded in GameLoop.js)
window.playerIsShooting = false;
window.arrowUpPressed = false;
window.arrowDownPressed = false;
window.arrowLeftPressed = false;
window.arrowRightPressed = false;
// Autofire toggle
window.autoFireEnabled = false;

// Extended WASD tracking for AI scripts
window.keys = window.keys ?? {
  W: false,
  w: false,
  A: false,
  a: false,
  S: false,
  s: false,
  D: false,
  d: false,
};

// Initialise input listeners exactly once
InputSystem.initialize();
