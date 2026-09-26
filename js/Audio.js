/**
 * Audio: synthesized sound effects (SoundConfig.js) and enemy/player speech.
 *
 * Signal flow (one AudioContext, shared with BeatTrack):
 *   effects    -> masterGain (mute) -> duckGain     -> masterLimiter -> out
 *   beat track -> its masterGain    -> beatDuckGain -> masterLimiter
 *   speech     -> speechSynthesis, outside Web Audio; syncDuck() dips the two
 *                 duck gains while it speaks. Levels live in CONFIG.MIX.
 */

// Requires p5.js in instance mode: all p5 functions/vars must use the 'p' parameter (e.g., p.ellipse, p.fill)
import { random, randomRange, floor } from './mathUtils.js';
import { createContextAccessor } from './shared/ContextAccessor.js';
import { drawGlow } from './effects/glowUtils.js';
import {
  AMBIENT_SOUNDS,
  resolveSoundSourcePosition,
} from './audio/AmbientSoundProfile.js';
import {
  calculatePanForPosition,
  calculateVolumeForPosition,
} from './audio/SpatialAudio.js';
import { applyBeatTremolo as applyBeatTremoloEffect } from './audio/BeatTremolo.js';
import { drawActiveTexts, updateActiveTexts } from './audio/TextDisplay.js';
import { selectVoiceWithEffects as selectVoiceWithEffectsHelper } from './audio/VoiceSelection.js';
import { applyVoiceEffects as applyVoiceEffectsHelper } from './audio/VoiceEffects.js';
import {
  isAggressiveText as isAggressiveTextHelper,
  isConfusedText as isConfusedTextHelper,
} from './audio/TextSemantics.js';
import { CONFIG, VOICE_CONFIG } from './config.js';
import { SOUND_CONFIG, TONE_ATTACK_SEC } from './audio/SoundConfig.js';
import { getPlayerDialogueLine } from './audio/DialogueLines.js';

// How fast the game dips when speech starts (the release is in CONFIG.MIX)
const DUCK_ATTACK_SEC = 0.05;

export class Audio {
  /**
   * @param {p5} p - The p5 instance
   * @param {Player} player - The player object (dependency injected for modularity)
   */
  constructor(p, player, context = null, ...args) {
    this.p = p;
    this.player = player;
    this.context = context;
    // Core audio setup
    this.audioContext = null;
    this.masterGain = null;
    this.initialized = false;
    this.enabled = true;
    this.volume = 1.0;

    // Effects nodes
    this.effects = {
      reverb: null,
    };
    // Waveshaper curve for the ambient sounds' wet path (made in createEffects)
    this.ambientDistortionCurve = null;

    // Speech
    this.speechSynthesis = window.speechSynthesis;
    this.speechEnabled = true;
    this.englishVoices = [];
    this.lastSpeechTime = 0;
    this.speechCooldown = 2500; // 2.5 seconds - reasonable cooldown to prevent excessive chatter

    // Speech bubbles and floating text
    this.activeTexts = [];
    this.showBeatIndicator = false;
    this.beatX = 0;
    this.beatY = 0;

    this.sounds = { ...SOUND_CONFIG };
    this.voiceConfig = { ...VOICE_CONFIG };
  }

  setContext(context) {
    this.context = context;
  }

  getContextValue = createContextAccessor(() => this.context);

  // ========================================================================
  // INITIALIZATION - CENTRALIZED AUDIO CONTEXT MANAGEMENT
  // ========================================================================

