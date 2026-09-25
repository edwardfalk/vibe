/**
 * BeatTrack.js - The steady backbone synced to BeatClock
 *
 * A kick drum anchors the beat (four on the floor by default) so enemy
 * sounds have something to fall into, over a sub-bass pulse felt more than
 * heard. Enemies and player are the instruments — this keeps time.
 * Tunables live in CONFIG.BEAT_TRACK and are read on every note, so the
 * ?tune panel changes them live.
 *
 * Uses a look-ahead scheduler for sample-accurate timing.
 * Shares the game's AudioContext when available.
 */

import { CONFIG } from '../config.js';
import { createContextAccessor } from '../shared/ContextAccessor.js';

const EIGHTH_NOTES_PER_MEASURE = 8;
// Which beats (0-3) the kick plays on, per CONFIG.BEAT_TRACK.KICK.PATTERN
const KICK_PATTERNS = {
  four: [0, 1, 2, 3],
  oneThree: [0, 2],
};
// Look-ahead buffer for sample-accurate scheduling.
// 75ms balances glitch-free playback with minimal audio-visual desync.
const SCHEDULE_AHEAD_SEC = 0.075;
const SCHEDULER_INTERVAL_MS = 25;
// A note this late (a short main-thread stall) still plays, a little late;
// anything later (a hidden tab) is skipped rather than played in a burst
const LATE_GRACE_SEC = 0.05;
// Exponential ramps can't reach 0; this is inaudible
const SILENCE_GAIN = 0.001;
const DRIVE_CURVE_SAMPLES = 1024;
// Fade from SILENCE_GAIN to 0 before stopping, so drive can't turn the
// leftover sine into an audible tick
const TAIL_FADE_SEC = 0.005;

export class BeatTrack {
  // bpm is kept for the call signature; tempo now comes from BeatClock
  constructor(bpm = 120, context = null) {
    this.context = context;
    this.getContextValue = createContextAccessor(context);
    this.volume = CONFIG.MIX.BEAT_TRACK_VOLUME;
    this.muted = false;

    // Web Audio state
    this.ctx = null;
    this.masterGain = null;
    this.isPlaying = false;

    // Scheduler state
    this.schedulerTimer = null;

    // Enemy count for dynamic volume scaling
    this._enemyCount = 0;

    // Level tracking for pulse evolution
    this.level = 1;
  }

  async start() {
    if (this.isPlaying) return;

    const audio = this.getContextValue('audio');
    if (audio && audio.audioContext) {
      this.ctx = audio.audioContext;
    } else {
      if (typeof window === 'undefined') {
        console.error(
          '⚠️ AudioContext unavailable: no global window (non-browser environment)'
        );
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        console.error('⚠️ AudioContext not supported in this browser');
        return;
      }
      this.ctx = new Ctx();
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.volume;
    // The beat's own duck gain (→ limiter): speech dips it by DUCK_BEAT_DB
    const bus =
      audio?.audioContext === this.ctx
        ? (audio.beatDuckGain ?? audio.masterLimiter)
        : null;
    this.masterGain.connect(bus ?? this.ctx.destination);

    this.isPlaying = true;

    // Reusable noise buffer: the kick click and Level 5+ downbeat transients
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.03); // 30ms
    this._noiseBuffer = this.ctx.createBuffer(
      1,
      bufferSize,
      this.ctx.sampleRate
    );
    const data = this._noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this._scheduler();
    console.log('🎵 BeatTrack started');
  }

  stop() {
    this.isPlaying = false;
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    this._applyGain();
  }

  setMuted(muted) {
    this.muted = muted;
    this._applyGain();
  }

