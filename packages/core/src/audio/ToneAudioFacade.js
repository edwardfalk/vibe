// ToneAudioFacade.js – Tone.js-based audio system (MVP)
// Requires p5.js instance only for future spatial calculations; currently optional.
// TODO: Expand with Mixer, SampleLoader, MusicScheduler.

import * as Tone from 'tone';
import { SampleLoader } from './SampleLoader.js';
import { SOUND } from './SoundIds.js';
import { FallbackManager } from './FallbackManager.js';
import { MusicScheduler } from './MusicScheduler.js';
import { random, floor, max } from '../mathUtils.js';

/**
 * Type JSDoc: @typedef {{ bpm: number, getTotalBeats:()=>number }} BeatClockLike
 */

// Category labels for gain routing – keeps API simple
const CATEGORIES = ['master', 'music', 'sfx', 'speechBed'];

export class ToneAudioFacade {
  constructor() {
    /** @type {boolean} */
    this._initialized = false;

    /** @type {Record<string, Tone.Gain>} */
    this._gains = /** @type {any} */ ({});

    // Lazy flag to avoid duplicate Tone.start() prompts
    this._toneStarted = false;

    /** @type {MusicScheduler|null} */
    this._musicScheduler = null;

    /** @type {Map<string, Tone.Player | Tone.Synth>} */
    this._players = new Map();

    /** @type {Set<string>} */
    this._unknownIdsWarned = new Set();

    /** @type {BeatClockLike|null} */
    this._beatClock = null;

    /** @type {Tone.Meter|null} */
    this._meter = null;

    /** @type {number|null} */
    this._lastSpeechTime = null;

    /** @type {null} */
    this._speech = null;

    /** @type {(e:CustomEvent)=>void|null} */
    this._bpmListener = null;

    /** @type {Object|null} */
    this._player = null;

    /** @type {boolean} */
    this._muted = false;
  }

  /* -------------------------------------------------------------------- */
  /* Public API                                                           */
  /* -------------------------------------------------------------------- */

  /**
   * One-time asynchronous setup. Call before any other method.
   * Loads samples and wires the basic mixer graph.
   *
   * @returns {Promise<void>}
   */
  async init() {
    if (this._initialized) return;

    try {
      console.log('🔵 ToneAudioFacade init starting...');

      await this._ensureToneStarted();
      console.log('🟢 Tone started successfully');

      this._createMixer();
      console.log('🟢 Mixer created successfully');

      console.log('🔵 Loading samples via SampleLoader...');
      const { players, failedIds } = await SampleLoader.load(
        '/audio/manifest.json',
        (m) => this._remapManifestToCdn(m)
      );

      // Route players to proper buses
      for (const [id, player] of Object.entries(players._players)) {
        player.disconnect();
        const bus = id.startsWith('music')
          ? this._gains.music
          : this._gains.sfx;
        player.connect(bus);
      }

      console.log('🟢 Players loaded:', Object.keys(players._players).length);
      if (failedIds.length) {
        console.warn('⚠️ Missing samples:', failedIds.join(', '));
      }

      // Remove broken player refs to prevent accidental use
      for (const id of failedIds) {
        delete players._players[id];
      }

      // Store players map
      this._players = new Map(Object.entries(players._players));

      // Dev-only fallback synths so testers hear beeps for missing samples.
      const devMode =
        typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
      this._fallbackSynths = FallbackManager.create(
        failedIds,
        this._gains.sfx,
        { enabled: devMode }
      );

      // SpeechCoordinator removed (ducking disabled)

      // Pre-create music scheduler (will start on demand)
      this._musicScheduler = new MusicScheduler((id) => this.playSound(id));
      console.log('🟢 MusicScheduler initialized');

      this._initialized = true;
      console.log('🎵 ToneAudioFacade initialised successfully');
    } catch (error) {
      console.error('❌ ToneAudioFacade init failed:', error);
      try {
        // In development mode, emit a short beep so devs notice silent audio failures
        const isDev =
          (typeof process !== 'undefined' &&
            process.env?.NODE_ENV !== 'production') ||
          (typeof window !== 'undefined' &&
            window.location?.hostname === 'localhost');
        if (isDev) {
          await this._ensureToneStarted();
          console.warn('🔈 Playing fallback beep to signal audio-init failure');
          const synth = new Tone.Synth().toDestination();
          synth.triggerAttackRelease('C5', '8n');
        }
      } catch {}
      throw error; // Fail fast – propagate to GameLoop
    }
  }