  initialize() {
    if (this.initialized) return;

    try {
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
      this.masterGain = this.audioContext.createGain();

      // Master limiter to prevent clipping from concurrent sounds
      this.masterLimiter = this.audioContext.createDynamicsCompressor();
      this.masterLimiter.threshold.setValueAtTime(
        -6,
        this.audioContext.currentTime
      );
      this.masterLimiter.knee.setValueAtTime(3, this.audioContext.currentTime);
      this.masterLimiter.ratio.setValueAtTime(
        12,
        this.audioContext.currentTime
      );
      this.masterLimiter.attack.setValueAtTime(
        0.003,
        this.audioContext.currentTime
      );
      this.masterLimiter.release.setValueAtTime(
        0.1,
        this.audioContext.currentTime
      );

      // Duck gains in front of the limiter: effects and beat dip separately
      // while speech plays (see syncDuck). Mute stays on the gains before these.
      this.duckGain = this.audioContext.createGain();
      this.duckGain.connect(this.masterLimiter);
      this.beatDuckGain = this.audioContext.createGain();
      this.beatDuckGain.connect(this.masterLimiter);
      this._ducked = false;

      this.masterGain.connect(this.duckGain);
      this.masterLimiter.connect(this.audioContext.destination);
      this.applyMix();

      this.createEffects();
      this.loadVoices();

      // Start drum machine now that audio context is available
      if (window.beatTrack && !window.beatTrack.isPlaying) {
        window.beatTrack.start().catch((err) => {
          console.warn('BeatTrack start failed:', err);
        });
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ Audio initialization failed:', error);
      this.enabled = false;
    }

    // After the beat track's start(): its first (synchronous) scheduler pass
    // stays silent, and the kick starts on the grid restart() sets next
    if (this.audioContext) {
      this.getContextValue('beatClock')?.useAudioClock(this.audioContext);
    }
  }

  // CENTRALIZED audio context resume - used by both sound and speech
  ensureAudioContext() {
    if (!this.enabled) return false;

    this.initialize();
    if (!this.audioContext) return false;

    if (this.audioContext.state === 'suspended') {
      // Fire-and-forget but don't block callers; sound will start once resumed
      this.audioContext.resume().catch((error) => {
        console.warn('Audio context resume failed:', error);
      });
    }

    return this.audioContext.state === 'running';
  }

  createEffects() {
    // Enhanced reverb for atmospheric ambient sounds
    this.effects.reverb = this.audioContext.createConvolver();
    this.effects.reverb.buffer = this.createReverbImpulse(3.5, 0.5); // Longer, more atmospheric reverb

    // One curve shared by every ambient sound's light distortion
    this.ambientDistortionCurve = this.createDistortionCurve(
      5,
      this.audioContext.sampleRate
    );
  }

  createReverbImpulse(duration, decay) {
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  createDistortionCurve(amount, sampleRate) {
    // Use the actual audio context sample rate, rounded to nearest power of two for efficiency
    let samples = sampleRate || 44100;
    samples = Math.pow(2, Math.round(Math.log2(samples)));
    const curve = new Float32Array(samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] =
        ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  loadVoices() {
    if (this._voicesLoaded) return;

    const loadVoices = () => {
      const allVoices = this.speechSynthesis.getVoices();
      this.englishVoices = allVoices.filter(
        (voice) =>
          voice.lang.startsWith('en-') &&
          (voice.lang.includes('US') || voice.lang.includes('GB'))
      );
      this._voicesLoaded = true;
      this.speechSynthesis.onvoiceschanged = null;
    };

    if (this.speechSynthesis.getVoices().length === 0) {
      this.speechSynthesis.onvoiceschanged = loadVoices;
    } else {
      loadVoices();
    }
  }

  // ========================================================================
  // SOUND EFFECTS
  // ========================================================================

  playSound(soundName, x = null, y = null) {
    if (!this.ensureAudioContext()) return;

    const soundConfig = this.sounds[soundName];
    if (!soundConfig) {
      console.warn(`❌ Sound not found: ${soundName}`);
      return;
    }

    this.playTone(soundConfig, x, y, soundName);
  }

  playTone(config, x, y, soundName = '') {
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    const panNode = this.audioContext.createStereoPanner();

    // Add subtle randomness to frequency and volume for variety
    const freqVarRange = config.frequencyVariationRange || 0.1;
    const frequencyVariation = 1 + (random() - 0.5) * freqVarRange;
    const volumeVariation = 1 + (random() - 0.5) * 0.15;
    const durationVariation = 1 + (random() - 0.5) * 0.2;

    // Configure oscillator with randomness
    oscillator.type =
      config.waveform === 'noise' ? 'sawtooth' : config.waveform;
    const startFreq = config.frequency * frequencyVariation;
    oscillator.frequency.setValueAtTime(
      startFreq,
      this.audioContext.currentTime
    );

    // Optional pitch sweep (e.g. the falling "oh no!" sounds)
    if (config.sweep) {
      const endFreq = config.sweep.to * frequencyVariation;
      const sweepDuration = config.duration * durationVariation;

      if (config.sweep.curve === 'exponential') {
        // Exponential sweep for dramatic "oh no!" effect
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(0.1, endFreq), // Ensure positive value for exponential ramp
          this.audioContext.currentTime + sweepDuration
        );
      } else {
        // Linear sweep as fallback
        oscillator.frequency.linearRampToValueAtTime(
          endFreq,
          this.audioContext.currentTime + sweepDuration
        );
      }
    }

    // Get player position for relative audio positioning
    let playerX = 400,
      playerY = 300; // Default screen center
    if (
      this.player &&
      Number.isFinite(this.player.x) &&
      Number.isFinite(this.player.y)
    ) {
      playerX = this.player.x;
      playerY = this.player.y;
    }

    // Configure gain envelope with proper volume calculation and randomness
    let volume = config.volume * volumeVariation;
    let panValue = 0;

    // Only calculate distance-based volume and panning for positioned sounds (enemies)
    // Player sounds (x, y null or same as player position) get full volume
    if (x !== null && y !== null) {
      const isPlayerSound =
        Math.abs(x - playerX) < 1 && Math.abs(y - playerY) < 1;

      if (!isPlayerSound) {
        // This is an enemy sound - calculate distance-based volume and panning
        volume =
          config.volume *
          volumeVariation *
          calculateVolumeForPosition(x, y, playerX, playerY);
        panValue = calculatePanForPosition(x, playerX);
      }
      // If it's a player sound, keep full volume and center panning (defaults above)
    }

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(
      volume,
      this.audioContext.currentTime + TONE_ATTACK_SEC
    );
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      this.audioContext.currentTime + config.duration * durationVariation
    );

    // Configure panning
    panNode.pan.setValueAtTime(panValue, this.audioContext.currentTime);

    // Connect nodes - add reverb for ambient enemy sounds
    const tremoloGain = this.audioContext.createGain();
    oscillator.connect(tremoloGain);
    tremoloGain.connect(gainNode);
    gainNode.connect(panNode);

    if (config.tremolo) {
      const beatClock = this.getContextValue('beatClock');
      applyBeatTremoloEffect(
        this.audioContext,
        beatClock,
        tremoloGain,
        config.duration * durationVariation
      );
    }

    // Check if this is an ambient enemy sound that should have reverb
    const isAmbientSound = AMBIENT_SOUNDS.has(soundName);

    // Declare reverb-path nodes outside if-block so onended cleanup can access them
    let reverbGainNode = null;
    let lowPassFilter = null;
    let distortionNode = null;
    let dryGain = null;

    if (isAmbientSound && this.effects.reverb) {
      // Distance-based reverb, lowpass and light distortion for ambient enemy sounds
      const { sourceX, sourceY } = resolveSoundSourcePosition(
        x,
        y,
        playerX,
        playerY
      );
      const distance = Math.sqrt(
        (sourceX - playerX) ** 2 + (sourceY - playerY) ** 2
      );
      const normalizedDistance = Math.max(0, Math.min(distance / 600, 1)); // 0 = close, 1 = far; clamp to avoid negative

      reverbGainNode = this.audioContext.createGain();
      lowPassFilter = this.audioContext.createBiquadFilter();

      // Reverb 15% close to 30% far
      const reverbIntensity = 0.15 + normalizedDistance * 0.15;
      reverbGainNode.gain.setValueAtTime(
        reverbIntensity,
        this.audioContext.currentTime
      );

      // Farther sounds are more muffled: 1400 Hz close to 800 Hz far
      const lowpassFreq = 1400 - normalizedDistance * 600;
      lowPassFilter.type = 'lowpass';
      lowPassFilter.frequency.setValueAtTime(
        lowpassFreq,
        this.audioContext.currentTime
      );
      lowPassFilter.Q.setValueAtTime(0.5, this.audioContext.currentTime);

      // A light otherworldly distortion
      distortionNode = this.audioContext.createWaveShaper();
      distortionNode.curve = this.ambientDistortionCurve;
      distortionNode.oversample = '2x';

      // Wet path: pan -> lowpass -> distortion -> reverb -> master
      panNode.connect(lowPassFilter);
      lowPassFilter.connect(distortionNode);
      distortionNode.connect(reverbGainNode);
      reverbGainNode.connect(this.effects.reverb);
      this.effects.reverb.connect(this.masterGain);

      // Dry path: 90% close to 75% far, so the reverb stays subtle
      dryGain = this.audioContext.createGain();
      const dryMix = 0.9 - normalizedDistance * 0.15;
      dryGain.gain.setValueAtTime(dryMix, this.audioContext.currentTime);

      panNode.connect(dryGain);
      dryGain.connect(this.masterGain);
    } else {
      // Normal connection for non-ambient sounds
      panNode.connect(this.masterGain);
    }

    // Play
    try {
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(
        this.audioContext.currentTime + config.duration * durationVariation
      );

      // Clean up all audio nodes when oscillator ends to prevent graph accumulation
      oscillator.onended = () => {
        try {
          oscillator.disconnect();
          tremoloGain.disconnect();
          gainNode.disconnect();
          panNode.disconnect();
          if (lowPassFilter) lowPassFilter.disconnect();
          if (distortionNode) distortionNode.disconnect();
          if (reverbGainNode) reverbGainNode.disconnect();
          if (dryGain) dryGain.disconnect();
        } catch (_) {
          // Nodes may already be disconnected
        }
      };
    } catch (e) {
      try {
        oscillator.disconnect();
      } catch (_) {}
      try {
        gainNode.disconnect();
      } catch (_) {}
      try {
        panNode.disconnect();
      } catch (_) {}
    }
  }

  // ========================================================================
  // SPEECH
  // ========================================================================

  speak(entity, text, voiceType = 'player', force = false) {
    if (!this.speechEnabled || !this.speechSynthesis || !text) {
      return false;
    }

    // Check cooldown unless force is true
    const now = Date.now();
    if (!force && now - this.lastSpeechTime < this.speechCooldown) {
      return false; // Return false immediately, no text, no speech
    }

    this.lastSpeechTime = now;

    // Ensure audio context is ready
    this.ensureAudioContext();

    const displayText = text.toUpperCase();

    // Create and configure utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';

    const config = this.voiceConfig[voiceType] || this.voiceConfig.player;
    utterance.rate = config.rate;
    utterance.pitch = config.pitch;

    // Get player position for relative audio positioning
    let playerX = CONFIG.GAME_SETTINGS.WORLD_WIDTH / 2,
      playerY = CONFIG.GAME_SETTINGS.WORLD_HEIGHT / 2;
    if (typeof this.player !== 'undefined' && this.player) {
      playerX = this.player.x;
      playerY = this.player.y;
    }
    // Ensure entity.x and entity.y are valid numbers
    const ex =
      entity && typeof entity.x === 'number' && !isNaN(entity.x)
        ? entity.x
        : 400;
    const ey =
      entity && typeof entity.y === 'number' && !isNaN(entity.y)
        ? entity.y
        : 300;
    // Speech is outside Web Audio and capped at 1: keep it near full and let
    // syncDuck dip the game while it plays
    const distance = Math.max(
      CONFIG.MIX.SPEECH_DISTANCE_FLOOR,
      calculateVolumeForPosition(ex, ey, playerX, playerY)
    );
    utterance.volume = Math.min(
      1,
      config.volume * distance * CONFIG.MIX.SPEECH_VOLUME
    );

    // Enhanced voice selection with effects
    const voice = selectVoiceWithEffectsHelper(
      this.englishVoices,
      voiceType,
      text,
      random,
      floor
    );
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    // Apply dynamic voice effects based on content
    applyVoiceEffectsHelper(
      utterance,
      voiceType,
      text,
      this.voiceConfig,
      randomRange
    );

    // Show the text for as long as the line takes to say
    const estimatedDuration = this.calculateSpeechDuration(
      text,
      utterance.rate
    );
    this.showText(entity, displayText, voiceType, estimatedDuration);

    // Speak with better error handling
    try {
      this.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('TTS error:', error);
      return false;
    }

    return true; // Successfully started speech
  }

  // A random player line for `lineContext` ('start', 'damage', 'lowHealth', 'death')
  speakPlayerLine(entity, lineContext) {
    this.speak(
      entity,
      getPlayerDialogueLine(lineContext, random, floor),
      'player'
    );
  }

  // Estimated time to say `text` at `rate`
  calculateSpeechDuration(text, rate) {
    // Base calculation: ~150 words per minute at rate 1.0
    const wordsPerMinute = 150 * rate;
    const words = text.split(' ').length;
    const durationSeconds = (words / wordsPerMinute) * 60;

    // Convert to frames (60fps) with minimum duration
    const frames = Math.max(90, Math.floor(durationSeconds * 60)); // Min 1.5 seconds
    return frames;
  }

  // ========================================================================
  // TEXT DISPLAY SYSTEM
  // ========================================================================

  showText(entity, text, voiceType, duration) {
    // Determine aggression level and style based on text content
    const isAggressive = isAggressiveTextHelper(text);
    const isConfused = isConfusedTextHelper(text);

    if (this.activeTexts.length >= 50) {
      this.activeTexts.shift();
    }

    this.activeTexts.push({
      entity: entity,
      text: text,
      voiceType: voiceType,
      timer: duration,
      x: entity.x,
      y: entity.y - 30,
      isAggressive: isAggressive,
      isConfused: isConfused,
      shakeTimer: isAggressive ? 30 : 0, // Shake aggressive text
      wobbleTimer: isConfused ? 60 : 0, // Wobble confused text
    });
  }

  updateTexts() {
    updateActiveTexts(this.activeTexts);
  }

  drawTexts(p) {
    drawActiveTexts(
      p,
      this.activeTexts,
      this.showBeatIndicator,
      this.beatX,
      this.beatY,
      drawGlow
    );
  }

  // Control methods
  // Apply CONFIG.MIX levels (at init and from the ?tune sliders)
  applyMix() {
    this.volume = CONFIG.MIX.SFX_VOLUME;
    if (this.masterGain) {
      this.masterGain.gain.value = this.enabled ? this.volume : 0;
    }
    window.beatTrack?.setVolume(CONFIG.MIX.BEAT_TRACK_VOLUME);
  }

  // Dip the game while the speech engine speaks. Reads the engine's own state
  // every frame, so a lost or late end event can't leave it ducked; capped in
  // case the engine stalls and reports speaking forever.
  syncDuck() {
    if (!this.duckGain) return;
    const { MIX } = CONFIG;
    const speaking =
      this.enabled &&
      !!this.speechSynthesis?.speaking &&
      Date.now() - this.lastSpeechTime < MIX.DUCK_MAX_HOLD_MS;
    if (speaking === this._ducked) return;
    this._ducked = speaking;
    const t = this.audioContext.currentTime;
    const timeConstant =
      (speaking ? DUCK_ATTACK_SEC : MIX.DUCK_RELEASE_SEC) / 3;
    for (const [node, db] of [
      [this.duckGain, MIX.DUCK_SFX_DB],
      [this.beatDuckGain, MIX.DUCK_BEAT_DB],
    ]) {
      node.gain.cancelScheduledValues(t);
      node.gain.setTargetAtTime(
        speaking ? 10 ** (db / 20) : 1,
        t,
        timeConstant
      );
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    this.speechEnabled = this.enabled;
    // Silence what is already playing (beat track, queued speech), not just new sounds.
    // Gains, not audioContext.suspend(): BeatClock runs on the context's clock.
    if (this.masterGain) {
      this.masterGain.gain.value = this.enabled ? this.volume : 0;
    }
    window.beatTrack?.setMuted(!this.enabled);
    if (!this.enabled) this.speechSynthesis?.cancel();
    return this.enabled;
  }

  // ========================================================================
  // UPDATE METHOD - Called every frame
  // ========================================================================

  update() {
    // Update text display system
    this.updateTexts();
  }
}
