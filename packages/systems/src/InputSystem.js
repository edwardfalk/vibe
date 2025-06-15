// InputSystem.js - Centralised keyboard & mouse input handling for Vibe
// Requires p5.js only through mouse event flags; global state stored on window.* for compatibility.
// Math utils not required here, but keeping consistent import style.

export class InputSystem {
  static initialize() {
    if (window.inputSystemInitialized) return;

    // Ensure legacy flags exist
    window.playerIsShooting = window.playerIsShooting ?? false;
    window.arrowUpPressed = window.arrowUpPressed ?? false;
    window.arrowDownPressed = window.arrowDownPressed ?? false;
    window.arrowLeftPressed = window.arrowLeftPressed ?? false;
    window.arrowRightPressed = window.arrowRightPressed ?? false;

    // Extended WASD tracking (for test mode / AI presses)
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

    // --- Event listeners -------------------------------------------------
    window.addEventListener('mousedown', InputSystem._onMouseDown);
    window.addEventListener('mouseup', InputSystem._onMouseUp);
    window.addEventListener('keydown', InputSystem._onKeyDown);
    window.addEventListener('keyup', InputSystem._onKeyUp);

    window.inputSystemInitialized = true;
    console.log('🕹️ InputSystem initialised');
  }

  // --- Internal static handlers -----------------------------------------
  static _onMouseDown() {
    window.playerIsShooting = true;
  }
  static _onMouseUp() {
    window.playerIsShooting = false;
  }
  static _onKeyDown(e) {
    switch (e.code) {
      case 'Space':
        window.playerIsShooting = true;
        e.preventDefault();
        break;
      case 'ArrowUp':
        window.arrowUpPressed = true;
        e.preventDefault();
        break;
      case 'ArrowDown':
        window.arrowDownPressed = true;
        e.preventDefault();
        break;
      case 'ArrowLeft':
        window.arrowLeftPressed = true;
        e.preventDefault();
        break;
      case 'ArrowRight':
        window.arrowRightPressed = true;
        e.preventDefault();
        break;
      default:
        // WASD tracking for movement
        if (window.keys && e.key in window.keys) {
          window.keys[e.key] = true;
        }
        break;
    }
  }
  static _onKeyUp(e) {
    switch (e.code) {
      case 'Space':
        window.playerIsShooting = false;
        e.preventDefault();
        break;
      case 'ArrowUp':
        window.arrowUpPressed = false;
        e.preventDefault();
        break;
      case 'ArrowDown':
        window.arrowDownPressed = false;
        e.preventDefault();
        break;
      case 'ArrowLeft':
        window.arrowLeftPressed = false;
        e.preventDefault();
        break;
      case 'ArrowRight':
        window.arrowRightPressed = false;
        e.preventDefault();
        break;
      default:
        if (window.keys && e.key in window.keys) {
          window.keys[e.key] = false;
        }
        break;
    }
  }
}
