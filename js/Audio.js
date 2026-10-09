/**
 * Audio: synthesized sound effects (SoundConfig.js) and enemy/player speech.
 *
 * Signal flow (one AudioContext, shared with BeatTrack):
 *   effects    -> masterGain (mute) -> duckGain     -> masterLimiter -> out
 *   hum        -> masterGain (Hum.js; BeatTrack keeps its time)
 *   beat track -> its masterGain    -> beatDuckGain -> masterLimiter
 *   speech     -> Voicebox (js/audio/speech): each line's gain and pan ->
 *                 speech gain (volume, mute) -> masterLimiter. syncDuck()
 *                 dips the two duck gains while someone speaks; speech itself
 *                 is never ducked. Levels live in CONFIG.MIX.
 */

// Requires p5.js in instance mode: all p5 functions/vars must use the 'p' parameter (e.g., p.ellipse, p.fill)
import { random, floor } from './mathUtils.js';
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
import {
  drawActiveTexts,
  isWaiting,
  updateActiveTexts,
} from './audio/TextDisplay.js';
import {
  isAggressiveText as isAggressiveTextHelper,
  isConfusedText as isConfusedTextHelper,
} from './audio/TextSemantics.js';
import { CONFIG } from './config.js';
import { createReverbImpulse } from './audio/speech/effects.js';
import { Voicebox, startSpeechWorker } from './audio/speech/Voicebox.js';
import { SOUND_CONFIG, TONE_ATTACK_SEC } from './audio/SoundConfig.js';
import {
  BOMB_PLANTED,
  COUNTDOWN,
  PLAYER_LINES,
  TANK_UH_OH,
  getPlayerDialogueLine,
} from './audio/DialogueLines.js';
import { crashNoise } from './audio/CrashSynth.js';
import { SYNTHS } from './audio/Instruments.js';
import { cloudSound, bangSound } from './audio/BombSounds.js';
import {
  gruntPop,
  lastBreath,
  tankAir,
  plateClang,
  GRUNT_POP_SEC,
} from './audio/DeathSounds.js';
import { STRING_PARTS, STRINGS_NOISE_SEC } from './audio/StabberStrings.js';
import { Hum } from './audio/Hum.js';
import { hz } from './audio/Harmony.js';

// How fast the game dips when speech starts (the release is in CONFIG.MIX)
const DUCK_ATTACK_SEC = 0.05;
// A bubble shows for as long as its line is spoken, and at least 1.5 s; one
// whose line won't play shows for as long as it takes at 150 words a minute
const bubbleFrames = (seconds) => Math.max(90, Math.round(seconds * 60));
const WORD_SEC = 0.4;
const MS_PER_SEC = 1000;
const DEFAULT_BEAT_MS = 500; // 120 BPM, with no beat clock
const CLOUD_FRAME_SEC = 1 / 60; // a hazard cloud ticks once a frame
const TANK_DEATH_NOTE = ['1', 2]; // the tank dies on the root
const CENTS_PER_OCTAVE = 1200;
// A tone starts at most this late (playTone), so copies don't add in phase
const MAX_START_OFFSET_SEC = 0.005;
// A hero shot this close (beats) to the last continues their run (heroRunLevel)
const RUN_GAP_BEATS = 0.75;

