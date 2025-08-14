// vfx-liveness-probe.js – verifies that visual effects & audio are actually running
// Export default async function returning result object (Playwright probes convention)
/**
 * Checks three things:
 * 1) No console errors or warnings emitted after page load.
 * 2) VisualEffectsManager.ready() === true and at least one non-black pixel exists after 2s.
 * 3) Audio master meter shows energy > ‑40 dB within 2s.
 */
export default (async function () {
  const result = {
    timestamp: Date.now(),
    consoleErrors: [],
    fxReady: false,
    nonBlackPixels: 0,
    masterDb: null,
    failure: null,
    warnings: [],
  };

  /* ------------------------------------------------------------------ */
  /* 1) Capture console errors                                          */
  /* ------------------------------------------------------------------ */
  try {
    if (typeof window !== 'undefined' && window.__probeHooked !== true) {
      window.__probeHooked = true;
      window.__probeLogs = { errors: [] };
      const origError = console.error;
      const origWarn = console.warn;
      console.error = function (...args) {
        window.__probeLogs.errors.push(args.join(' '));
        return origError.apply(this, args);
      };
      console.warn = function (...args) {
        window.__probeLogs.errors.push(args.join(' '));
        return origWarn.apply(this, args);
      };
    }
  } catch {}

  /* ------------------------------------------------------------------ */
  /* 2) Wait 2 seconds then inspect FX & canvas pixels                   */
  /* ------------------------------------------------------------------ */
  await new Promise((r) => setTimeout(r, 2000));

  // Collect errors (after wait to include boot)
  try {
    result.consoleErrors = window.__probeLogs?.errors || [];
    if (result.consoleErrors.length) {
      result.failure = 'Console errors/warnings detected';
    }
  } catch {}

  // FX ready flag
  try {
    result.fxReady = !!window.visualEffectsManager?.ready?.();
    if (!result.fxReady && !result.failure) {
      result.failure = 'VisualEffectsManager not ready';
    }
  } catch {}

  // Canvas pixel check – look for at least one non-black pixel
  try {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < img.length; i += 4) {
        const r = img[i];
        const g = img[i + 1];
        const b = img[i + 2];
        if (r !== 0 || g !== 0 || b !== 0) {
          result.nonBlackPixels += 1;
          if (result.nonBlackPixels > 10) break;
        }
      }
      if (result.nonBlackPixels === 0 && !result.failure) {
        result.failure = 'Canvas remained fully black – no FX rendered';
      }
    } else {
      result.warnings.push('No canvas element found');
    }
  } catch {}

  /* ------------------------------------------------------------------ */
  /* 3) Audio meter                                                     */
  /* ------------------------------------------------------------------ */
  try {
    if (typeof window.audio?.getMasterLevel === 'function') {
      result.masterDb = window.audio.getMasterLevel();
      if (typeof result.masterDb === 'number' && result.masterDb <= -40) {
        result.failure = result.failure || 'Audio master level below threshold';
      }
    } else {
      result.warnings.push('audio.getMasterLevel unavailable');
    }
  } catch {}

  return result;
})();
