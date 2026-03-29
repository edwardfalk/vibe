/**
 * BeatTrack.js - Minimal pulse synced to BeatClock
 *
 * Establishes tempo with a subtle sub-bass pulse felt more than heard.
 * Enemies and player are the real instruments now — this just keeps time.
 *
 * Uses a look-ahead scheduler for sample-accurate timing.
 * Shares the game's AudioContext when available.
 */

const EIGHTH_NOTES_PER_MEASURE = 8;
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
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.currentEighth = 0;
    this.isPlaying = true;

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
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  setBPM(bpm) {
    this.bpm = bpm;
    this.beatDuration = 60 / bpm;
    this.eighthDuration = this.beatDuration / 2;
  }

  // -- Scheduler ----------------------------------------------------------

  _scheduler() {
    if (!this.isPlaying || !this.ctx) return;

    while (this.nextNoteTime < this.ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      this._scheduleNote(this.nextNoteTime, this.currentEighth);
      this.nextNoteTime += this.eighthDuration;
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
    const isDownbeat = beat === 0;
    this._playPulse(time, isDownbeat);
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
    const volume = (isDownbeat ? 0.15 : 0.08) * enemyFactor;
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

    // Level 5+: Add noise transient on downbeats
    if (this.level >= 5 && isDownbeat && this.ctx) {
      const bufferSize = this.ctx.sampleRate * 0.03; // 30ms
      const noiseBuffer = this.ctx.createBuffer(
        1,
        bufferSize,
        this.ctx.sampleRate
      );
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

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
