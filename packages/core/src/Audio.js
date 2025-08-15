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
import { random, randomRange, floor, PI } from './mathUtils.js';
import { SFXManager } from './audio/SFXManager.js';
import { SOUND } from './audio/SoundIds.js';

export class Audio {
  /**
   * @param {p5} p - The p5 instance
   * @param {Player} player - The player object (dependency injected for modularity)
   */
  constructor(p, player, ...args) {
    this.p = p;
    this.player = player;
    // Core audio setup
    this.audioContext = null;
    this.masterGain = null;
    this.initialized = false;
    this.enabled = true;
    // Master volume (increased from 0.7 → 1.0 for better baseline loudness)
    this.volume = 1.0;

    // Per-category gain multipliers for quick balancing (🔊 sfx, 🗣️ speech)
    this.categoryGain = {
      sfx: 1.0,
      speech: 1.5, // speech needs a boost to cut through
    };

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

    // Sound configuration - MUSICAL COMBAT SYSTEM
    this.sounds = {
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
      }, // Sharp accent: cutting through
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
      stabberKnifeExtend: {
        frequency: 2000,
        waveform: 'triangle',
        volume: 0.3,
        duration: 0.12,
      },
      stabberKnifeHit: {
        frequency: 2600,
        waveform: 'square',
        volume: 0.45,
        duration: 0.05,
      },
    };

    // Voice configuration - REDUCED VOLUMES for background speech effect
    this.voiceConfig = {
      // Player voice tweaked for mysterious tone
      player: { rate: 0.85, pitch: 0.15, volume: 0.5 },
      grunt: { rate: 0.6, pitch: 1.6, volume: 0.3 }, // Reduced from 0.8 to 0.3
      rusher: { rate: 1.4, pitch: 1.5, volume: 0.35 }, // Reduced from 0.9 to 0.35
      tank: { rate: 0.5, pitch: 0.2, volume: 0.4 }, // Reduced from 1.0 to 0.4
      stabber: { rate: 0.8, pitch: 2.0, volume: 0.4 }, // Fixed: was 0.4, comment said 0.3
    };

    // Initialise dedicated SFX Manager (first extraction step)
    this.sfxManager = new SFXManager(this);

    // Override legacy methods to delegate to SFX manager
    this.playSound = (...a) => this.sfxManager.playSound(...a);
    this.playTone = (...a) => this.sfxManager.playTone(...a);

    // Validate registry vs config in development builds
    try {
      this.validateSoundRegistry();
    } catch (e) {
      console.error(e);
      throw e;
    }

    console.log('🎵 Optimized Audio System ready');

