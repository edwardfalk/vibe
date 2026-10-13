import { CONFIG } from '../config.js';

// Everything currently holding the trigger: fire key codes, 'mouse', 'pad'.
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

// A controller with the standard mapping (an Xbox pad's, in Chrome and
// Firefox): its button numbers
const PAD = {
  A: 0,
  RT: 7,
  VIEW: 8,
  START: 9,
  LS: 10, // the left stick, clicked
  UP: 12,
  DOWN: 13,
  LEFT: 14,
  RIGHT: 15,
};
const padDown = new Set(); // the buttons that act once held down last frame

// The stick (x, y) as a unit direction, or null inside the dead zone
function stick(x, y) {
  const len = Math.hypot(x, y);
  return len > CONFIG.GAMEPAD.DEADZONE ? { x: x / len, y: y / len } : null;
}

/**
 * Read the first controller, once a frame. The left stick or D-pad writes
 * window.padMove (a unit direction, null when still); the right stick
 * window.padAim (an angle, kept after the stick is let go, until the mouse
 * moves). RT holds the trigger like the mouse; A or a left stick click, View
 * and Start act once a press, as the keys E, M and P (R on the GAME OVER
 * screen).
 */
export function pollGamepad() {
  let pads = [];
  try {
    pads = navigator.getGamepads?.() ?? [];
  } catch {
    // Refused, as in an iframe without allow="gamepad": play on without
  }
  const live = Array.from(pads).filter((g) => g?.connected);
  // shortcut: a pad without the standard mapping is read as if it had it
  // (wrong buttons); give it a remap if one turns up
  const pad = live.find((g) => g.mapping === 'standard') ?? live[0];
  if (!pad) {
    window.padMove = null;
    padDown.clear();
    if (held.delete('pad')) syncShooting();
    return;
  }
  const down = (i) => pad.buttons[i]?.pressed;

  const dx = (down(PAD.RIGHT) ? 1 : 0) - (down(PAD.LEFT) ? 1 : 0);
  const dy = (down(PAD.DOWN) ? 1 : 0) - (down(PAD.UP) ? 1 : 0);
  window.padMove = dx || dy ? stick(dx, dy) : stick(pad.axes[0], pad.axes[1]);

  const aim = stick(pad.axes[2], pad.axes[3]);
  if (aim) window.padAim = Math.atan2(aim.y, aim.x);
  else window.padAim ??= null;

  if ((pad.buttons[PAD.RT]?.value ?? 0) > CONFIG.GAMEPAD.TRIGGER) {
    held.add('pad');
  } else held.delete('pad');
  syncShooting();

  const ui = window.uiRenderer;
  const pressed = (i) => {
    const was = padDown.has(i);
    if (down(i)) padDown.add(i);
    else padDown.delete(i);
    return down(i) && !was && ui;
  };
  // All read first, so each notes its state: one dash if A and the stick
  // go down at once, and none held through the start acts in the run
  const [dash, stickDash, mute, start] = [
    PAD.A,
    PAD.LS,
    PAD.VIEW,
    PAD.START,
  ].map(pressed);
  // Not on the title screen, as the keys there: muted before the start,
  // the run would get no AudioContext
  if (window.gameState?.gameState === 'title') return;
  if (dash || stickDash) ui.handleKeyPress('e');
  if (mute) ui.handleKeyPress('m');
  // R only acts on the GAME OVER screen; anywhere else Start pauses
  if (start) ui.handleKeyPress('r') || ui.handleKeyPress('p');
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
  // Moving the mouse takes the aim back from the right stick. A mousemove
  // the browser makes up, with the cursor still, has no movement.
  window.addEventListener('mousemove', (e) => {
    if (e.movementX || e.movementY) window.padAim = null;
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
