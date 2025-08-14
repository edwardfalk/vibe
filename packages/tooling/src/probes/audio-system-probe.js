// audio-system-probe.js
// Probe: Audio System and Beat Clock Health Monitoring

export default (async function () {
  const { min, max } = await import('@vibe/core/mathUtils.js');
  const { SOUND } = await import('@vibe/core');

  // Import ticketManager API if available
  let ticketManager = null;
  try {
    ticketManager = await import(
      new URL('../githubIssueManager.js', import.meta.url).href
    );
  } catch {}

  const result = {
    timestamp: Date.now(),
    audio: {
      exists: !!window.audio,
      contextState: null,
      hasPlaySound: false,
      players: 0,
      fallbackSynths: 0,
      busLevels: null,
      masterLevelDb: null,
      muted: null,
      masterGain: null,
    },
    tone: {
      transportState: null,
    },
    // signal metrics
    dbBaseline: null,
    dbPeak: null,
    signalDetected: false,
    warnings: [],
    failure: null,
  };

  // Ensure user gesture to unlock audio
  try {
    const canvas = document.querySelector('canvas') || document.body;
    // Prefer real element click if available
    await Promise.race([
      (async () => {
        await canvas?.click?.();
      })(),
      (async () => {
        await new Promise((r) => setTimeout(r, 50));
      })(),
    ]);
    if (window.Tone && window.Tone.context?.state !== 'running') {
      try {
        await window.Tone.start();
      } catch {}
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

    // Unmute if needed
    if (typeof window.audio.isMuted === 'function') {
      result.audio.muted = window.audio.isMuted();
      if (result.audio.muted) window.audio.toggle?.();
    }

    // Ensure mixer exists so meter is present
    try {
      if (result.audio.hasPlaySound) {
        await window.audio.playSound(SOUND.playerShoot, { volume: 1 });
      }
    } catch {}

    // Read baseline dB
    if (typeof window.audio.getMasterLevel === 'function') {
      result.dbBaseline = window.audio.getMasterLevel();
    }

    // Trigger multiple SFX to create measurable energy on master
    try {
      await window.audio.playSound(SOUND.explosion, { volume: 1 });
      await new Promise((r) => setTimeout(r, 150));
      await window.audio.playSound(SOUND.playerShoot, { volume: 1 });
    } catch {}

    // Poll meter for a short window and capture peak dB
    const t0 = performance?.now?.() ?? Date.now();
    let peak = -Infinity;
    while ((performance?.now?.() ?? Date.now()) - t0 < 1500) {
      const db =
        typeof window.audio.getMasterLevel === 'function'
          ? window.audio.getMasterLevel()
          : -Infinity;
      if (typeof db === 'number' && isFinite(db)) {
        peak = max(peak, db);
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    result.dbPeak = peak;

    // Snapshot mixer state
    if (window.audio._gains?.master) {
      result.audio.masterGain = window.audio._gains.master.gain?.value ?? null;
    }
    if (typeof window.audio.getBusLevels === 'function') {
      result.audio.busLevels = window.audio.getBusLevels();
    }
    if (typeof window.audio.getMasterLevel === 'function') {
      result.audio.masterLevelDb = window.audio.getMasterLevel();
    }

    // Heuristics for real signal detection
    // dbPeak closer to 0 indicates audible energy; -40 dB threshold in headless.
    const dbThreshold = -40;
    const sfxLin = result.audio.busLevels?.sfx;
    const hasSfxBus = typeof sfxLin === 'number' && sfxLin > 0.01; // linear gain

    result.signalDetected =
      isFinite(result.dbPeak) && result.dbPeak > dbThreshold;

    // If no signal from SFX, verify meter itself by injecting a short test tone
    let meterFunctional = null;
    if (!result.signalDetected && window.audio?._gains?.master) {
      try {
        const Tone = await import('tone');
        const osc = new Tone.Oscillator(440, 'sine');
        const gain = new Tone.Gain(0.5).connect(window.audio._gains.master);
        osc.connect(gain);
        await osc.start();
        const t0b = performance?.now?.() ?? Date.now();
        let peakB = -Infinity;
        while ((performance?.now?.() ?? Date.now()) - t0b < 600) {
          const db =
            typeof window.audio.getMasterLevel === 'function'
              ? window.audio.getMasterLevel()
              : -Infinity;
          if (typeof db === 'number' && isFinite(db)) peakB = max(peakB, db);
          await new Promise((r) => setTimeout(r, 25));
        }
        await osc.stop();
        osc.dispose?.();
        gain.dispose?.();
        meterFunctional = isFinite(peakB) && peakB > dbThreshold;
      } catch {
        meterFunctional = false;
      }
    }

    result.meterFunctional = meterFunctional;

    if (!result.signalDetected) {
      if (!hasSfxBus) result.warnings.push('sfx bus gain is near zero');
      if (result.audio.masterGain === 0)
        result.warnings.push('master gain is 0');
      if (meterFunctional === true) {
        result.failure =
          'Audio path produced no signal on master meter after test SFX';
      } else if (meterFunctional === false) {
        result.failure = 'Master meter not responding to injected test tone';
      } else {
        result.failure =
          'No audio signal detected (meter verification inconclusive)';
      }
    }
  }

  // Tone.js context
  if (window.Tone) {
    result.audio.contextState = window.Tone.context.state;
    result.tone.transportState = window.Tone.Transport.state;
    if (window.Tone.context.state !== 'running') {
      // Only warn if fallback path succeeded and we detected signal; otherwise fail
      if (!result.signalDetected) {
        result.failure = result.failure || 'Tone context not running';
      } else {
        result.warnings.push('Tone context not running (fallback path)');
      }
    }
  }

  return result;
})();
