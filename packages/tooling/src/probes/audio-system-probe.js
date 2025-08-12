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
      busLevels: null,
      masterLevel: null,
    },
    tone: {
      transportState: null,
    },
    warnings: [],
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
      result.warnings.push(`Missing samples: ${result.audio.fallbackSynths}`);
    }

    // --- Master level test -------------------------------------------------
    if (result.audio.hasPlaySound) {
      try {
        await window.audio.playSound('playerShoot', { volume: 1 });
        await window.audio.playSound('explosion', { volume: 1 });
      } catch {}
      await new Promise((r) => setTimeout(r, 800));
      if (typeof window.audio.getMasterLevel === 'function') {
        const lvl = window.audio.getMasterLevel();
        result.audio.masterLevel = lvl;
        if (lvl < 0.02 && !result.failure) {
          result.warnings.push('masterLevel very low after SFX');
        }
      }
      if (typeof window.audio.getBusLevels === 'function') {
        result.audio.busLevels = window.audio.getBusLevels();
        const sfxLin = result.audio.busLevels?.sfx;
        if (typeof sfxLin === 'number' && sfxLin < 0.2) {
          result.warnings.push('sfx bus gain appears low (<0.2)');
        }
      }
    }
  }

  // Tone.js context
  if (window.Tone) {
    result.audio.contextState = window.Tone.context.state;
    result.tone.transportState = window.Tone.Transport.state;
    if (window.Tone.context.state !== 'running') {
      if (result.audio.exists && result.audio.hasPlaySound) {
        result.warnings.push('Tone context not running (using fallback)');
      } else {
        result.failure = 'Tone context not running';
      }
    }
  }

  return result;
})();
