// audio-system-probe.js
// Probe: Audio System and Beat Synchronization with Automated Bug Reporting

(async function() {
  // Import ticketManager API if available
  let ticketManager = null;
  try {
    ticketManager = await import('./ticketManager.js');
  } catch (e) {
    // Not available in all contexts
  }

  const result = {
    timestamp: Date.now(),
    audioContext: {},
    beatClock: {},
    soundSystem: {},
    ttsSystem: {},
    failure: null,
    warnings: []
  };

  // Check Audio Context
  if (window.audio) {
    result.audioContext.exists = true;
    result.audioContext.initialized = !!window.audio.audioContext;
    result.audioContext.state = window.audio.audioContext ? window.audio.audioContext.state : 'unknown';
    result.audioContext.sampleRate = window.audio.audioContext ? window.audio.audioContext.sampleRate : null;
    
    // Check if audio context is running
    if (window.audio.audioContext && window.audio.audioContext.state !== 'running') {
      result.warnings.push('Audio context is not in running state');
    }
  } else {
    result.failure = 'Audio system not found (window.audio missing)';
    return result;
  }

  // Check BeatClock System
  if (window.beatClock) {
    result.beatClock.exists = true;
    result.beatClock.isRunning = typeof window.beatClock.isRunning === 'boolean' ? window.beatClock.isRunning : null;
    result.beatClock.currentBeat = window.beatClock.currentBeat || null;
    result.beatClock.bpm = window.beatClock.bpm || null;
    result.beatClock.lastBeatTime = window.beatClock.lastBeatTime || null;
    
    // Check if beat clock is ticking
    if (window.beatClock.isRunning === false) {
      result.warnings.push('BeatClock is not running');
    }
    
    // Check beat timing consistency
    if (window.beatClock.lastBeatTime) {
      const timeSinceLastBeat = Date.now() - window.beatClock.lastBeatTime;
      const expectedBeatInterval = (60 / (window.beatClock.bpm || 120)) * 1000;
      result.beatClock.timeSinceLastBeat = timeSinceLastBeat;
      result.beatClock.expectedInterval = expectedBeatInterval;
      result.beatClock.beatTimingHealthy = timeSinceLastBeat < expectedBeatInterval * 2;
      
      if (!result.beatClock.beatTimingHealthy) {
        result.warnings.push('Beat timing appears unhealthy - too long since last beat');
      }
    }
  } else {
    result.warnings.push('BeatClock system not found (window.beatClock missing)');
  }

  // Check Sound System Methods
  if (window.audio) {
    const soundMethods = ['playSound', 'playRandomSound', 'stopAllSounds'];
    result.soundSystem.availableMethods = [];
    
    soundMethods.forEach(method => {
      if (typeof window.audio[method] === 'function') {
        result.soundSystem.availableMethods.push(method);
      }
    });
    
    result.soundSystem.hasBasicMethods = result.soundSystem.availableMethods.length >= 2;
    
    if (!result.soundSystem.hasBasicMethods) {
      result.warnings.push('Audio system missing basic sound methods');
    }
    
    // Test sound playing capability (non-intrusive)
    try {
      if (typeof window.audio.playSound === 'function') {
        // Try to play a very quiet test sound if available
        const testResult = window.audio.playSound('test', 0.01); // Very low volume
        result.soundSystem.canPlaySounds = testResult !== false;
      }
    } catch (error) {
      result.soundSystem.soundPlayError = error.message;
      result.warnings.push(`Sound playing error: ${error.message}`);
    }
  }

  // Check TTS System
  if (window.audio && typeof window.audio.speak === 'function') {
    result.ttsSystem.exists = true;
    result.ttsSystem.hasSpeak = true;
    
    // Check if speech synthesis is available
    if (typeof speechSynthesis !== 'undefined') {
      result.ttsSystem.speechSynthesisAvailable = true;
      result.ttsSystem.voicesCount = speechSynthesis.getVoices().length;
      
      if (result.ttsSystem.voicesCount === 0) {
        result.warnings.push('No speech synthesis voices available');
      }
    } else {
      result.ttsSystem.speechSynthesisAvailable = false;
      result.warnings.push('Speech synthesis not available in browser');
    }
  } else {
    result.warnings.push('TTS system not found (audio.speak missing)');
  }

  // Check for critical audio failures
  const criticalFailures = [];
  
  if (!window.audio) {
    criticalFailures.push('Audio system completely missing');
  } else {
    if (!window.audio.audioContext) {
      criticalFailures.push('Audio context not initialized');
    } else if (window.audio.audioContext.state === 'suspended') {
      criticalFailures.push('Audio context suspended (needs user interaction)');
    }
    
    if (!result.soundSystem.hasBasicMethods) {
      criticalFailures.push('Audio system missing essential methods');
    }
  }
  
  if (!window.beatClock) {
    criticalFailures.push('BeatClock system missing');
  } else if (window.beatClock.isRunning === false) {
    criticalFailures.push('BeatClock not running');
  }

  if (criticalFailures.length > 0) {
    result.failure = criticalFailures.join('; ');
  }

  // If failure, trigger screenshot and automated bug reporting
  if (result.failure) {
    let screenshotData = null;
    if (window.mcp && window.mcp.screenshot) {
      screenshotData = await window.mcp.screenshot('audio-system-failure-' + Date.now());
    } else if (document.querySelector('canvas')) {
      screenshotData = document.querySelector('canvas').toDataURL('image/png');
    }
    
    console.error('🎵 Audio System Probe Failure:', result);
    
    if (ticketManager && ticketManager.createTicket) {
      try {
        const shortId = 'AUD-' + Math.random().toString(36).substr(2, 6);
        const ticketData = {
          id: shortId,
          title: 'audio-system-failure',
          description: result.failure,
          timestamp: new Date().toISOString(),
          state: result,
          artifacts: screenshotData ? [screenshotData] : [],
          status: 'Open',
          history: [
            {
              type: 'audio_probe_failure',
              description: result.failure,
              at: new Date().toISOString(),
            }
          ],
          verification: [],
          relatedTickets: [],
        };
        await ticketManager.createTicket(ticketData);
        console.log('🎵 Automated audio bug ticket created:', shortId);
      } catch (err) {
        console.error('⚠️ Failed to create automated audio bug ticket:', err);
      }
    }
  }

  return result;
})();