/** The master limiter, so concurrent sounds can't clip (also the loudness test's) */
export function createMasterLimiter(ctx) {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 3;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;
  return limiter;
}

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
    this.hum = null; // the universe's hum, built in initialize()
    this.initialized = false;
    this.enabled = true;
    this.volume = 1.0;
    // A pause holds the sound (see syncPause); _resuming until it is back
    this._pausedByGame = false;
    this._resuming = false;

    // Effects nodes
    this.effects = {
      reverb: null,
    };
    // Waveshaper curve for the ambient sounds' wet path (made in createEffects)
    this.ambientDistortionCurve = null;

    // Speech. Its engines start loading now, on the title screen, so the
    // first line isn't kept waiting for them; initialize() hands the worker
    // to the Voicebox. Node (the unit tests, the replay) has no Worker, and
    // one that can't be made is tried, and reported, by the Voicebox.
    this.speechWorker = null;
    try {
      if (typeof Worker !== 'undefined') {
        this.speechWorker = startSpeechWorker();
      }
    } catch (_) {}
    this.voicebox = null; // built in initialize()
    this.speechEnabled = true;
    // When the hero's last line and the enemies' last line were taken (ms)
    this.lastSpeechTime = { player: 0, enemies: 0 };

    // Speech bubbles and floating text
    this.activeTexts = [];
    this.showBeatIndicator = false;
    this.beatX = 0;
    this.beatY = 0;

    this.sounds = { ...SOUND_CONFIG };
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

      this.masterLimiter = createMasterLimiter(this.audioContext);

      // Duck gains in front of the limiter: effects and beat dip separately
      // while speech plays (see syncDuck). Mute stays on the gains before these.
      this.duckGain = this.audioContext.createGain();
      this.duckGain.connect(this.masterLimiter);
      this.beatDuckGain = this.audioContext.createGain();
      this.beatDuckGain.connect(this.masterLimiter);
      this._ducked = false;

      this.masterGain.connect(this.duckGain);
      this.masterLimiter.connect(this.audioContext.destination);
      // Speech goes straight to the limiter: the duck never touches it
      this.voicebox = this.createVoicebox(this.audioContext);
      this.voicebox.connect(this.masterLimiter);
      // The bomb's shout and count and his death lines can't wait for a
      // render: the shout must end before the count, the count land on its
      // beats, and his death scene is too short
      for (const line of [BOMB_PLANTED, ...COUNTDOWN, ...PLAYER_LINES.death]) {
        this.voicebox.prepare('player', line);
      }
      // and the tank's "uh oh" has a beat
      this.voicebox.prepare('tank', TANK_UH_OH);
      this.applyMix();
      // The universe's hum, behind masterGain so it mutes and ducks with the
      // effects; built before the beat track starts, which keeps its time.
      // A hum that fails (a bad CONFIG.HUM.ROOT) costs only the hum.
      try {
        this.hum = new Hum(this.audioContext, this.masterGain);
      } catch (error) {
        console.error(
          'The hum failed to start; the game plays on without it:',
          error
        );
      }

      this.createEffects();
      // The crash's noise, once, from a fixed seed (CrashSynth.js)
      crashNoise(this.audioContext);

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

  /**
   * Bring back a context the browser suspended or interrupted, muted or not
   * (mute is gains): his death scene's clock runs on it. Call from a key
   * press, the gesture a browser asks for. Not while a pause holds it.
   */
  wake() {
    const ctx = this.audioContext;
    if (!ctx || ctx.state === 'running' || this._pausedByGame) return;
    ctx.resume().catch((error) => {
      console.warn('Audio context resume failed:', error);
    });
  }

  // CENTRALIZED audio context resume - used by both sound and speech
  ensureAudioContext() {
    // A sound during a pause must not bring the audio back
    if (!this.enabled || this._pausedByGame) return false;

    this.initialize();
    if (!this.audioContext) return false;

    if (this.audioContext.state === 'suspended') {
      // Fire-and-forget but don't block callers; sound will start once resumed
      this.audioContext.resume().catch((error) => {
        console.warn('Audio context resume failed:', error);
      });
    }

    // Coming back from a pause, sounds and lines wait for it, not lost
    return this.audioContext.state === 'running' || this._resuming;
  }

  createEffects() {
    // Enhanced reverb for atmospheric ambient sounds
    this.effects.reverb = this.audioContext.createConvolver();
    this.effects.reverb.buffer = createReverbImpulse(
      this.audioContext,
      3.5,
      0.5
    ); // Longer, more atmospheric reverb

    // One curve shared by every ambient sound's light distortion
    this.ambientDistortionCurve = this.createDistortionCurve(
      5,
      this.audioContext.sampleRate
    );
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

  // The game's speech; the replay tool, which has no Worker, stands one in
  createVoicebox(audioContext) {
    // The title screen's worker goes to one Voicebox: a retried
    // initialize() makes its own, rather than share it
    const worker = this.speechWorker;
    this.speechWorker = null;
    return new Voicebox({
      audioContext,
      ...(worker && { createWorker: () => worker }),
    });
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
    // A sound that throws (a bad CONFIG.HUM.ROOT) warns once and plays
    // nothing: it can't stop the game loop
    try {
      if (soundConfig.synth) {
        this.playSynth(soundConfig, x, y);
      } else {
        this.playTone(soundConfig, x, y, soundName);
      }
    } catch (error) {
      // An error, not a warning, so the browser tests catch a broken sound
      const failed = (this._failedSounds ??= new Set());
      if (!failed.has(soundName)) {
        failed.add(soundName);
        console.error(`Sound ${soundName} failed and plays nothing:`, error);
      }
    }
  }

  // How loud (0..1) and where (pan -1..1) a sound from (x, y) is, heard from
  // the hero; one with no position is beside him
  placement(x, y) {
    const hx = Number.isFinite(this.player?.x) ? this.player.x : 0;
    const hy = Number.isFinite(this.player?.y) ? this.player.y : 0;
    const placed = x !== null && y !== null;
    return {
      near: placed ? calculateVolumeForPosition(x, y, hx, hy) : 1,
      pan: placed ? calculatePanForPosition(x, hx) : 0,
    };
  }

  /**
   * A preset with a synth of its own (Instruments.js), quieter and panned
   * with distance from the hero; the hero's shot is also timed and softened
   */
  playSynth(config, x, y) {
    const { near, pan } = this.placement(x, y);
    const clock = this.getContextValue('beatClock');
    // Every synth is told the nearest eighth; the hero's shot may also wait
    // for it, and softens in a burst
    const { at, eighth, level } =
      config.synth === 'heroShot'
        ? this.heroShotTiming()
        : {
            at: this.audioContext.currentTime,
            eighth: clock ? Math.round(clock.getBeatPosition() * 2) : 0,
            level: 1,
          };
    SYNTHS[config.synth](this.audioContext, this.masterGain, config, {
      volume: near * level,
      pan,
      at,
      eighth,
    });
  }

  /**
   * When the hero's shot plays, the eighth it is told (BeatClock's nearest),
   * and its level: shots in a row (held fire) soften (heroRunLevel)
   */
  heroShotTiming() {
    const clock = this.getContextValue('beatClock');
    const at = this.audioContext.currentTime;
    const eighth = clock ? Math.round(clock.getBeatPosition() * 2) : 0;
    return { at, eighth, level: this.heroRunLevel(at, clock) };
  }

  /**
   * The level of a hero shot starting at audio time `at`. One within
   * RUN_GAP_BEATS of the last continues their run, so held fire softens by
   * HERO_SHOT.SOFTEN_DB over SOFTEN_SHOTS shots; the run's first is
   * unsoftened. Audio time stops in a pause, so a burst goes on after one; a
   * restart ends the run, since game over holds the fire for a bar.
   */
  heroRunLevel(at, clock) {
    const beatSec = (clock?.beatInterval ?? DEFAULT_BEAT_MS) / MS_PER_SEC;
    const last = this._heroRun;
    const n = last && at - last.at <= RUN_GAP_BEATS * beatSec ? last.n + 1 : 0;
    this._heroRun = { at, n };
    const { SOFTEN_DB, SOFTEN_SHOTS } = CONFIG.HERO_SHOT;
    if (SOFTEN_SHOTS <= 0) return 1;
    return 10 ** ((-SOFTEN_DB * Math.min(n, SOFTEN_SHOTS)) / SOFTEN_SHOTS / 20);
  }

  /**
   * A grunt's pop and whine (DeathSounds.js) from (x, y), at audio time `at`,
   * landing on `note`; seed (0..1) picks its stretch of the noise
   */
  playGruntPop(x, y, at, note, seed) {
    if (!this.ensureAudioContext()) return;
    const { near, pan } = this.placement(x, y);
    const noise = crashNoise(this.audioContext);
    gruntPop(this.audioContext, this.masterGain, {
      at,
      note,
      noise,
      offset: seed * (noise.duration - GRUNT_POP_SEC),
      volume: CONFIG.DEATHS.GRUNT_VOLUME * near,
      pan,
    });
  }

  /**
   * One of the stabber's strings (StabberStrings.js) from (x, y), now:
   * 'tremolo' (opts.untilSec: how long to the lock; returns its handle),
   * 'stab', 'screech' (opts.beatSec, for its echo) or 'pluck'. opts.seed
   * (0..1) picks its stretch of the noise. Null when it plays nothing
   * (muted, paused, no context)
   */
  playStabberStrings(part, x, y, opts = {}) {
    if (!this.ensureAudioContext()) return null;
    const S = CONFIG.STABBER;
    const volume = {
      tremolo: S.TREMOLO_VOLUME,
      stab: S.STAB_VOLUME,
      screech: S.STAB_VOLUME,
      pluck: S.PLUCK_VOLUME,
    }[part];
    const { near, pan } = this.placement(x, y);
    const noise = crashNoise(this.audioContext);
    return (
      STRING_PARTS[part](this.audioContext, this.masterGain, {
        ...opts,
        at: this.audioContext.currentTime,
        volume: volume * near,
        pan,
        noise,
        offset: (opts.seed ?? 0) * (noise.duration - STRINGS_NOISE_SEC),
      }) ?? null
    );
  }

  /**
   * A tank's death, All air (DeathSounds.js), from (x, y) at audio time
   * `at`, on his timing and darts (TankDeath.js)
   */
  playTankDeath(x, y, at, timing, darts) {
    if (!this.ensureAudioContext()) return;
    const { near, pan } = this.placement(x, y);
    tankAir(this.audioContext, this.masterGain, {
      at,
      note: TANK_DEATH_NOTE,
      noise: crashNoise(this.audioContext),
      volume: CONFIG.DEATHS.TANK_VOLUME * near,
      pan,
      timing,
      darts,
    });
  }

  /** A tank's plate breaking (DeathSounds.js) at (x, y), now */
  playPlateClang(x, y) {
    if (!this.ensureAudioContext()) return;
    const { near, pan } = this.placement(x, y);
    plateClang(this.audioContext, this.masterGain, {
      at: this.audioContext.currentTime,
      noise: crashNoise(this.audioContext),
      volume: CONFIG.TANK_ARMOR.CLANG_VOLUME * near,
      pan,
    });
  }

  /** The bomb's bang (BombSounds.js) from (x, y), now */
  playBombBang(x, y) {
    if (!this.ensureAudioContext()) return;
    const { near, pan } = this.placement(x, y);
    bangSound(this.audioContext, this.masterGain, {
      at: this.audioContext.currentTime,
      noise: crashNoise(this.audioContext),
      volume: CONFIG.BOMB.BANG_VOLUME * near,
      pan,
    });
  }

  /**
   * The bomb's cloud (BombSounds.js) from (x, y), from now to the end of its
   * debris; seed (0..1) is the cloud's own. Returns its handle (stop()), or
   * null when it plays nothing (muted, paused, no context)
   */
  playBombCloud(x, y, seed) {
    if (!this.ensureAudioContext()) return null;
    const { near, pan } = this.placement(x, y);
    const clock = this.getContextValue('beatClock');
    return cloudSound(this.audioContext, this.masterGain, {
      at: this.audioContext.currentTime,
      noise: crashNoise(this.audioContext),
      volume: CONFIG.BOMB.CLOUD_VOLUME * near,
      pan,
      beatSec: (clock?.beatInterval ?? DEFAULT_BEAT_MS) / MS_PER_SEC,
      plasmaSec: CONFIG.PLASMA.DURATION * CLOUD_FRAME_SEC,
      debrisSec: CONFIG.DEBRIS.DURATION * CLOUD_FRAME_SEC,
      seed,
    });
  }

  /** The Dude's last breath (DeathSounds.js) at audio time `at` */
  playLastBreath(at) {
    if (!this.ensureAudioContext()) return;
    lastBreath(this.audioContext, this.masterGain, {
      at,
      noise: crashNoise(this.audioContext),
      volume: CONFIG.DEATHS.BREATH_VOLUME,
    });
  }

  playTone(config, x, y, soundName = '') {
    const ctx = this.audioContext;
    // Noise (the dash, the frying) is the shared noise through a band-pass
    const noise = config.waveform === 'noise';
    // The notes first, so one that can't resolve (a bad root) throws before
    // any node is made. A small random detune keeps copies of one sound
    // apart, plus the preset's own (the tank's arc rides 3% above his zap)
    const cents =
      (random() - 0.5) * 2 * CONFIG.TONES.DETUNE_CENTS +
      (config.detuneCents ?? 0);
    const detune = 2 ** (cents / CENTS_PER_OCTAVE);
    const now = ctx.currentTime;
    const startHz = noise ? null : hz(config.note, now) * detune;
    const endHz =
      config.sweep && !noise ? hz(config.sweep.to, now) * detune : null;
    const volumeVariation = 1 + (random() - 0.5) * 0.15;
    const durationVariation = 1 + (random() - 0.5) * 0.2;
    // Copies started in one frame would add in phase: each starts up to
    // MAX_START_OFFSET_SEC late (one period of the note isn't enough: Chrome
    // still added four copies 7 dB over one, not the 6 of random phases)
    const at = now + random() * MAX_START_OFFSET_SEC;
    const sec = config.duration * durationVariation;

    const oscillator = noise
      ? ctx.createBufferSource()
      : ctx.createOscillator();
    const gainNode = ctx.createGain();
    const panNode = ctx.createStereoPanner();

    let band = null;
    if (noise) {
      oscillator.buffer = crashNoise(ctx);
      band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.setValueAtTime(config.bandHz, at);
    } else {
      oscillator.type = config.waveform;
      oscillator.frequency.setValueAtTime(startHz, at);
      // Optional pitch sweep (e.g. the falling "oh no!" sounds)
      if (config.sweep?.curve === 'exponential') {
        oscillator.frequency.exponentialRampToValueAtTime(endHz, at + sec);
      } else if (config.sweep) {
        oscillator.frequency.linearRampToValueAtTime(endHz, at + sec);
      }
    }

    // Get player position for relative audio positioning
    // The world is centred on 0,0, which is where the hero starts
    let playerX = 0,
      playerY = 0;
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

    gainNode.gain.setValueAtTime(0, at);
    gainNode.gain.linearRampToValueAtTime(volume, at + TONE_ATTACK_SEC);
    gainNode.gain.exponentialRampToValueAtTime(0.001, at + sec);

    // Configure panning
    panNode.pan.setValueAtTime(panValue, at);

    // Connect nodes - add reverb for ambient enemy sounds
    const tremoloGain = ctx.createGain();
    if (band) {
      oscillator.connect(band);
      band.connect(tremoloGain);
    } else {
      oscillator.connect(tremoloGain);
    }
    tremoloGain.connect(gainNode);
    gainNode.connect(panNode);

    if (config.tremolo) {
      const beatClock = this.getContextValue('beatClock');
      applyBeatTremoloEffect(this.audioContext, beatClock, tremoloGain, sec);
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

      reverbGainNode = ctx.createGain();
      lowPassFilter = ctx.createBiquadFilter();

      // Reverb 15% close to 30% far
      const reverbIntensity = 0.15 + normalizedDistance * 0.15;
      reverbGainNode.gain.setValueAtTime(reverbIntensity, at);

      // Farther sounds are more muffled: 1400 Hz close to 800 Hz far
      const lowpassFreq = 1400 - normalizedDistance * 600;
      lowPassFilter.type = 'lowpass';
      lowPassFilter.frequency.setValueAtTime(lowpassFreq, at);
      lowPassFilter.Q.setValueAtTime(0.5, at);

      // A light otherworldly distortion
      distortionNode = ctx.createWaveShaper();
      distortionNode.curve = this.ambientDistortionCurve;
      distortionNode.oversample = '2x';

      // Wet path: pan -> lowpass -> distortion -> reverb -> master
      panNode.connect(lowPassFilter);
      lowPassFilter.connect(distortionNode);
      distortionNode.connect(reverbGainNode);
      reverbGainNode.connect(this.effects.reverb);
      this.effects.reverb.connect(this.masterGain);

      // Dry path: 90% close to 75% far, so the reverb stays subtle
      dryGain = ctx.createGain();
      const dryMix = 0.9 - normalizedDistance * 0.15;
      dryGain.gain.setValueAtTime(dryMix, at);

      panNode.connect(dryGain);
      dryGain.connect(this.masterGain);
    } else {
      // Normal connection for non-ambient sounds
      panNode.connect(this.masterGain);
    }

    // Play
    try {
      oscillator.start(at);
      oscillator.stop(at + sec);

      // Clean up all audio nodes when oscillator ends to prevent graph accumulation
      oscillator.onended = () => {
        try {
          oscillator.disconnect();
          band?.disconnect();
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

  // Say a line in the speaker's voice, on the beat grid (Voicebox). True
  // when it is taken: false while paused or muted, within VOICE_GAP_SEC of
  // its side's last line (the hero's or the enemies'; unless forced), for an
  // empty line, or without running audio
  // and a working speech engine (Grunt.sayOw then plays its sound instead).
  // onStart(startsAt) hears when a taken line was scheduled (audio seconds);
  // not for one dropped
  speak(entity, text, voiceType = 'player', force = false, onStart = null) {
    // Nobody speaks while a pause holds the sound
    if (this._pausedByGame) return false;
    if (!this.speechEnabled || !text) return false;
    // A line with no speaker comes from the hero
    entity ??= this.player;

    const side = voiceType === 'player' ? 'player' : 'enemies';
    const now = Date.now();
    const gapMs = CONFIG.SPEECH_SETTINGS.VOICE_GAP_SEC * 1000;
    if (!force && now - this.lastSpeechTime[side] < gapMs) {
      return false;
    }
    if (!this.ensureAudioContext() || !this.voicebox || this.voicebox.failed) {
      return false;
    }
    this.lastSpeechTime[side] = now;

    // The hero hears it from where the speaker is; one without a position
    // speaks from where the hero is
    const hx = Number.isFinite(this.player?.x) ? this.player.x : 0;
    const hy = Number.isFinite(this.player?.y) ? this.player.y : 0;
    const ex = Number.isFinite(entity?.x) ? entity.x : hx;
    const ey = Number.isFinite(entity?.y) ? entity.y : hy;
    const gain = Math.max(
      CONFIG.MIX.SPEECH_DISTANCE_FLOOR,
      calculateVolumeForPosition(ex, ey, hx, hy)
    );
    const pan = calculatePanForPosition(ex, hx);

    this.voicebox
      .say(voiceType, text, {
        gain,
        pan,
        clock: this.getContextValue('beatClock'),
      })
      .then(({ startsAt, duration, dropped }) => {
        if (dropped === 'cancelled') return;
        // Its bubble still shows; say why it's silent, or a line that is
        // always late would be missing with no trace
        if (dropped === 'late') {
          console.warn(
            `Speech: "${text}" (${voiceType}) wasn't ready in ${CONFIG.SPEECH.MAX_WAIT_MS} ms; dropped`
          );
        }
        if (!dropped) onStart?.(startsAt);
        // The bubble shows as the line starts; one that won't play, now
        const seconds = dropped ? text.split(' ').length * WORD_SEC : duration;
        this.showText(
          entity,
          text.toUpperCase(),
          voiceType,
          bubbleFrames(seconds),
          dropped ? null : startsAt
        );
      })
      .catch((error) => console.warn('Speech failed:', error));
    return true;
  }

  // A random player line for `lineContext` ('start', 'levelUp', 'damage',
  // 'lowHealth', 'death'); force: past the speech cooldown
  speakPlayerLine(entity, lineContext, force = false) {
    this.speak(
      entity,
      getPlayerDialogueLine(lineContext, random, floor),
      'player',
      force
    );
  }

  // ========================================================================
  // TEXT DISPLAY SYSTEM
  // ========================================================================

  // A bubble over `entity` for `duration` frames, from audio time `showsAt`
  // (when its line starts; null: now)
  showText(entity, text, voiceType, duration, showsAt = null) {
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
      showsAt,
      x: entity.x,
      y: entity.y - 30,
      isAggressive: isAggressive,
      isConfused: isConfused,
      shakeTimer: isAggressive ? 30 : 0, // Shake aggressive text
      wobbleTimer: isConfused ? 60 : 0, // Wobble confused text
    });
  }

  // Bubbles wait for their line by the audio clock, which runs on through
  // hitstop and slow frames; without audio, every bubble shows
  get textTime() {
    return this.audioContext?.currentTime ?? Infinity;
  }

  updateTexts() {
    updateActiveTexts(this.activeTexts, this.textTime);
  }

  drawTexts(p) {
    drawActiveTexts(
      p,
      this.activeTexts,
      this.showBeatIndicator,
      this.beatX,
      this.beatY,
      drawGlow,
      this.textTime
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
    if (this.voicebox) {
      this.voicebox.output.gain.value = this.enabled
        ? CONFIG.MIX.SPEECH_VOLUME
        : 0;
    }
  }

  // Dip the game while someone speaks. Read every frame from the lines' own
  // start times and lengths, for at most DUCK_MAX_HOLD_MS from a line's start.
  syncDuck() {
    if (!this.duckGain) return;
    const { MIX } = CONFIG;
    const speaking =
      this.enabled && !!this.voicebox?.isSpeaking(MIX.DUCK_MAX_HOLD_MS / 1000);
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

  // Pausing the game stops its sound. Suspending the context also stops
  // BeatClock (it reads the context's clock), so on unpause the beat, the
  // kick, every enemy and a line being spoken pick up exactly where they
  // stopped. With CONFIG.SOUND_WHILE_PAUSED (?tune ticks it) the sound
  // plays on. Called when P is pressed and every frame; it acts once per change.
  syncPause(paused) {
    const hold = !!this.audioContext && paused && !CONFIG.SOUND_WHILE_PAUSED;
    if (hold === this._pausedByGame) return;
    this._pausedByGame = hold;
    if (hold) {
      this.audioContext
        .suspend()
        .catch((error) => console.warn('Audio suspend failed:', error));
      return;
    }
    // Context calls run in order, so quick P presses end where the last one left
    this._resuming = true;
    this.audioContext
      .resume()
      .catch((error) => console.warn('Audio resume failed:', error))
      .finally(() => (this._resuming = false));
  }

  /** True while a pause holds the sound, until it is fully back (the sky waits) */
  get soundPaused() {
    return this._pausedByGame || this._resuming;
  }

  toggle() {
    this.enabled = !this.enabled;
    this.speechEnabled = this.enabled;
    // Silence what is already playing (beat track, speech), not just new
    // sounds, and drop the lines still waiting to start, with their bubbles.
    // Gains, not audioContext.suspend(): BeatClock runs on the context's clock.
    this.applyMix();
    window.beatTrack?.setMuted(!this.enabled);
    if (!this.enabled) {
      this.voicebox?.cancelPending();
      this.activeTexts = this.activeTexts.filter(
        (bubble) => !isWaiting(bubble, this.textTime)
      );
    }
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
