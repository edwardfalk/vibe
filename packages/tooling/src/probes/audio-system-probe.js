// audio-system-probe.js
// Probe: Audio System and Beat Clock Health Monitoring

export default (async function () {
  const { random } = await import('@vibe/core/mathUtils.js');
  const { SOUND } = await import('@vibe/core');

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
      muted: null,
      masterGain: null,
    },
    tone: {
      transportState: null,
    },
    warnings: [],
    failure: null,
  };

  // Ensure user gesture to unlock audio
  try {
    const canvas = document.querySelector('canvas') || document.body;
    const rect = canvas.getBoundingClientRect();
    const x = rect.left + Math.max(5, Math.min(rect.width - 5, rect.width / 2));
    const y = rect.top + Math.max(5, Math.min(rect.height - 5, rect.height / 2));
    // Prefer a real click; some browsers require gesture on element
    await Promise.race([
      (async () => { await canvas?.click?.(); })(),
      (async () => { await new Promise(r => setTimeout(r, 50)); })(),
    ]);
    // If Tone present, attempt explicit start
    if (window.Tone && window.Tone.context?.state !== 'running') {
      try { await window.Tone.start(); } catch {}
    }
  } catch {}

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
        // Unmute if needed
        if (typeof window.audio.isMuted === 'function' && window.audio.isMuted()) {
          window.audio.toggle();
        }
        await window.audio.playSound(SOUND.playerShoot, { volume: 1 });
        await window.audio.playSound(SOUND.explosion, { volume: 1 });
      } catch {}
      await new Promise((r) => setTimeout(r, 800));
      // Snapshot mixer state
      if (window.audio._gains?.master) {
        result.audio.masterGain = window.audio._gains.master.gain?.value ?? null;
      }
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
      if (typeof window.audio.isMuted === 'function') {
        result.audio.muted = window.audio.isMuted();
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
