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

export class BeatTrack {
  constructor(bpm = 120, context = null) {
    this.bpm = bpm;
    this.context = context;
    this.beatDuration = 60 / bpm;
    this.eighthDuration = this.beatDuration / 2;
    this.volume = 0.4;
    this.muted = false;

    // Web Audio state
    this.ctx = null;
    this.masterGain = null;
    this.isPlaying = false;

    // Scheduler state
    this.nextNoteTime = 0;
    this.currentEighth = 0;
    this.schedulerTimer = null;

    // Enemy count for dynamic volume scaling
    this._enemyCount = 0;

    // Level tracking for pulse evolution
    this.level = 1;
  }

  _getAudio() {
    if (this.context && typeof this.context.get === 'function') {
      return this.context.get('audio');
    }
    return window.audio;
  }

  async start() {
    if (this.isPlaying) return;

    const audio = this._getAudio();
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
    this.masterGain.connect(this.ctx.destination);

    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this._startTime = this.nextNoteTime;
    this._totalEighths = 0;
    this.currentEighth = 0;
    this.isPlaying = true;

    // Pre-create reusable noise buffer for Level 5+ downbeat transients
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

  setBPM(bpm) {
    this.bpm = bpm;
    this.beatDuration = 60 / bpm;
    this.eighthDuration = this.beatDuration / 2;
    // Reset accumulator to avoid drift across BPM changes
    if (this.ctx) {
      this._startTime = this.ctx.currentTime;
      this._totalEighths = 0;
    }
  }

  // -- Scheduler ----------------------------------------------------------

  _scheduler() {
    if (!this.isPlaying || !this.ctx) return;

    while (this.nextNoteTime < this.ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      this._scheduleNote(this.nextNoteTime, this.currentEighth);
      this._totalEighths++;
      this.nextNoteTime =
        this._startTime + this._totalEighths * this.eighthDuration;
      this.currentEighth = (this.currentEighth + 1) % EIGHTH_NOTES_PER_MEASURE;
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
    gain.gain.exponentialRampToValueAtTime(0.001, time + k.DECAY_SEC);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(time);
    osc.stop(time + k.DECAY_SEC);

    // Click: a few ms of high-passed noise for the attack
    if (k.CLICK_LEVEL > 0 && this._noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const clickGain = this.ctx.createGain();
      noise.buffer = this._noiseBuffer;
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(k.CLICK_HIGHPASS_HZ, time);
      clickGain.gain.setValueAtTime(k.VOLUME * k.CLICK_LEVEL, time);
      clickGain.gain.exponentialRampToValueAtTime(
        0.001,
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