  /**
   * Play a one-shot sound effect with optional positioning.
   * @param {string} id – sample ID defined in the manifest
   * @param {number|object} [xOrOpts] - x coordinate or options object
   * @param {number} [y] - y coordinate (if first param is x)
   */
  async playSound(id, xOrOpts = {}, y = null) {
    // Early fallback if init previously failed (e.g., external CDN unreachable)
    if (
      !this._initialized &&
      this._players?.size === 0 &&
      this._fallbackSynths?.size >= 0
    ) {
      // Attempt a fast, single-sound fallback using Tone.Synth without manifest
      try {
        await this._ensureToneStarted();
        if (!this._gains.master) this._createMixer();
        if (!this._fallbackSynths) this._fallbackSynths = new Map();
        if (!this._fallbackSynths.has('beep')) {
          const synth = new Tone.Synth().connect(
            this._gains.sfx || this._gains.master
          );
          this._fallbackSynths.set('beep', synth);
        }
        // If requested id exists in registry, still play beep as stand-in
        this._fallbackSynths.get('beep')?.triggerAttackRelease('C5', '8n');
        return;
      } catch {}
    }

    if (!this._initialized) await this.init();
    const player = this._players?.get(id);
    const synth = this._fallbackSynths?.get(id);
    if (!player && !synth) {
      if (!this._unknownIdsWarned.has(id)) {
        console.warn(`⚠️ [Audio] Unknown sound id: ${id}`);
        this._unknownIdsWarned.add(id);
      }
      return;
    }

    // Handle both legacy (x, y) and new ({volume}) calling conventions
    let opts = {};
    if (typeof xOrOpts === 'object' && xOrOpts !== null) {
      opts = xOrOpts;
    } else if (typeof xOrOpts === 'number' && typeof y === 'number') {
      // Legacy positioning call - TODO: implement spatial audio
      opts = { x: xOrOpts, y: y };
    }

    const vol = typeof opts.volume === 'number' ? opts.volume : 1;

    if (player) {
      // Velocity maps 0…1 → -60…0 dB roughly
      player.volume.value = Tone.gainToDb(vol);
      try {
        player.start();
        // Brief unduck to ensure audibility in case a stale duck is active
        this.unduck(0.05);
      } catch {}
    } else if (synth) {
      // Simple beep envelope – map vol → decibels for synth volume
      synth.volume.value = Tone.gainToDb(vol);
      try {
        synth.triggerAttackRelease('C4', '8n');
        this.unduck(0.05);
      } catch {}
    }
  }

  /**
   * Duck master gain by specified dB amount.
   * @param {number} db
   * @param {number} rampSeconds
   */
  duck(db, rampSeconds = 0.2) {
    try {
      if (!this._gains?.master) return;
      const now = Tone.now();
      const target = Math.pow(10, db / 20);
      const param = this._gains.master.gain;
      // Cancel any pending ramps to avoid zipper noise
      param.cancelAndHoldAtTime(now);
      param.linearRampToValueAtTime(target, now + rampSeconds);
    } catch {}
  }

  /** Restore master gain to 1.0 */
  unduck(rampSeconds = 0.2) {
    try {
      if (!this._gains?.master) return;
      const now = Tone.now();
      const param = this._gains.master.gain;
      param.cancelAndHoldAtTime(now);
      param.linearRampToValueAtTime(1, now + rampSeconds);
    } catch {}
  }

  /** Start default background loop (idempotent) */
  startMusic() {
    if (!this._musicScheduler) return;
    this._musicScheduler.start();
  }

  stopMusic() {
    if (this._musicScheduler) this._musicScheduler.stop();
  }

  /** Provide BeatClock instance so we can keep Tone.Transport in sync */
  setBeatClock(beatClock) {
    this._beatClock = beatClock;
    if (!beatClock) return;
    // Immediate sync
    Tone.Transport.bpm.value = beatClock.bpm;

    // Remove previous listener if any
    if (this._bpmListener) {
      window.removeEventListener('bpmChange', this._bpmListener);
    }

    // Event-driven sync – adjust Transport whenever BeatClock dispatches bpmChange.
    this._bpmListener = (e) => {
      const { bpm } = e.detail || {};
      if (typeof bpm === 'number' && bpm > 0) {
        Tone.Transport.bpm.rampTo(bpm, 0.2);
      }
    };
    window.addEventListener('bpmChange', this._bpmListener);
  }

