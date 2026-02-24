/**
 * Clean and Reliable Audio System for Vibe Game
 *
 * Features:
 * ✅ Simplified Web Audio API sound effects
 * ✅ Reliable TTS with proper synchronization
 * ✅ Clean, manageable code structure
 * ✅ Optimized performance and speech flow
 *
 * =============================================================================
 * 🎛️ AUDIO CONFIGURATION GUIDE
 * =============================================================================
 *
 * 🔊 SOUND EFFECTS CONFIGURATION (lines ~32-62):
 * Each sound has these properties:
 * - frequency: Pitch in Hz (lower = deeper, higher = sharper)
 * - waveform: 'sine', 'sawtooth', 'square', 'triangle' (affects tone quality)
 * - volume: 0.0-1.0 (loudness relative to master volume)
 * - duration: seconds (how long the sound plays)
 *
 * Example - Plasma Ball Configuration:
 * plasmaCloud: {
 *   frequency: 80,        // Deep bass rumble (increase for higher pitch)
 *   waveform: 'sine',     // Smooth tone (try 'sawtooth' for harsher)
 *   volume: 0.6,          // Loud effect (reduce to 0.4 for quieter)
 *   duration: 4.0         // 4 second duration (reduce to 2.0 for shorter)
 * }
 *
 * 🎤 SPEECH CONFIGURATION (lines ~65-71):
 * Each character voice has:
 * - rate: 0.1-2.0 (speech speed, 1.0 = normal)
 * - pitch: 0.0-2.0 (voice pitch, 1.0 = normal)
 * - volume: 0.0-1.0 (speech volume - NOW REDUCED for background effect)
 *
 * 🌊 DISTANCE EFFECTS (lines ~240-280):
 * Ambient sounds get enhanced effects based on distance:
 * - reverbIntensity: How much reverb (echo) to add
 * - distortionAmount: How much to distort the sound
 * - delayTime: Echo delay in seconds
 * - lowpassFreq: High frequency cutoff (lower = more muffled)
 *
 * 🎚️ QUICK ADJUSTMENTS:
 * - Make plasma ball louder: Increase plasmaCloud volume from 0.6 to 0.8
 * - Make plasma ball deeper: Decrease plasmaCloud frequency from 80 to 60
 * - Make speech quieter: Reduce all voiceConfig volume values
 * - More reverb on distant enemies: Increase reverbIntensity calculation
 * - More distortion: Increase distortionAmount in ambient sound processing
 *
 * =============================================================================
 */

