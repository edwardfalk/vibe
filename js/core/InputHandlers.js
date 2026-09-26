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
    syncShooting();
  }
  if (!FIRE_KEYS.includes(e.code)) return false;
  if (down) held.add(e.code);
  else held.delete(e.code);
  syncShooting();
  e.preventDefault();
  return true;
}

// Arrow keys set these window flags, which the player reads
const ARROW_FLAGS = new Map([
  ['ArrowUp', 'arrowUpPressed'],
  ['ArrowDown', 'arrowDownPressed'],
  ['ArrowLeft', 'arrowLeftPressed'],
  ['ArrowRight', 'arrowRightPressed'],
]);

function onKey(e, down) {
  if (fireKey(e, down)) return;
  const flag = ARROW_FLAGS.get(e.code);
  if (!flag) return;
  window[flag] = down;
  e.preventDefault();
}

export function initializeInputHandlers() {
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
    for (const flag of ARROW_FLAGS.values()) window[flag] = false;
  });
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));

  window.addEventListener('keydown', (event) => {
    if (!event.repeat) {
      const singleActionKeys = ['r', 'R', 'p', 'P', 'm', 'M', 'e', 'E'];
      if (singleActionKeys.includes(event.key) && window.uiRenderer) {
        window.uiRenderer.handleKeyPress(event.key);
      }
    }
  });
}
