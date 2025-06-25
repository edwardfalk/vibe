import { random } from '../mathUtils.js';
import { SOUND } from './SoundIds.js';

export class SFXManager {
  /**
   * @param {Audio} audio - The parent Audio system instance.
   */
  constructor(audio) {
    this.audio = audio;
  }

  /**
   * Play a named sound from the Audio system's `sounds` map.
   * Delegates to {@link playTone} with the resolved config.
   *
   * @param {string} soundName - Key in Audio.sounds.
   * @param {number|null} [x] - World X (for panning / distance). If omitted, treated as player sound.
   * @param {number|null} [y] - World Y.
   */
  playSound(soundName, x = null, y = null) {
    if (!this.audio.ensureAudioContext()) return;

    if (!Object.values(SOUND).includes(soundName)) {
      throw new Error(
        `❌ Unknown sound id: ${soundName}. Add it to SoundIds.js and Audio.sounds`
      );
    }

    const soundConfig = this.audio.sounds[soundName];
    if (!soundConfig) {
      throw new Error(
        `❌ Sound config missing: ${soundName}. Define it in Audio.sounds`
      );
    }

    // Variant-array support
    if (
      Array.isArray(soundConfig.variants) &&
      soundConfig.variants.length > 0
    ) {
      const idx = Math.floor(random() * soundConfig.variants.length);
      this.playTone(soundConfig.variants[idx], x, y, soundName);
    } else {
      this.playTone(soundConfig, x, y, soundName);
    }
  }

  /**
   * Core tone-generation helper used by all SFX.
   * Mirrors the original logic previously embedded in Audio.js but now lives in its own module.
   *
   * @param {object} config - Frequency / envelope definition taken from Audio.sounds.
   * @param {number|null} [x]
   * @param {number|null} [y]
   * @param {string} [soundName] - For debug/peak logging
   */
  playTone(config, x, y, soundName = 'unknown') {
    const audio = this.audio;
    const ctx = audio.audioContext;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const panNode = ctx.createStereoPanner();

    // Subtle random variation for organic feel
    const frequencyVariation = 1 + (random() - 0.5) * 0.1;
    const volumeVariation = 1 + (random() - 0.5) * 0.15;
    const durationVariation = 1 + (random() - 0.5) * 0.2;

    oscillator.type =
      config.waveform === 'noise' ? 'sawtooth' : config.waveform;
    // --- Frequency safety guards -------------------------------------------------
    const startFreqRaw = config.frequency * frequencyVariation;
    const startFreq =
      Number.isFinite(startFreqRaw) && startFreqRaw > 0 ? startFreqRaw : 440; // Fallback to A4
    oscillator.frequency.setValueAtTime(startFreq, ctx.currentTime);

    // Optional frequency sweep (only if the target frequency is valid)
    if (config.sweep && Number.isFinite(config.sweep.to)) {
      const endFreq = config.sweep.to * frequencyVariation;
      const sweepDuration = config.duration * durationVariation;

      if (!Number.isFinite(sweepDuration) || sweepDuration <= 0) {
        console.warn(
          `⚠️ Invalid sweep duration for sound ${soundName}. Sweep skipped.`
        );
      } else if (Number.isFinite(endFreq) && endFreq > 0) {
        if (config.sweep.curve === 'exponential') {
          try {
            oscillator.frequency.exponentialRampToValueAtTime(
              Math.max(0.1, endFreq),
              ctx.currentTime + sweepDuration
            );
          } catch (e) {
            console.warn('⚠️ exponentialRampToValueAtTime error', e);
          }
        } else {
          try {
            oscillator.frequency.linearRampToValueAtTime(
              endFreq,
              ctx.currentTime + sweepDuration
            );
          } catch (e) {
            console.warn('⚠️ linearRampToValueAtTime error', e);
          }
        }
      } else {
        console.warn(
          `⚠️ Invalid endFreq for sound ${soundName}. Sweep skipped.`
        );
      }
    } else if (config.sweep) {
      console.warn(
        `⚠️ Invalid sweep.to value for sound ${soundName}. Sweep skipped.`
      );
    }

    // Player position (defaults to centre)
    let playerX = 400,
      playerY = 300;
    if (audio.player) {
      playerX = audio.player.x;
      playerY = audio.player.y;
    }

    let volume = config.volume * volumeVariation;
    let panValue = 0;

    // Safety guards – ensure volume & pan are finite numbers
    if (!Number.isFinite(volume) || volume < 0) {
      console.warn(
        `⚠️ Non-finite or negative volume '${volume}' for sound ${soundName}. Resetting to 0.5.`
      );
      volume = 0.5;
    }
    if (!Number.isFinite(panValue)) {
      panValue = 0;
    }

    if (x !== null && y !== null) {
      const isPlayerSound =
        Math.abs(x - playerX) < 1 && Math.abs(y - playerY) < 1;
      if (!isPlayerSound) {
        volume =
          config.volume *
          volumeVariation *
          this.calculateVolume(x, y, playerX, playerY);
        panValue = this.calculatePan(x, playerX);
      }
    }

    // Apply per-category gain (SFX) before scheduling envelope
    volume *= audio.categoryGain?.sfx || 1;

    // -------------------------------------------------------------------
    // 📊 DEBUG INFO SETUP (captures values before envelope scheduling)
    // -------------------------------------------------------------------
    const debugEnabled =
      window.DEBUG_AUDIO ||
      window.debug_audio ||
      localStorage.getItem('debugAudio') === '1';
    const dx = x !== null && x !== undefined ? x - playerX : 0;
    const dy = y !== null && y !== undefined ? y - playerY : 0;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const isOnScreen = Math.abs(dx) <= 400 && Math.abs(dy) <= 300;
    let debugReverb = 0;
    let debugDry = 0;

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + config.duration * durationVariation
    );