    // Register listener to keep player reference in sync on global event bus
    window.addEventListener('playerChanged', (e) => {
      if (e && e.detail) {
        this.setPlayer(e.detail);
      }
    });
  }

  /**
   * Update the internal player reference used for spatial audio calculations.
   * Safe to call multiple times; ignores invalid or duplicate inputs.
   * @param {Player} newPlayer - The current live player instance.
   */
  setPlayer(newPlayer) {
    if (!newPlayer || newPlayer === this.player) return;
    this.player = newPlayer;
    console.log('🔊 Audio player reference updated');
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
    const deg = PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (PI + amount * Math.abs(x));
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
      // Fallback: some browsers never fire onvoiceschanged reliably – poll once after a short delay
      setTimeout(() => {
        try {
          loadVoices();
        } catch (_) {}
      }, 300);
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

    this.playTone(soundConfig, x, y);
  }

  playTone(config, x, y) {
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
          this.calculateVolume(x, y, playerX, playerY);
        panValue = this.calculatePan(x, playerX);
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
      this.applyBeatTremolo(tremoloGain, config.duration * durationVariation);
    }

    // Check if this is an ambient enemy sound that should have reverb
    const soundName = Object.keys(this.sounds).find(
      (key) => this.sounds[key] === config
    );
    const isAmbientSound = [
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
    ].includes(soundName);

    if (isAmbientSound && this.effects.reverb) {
      // OPTIMIZED: Simplified atmospheric effects for better performance
      const distance = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
      const normalizedDistance = Math.min(distance / 600, 1); // 0 = close, 1 = far

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

  calculatePan(x, playerX = 400) {
    if (playerX === 400 && typeof this.player !== 'undefined')
      playerX = this.player.x;
    if (x === null || x === undefined) return 0;
    // Pan relative to player position instead of screen center
    return Math.max(-1, Math.min(1, (x - playerX) / 400));
  }

  calculateVolume(x, y, playerX = 400, playerY = 300) {
    if (playerX === 400 && typeof this.player !== 'undefined')
      playerX = this.player.x;
    if (playerY === 300 && typeof this.player !== 'undefined')
      playerY = this.player.y;
    if (x === null || y === null) return 1.0;

    // Calculate distance relative to player position instead of screen center
    const distance = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
    const normalizedDistance = Math.min(distance / 600, 1); // Longer range for less dramatic falloff

    // Less dramatic volume reduction for distant enemies
    return Math.max(0.3, 1.0 - normalizedDistance * 0.6);
  }

  // Apply beat-synced tremolo using the global BeatClock
  applyBeatTremolo(targetGain, duration) {
    if (!window.beatClock) return;

    const lfo = this.audioContext.createOscillator();
    const depth = this.audioContext.createGain();

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(
      window.beatClock.bpm / 60,
      this.audioContext.currentTime
    );
    depth.gain.setValueAtTime(0.5, this.audioContext.currentTime);

    lfo.connect(depth);
    depth.connect(targetGain.gain);

    lfo.start(this.audioContext.currentTime);
    lfo.stop(this.audioContext.currentTime + duration);
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
    // Ensure TTS volume respects master volume, per-voice config, distance attenuation (clamped), and speech gain
    const distanceAtt = Math.max(
      0.5, // never drop below half volume for speech so lines remain audible
      this.calculateVolume(ex, ey, playerX, playerY)
    );
    utterance.volume = Math.min(
      1,
      config.volume *
        distanceAtt *
        this.volume *
        (this.categoryGain?.speech || 1)
    );

    // Enhanced voice selection with effects
    const voice = this.selectVoiceWithEffects(voiceType, text);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    // Apply dynamic voice effects based on content
    this.applyVoiceEffects(utterance, voiceType, text);

    // IMPROVED text-speech synchronization
    const estimatedDuration = this.calculateSpeechDuration(
      text,
      utterance.rate
    );
    this.showText(entity, displayText, voiceType, estimatedDuration);

    // Attempt to ensure speech engine is in a clean state (Chrome can get stuck)
    try {
      this.speechSynthesis.cancel();
      if (typeof this.speechSynthesis.resume === 'function') {
        this.speechSynthesis.resume();
      }
    } catch (_) {}

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

  // SIMPLIFIED voice selection
  selectVoice(voiceType) {
    if (this.englishVoices.length === 0) return null;

    // Prefer US voices, fallback to any English
    const usVoices = this.englishVoices.filter((v) => v.lang.includes('US'));
    const availableVoices = usVoices.length > 0 ? usVoices : this.englishVoices;

    if (voiceType === 'player') {
      // Enhanced masculine voice detection
      const maleVoices = availableVoices.filter((v) => {
        const name = v.name.toLowerCase();
        return (
          name.includes('male') ||
          name.includes('david') ||
          name.includes('alex') ||
          name.includes('james') ||
          name.includes('john') ||
          name.includes('michael') ||
          name.includes('mark') ||
          name.includes('paul') ||
          name.includes('daniel') ||
          name.includes('deep') ||
          name.includes('bass') ||
          name.includes('rich')
        );
      });

      // Prefer deeper/richer sounding voices
      const deepVoices = maleVoices.filter((v) => {
        const name = v.name.toLowerCase();
        return (
          name.includes('deep') ||
          name.includes('bass') ||
          name.includes('rich') ||
          name.includes('low')
        );
      });

      if (deepVoices.length > 0) return deepVoices[0];
      if (maleVoices.length > 0) return maleVoices[0];
      return availableVoices[0];
    }

    // Random voice for enemies
    return availableVoices[Math.floor(random() * availableVoices.length)];
  }

  // ENHANCED voice selection with effects
  selectVoiceWithEffects(voiceType, text) {
    if (this.englishVoices.length === 0) return null;

    // Prefer US voices, fallback to any English
    const usVoices = this.englishVoices.filter((v) => v.lang.includes('US'));
    const availableVoices = usVoices.length > 0 ? usVoices : this.englishVoices;

    if (voiceType === 'player') {
      // Enhanced masculine voice detection for heroic sound
      const maleVoices = availableVoices.filter((v) => {
        const name = v.name.toLowerCase();
        return (
          name.includes('male') ||
          name.includes('david') ||
          name.includes('alex') ||
          name.includes('james') ||
          name.includes('john') ||
          name.includes('michael') ||
          name.includes('mark') ||
          name.includes('paul') ||
          name.includes('daniel') ||
          name.includes('deep') ||
          name.includes('bass') ||
          name.includes('rich') ||
          name.includes('low') ||
          name.includes('tom') ||
          name.includes('sam')
        );
      });

      // Prefer deeper/richer sounding voices for hero
      const deepVoices = maleVoices.filter((v) => {
        const name = v.name.toLowerCase();
        return (
          name.includes('deep') ||
          name.includes('bass') ||
          name.includes('rich') ||
          name.includes('low') ||
          name.includes('resonant')
        );
      });

      if (deepVoices.length > 0) return deepVoices[0];
      if (maleVoices.length > 0) return maleVoices[0];
      return availableVoices[0];
    }

    // Enemy voice selection based on character type and content
    if (voiceType === 'grunt') {
      // Prefer robotic or monotone voices for confused grunts
      const roboticVoices = availableVoices.filter((v) => {
        const name = v.name.toLowerCase();
        return (
          name.includes('robot') ||
          name.includes('computer') ||
          name.includes('synthetic') ||
          name.includes('monotone') ||
          name.includes('flat')
        );
      });
      if (roboticVoices.length > 0)
        return roboticVoices[Math.floor(random() * roboticVoices.length)];
    }

    if (voiceType === 'rusher') {
      // Prefer higher, more frantic voices for rushers
      const franticVoices = availableVoices.filter((v) => {
        const name = v.name.toLowerCase();
        return (
          name.includes('female') ||
          name.includes('high') ||
          name.includes('fast') ||
          name.includes('excited') ||
          name.includes('energetic')
        );
      });
      if (franticVoices.length > 0)
        return franticVoices[Math.floor(random() * franticVoices.length)];
    }

    if (voiceType === 'tank') {
      // Prefer deep, intimidating voices for tanks
      const deepVoices = availableVoices.filter((v) => {
        const name = v.name.toLowerCase();
        return (
          name.includes('deep') ||
          name.includes('bass') ||
          name.includes('low') ||
          name.includes('heavy') ||
          name.includes('strong') ||
          name.includes('male')
        );
      });
      if (deepVoices.length > 0)
        return deepVoices[Math.floor(random() * deepVoices.length)];
    }

    if (voiceType === 'stabber') {
      // Prefer precise, clinical voices for stabbers
      const preciseVoices = availableVoices.filter((v) => {
        const name = v.name.toLowerCase();
        return (
          name.includes('clear') ||
          name.includes('precise') ||
          name.includes('clinical') ||
          name.includes('sharp') ||
          name.includes('articulate')
        );
      });
      if (preciseVoices.length > 0)
        return preciseVoices[floor(random() * preciseVoices.length)];
    }

    // Fallback to random voice
    return availableVoices[floor(random() * availableVoices.length)];
  }

  // DYNAMIC voice effects based on content and character
  applyVoiceEffects(utterance, voiceType, text) {
    const baseConfig = this.voiceConfig[voiceType] || this.voiceConfig.player;

    // Content-based effects
    const isAggressive = this.isAggressiveText(text);
    const isConfused = this.isConfusedText(text);
    const isScreaming =
      text.includes('!') || text.includes('AHHH') || text.includes('WHEEE');

    // Apply dynamic modifications
    if (voiceType === 'player') {
      // Hero gets confident, clear speech with slight dramatic flair
      if (isAggressive) {
        utterance.rate = Math.max(0.8, baseConfig.rate - 0.1); // Slower for emphasis
        utterance.pitch = Math.max(0.3, baseConfig.pitch - 0.1); // Deeper for intimidation
      }
    } else if (voiceType === 'grunt') {
      // Grunts get robotic, confused effects
      if (isConfused) {
        utterance.rate = Math.max(0.4, baseConfig.rate - 0.2); // Much slower when confused
        utterance.pitch = baseConfig.pitch + randomRange(-0.1, 0.1); // Slight pitch variation
      }
      if (isAggressive) {
        utterance.rate = Math.min(1.0, baseConfig.rate + 0.2); // Faster when angry
        utterance.pitch = Math.min(1.0, baseConfig.pitch + 0.2); // Higher when excited
      }
    } else if (voiceType === 'rusher') {
      // Rushers get frantic, escalating effects
      if (isScreaming || isAggressive) {
        utterance.rate = Math.min(2.0, baseConfig.rate + 0.3); // Much faster when screaming
        utterance.pitch = Math.min(2.0, baseConfig.pitch + 0.2); // Higher pitch for screams
      }
    } else if (voiceType === 'tank') {
      // Tanks get intimidating, powerful effects
      if (isAggressive) {
        utterance.rate = Math.max(0.3, baseConfig.rate - 0.2); // Slower for menace
        utterance.pitch = Math.max(0.1, baseConfig.pitch - 0.1); // Deeper for intimidation
      }
    } else if (voiceType === 'stabber') {
      // Stabbers get precise, clinical effects
      if (isAggressive) {
        utterance.rate = Math.max(0.7, baseConfig.rate - 0.2); // Slower, more deliberate
        utterance.pitch = baseConfig.pitch + randomRange(-0.05, 0.05); // Slight variation for unsettling effect
      }
    }

    // Add some randomness for variety (small amounts)
    utterance.rate += randomRange(-0.05, 0.05);
    utterance.pitch += randomRange(-0.03, 0.03);

    // Ensure values stay in valid ranges
    utterance.rate = Math.max(0.1, Math.min(2.0, utterance.rate));
    utterance.pitch = Math.max(0.1, Math.min(2.0, utterance.pitch));
  }

  // ========================================================================
  // TEXT DISPLAY SYSTEM
  // ========================================================================

  showText(entity, text, voiceType, duration) {
    // Determine aggression level and style based on text content
    const isAggressive = this.isAggressiveText(text);
    const isConfused = this.isConfusedText(text);

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

  // Helper methods to detect text types
  isAggressiveText(text) {
    const aggressiveWords = [
      'KILL',
      'DEATH',
      'DESTROY',
      'BLOOD',
      'TEAR',
      'CRUSH',
      'OBLITERATE',
      'VIOLENCE',
      'CARNAGE',
      'ANNIHILATION',
      'CARVE',
      'SLICE',
      'BUTCHER',
    ];
    return aggressiveWords.some((word) => text.includes(word));
  }

  isConfusedText(text) {
    const confusedWords = [
      'WAIT',
      'UH',
      'THINK',
      'MAYBE',
      'PROBABLY',
      '?',
      'FORGOT',
      'LOST',
    ];
    return confusedWords.some((word) => text.includes(word));
  }

  updateTexts() {
    for (let i = this.activeTexts.length - 1; i >= 0; i--) {
      const textObj = this.activeTexts[i];
      textObj.timer--;

      // Update position to follow entity
      if (textObj.entity) {
        textObj.x = textObj.entity.x;
        textObj.y = textObj.entity.y - 30;
      }

      // Update animation timers
      if (textObj.shakeTimer > 0) textObj.shakeTimer--;
      if (textObj.wobbleTimer > 0) textObj.wobbleTimer--;

      if (textObj.timer <= 0) {
        this.activeTexts.splice(i, 1);
      }
    }
  }

  drawTexts(p) {
    p.push();
    p.textAlign(p.CENTER, p.CENTER);

    for (const textObj of this.activeTexts) {
      // Defines how long the fade-out animation should last, in frames.
      const fadeOutDuration = 30; // 30 frames = 0.5 seconds at 60fps
      let alpha;

      if (textObj.timer <= fadeOutDuration) {
        // If the remaining time for the text is less than or equal to the fade-out duration,
        // calculate alpha to create a linear fade-out effect.
        alpha = (textObj.timer / fadeOutDuration) * 255;
      } else {
        // If there's more time remaining than the fade-out duration,
        // the text should be fully opaque.
        alpha = 255;
      }
      // Ensure alpha is clamped to the valid range [0, 255].
      alpha = Math.max(0, Math.min(255, alpha));

      // Different colors and styles based on content and character
      const isPlayer = textObj.voiceType === 'player';
      let textColor = [255, 255, 255]; // Default white
      let textSizeValue = 10; // Same size for all
      let strokeWeightValue = 2;

      if (isPlayer) {
        textColor = [255, 255, 0]; // Yellow for player
        textSizeValue = 11; // Slightly larger for player
      } else {
        // All enemies use white text, same size
        textColor = [255, 255, 255]; // White for all enemies
        textSizeValue = 10; // Same size for all enemies

        // Only adjust stroke weight for aggressive content
        if (textObj.isAggressive) {
          strokeWeightValue = 3; // Thicker stroke for aggressive
        }
      }

      p.textSize(textSizeValue);

      // NEW LOGIC: Use world coordinates directly.
      // The camera transform is already applied globally in GameLoop.js
      let screenX = textObj.x;
      let screenY = textObj.y;

      // Add animation effects
      if (textObj.shakeTimer > 0) {
        // Shake effect for aggressive text
        screenX += randomRange(-2, 2);
        screenY += randomRange(-1, 1);
      }

      if (textObj.wobbleTimer > 0) {
        // Wobble effect for confused text
        const wobble = this.p.sin(this.p.frameCount * 0.3) * 1.5;
        screenX += wobble;
        screenY += this.p.sin(this.p.frameCount * 0.2) * 0.8;
      }

      // Enhanced stroke for better visibility
      p.stroke(0, 0, 0, alpha);
      p.strokeWeight(strokeWeightValue);

      // Fill with calculated color
      p.fill(textColor[0], textColor[1], textColor[2], alpha);

      p.text(textObj.text, screenX, screenY);
    }

    if (this.showBeatIndicator) {
      drawGlow(p, this.beatX, this.beatY, 40, p.color(255, 255, 100), 0.5);
    }

    p.pop();
  }

  // ========================================================================
  // CONVENIENCE METHODS
  // ========================================================================

  // Sound effects
  playPlayerShoot(x, y) {
    this.playSound(SOUND.playerShoot, x, y);
  }
  playAlienShoot(x, y) {
    this.playSound(SOUND.alienShoot, x, y);
  }
  playExplosion(x, y) {
    this.playSound(SOUND.explosion, x, y);
  }
  playHit(x, y) {
    this.playSound(SOUND.hit, x, y);
  }
  playPlayerHit() {
    this.playSound(SOUND.playerHit);
  }
  playEnemyHit(x, y) {
    this.playSound(SOUND.hit, x, y);
  }
  playRusherScream(x, y) {
    this.playSound(SOUND.rusherScream, x, y);
  }
  playTankEnergyBall(x, y) {
    this.playSound(SOUND.tankEnergy, x, y);
  }
  playStabAttack(x, y) {
    this.playSound(SOUND.stabAttack, x, y);
  }
  playEnemyFrying(x, y) {
    this.playSound(SOUND.enemyFrying, x, y);
  }

  // NEW CHARACTER-BUILDING SOUND METHODS
  playPlasmaCloud(x, y) {
    this.playSound(SOUND.plasmaCloud, x, y);
  }
  playTankCharging(x, y) {
    this.playSound(SOUND.tankCharging, x, y);
  }
  playTankPower(x, y) {
    this.playSound(SOUND.tankPower, x, y);
  }
  playStabberChant(x, y) {
    this.playSound(SOUND.stabberChant, x, y);
  }
  playGruntAdvance(x, y) {
    this.playSound(SOUND.gruntAdvance, x, y);
  }
  playGruntRetreat(x, y) {
    this.playSound(SOUND.gruntRetreat, x, y);
  }
  playRusherCharge(x, y) {
    this.playSound(SOUND.rusherCharge, x, y);
  }
  playStabberKnife(x, y) {
    this.playSound(SOUND.stabberKnife, x, y);
  }
  playEnemyIdle(x, y) {
    this.playSound(SOUND.enemyIdle, x, y);
  }
  playTankPowerUp(x, y) {
    this.playSound(SOUND.tankPowerUp, x, y);
  }
  playStabberStalk(x, y) {
    this.playSound(SOUND.stabberStalk, x, y);
  }
  playStabberDash(x, y) {
    this.playSound(SOUND.stabberDash, x, y);
  }

  // NEW GRUNT AMBIENT SOUND METHODS
  playGruntMalfunction(x, y) {
    this.playSound(SOUND.gruntMalfunction, x, y);
  }
  playGruntBeep(x, y) {
    this.playSound(SOUND.gruntBeep, x, y);
  }
  playGruntWhir(x, y) {
    this.playSound(SOUND.gruntWhir, x, y);
  }
  playGruntError(x, y) {
    this.playSound(SOUND.gruntError, x, y);
  }
  playGruntGlitch(x, y) {
    this.playSound(SOUND.gruntGlitch, x, y);
  }

  // NEW SATISFYING KILL SOUND METHODS - The good stuff!
  playGruntPop(x, y) {
    this.playSound(SOUND.gruntPop, x, y);
  }
  playEnemyOhNo(x, y) {
    this.playSound(SOUND.enemyOhNo, x, y);
  }
  playStabberOhNo(x, y) {
    this.playSound(SOUND.stabberOhNo, x, y);
  }
  playRusherOhNo(x, y) {
    this.playSound(SOUND.rusherOhNo, x, y);
  }
  playTankOhNo(x, y) {
    this.playSound(SOUND.tankOhNo, x, y);
  }

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
    const lines = {
      start: [
        'RISE!',
        'CRUSH!',
        'BLOOD MOON!',
        'CHAOS!',
        'DANCE DEATH!',
        'COSMIC!',
        'LAUGH!',
        'RIOT!',
      ],
      damage: [
        'PAIN!',
        'BROKEN!',
        'HA!',
        'YOU MISS!',
        'TRY AGAIN!',
        'BITTER!',
        'BLEED!',
        'MAD!',
      ],
      lowHealth: [
        'MORE!',
        'STILL HERE!',
        'NO FEAR!',
        'DEEP CUT!',
        'GASP!',
        'WE CONTINUE!',
        'HOLD FAST!',
        'NEVER DONE!',
      ],
      death: [
        'FALLING...',
        'FAREWELL!',
        'DARKNESS...',
        'SEE YOU...',
        'I END...',
        'GOODBYE...',
        'VOID CALLS!',
        'FADING...',
      ],
    };
    const contextLines = lines[context] || lines.start;
    return contextLines[floor(random() * contextLines.length)];
  }

  getGruntLine() {
    const lines = [
      // Threatening but confused
      'KILL HUMAN!',
      'DESTROY TARGET!',
      'ELIMINATE!',
      'ATTACK MODE!',
      'HOSTILE DETECTED!',
      'ENGAGE ENEMY!',
      'FIRE WEAPONS!',
      'DEATH TO HUMANS!',

      // Confused/stupid moments (the good stuff but shorter)
      'WAIT WHAT?',
      'I FORGOT SOMETHING!',
      'WHERE AM I?',
      'HELP!',
      'WRONG PLANET?',
      'NEED BACKUP!',
      'LOST AGAIN!',
      'OOPS!',
      'MY HELMET IS TIGHT!',
      'WIFI PASSWORD?',
      'MOMMY?',
      'SCARED!',
      'IS THAT MY TARGET?',
      'WHICH BUTTON?',
      "I'M CONFUSED!",
    ];
    return lines[floor(random() * lines.length)];
  }

  getRusherLine() {
    const lines = [
      // Aggressive charging
      'INCOMING!',
      'KAMIKAZE TIME!',
      'SUICIDE RUN!',
      'BOOM BOOM!',
      'DIE WITH ME!',
      'EXPLOSIVE DEATH!',
      'RAMPAGE MODE!',
      'BERSERKER!',
      'DEATH RUSH!',
      'BLAST RADIUS!',
      'DETONATE!',
      'KABOOM!',

      // Crazy moments (keep the fun)
      'WHEEEEE!',
      'YOLO BOMB!',
      'CANNONBALL!',
      'ZOOM ZOOM!',
      'TOO FAST!',
      "CAN'T STOP!",
      'EXPLOSIVE DIARRHEA!',
      'REGRET NOTHING!',
      'WITNESS ME!',
      'LEEROY JENKINS!',
      'OOPS BOOM!',
    ];
    return lines[floor(random() * lines.length)];
  }

  getTankLine() {
    const lines = [
      // Heavy intimidation
      'CRUSH ENEMIES!',
      'HEAVY ARTILLERY!',
      'DEVASTATE ALL!',
      'SIEGE MODE!',
      'BIG GUN READY!',
      'UNSTOPPABLE FORCE!',
      'FORTRESS ONLINE!',
      'APOCALYPSE!',
      'OVERWHELMING POWER!',
      'JUGGERNAUT!',
      'PULVERIZE!',
      'DOMINATE!',

      // Macho moments (the good compensating humor)
      'DO YOU LIFT BRO?',
      'BIG MUSCLES!',
      'ALPHA MALE!',
      'COMPENSATING!',
      'SIZE MATTERS!',
      'PROTEIN POWER!',
      'HULK SMASH!',
      'BEAST MODE!',
      'MY GUN IS BIGGER!',
      'MAXIMUM TESTOSTERONE!',
    ];
    return lines[floor(random() * lines.length)];
  }

  getStabberLine() {
    const lines = [
      // Sharp and deadly
      'STAB TIME!',
      'SLICE AND DICE!',
      'PRECISION CUT!',
      'BLADE READY!',
      'SURGICAL STRIKE!',
      'SHARP DEATH!',
      'KNIFE WORK!',
      'CARVE YOU UP!',
      'CUTTING EDGE!',
      'STABBING SPREE!',
      'DISSECTION!',
      'PIERCE!',

      // Poke humor (the good surgical jokes)
      'ACUPUNCTURE TIME!',
      'JUST A PRICK!',
      'SURGERY!',
      'POKE POKE!',
      'NEEDLE THERAPY!',
      'OOPS SORRY!',
      'STABBY MCSTABFACE!',
      'HUMAN PINCUSHION!',
      'LITTLE SCRATCH!',
      'POINTY DEATH!',
    ];
    return lines[floor(random() * lines.length)];
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

  // MISSING METHODS - Added to fix silent sounds after refactoring
  playBombExplosion(x, y) {
    this.playSound(SOUND.explosion, x, y);
  } // Bombs use explosion sound
  playRusherExplosion(x, y) {
    this.playSound(SOUND.explosion, x, y);
  } // Rusher explosions use explosion sound
  playStabberAttack(x, y) {
    this.playSound(SOUND.stabAttack, x, y);
  } // Stabber attacks use stabAttack sound

  /**
   * Development-time safety: ensure every SOUND id has a config and vice-versa.
   * Throws an Error if any mismatch is found so problems surface immediately.
   */
  validateSoundRegistry() {
    const registryKeys = Object.values(SOUND);
    const configKeys = Object.keys(this.sounds);
    const missingInConfig = registryKeys.filter((k) => !configKeys.includes(k));
    const missingInRegistry = configKeys.filter(
      (k) => !registryKeys.includes(k)
    );
    if (missingInConfig.length || missingInRegistry.length) {
      const details = [
        missingInConfig.length
          ? `→ Missing configs for: ${missingInConfig.join(', ')}`
          : null,
        missingInRegistry.length
          ? `→ Missing registry IDs for: ${missingInRegistry.join(', ')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n');
      throw new Error(`Sound registry mismatch detected!\n${details}`);
    }
    console.log('✅ Sound registry validated –', configKeys.length, 'entries');
  }
}
