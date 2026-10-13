import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initializeInputHandlers,
  pollGamepad,
} from '../../js/core/InputHandlers.js';
import { CONFIG } from '../../js/config.js';

// A standard-mapping pad: 17 buttons, 4 axes, all at rest
const makePad = () => ({
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
});
const press = (pad, i, value = 1) => {
  pad.buttons[i] = { pressed: value > 0, value };
};
const release = (pad, i) => press(pad, i, 0);

describe('Gamepad', () => {
  let pad;
  let listeners;
  let keys;

  beforeEach(() => {
    pad = makePad();
    listeners = {};
    keys = [];
    globalThis.window = {
      addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
      uiRenderer: { handleKeyPress: (k) => (keys.push(k), k === 'p') },
      gameState: { gameState: 'playing' },
    };
    vi.stubGlobal('navigator', { getGamepads: () => [null, pad] });
    initializeInputHandlers();
  });
  afterEach(() => {
    // Leave no 'pad' held in the module's set for the next test
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    pollGamepad();
    vi.unstubAllGlobals();
  });

  it('the left stick steers past the dead zone, as a unit direction', () => {
    pad.axes[0] = CONFIG.GAMEPAD.DEADZONE * 0.9;
    pollGamepad();
    expect(window.padMove).toBeNull();
    pad.axes[0] = 0.3;
    pad.axes[1] = -0.4;
    pollGamepad();
    expect(window.padMove.x).toBeCloseTo(0.6);
    expect(window.padMove.y).toBeCloseTo(-0.8);
  });

  it('the D-pad steers too, diagonals at unit length', () => {
    press(pad, 14); // left
    press(pad, 13); // down
    pollGamepad();
    expect(window.padMove.x).toBeCloseTo(-Math.SQRT1_2);
    expect(window.padMove.y).toBeCloseTo(Math.SQRT1_2);
  });

  it('the right stick aims; the aim stays when it is let go, until the mouse moves', () => {
    pollGamepad();
    expect(window.padAim).toBeNull();
    pad.axes[2] = -0.3;
    pad.axes[3] = 0.7;
    pollGamepad();
    expect(window.padAim).toBeCloseTo(Math.atan2(0.7, -0.3));
    pad.axes[2] = 0;
    pad.axes[3] = 0;
    pollGamepad();
    expect(window.padAim).toBeCloseTo(Math.atan2(0.7, -0.3));
    // A mousemove the browser makes up, with the cursor still, keeps it
    listeners.mousemove.forEach((fn) => fn({ movementX: 0, movementY: 0 }));
    expect(window.padAim).not.toBeNull();
    listeners.mousemove.forEach((fn) => fn({ movementX: 3, movementY: 0 }));
    expect(window.padAim).toBeNull();
  });

  it('RT holds the trigger past its threshold, alongside the mouse', () => {
    press(pad, 7, CONFIG.GAMEPAD.TRIGGER * 0.9);
    pollGamepad();
    expect(window.playerIsShooting).toBe(false);
    press(pad, 7, 0.7);
    pollGamepad();
    expect(window.playerIsShooting).toBe(true);
    listeners.mousedown.forEach((fn) => fn({ button: 0 }));
    release(pad, 7);
    pollGamepad();
    expect(window.playerIsShooting).toBe(true); // the mouse still holds it
    listeners.mouseup.forEach((fn) => fn({ button: 0 }));
    expect(window.playerIsShooting).toBe(false);
  });

  it('a controller unplugged with RT held and the sticks pushed stops him, and gives the mouse the aim', () => {
    press(pad, 7);
    pad.axes[0] = 1;
    pad.axes[3] = 1;
    pollGamepad();
    expect(window.playerIsShooting).toBe(true);
    expect(window.padMove).not.toBeNull();
    expect(window.padAim).not.toBeNull();
    vi.stubGlobal('navigator', { getGamepads: () => [null, null] });
    pollGamepad();
    expect(window.playerIsShooting).toBe(false);
    expect(window.padMove).toBeNull();
    expect(window.padAim).toBeNull();
  });

  it('A dashes and View mutes, once a press, however long it is held', () => {
    press(pad, 0);
    pollGamepad();
    pollGamepad();
    pollGamepad();
    release(pad, 0);
    pollGamepad();
    press(pad, 0);
    press(pad, 8);
    pollGamepad();
    expect(keys).toEqual(['e', 'e', 'm']);
  });

  it('a left stick click dashes too; with A on the same frame, once', () => {
    press(pad, 10);
    pollGamepad();
    pollGamepad();
    expect(keys).toEqual(['e']);
    release(pad, 10);
    pollGamepad();
    press(pad, 0);
    press(pad, 10);
    pollGamepad();
    release(pad, 0);
    pollGamepad(); // still clicked: no second dash
    expect(keys).toEqual(['e', 'e']);
  });

  it('Start restarts after GAME OVER, else pauses', () => {
    press(pad, 9);
    pollGamepad();
    expect(keys).toEqual(['r', 'p']); // R does nothing in play, so P pauses
    release(pad, 9);
    pollGamepad();
    keys.length = 0;
    window.uiRenderer.handleKeyPress = (k) => (keys.push(k), k === 'r');
    press(pad, 9);
    pollGamepad();
    expect(keys).toEqual(['r']); // restarted: no pause after it
  });

  // As M there: muted before the start, the run would get no AudioContext
  it('on the title screen its buttons do nothing, nor once the run starts', () => {
    window.gameState.gameState = 'title';
    press(pad, 0);
    press(pad, 8);
    press(pad, 9);
    pollGamepad();
    window.gameState.gameState = 'playing';
    pollGamepad(); // still held
    expect(keys).toEqual([]);
  });

  it('a standard pad is read before an odd device ahead of it', () => {
    const wheel = { ...makePad(), mapping: '', axes: [0, 0, -1, 0] };
    vi.stubGlobal('navigator', { getGamepads: () => [wheel, pad] });
    pollGamepad();
    expect(window.padAim).toBeNull();
  });

  it('a browser without the Gamepad API reads no controller', () => {
    vi.stubGlobal('navigator', {});
    expect(() => pollGamepad()).not.toThrow();
    expect(window.padMove).toBeNull();
  });

  // As in an iframe without allow="gamepad": it must not stop the game
  it('a browser that refuses the controller reads none', () => {
    vi.stubGlobal('navigator', {
      getGamepads: () => {
        throw new Error('SecurityError: not allowed');
      },
    });
    expect(() => pollGamepad()).not.toThrow();
    expect(window.padMove).toBeNull();
  });
});