    panNode.pan.setValueAtTime(panValue, ctx.currentTime);

    // Optional debug output for quick balancing tweaks with spatial info
    if (debugEnabled) {
      console.log('🎵', {
        name: soundName,
        gain: volume.toFixed(2),
        dist: distance.toFixed(1),
        pan: panValue.toFixed(2),
        onscreen: isOnScreen,
        reverb: debugReverb,
        dry: debugDry,
        pos: `(${Math.round(x ?? playerX)},${Math.round(y ?? playerY)})`,
      });
    }

    // Node graph – oscillator ▶ tremoloGain ▶ gain ▶ pan ▶ (reverb?) ▶ master
    const tremoloGain = ctx.createGain();
    oscillator.connect(tremoloGain);
    tremoloGain.connect(gainNode);
    gainNode.connect(panNode);

    if (config.tremolo) {
      this.applyBeatTremolo(tremoloGain, config.duration * durationVariation);
    }

    // Ambient / reverb check
    const ambientSet = new Set([
      'enemyIdle',
      'stabberChant',
      'gruntAdvance',
      'gruntRetreat',
      'stabberStalk',
      'gruntMalfunction',
      'gruntBeep',
      'gruntWhir',
      'gruntError',
      'gruntGlitch',
    ]);

    if (ambientSet.has(soundName) && audio.effects.reverb) {
      const normalizedDistance = Math.min(distance / 600, 1);

      const reverbGain = ctx.createGain();
      const lowPassFilter = ctx.createBiquadFilter();
      const distortionNode = ctx.createWaveShaper();

      const reverbIntensity = 0.15 + normalizedDistance * 0.15;
      reverbGain.gain.setValueAtTime(reverbIntensity, ctx.currentTime);
      debugReverb = reverbIntensity.toFixed(2);

      const lowpassFreq = 1400 - normalizedDistance * 600;
      lowPassFilter.type = 'lowpass';
      lowPassFilter.frequency.setValueAtTime(lowpassFreq, ctx.currentTime);
      lowPassFilter.Q.setValueAtTime(0.5, ctx.currentTime);

      distortionNode.curve = audio.createOrGetCurve(5);
      distortionNode.oversample = '2x';

      panNode.connect(lowPassFilter);
      lowPassFilter.connect(distortionNode);
      distortionNode.connect(reverbGain);
      reverbGain.connect(audio.effects.reverb);
      audio.effects.reverb.connect(audio.masterGain);

      const dryGain = ctx.createGain();
      const dryMix = 0.9 - normalizedDistance * 0.15;
      dryGain.gain.setValueAtTime(dryMix, ctx.currentTime);
      debugDry = dryMix.toFixed(2);
      panNode.connect(dryGain);
      dryGain.connect(audio.masterGain);
    } else {
      panNode.connect(audio.masterGain);
    }

    // --- DEBUG_AUDIO_PEAK: true-peak and LUFS logging ---
    if (window.DEBUG_AUDIO_PEAK) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      const bufferLength = analyser.fftSize;
      const dataArray = new Float32Array(bufferLength);
      panNode.connect(analyser);
      analyser.connect(audio.masterGain);
      setTimeout(
        () => {
          analyser.getFloatTimeDomainData(dataArray);
          let peak = 0;
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            const v = Math.abs(dataArray[i]);
            if (v > peak) peak = v;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / bufferLength);
          // LUFS rough estimate: -0.691 + 10*log10(rms^2)
          const lufs = -0.691 + 10 * Math.log10(rms * rms);
          console.log(
            `🔊 [${soundName}] true-peak: ${(20 * Math.log10(peak)).toFixed(1)} dBFS, LUFS: ${lufs.toFixed(1)}`
          );
        },
        Math.max(10, config.duration * 500)
      );
    }

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + config.duration * durationVariation);
  }

  // ----- helper maths ----------------------------------------------------

  calculatePan(x, playerX = 400) {
    if (x === null || x === undefined) return 0;
    return Math.max(-1, Math.min(1, (x - playerX) / 400));
  }

  calculateVolume(x, y, playerX = 400, playerY = 300) {
    if (x === null || y === null) return 1.0;
    const distance = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
    const normalizedDistance = Math.min(distance / 600, 1);
    return Math.max(0.3, 1.0 - normalizedDistance * 0.6);
  }

  /**
   * Apply a beat-synced tremolo LFO using the global `window.beatClock`.
   * Keeps SFX rhythmically aligned with the Cosmic Beat.
   */
  applyBeatTremolo(targetGain, duration) {
    if (!window.beatClock) return;

    const ctx = this.audio.audioContext;
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(window.beatClock.bpm / 60, ctx.currentTime);
    depth.gain.setValueAtTime(0.5, ctx.currentTime);

    lfo.connect(depth);
    depth.connect(targetGain.gain);

    lfo.start(ctx.currentTime);
    lfo.stop(ctx.currentTime + duration);
  }
}
