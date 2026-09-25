// Everything currently holding the trigger: fire key codes and 'mouse'.
// Firing continues while any of them is held.
const FIRE_KEYS = ['Space', 'ShiftLeft', 'ShiftRight'];
const held = new Set();
const syncShooting = () => {
  window.playerIsShooting = held.size > 0;
};

// Returns true if the event was a fire key. A lost Shift keyup (a known OS
// quirk) is repaired by any later key event.
function fireKey(e, down) {
  if (!e.shiftKey) {
    held.delete('ShiftLeft');
    held.delete('ShiftRight');
  }
  if (!FIRE_KEYS.includes(e.code)) return false;
  if (down) held.add(e.code);
  else held.delete(e.code);
  syncShooting();
  e.preventDefault();
  return true;
}

function onKeyDown(e) {
  if (fireKey(e, true)) return;
  switch (e.code) {
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
  }
}

function onKeyUp(e) {
  if (fireKey(e, false)) return;
  switch (e.code) {
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
  }
}

export function initializeInputHandlers() {
  if (!window.inputListenersAdded) {
    // Only the left button fires (a right-click's menu can swallow mouseup)
    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      held.add('mouse');
      syncShooting();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      held.delete('mouse');
      syncShooting();
    });
    // Keyups that happen while the window is unfocused never arrive
    window.addEventListener('blur', () => {
      held.clear();
      syncShooting();
      window.arrowUpPressed = false;
      window.arrowDownPressed = false;
      window.arrowLeftPressed = false;
      window.arrowRightPressed = false;
    });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.inputListenersAdded = true;
  }

  if (!window.uiKeyListenersAdded) {
    window.addEventListener('keydown', (event) => {
      if (!event.repeat) {
        const singleActionKeys = ['r', 'R', 'p', 'P', 'm', 'M', 'e', 'E', ' '];
        if (singleActionKeys.includes(event.key) && window.uiRenderer) {
          window.uiRenderer.handleKeyPress(event.key);
        }
      }
    });
    window.uiKeyListenersAdded = true;
  }
}
