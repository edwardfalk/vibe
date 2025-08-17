// DevShortcuts.js - Houses keyboard shortcuts and dev-only helpers

// Secret combo to toggle developer mode (Ctrl+Alt+Shift+D)
if (!window.devModeToggleAdded) {
  window.addEventListener('keydown', (e) => {
    if (
      (e.key === 'd' || e.key === 'D') &&
      e.ctrlKey &&
      e.altKey &&
      e.shiftKey &&
      !e.repeat
    ) {
      window.uiRenderer?.toggleDevMode();
    }
  });
  window.devModeToggleAdded = true;
}

// Toggle profiler overlay with P key (dev mode only)
if (!window.profilerOverlayToggleAdded) {
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'p' || e.key === 'P') && !e.repeat) {
      if (window.uiRenderer?.devMode && window.profilerOverlay) {
        window.profilerOverlay.toggle();
      }
    }
  });
  window.profilerOverlayToggleAdded = true;
}

// Ensure minimal on-demand profiler toggle helper exists
if (!window.profilerOverlay) {
  (async () => {
    try {
      const mod = await import('@vibe/fx/ProfilerOverlay.js');
      window.profilerOverlay =
        mod.default || mod.ProfilerOverlay || window.profilerOverlay;
    } catch (_) {}
  })();
}

// Single-action UI keys routed to UIRenderer (migrated from GameLoop.js)
if (!window.uiKeyListenersAdded) {
  window.addEventListener('keydown', (event) => {
    if (!event.repeat) {
      const singleActionKeys = [
        'r',
        'R',
        'Escape',
        'm',
        'M',
        'e',
        'E',
        'F10',
        '1',
        '2',
        '3',
        '4',
        ' ',
        'i',
        'I',
        '-',
        '=',
        '[',
        ']',
        's',
        'S',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ];
      if (singleActionKeys.includes(event.key) && window.uiRenderer) {
        window.uiRenderer.handleKeyPress(event.key);
      }
    }
  });
  window.uiKeyListenersAdded = true;
}