// Requires p5.js in instance mode: all p5 functions/vars must use the 'p' parameter (e.g., p.ellipse, p.fill)
import { random, randomRange, floor } from './mathUtils.js';
import { drawGlow } from './visualEffects.js';
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
import {
  getEnemyDialogueLine,
  getPlayerDialogueLine,
} from './audio/DialogueLines.js';
import { SOUND_CONFIG, SOUND_METHOD_TO_KEY } from './audio/SoundConfig.js';
import { VOICE_CONFIG } from './audio/VoiceConfig.js';

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
    this.volume = 0.7;

    // Effects nodes
    this.effects = {
      reverb: null,
      distortion: null,
    };

    // Distortion curve cache
    this.distortionCurves = new Map();
    this.maxCurveCache = 32; // Limit cache size to 32 entries

    // TTS system - OPTIMIZED
    this.speechSynthesis = window.speechSynthesis;
    this.speechEnabled = true;
    this.englishVoices = [];
    this.lastSpeechTime = 0;
    this.speechCooldown = 2500; // 2.5 seconds - reasonable cooldown to prevent excessive chatter

    // Text display system - IMPROVED
    this.activeTexts = [];
    this.showBeatIndicator = false;
    this.beatX = 0;
    this.beatY = 0;

    // Sound configuration - MUSICAL COMBAT SYSTEM
    // Spread SOUND_CONFIG first; inline block overrides (playerShoot, explosion, hit, etc.) are authoritative for game-specific tuning
    this.sounds = {
      ...SOUND_CONFIG,
      // MUSICAL WEAPONS: Each enemy type becomes an instrument
      playerShoot: {
        frequency: 480,
        waveform: 'sawtooth',
        volume: 0.2,
        duration: 0.01,
      }, // Hi-hat: crisp, high, short
      alienShoot: {
        frequency: 800,
        waveform: 'square',
        volume: 0.25,
        duration: 0.15,
      }, // Snare: punchy, mid-range
      tankEnergy: {
        frequency: 80,
        waveform: 'sine',
        volume: 0.7,
        duration: 1.0,
      }, // ENHANCED: Fatter bass drum with more volume and duration
      stabAttack: {
        frequency: 2000,
        waveform: 'sawtooth',
        volume: 0.3,
        duration: 0.1,
      }, // Sharp accent: cutting through

      // NON-MUSICAL SOUNDS: Effects and ambience - ENHANCED EXPLOSIONS
      explosion: {
        frequency: 250,
        waveform: 'sawtooth',
        volume: 0.7,
        duration: 0.3,
      }, // ENHANCED: More snare-like punch
      hit: {
        frequency: 1200,
        waveform: 'triangle',
        duration: 0.05,
        volume: 0.2,
      },
      playerHit: {
        frequency: 250,
        waveform: 'sawtooth',
        volume: 0.4,
        duration: 0.3,
      },
      rusherScream: {
        frequency: 800,
        waveform: 'sawtooth',
        volume: 0.4,
        duration: 1.0,
      },
      enemyFrying: {
        frequency: 1400,
        waveform: 'noise',
        duration: 0.3,
        volume: 0.3,
      }, // ENHANCED: Higher frequency for better audibility
      stabberDash: {
        frequency: 2500,
        waveform: 'sawtooth',
        volume: 0.4,
        duration: 0.3,
      },

      // CHARACTER-BUILDING SOUNDS - ENHANCED PLASMA CLOUD FOR COSMIC BEAT
      plasmaCloud: {
        frequency: 75,
        waveform: 'sawtooth',
        volume: 0.8,
        duration: 5.0,
      }, // ENHANCED: Deeper, more ominous plasma energy with sawtooth for electrical feel
      tankCharging: {
        frequency: 60,
        waveform: 'sawtooth',
        volume: 0.4,
        duration: 0.8,
      },
      tankPower: {
        frequency: 40,
        waveform: 'sawtooth',
        volume: 0.5,
        duration: 1.2,
      },
      stabberChant: {
        frequency: 1800,
        waveform: 'triangle',
        volume: 0.3,
        duration: 0.5,
      },
      gruntAdvance: {
        frequency: 400,
        waveform: 'square',
        volume: 0.2,
        duration: 0.2,
      },
      gruntRetreat: {
        frequency: 350,
        waveform: 'square',
        volume: 0.15,
        duration: 0.08,
      },
      rusherCharge: {
        frequency: 1200,
        waveform: 'sawtooth',
        volume: 0.5,
        duration: 0.6,
        tremolo: true,
      },
      stabberKnife: {
        frequency: 2200,
        waveform: 'triangle',
        volume: 0.4,
        duration: 0.15,
      },
      enemyIdle: {
        frequency: 200,
        waveform: 'sine',
        volume: 0.1,
        duration: 0.8,
      },
      tankPowerUp: {
        frequency: 40,
        waveform: 'sawtooth',
        volume: 0.5,
        duration: 1.2,
      },
      stabberStalk: {
        frequency: 1600,
        waveform: 'triangle',
        volume: 0.25,
        duration: 0.4,
      },

      // SATISFYING KILL SOUNDS - The good stuff!
      gruntPop: {
        frequency: 1200,
        waveform: 'triangle',
        volume: 0.4,
        duration: 0.08,
      }, // Crisp, satisfying POP!
      enemyOhNo: {
        frequency: 800,
        waveform: 'sawtooth',
        volume: 0.35,
        duration: 0.4,
        sweep: { to: 200, curve: 'exponential' },
      }, // Descending "oh no!" sweep
      stabberOhNo: {
        frequency: 1400,
        waveform: 'triangle',
        volume: 0.3,
        duration: 0.35,
        sweep: { to: 300, curve: 'exponential' },
      }, // Higher pitched for stabbers
      rusherOhNo: {
        frequency: 1000,
        waveform: 'sawtooth',
        volume: 0.4,
        duration: 0.5,
        sweep: { to: 150, curve: 'exponential' },
      }, // Longer for dramatic rushers
      tankOhNo: {
        frequency: 600,
        waveform: 'sawtooth',
        volume: 0.5,
        duration: 0.6,
        sweep: { to: 80, curve: 'exponential' },
      }, // Deep, ominous for tanks

      // GRUNT AMBIENT SOUNDS (unchanged)
      gruntMalfunction: {
        frequency: 180,
        waveform: 'sawtooth',
        volume: 0.12,
        duration: 0.4,
      },
      gruntBeep: {
        frequency: 800,
        waveform: 'triangle',
        volume: 0.08,
        duration: 0.15,
      },
      gruntWhir: {
        frequency: 300,
        waveform: 'sine',
        volume: 0.1,
        duration: 0.6,
      },
      gruntError: {
        frequency: 220,
        waveform: 'square',
        volume: 0.1,
        duration: 0.2,
      },
      gruntGlitch: {
        frequency: 150,
        waveform: 'sawtooth',
        volume: 0.09,
        duration: 0.25,
      },
      gruntOw: {
        frequency: 600,
        waveform: 'triangle',
        volume: 0.25,
        duration: 0.18,
      }, // Quick, soft "ow" fallback
    };

    this.voiceConfig = { ...VOICE_CONFIG };

    this.bindConvenienceSoundMethods();

    console.log('🎵 Optimized Audio System ready');
  }

  setContext(context) {
    this.context = context;
  }

  getContextValue(key) {
    if (this.context && typeof this.context.get === 'function') {
      return this.context.get(key);
    }
    if (this.context && key in this.context) {
      return this.context[key];
    }
    return window[key];
  }

  bindConvenienceSoundMethods() {
    for (const [methodName, soundKey] of Object.entries(SOUND_METHOD_TO_KEY)) {
      this[methodName] = (...args) => this.playSound(soundKey, ...args);
    }
  }

  // ========================================================================
  // INITIALIZATION - CENTRALIZED AUDIO CONTEXT MANAGEMENT
  // ========================================================================

  initialize() {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.setValueAtTime(
        this.volume,
        this.audioContext.currentTime
      );

      this.createEffects();
      this.loadVoices();

      this.initialized = true;
      console.log('✅ Audio system initialized');
    } catch (error) {
      console.error('❌ Audio initialization failed:', error);
      this.enabled = false;
    }
  }

  // CENTRALIZED audio context resume - used by both sound and speech
  ensureAudioContext() {
    if (!this.enabled) return false;

    this.initialize();
    if (!this.audioContext) return false;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch((error) => {
        console.warn('Audio context resume failed:', error);
      });
    }

    return true;
  }

  createEffects() {
    // Enhanced reverb for atmospheric ambient sounds
    this.effects.reverb = this.audioContext.createConvolver();
    this.effects.reverb.buffer = this.createReverbImpulse(3.5, 0.5); // Longer, more atmospheric reverb

    // Simple distortion
    this.effects.distortion = this.audioContext.createWaveShaper();
    // Reuse cached curve for identical amount / sample-rate pairs
    this.effects.distortion.curve = this.createOrGetCurve(30);
    this.effects.distortion.oversample = '2x';
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

  // Distortion curve cache helper with proper FIFO eviction and duplicate check
  createOrGetCurve(amount) {
    const sampleRate = this.audioContext ? this.audioContext.sampleRate : 44100;
    const key = `${amount}_${sampleRate}`;
    // If the key already exists, return it immediately (no reinsertion)
    if (this.distortionCurves.has(key)) {
      return this.distortionCurves.get(key);
    }
    // If adding a new key and the cache is full, evict the oldest
    if (this.distortionCurves.size >= this.maxCurveCache) {
      const oldestKey = this.distortionCurves.keys().next().value;
      this.distortionCurves.delete(oldestKey);
    }
    // Add the new curve
    const curve = this.createDistortionCurve(amount, sampleRate);
    this.distortionCurves.set(key, curve);
    return curve;
  }

  loadVoices() {
    const loadVoices = () => {
      const allVoices = this.speechSynthesis.getVoices();
      this.englishVoices = allVoices.filter(
        (voice) =>
          voice.lang.startsWith('en-') &&
          (voice.lang.includes('US') || voice.lang.includes('GB'))
      );
      console.log(`🎤 Loaded ${this.englishVoices.length} English voices`);
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
    const frequencyVariation = 1 + (random() - 0.5) * 0.1;
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

    // NEW: Add frequency sweep support for "oh no!" effects
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
    if (typeof this.player !== 'undefined' && this.player) {
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
      this.audioContext.currentTime + 0.01
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

    if (isAmbientSound && this.effects.reverb) {
      // OPTIMIZED: Simplified atmospheric effects for better performance
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

      // Simplified reverb processing - REDUCED intensity from 65% to 45% for less overwhelming effects
      const reverbGain = this.audioContext.createGain();
      const lowPassFilter = this.audioContext.createBiquadFilter();

      // REDUCED: Reverb intensity from 65% to 45% for more subtle atmospheric effects
      const reverbIntensity = 0.15 + normalizedDistance * 0.15; // Further reduced from 0.25 + 0.2 to 0.15 + 0.15 (range: 15-30% instead of 25-45%)
      reverbGain.gain.setValueAtTime(
        reverbIntensity,
        this.audioContext.currentTime
      );

      // Simplified lowpass filtering
      const lowpassFreq = 1400 - normalizedDistance * 600; // Less dramatic range
      lowPassFilter.type = 'lowpass';
      lowPassFilter.frequency.setValueAtTime(
        lowpassFreq,
        this.audioContext.currentTime
      );
      lowPassFilter.Q.setValueAtTime(0.5, this.audioContext.currentTime); // Reduced Q for performance

      // REDUCED: Distortion amount from 15 to 10 for more subtle otherworldly effect
      const distortionNode = this.audioContext.createWaveShaper();
      distortionNode.curve = this.createOrGetCurve(5); // Was this.createDistortionCurve(5)
      distortionNode.oversample = '2x';

      // SIMPLIFIED: Direct connection with reduced effects intensity
      panNode.connect(lowPassFilter);
      lowPassFilter.connect(distortionNode);
      distortionNode.connect(reverbGain);
      reverbGain.connect(this.effects.reverb);
      this.effects.reverb.connect(this.masterGain);

      // Simplified dry signal path with more dry mix for less overwhelming effects
      const dryGain = this.audioContext.createGain();
      const dryMix = 0.9 - normalizedDistance * 0.15; // Increased dry mix from 0.85-0.2 to 0.9-0.15 to compensate for reduced reverb
      dryGain.gain.setValueAtTime(dryMix, this.audioContext.currentTime);

      panNode.connect(dryGain);
      dryGain.connect(this.masterGain);
    } else {
      // Normal connection for non-ambient sounds
      panNode.connect(this.masterGain);
    }

    // Play
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(
      this.audioContext.currentTime + config.duration * durationVariation
    );
  }

  // ========================================================================
  // SPEECH SYSTEM (SIMPLIFIED AND RELIABLE)
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
    console.log(`💬 ${entity.type || 'Entity'} speaking: "${displayText}"`);

    // Create and configure utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';

    const config = this.voiceConfig[voiceType] || this.voiceConfig.player;
    utterance.rate = config.rate;
    utterance.pitch = config.pitch;

    // Get player position for relative audio positioning
    let playerX = 400,
      playerY = 300; // Default screen center
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
    // Ensure TTS volume respects master volume, per-voice config, and distance attenuation
    utterance.volume = Math.min(
      1,
      config.volume *
        calculateVolumeForPosition(ex, ey, playerX, playerY) *
        this.volume
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

    // IMPROVED text-speech synchronization
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

  // IMPROVED speech duration calculation
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

  // ========================================================================
  // CONVENIENCE METHODS
  // ========================================================================

  // Speech methods (simplified - no Promises)
  speakPlayerLine(player, context) {
    return this.speak(player, this.getPlayerLine(context), 'player');
  }
  speakGruntLine(grunt) {
    return this.speak(grunt, this.getGruntLine(), 'grunt');
  }
  speakRusherLine(rusher) {
    return this.speak(rusher, this.getRusherLine(), 'rusher');
  }
  speakTankLine(tank) {
    return this.speak(tank, this.getTankLine(), 'tank');
  }
  speakStabberLine(stabber) {
    return this.speak(stabber, this.getStabberLine(), 'stabber');
  }

  // Dialogue lines
  getPlayerLine(context) {
    return getPlayerDialogueLine(context, random, floor);
  }

  getGruntLine() {
    return getEnemyDialogueLine('grunt', random, floor);
  }

  getRusherLine() {
    return getEnemyDialogueLine('rusher', random, floor);
  }

  getTankLine() {
    return getEnemyDialogueLine('tank', random, floor);
  }

  getStabberLine() {
    return getEnemyDialogueLine('stabber', random, floor);
  }

  // Control methods
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(
        this.volume,
        this.audioContext.currentTime
      );
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    this.speechEnabled = this.enabled;
    console.log(`🔊 Audio ${this.enabled ? 'enabled' : 'disabled'}`);
    return this.enabled;
  }

  // Compatibility methods
  updateSpeechBubbles() {
    this.updateTexts();
  }
  drawSpeechBubbles() {
    this.drawTexts(this.p);
  }

  // ========================================================================
  // UPDATE METHOD - Called every frame
  // ========================================================================

  update() {
    // Update text display system
    this.updateTexts();
  }
}