  _applyGain() {
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
    }
  }

  // -- Scheduler ----------------------------------------------------------

  _scheduler() {
    if (!this.isPlaying || !this.ctx) return;

    const clock = this.getContextValue('beatClock');
    // Silent until BeatClock runs on this AudioContext (the first moments
    // after start); from then on the kick uses the enemies' grid exactly
    if (clock?.audioContext === this.ctx) {
      const now = this.ctx.currentTime;
      const origin = clock.startTime / 1000;
      const eighth = clock.beatInterval / 2000;
      const n8 = EIGHTH_NOTES_PER_MEASURE;
      // From just before now (skips missed notes after a hidden tab, keeps
      // ones a short stall made late), and never at or before a note already
      // handed to Web Audio (a restart moves the grid)
      const from = Math.max(
        now - LATE_GRACE_SEC,
        (this._lastNoteSec ?? -Infinity) + eighth / 2
      );
      for (
        let n = Math.ceil((from - origin) / eighth);
        origin + n * eighth < now + SCHEDULE_AHEAD_SEC;
        n++
      ) {
        this._lastNoteSec = origin + n * eighth;
        this._scheduleNote(this._lastNoteSec, ((n % n8) + n8) % n8);
      }
    }

    this.schedulerTimer = setTimeout(
      () => this._scheduler(),
      SCHEDULER_INTERVAL_MS
    );
  }

  _scheduleNote(time, eighth) {
    // Only play on downbeats (8th notes 0, 2, 4, 6 = beats 1, 2, 3, 4)
    if (eighth % 2 !== 0) return;
    const beat = eighth / 2; // 0-3
    const { KICK, SUB_PULSE } = CONFIG.BEAT_TRACK;
    if (KICK.ENABLED && KICK_PATTERNS[KICK.PATTERN]?.includes(beat)) {
      this._playKick(time);
    }
    if (SUB_PULSE.ENABLED) {
      this._playPulse(time, beat === 0);
    }
  }

  // -- Kick ---------------------------------------------------------------

  _playKick(time) {
    if (!this.ctx || !this.masterGain) return;
    const k = CONFIG.BEAT_TRACK.KICK;

    // Body: a sine whose pitch drops fast from punch to thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(k.PITCH_START_HZ, time);
    osc.frequency.exponentialRampToValueAtTime(
      k.PITCH_END_HZ,
      time + k.PITCH_DROP_SEC
    );
    gain.gain.setValueAtTime(k.VOLUME, time);
    gain.gain.exponentialRampToValueAtTime(SILENCE_GAIN, time + k.DECAY_SEC);
    gain.gain.linearRampToValueAtTime(0, time + k.DECAY_SEC + TAIL_FADE_SEC);
    osc.connect(gain);
    // Drive after the envelope, so the thump distorts most as it hits
    const shaper = k.DRIVE > 0 ? this._getDriveShaper(k.DRIVE) : null;
    if (shaper) {
      gain.connect(shaper);
      shaper.connect(this.masterGain);
    } else {
      gain.connect(this.masterGain);
    }
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      shaper?.disconnect();
    };
    osc.start(time);
    osc.stop(time + k.DECAY_SEC + TAIL_FADE_SEC);

    // Click: a few ms of high-passed noise for the attack
    if (k.CLICK_LEVEL > 0 && this._noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const clickGain = this.ctx.createGain();
      noise.buffer = this._noiseBuffer;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(k.CLICK_FREQ_HZ, time);
      clickGain.gain.setValueAtTime(k.VOLUME * k.CLICK_LEVEL, time);
      clickGain.gain.exponentialRampToValueAtTime(
        SILENCE_GAIN,
        time + k.CLICK_DECAY_SEC
      );
      noise.connect(filter);
      filter.connect(clickGain);
      clickGain.connect(this.masterGain);
      noise.onended = () => {
        noise.disconnect();
        filter.disconnect();
        clickGain.disconnect();
      };
      noise.start(time);
      noise.stop(time + k.CLICK_DECAY_SEC);
    }
  }

  // Soft-clipping curve tanh(drive * x), normalised so full scale stays full
  // scale. The curve is cached per drive value; each kick gets its own node.
  _getDriveShaper(drive) {
    if (this._driveCurveFor !== drive) {
      const curve = new Float32Array(DRIVE_CURVE_SAMPLES);
      for (let i = 0; i < DRIVE_CURVE_SAMPLES; i++) {
        const x = (i / (DRIVE_CURVE_SAMPLES - 1)) * 2 - 1;
        curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
      }
      this._driveCurve = curve;
      this._driveCurveFor = drive;
    }
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this._driveCurve;
    shaper.oversample = '2x'; // less aliasing from the added overtones
    return shaper;
  }

  // -- Pulse --------------------------------------------------------------

  _playPulse(time, isDownbeat) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isDownbeat ? 60 : 50, time);
    osc.frequency.exponentialRampToValueAtTime(35, time + 0.1);

    // Scale volume: quieter when many enemies (their sounds carry the beat)
    const enemyFactor = Math.max(0.3, 1.0 - (this._enemyCount || 0) * 0.1);
    const volume =
      (isDownbeat ? 0.15 : 0.08) *
      enemyFactor *
      CONFIG.BEAT_TRACK.SUB_PULSE.VOLUME;
    const duration = 0.15;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(time);
    osc.stop(time + duration);

    // Level 3+: Add octave harmonic
    if (this.level >= 3 && this.ctx) {
      const harmonicOsc = this.ctx.createOscillator();
      const harmonicGain = this.ctx.createGain();
      harmonicOsc.type = 'sine';
      harmonicOsc.frequency.setValueAtTime(100, time);
      harmonicGain.gain.setValueAtTime(volume * 0.3, time);
      harmonicGain.gain.exponentialRampToValueAtTime(0.001, time + duration);
      harmonicOsc.connect(harmonicGain);
      harmonicGain.connect(this.masterGain);
      harmonicOsc.start(time);
      harmonicOsc.stop(time + duration);
    }

    // Level 5+: Add noise transient on downbeats (reuses pre-created buffer)
    if (this.level >= 5 && isDownbeat && this.ctx && this._noiseBuffer) {
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this._noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(40, time);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(volume * 0.5, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noiseSource.start(time);
    }
  }

  setEnemyCount(count) {
    this._enemyCount = count;
  }

  setLevel(level) {
    this.level = level;
  }
}
