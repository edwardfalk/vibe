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

    // Fail fast in development if unknown ID
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

    this.playTone(soundConfig, x, y);
  }

  /**
   * Core tone-generation helper used by all SFX.
   * Mirrors the original logic previously embedded in Audio.js but now lives in its own module.
   *
   * @param {object} config - Frequency / envelope definition taken from Audio.sounds.
   * @param {number|null} [x]
   * @param {number|null} [y]
   */
  playTone(config, x, y) {
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
    const startFreq = config.frequency * frequencyVariation;
    oscillator.frequency.setValueAtTime(startFreq, ctx.currentTime);

    // Optional frequency sweep
    if (config.sweep) {
      const endFreq = config.sweep.to * frequencyVariation;
      const sweepDuration = config.duration * durationVariation;
      if (config.sweep.curve === 'exponential') {
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(0.1, endFreq),
          ctx.currentTime + sweepDuration
        );
      } else {
        oscillator.frequency.linearRampToValueAtTime(
          endFreq,
          ctx.currentTime + sweepDuration
        );
      }
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

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + config.duration * durationVariation
    );

    panNode.pan.setValueAtTime(panValue, ctx.currentTime);

    // Node graph – oscillator ▶ tremoloGain ▶ gain ▶ pan ▶ (reverb?) ▶ master
    const tremoloGain = ctx.createGain();
    oscillator.connect(tremoloGain);
    tremoloGain.connect(gainNode);
    gainNode.connect(panNode);

    if (config.tremolo) {
      this.applyBeatTremolo(tremoloGain, config.duration * durationVariation);
    }

    // Ambient / reverb check
    const soundName = Object.keys(audio.sounds).find(
      (k) => audio.sounds[k] === config
    );
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
      const distance = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
      const normalizedDistance = Math.min(distance / 600, 1);

      const reverbGain = ctx.createGain();
      const lowPassFilter = ctx.createBiquadFilter();
      const distortionNode = ctx.createWaveShaper();

      const reverbIntensity = 0.15 + normalizedDistance * 0.15;
      reverbGain.gain.setValueAtTime(reverbIntensity, ctx.currentTime);

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
      panNode.connect(dryGain);
      dryGain.connect(audio.masterGain);
    } else {
      panNode.connect(audio.masterGain);
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
