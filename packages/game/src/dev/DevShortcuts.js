// DevShortcuts.js - Houses keyboard shortcuts and dev-only helpers

// Toggle profiler overlay with P key (moved from GameLoop.js)
if (!window.profilerOverlayToggleAdded) {
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'p' || e.key === 'P') && !e.repeat) {
      if (window.profilerOverlay) {
        window.profilerOverlay.toggle();
      }
    }
  });
  window.profilerOverlayToggleAdded = true;
}

// TODO: migrate F6/F7/F8 test mode triggers in a follow-up chunk

// Ensure minimal on-demand profiler toggle helper exists
if (!window.profilerOverlay) {
  try {
    const mod = await import('@vibe/fx/ProfilerOverlay.js');
    window.profilerOverlay =
      mod.default || mod.ProfilerOverlay || window.profilerOverlay;
  } catch (_) {}
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
        't',
        'T',
        'e',
        'E',
        'F6',
        'F7',
        'F8',
        'F10',
        '1',
        '2',
        '3',
        '4',
        ' ',
      ];
      if (singleActionKeys.includes(event.key) && window.uiRenderer) {
        window.uiRenderer.handleKeyPress(event.key);
      }
    }
  });
  window.uiKeyListenersAdded = true;
}