  /* -------------------------------------------------------------------- */
  /* Internal helpers                                                     */
  /* -------------------------------------------------------------------- */

  async _ensureToneStarted() {
    if (this._toneStarted) return;
    // Tone.start() must be triggered by a user gesture; caller should ensure that.
    try {
      await Tone.start();
    } catch (e) {
      console.warn(
        '⚠️ Tone.start() failed, retrying after 100ms:',
        e?.message || e
      );
      await new Promise((r) => setTimeout(r, 100));
      try {
        await Tone.start();
      } catch {}
    }
    this._toneStarted = true;
  }

  _createMixer() {
    // Create category gain nodes feeding a master gain, then the destination.
    // Using Tone.Gain instead of Tone.Channel ensures the **gain** AudioParam
    // exists so that duck()/unduck() can call .rampTo without throwing.

    // Master → destination
    this._gains.master = new Tone.Gain(1).toDestination();

    // Individual categories → master with safe default gains
    // Avoid starting at absolute zero to prevent inaudible state
    const defaults = { master: 1, music: 0.8, sfx: 1, speechBed: 0.7 };
    for (const cat of CATEGORIES) {
      if (cat === 'master') continue;
      const initial = typeof defaults[cat] === 'number' ? defaults[cat] : 1;
      this._gains[cat] = new Tone.Gain(initial).connect(this._gains.master);
    }

    // Level meter taps the master output so we can get accurate readings.
    this._meter = new Tone.Meter();
    this._gains.master.connect(this._meter);
  }

  // _loadBuiltinSamples removed – now handled by SampleLoader

  /**
   * Many sample URLs in the legacy manifest point to removed files:
   *   https://tonejs.github.io/audio/berklee/*.mp3 (404)
   * The same files are still served by jsDelivr’s GitHub CDN mirror.
   * This helper rewrites each entry to the CDN base if it looks like
   * a Berklee sample path so the downloads succeed without code changes
   * elsewhere.
   * @param {Record<string,string>} manifest
   * @returns {Record<string,string>}
   */
  _remapManifestToCdn(manifest) {
    // ------------------------------------------------------------------
    // Mapping strategy (v3):
    //  1. Most of the Berklee and CR78 samples were deleted from:
    //       https://tonejs.github.io/audio/…
    //     and never existed on the current `gh-pages` branch either.
    //  2. The full set *does* exist on historical commit
    //       dc9de66401e175849bfd219bfe303ba2d72a4ee7  (≈ v14.7.x era).
    //  3. We therefore rewrite to RAW GitHub content rooted at that
    //     commit which is immutable and long-term cache-able:
    //       https://raw.githubusercontent.com/Tonejs/Tone.js/<commit>/examples/audio/<subdir>/<file>
    // ------------------------------------------------------------------

    const cdnCommit = 'dc9de66401e175849bfd219bfe303ba2d72a4ee7';
    const cdnBase = `https://raw.githubusercontent.com/Tonejs/Tone.js/${cdnCommit}/examples/audio/`;
    const remapped = {};
    for (const [id, url] of Object.entries(manifest)) {
      if (typeof url !== 'string') continue;
      if (url.includes('tonejs.github.io/audio/')) {
        const subPath = url.split('/audio/')[1];
        remapped[id] = cdnBase + subPath;
      } else if (/^https?:\/\//i.test(url)) {
        // Absolute URL – leave as-is
        remapped[id] = url;
      } else {
        // Relative path in our manifest → map into Tone.js examples CDN tree
        const trimmed = url.replace(/^\.\/?/, '');
        remapped[id] = cdnBase + trimmed;
      }
    }
    return remapped;
  }

  /**
   * Get current master RMS level (0–1 linear).
   * Returns 0 if meter not ready.
   */
  getMasterLevel() {
    if (!this._meter) return 0;
    const db = this._meter.getValue(); // dB negative or 0
    if (Array.isArray(db)) return 0;
    const lin = Tone.dbToGain(db); // 0..1
    return lin;
  }

  /**
   * Get current bus gains (linear 0..1) for diagnostics.
   */
  getBusLevels() {
    const toLin = (g) =>
      g && typeof g.gain?.value === 'number' ? g.gain.value : null;
    return {
      master: toLin(this._gains.master),
      music: toLin(this._gains.music),
      sfx: toLin(this._gains.sfx),
      speechBed: toLin(this._gains.speechBed),
    };
  }

