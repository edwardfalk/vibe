// AudioCanvasUnlock.js - Ensures audio contexts resume and canvas becomes visible on first interaction

function unlockAudioAndShowCanvas() {
  // Resume p5.js audio context if present
  try {
    if (typeof getAudioContext === 'function') {
      getAudioContext().resume();
    }
    // Resume unified audio context
    if (window.audio && typeof window.audio.ensureAudioContext === 'function') {
      window.audio.ensureAudioContext();
    }
  } catch (_) {}

  // Reveal the canvas if hidden by any gate
  const canvas = document.querySelector('canvas');
  if (canvas && canvas.style.visibility === 'hidden') {
    canvas.style.visibility = 'visible';
    canvas.removeAttribute('data-hidden');
  }

  // Remove this handler after first use
  window.removeEventListener('pointerdown', unlockAudioAndShowCanvas);
  window.removeEventListener('keydown', unlockAudioAndShowCanvas);
}

if (!window.__audioCanvasUnlockInstalled) {
  window.addEventListener('pointerdown', unlockAudioAndShowCanvas);
  window.addEventListener('keydown', unlockAudioAndShowCanvas);
  window.__audioCanvasUnlockInstalled = true;
}

export {};
