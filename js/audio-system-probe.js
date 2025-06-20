// audio-system-probe.js
// Probe: Audio System and Beat Clock Health Monitoring

(async function () {
  const { random } = await import('../packages/core/src/mathUtils.js');

  // Import ticketManager API if available
  let ticketManager = null;
  try {
    ticketManager = await import('../packages/tooling/src/ticketManager.js');
  } catch (e) {
    // Not available in all contexts
  }

  const result = {
    timestamp: Date.now(),
    audio: {
      exists: !!window.audio,
      context: null,
      methods: {},
      functionality: {},
    },
    beatClock: {
      exists: !!window.beatClock,
      isActive: false,
      beatTimingHealthy: false,
      currentBeat: null,
      bpm: null,
      lastBeatTime: null,
    },
    warnings: [],
    criticalFailures: [],
    failure: null,
  };

  // Check audio system
  if (window.audio) {
    // Check audio context state
    if (window.audio.audioContext) {
      result.audio.context = window.audio.audioContext.state;
    } else {
      result.warnings.push('Audio context not found');
    }

    // Check required audio methods
    const requiredMethods = [
      'playPlayerShoot',
      'playPlayerHit',
      'playHit',
      'playExplosion',
      'playEnemyOhNo',
      'playGruntPop',
      'playStabberOhNo',
      'playRusherOhNo',
      'playTankOhNo',
    ];

    for (const method of requiredMethods) {
      result.audio.methods[method] = typeof window.audio[method] === 'function';
      if (!result.audio.methods[method]) {
        result.warnings.push(`Audio missing method: ${method}`);
      }
    }

    // Test audio functionality (non-intrusive)
    try {
      // Check if audio can be initialized without playing sounds
      if (typeof window.audio.init === 'function') {
        result.audio.functionality.canInitialize = true;
      }

      // Check if audio context is accessible
      if (window.audio.audioContext) {
        result.audio.functionality.contextAccessible = true;
      }
    } catch (error) {
      result.warnings.push(`Audio system test error: ${error.message}`);
    }
  } else {
    result.criticalFailures.push('Audio system not found in window object');
  }

  // Check beat clock system
  if (window.beatClock) {
    result.beatClock.isActive = !!window.beatClock.isActive;
    result.beatClock.currentBeat = window.beatClock.currentBeat || null;
    result.beatClock.bpm = window.beatClock.bpm || null;
    result.beatClock.lastBeatTime = window.beatClock.lastBeatTime || null;

    // Check beat timing health
    if (result.beatClock.lastBeatTime) {
      const timeSinceLastBeat = Date.now() - result.beatClock.lastBeatTime;
      const expectedBeatInterval = result.beatClock.bpm
        ? 60000 / result.beatClock.bpm
        : 1000;

      // Consider timing healthy if within 2x expected interval
      result.beatClock.beatTimingHealthy =
        timeSinceLastBeat < expectedBeatInterval * 2;

      if (!result.beatClock.beatTimingHealthy) {
        result.warnings.push(
          'Beat timing appears unhealthy - too long since last beat'
        );
        result.criticalFailures.push('BeatClock timing unhealthy');
      }
    } else {
      result.warnings.push('Beat clock has no recorded beat time');
    }

    // Check required beat clock methods
    const requiredBeatMethods = ['start', 'stop', 'getCurrentBeat', 'getBPM'];
    for (const method of requiredBeatMethods) {
      if (typeof window.beatClock[method] !== 'function') {
        result.warnings.push(`BeatClock missing method: ${method}`);
      }
    }
  } else {
    result.criticalFailures.push('BeatClock system not found in window object');
  }

  // Check audio-related configuration
  if (window.CONFIG?.AUDIO_SETTINGS) {
    result.audio.configuration = {
      masterVolume: window.CONFIG.AUDIO_SETTINGS.MASTER_VOLUME,
      sfxVolume: window.CONFIG.AUDIO_SETTINGS.SFX_VOLUME,
      musicVolume: window.CONFIG.AUDIO_SETTINGS.MUSIC_VOLUME,
    };
  } else {
    result.warnings.push('Audio configuration not found');
  }

  // Determine overall failure status
  if (result.criticalFailures.length > 0) {
    result.failure = `Critical audio system failures: ${result.criticalFailures.join(', ')}`;
  }

  // If failure detected, capture diagnostic information and create bug report
  if (result.failure) {
    let screenshotData = null;

    // Capture screenshot if possible
    if (window.mcp?.screenshot) {
      try {
        screenshotData = await window.mcp.screenshot(
          'audio-probe-failure-' + Date.now()
        );
      } catch (e) {
        console.log('⚠️ Screenshot capture failed:', e);
      }
    } else if (document.querySelector('canvas')) {
      try {
        screenshotData = document
          .querySelector('canvas')
          .toDataURL('image/png');
      } catch (e) {
        console.log('⚠️ Canvas screenshot failed:', e);
      }
    }

    // Log comprehensive diagnostic information
    console.error('🎵 Audio System Probe Failure:', result);
    console.log('🎮 Audio State:', {
      audioExists: !!window.audio,
      beatClockExists: !!window.beatClock,
      audioContext: window.audio?.audioContext?.state,
      beatClockActive: window.beatClock?.isActive,
    });

    // Create automated bug report
    if (ticketManager?.createTicket) {
      try {
        const shortId = random().toString(36).substr(2, 8);
        const ticketData = {
          id: `AUDIO-${shortId}`,
          title: 'Audio System Failure',
          description: `Automated probe detected audio system issues: ${result.failure}`,
          timestamp: new Date().toISOString(),
          category: 'bug',
          priority: 'high',
          state: result,
          artifacts: screenshotData ? [screenshotData] : [],
          status: 'Open',
          history: [
            {
              type: 'audio_probe_failure',
              description: result.failure,
              criticalFailures: result.criticalFailures,
              warnings: result.warnings,
              at: new Date().toISOString(),
            },
          ],
          verification: [],
          relatedTickets: [],
          tags: ['automated', 'audio', 'probe', 'critical'],
        };

        await ticketManager.createTicket(ticketData);
        console.log('🎫 Automated audio bug ticket created:', ticketData.id);
      } catch (err) {
        console.error('⚠️ Failed to create automated audio bug ticket:', err);
      }
    }
  } else if (result.warnings.length > 0) {
    console.log('⚠️ Audio System Probe Warnings:', result.warnings);
  } else {
    console.log('✅ Audio System Probe: All systems healthy');
  }

  return result;
})();
