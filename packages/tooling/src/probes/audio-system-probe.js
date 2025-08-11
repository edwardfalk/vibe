// audio-system-probe.js
// Probe: Audio System and Beat Clock Health Monitoring

export default (async function () {
  const { random } = await import('@vibe/core/mathUtils.js');

  // Import ticketManager API if available
  let ticketManager = null;
  try {
    ticketManager = await import(
      new URL('../githubIssueManager.js', import.meta.url).href
    );
  } catch (e) {
    // Not available in all contexts
  }

  const result = {
    timestamp: Date.now(),
    audio: {
      exists: !!window.audio,
      contextState: null,
      hasPlaySound: false,
      players: 0,
      fallbackSynths: 0,
    },
    tone: {
      transportState: null,
    },
    failure: null,
  };

  // Audio checks
  if (window.audio) {
    result.audio.hasPlaySound = typeof window.audio.playSound === 'function';
    result.audio.players = window.audio._players?.size || 0;
    result.audio.fallbackSynths = window.audio._fallbackSynths?.size || 0;
    if (!result.audio.hasPlaySound) {
      result.failure = 'playSound method missing on audio';
    }
    if (result.audio.fallbackSynths > 0) {
      result.failure = `Missing samples: ${result.audio.fallbackSynths}`;
    }

    // --- Master level test -------------------------------------------------
    if (result.audio.hasPlaySound) {
      try {
        window.audio.playSound('playerShoot');
      } catch {}
      // Wait longer to allow Tone.start, sample load, and meter update
      await new Promise((r) => setTimeout(r, 1200));
      if (typeof window.audio.getMasterLevel === 'function') {
        const lvl = window.audio.getMasterLevel();
        result.audio.masterLevel = lvl;
        if (lvl < 0.01 && !result.failure) {
          result.failure = 'masterLevel did not rise after playSound';
        }
      }
    }
  }

  // Tone.js context
  if (window.Tone) {
    result.audio.contextState = window.Tone.context.state;
    result.tone.transportState = window.Tone.Transport.state;
    if (window.Tone.context.state !== 'running') {
      result.failure = 'Tone context not running';
    }
  }

  return result;
})();