  /* -------------------------------------------------------------------- */
  /* Legacy Audio.js Compatibility Layer                                  */
  /* -------------------------------------------------------------------- */

  /**
   * Speak text using browser speech synthesis with ducking
   * @param {Object} entity - Entity speaking (for position/type)
   * @param {string} text - Text to speak
   * @param {string} voiceType - Voice type ('player', 'grunt', 'tank', etc.)
   * @param {boolean} force - Force speech even if on cooldown
   * @returns {boolean} - Whether speech was triggered
   */
  speak(entity, text, voiceType = 'player', force = false) {
    // Use browser speech synthesis (ducking disabled)
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';

    // Configure voice based on type
    const voiceConfig = {
      player: { rate: 0.85, pitch: 0.15, volume: 0.5 },
      grunt: { rate: 0.6, pitch: 1.6, volume: 0.5 },
      rusher: { rate: 1.4, pitch: 1.5, volume: 0.65 },
      tank: { rate: 0.5, pitch: 0.2, volume: 0.6 },
      stabber: { rate: 0.8, pitch: 2.0, volume: 0.9 },
    };

    const config = voiceConfig[voiceType] || voiceConfig.player;
    utterance.rate = config.rate;
    utterance.pitch = config.pitch;
    utterance.volume = config.volume;

    // Check cooldown (2.5 seconds)
    const now = Date.now();
    if (!force && this._lastSpeechTime && now - this._lastSpeechTime < 2500) {
      return false;
    }

    this._lastSpeechTime = now;

    // Ducking removed – speak without volume changes

    window.speechSynthesis.speak(utterance);
    console.log(
      `💬 ${entity.type || 'Entity'} speaking: "${text.toUpperCase()}"`
    );
    return true;
  }

  // Legacy speech line methods
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

  // Dialogue line methods
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
      // Confused/stupid moments
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
      // Crazy moments
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
      // Macho moments
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
      // Poke humor
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

  // Legacy convenience methods - redirect to playSound with proper IDs
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
  playBombExplosion(x, y) {
    this.playSound(SOUND.explosion, x, y);
  }
  playRusherExplosion(x, y) {
    this.playSound(SOUND.rusherDeathFizz, x, y);
  }
  playStabberAttack(x, y) {
    this.playSound(SOUND.stabberKnifeHit, x, y);
  }
  playStabberHit(x, y) {
    this.playSound(SOUND.stabberKnifeHit, x, y);
  }

  // Legacy volume/control methods
  setVolume(volume) {
    if (this._gains.master) {
      this._gains.master.gain.value = volume;
    }
  }

  isMuted() {
    return this._muted;
  }

  toggle() {
    // Robust toggle that tracks explicit muted state
    const master = this._gains.master;
    if (!master) return !this._muted;
    this._muted = !this._muted;
    master.gain.value = this._muted ? 0 : 1;
    return !this._muted;
  }

  // Legacy player reference (compatibility)
  setPlayer(player) {
    this._player = player;
  }

  // Legacy test method
  testAudioSystem() {
    console.log('🎵 Testing ToneAudioFacade...');

    if (!this._initialized) {
      console.log('❌ Audio system not initialized');
      return false;
    }

    console.log('✅ Audio system initialized');
    console.log('🔊 Testing sample playback...');

    // Test a few key sounds
    const testSounds = ['playerShoot', 'explosion', 'hit'];
    testSounds.forEach((sound, i) => {
      setTimeout(() => {
        this.playSound(sound);
        console.log(`✅ Played ${sound}`);
      }, i * 200);
    });

    console.log('🎵 Audio system test complete');
    return true;
  }

  // Legacy methods that can be no-ops or minimal implementations
  ensureAudioContext() {
    return this._initialized;
  }
  update() {
    /* no-op in tone.js system */
  }
  updateTexts() {
    /* no-op - handled by UI */
  }
  drawTexts() {
    /* no-op - handled by UI */
  }
  disable() {
    this.setVolume(0);
  }

  /**
   * Return lightweight diagnostics for overlays/probes.
   */
  getDiagnostics() {
    return {
      masterLevel: this.getMasterLevel(),
      players: this._players?.size || 0,
      fallbackSynths: this._fallbackSynths?.size || 0,
      bpm: Tone.Transport.bpm.value,
    };
  }
}

// Singleton export for convenience (mirrors legacy Audio.js pattern)
export const toneAudio = new ToneAudioFacade();
