/**
 * BeatTrack.js - Procedural drum machine synced to BeatClock
 *
 * Generates a rhythmic bed using Web Audio API synthesis:
 * - Kick on beats 1 & 3 (half-time feel)
 * - Snare on beats 2 & 4
 * - Hi-hat on 8th notes
 * - Sub bass drone following the kick
 *
 * Uses a look-ahead scheduler for sample-accurate timing.
 * Shares the game's AudioContext when available.
 */

const EIGHTH_NOTES_PER_MEASURE = 8;
const SCHEDULE_AHEAD_SEC = 0.1;
const SCHEDULER_INTERVAL_MS = 25;

export class BeatTrack {
  constructor(bpm = 120) {
    this.bpm = bpm;
    this.beatDuration = 60 / bpm;
    this.eighthDuration = this.beatDuration / 2;
    this.volume = 0.25;

    // Web Audio state
    this.ctx = null;
    this.masterGain = null;
    this.isPlaying = false;

    // Scheduler state
    this.nextNoteTime = 0;
    this.currentEighth = 0;
    this.schedulerTimer = null;

    // Pre-created noise buffers (set on start)
    this.snareNoiseBuffer = null;
    this.hihatClosedBuffer = null;
    this.hihatOpenBuffer = null;
  }

  start() {
    if (this.isPlaying) return;

    if (window.audio && window.audio.audioContext) {
      this.ctx = window.audio.audioContext;
    } else {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);

    this.snareNoiseBuffer = this._createNoiseBuffer(0.15);
    this.hihatClosedBuffer = this._createNoiseBuffer(0.04);
    this.hihatOpenBuffer = this._createNoiseBuffer(0.12);

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
    if (this.masterGain) {
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
    if (!this.isPlaying) return;

    while (this.nextNoteTime < this.ctx.currentTime + SCHEDULE_AHEAD_SEC) {
      this._scheduleNote(this.nextNoteTime, this.currentEighth);
      this.nextNoteTime += this.eighthDuration;
      this.currentEighth =
        (this.currentEighth + 1) % EIGHTH_NOTES_PER_MEASURE;
    }

    this.schedulerTimer = setTimeout(
      () => this._scheduler(),
      SCHEDULER_INTERVAL_MS
    );
  }

  _scheduleNote(time, eighth) {
    // eighth: 0=beat1, 2=beat2, 4=beat3, 6=beat4 (even = quarter notes)
    const isQuarter = eighth % 2 === 0;
    const beat = eighth / 2; // 0-3

    this._playHiHat(time, !isQuarter);

    if (beat === 0 || beat === 2) {
      this._playKick(time);
      this._playBass(time);
    }

    if (beat === 1 || beat === 3) {
      this._playSnare(time);
    }
  }

  // -- Instruments --------------------------------------------------------

  _playKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.05);

    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.35);
  }

  _playSnare(time) {
    // Noise body
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.snareNoiseBuffer;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 3200;
    bandpass.Q.value = 0.8;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    noise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    // Tonal body
    const body = this.ctx.createOscillator();
    body.type = 'sine';
    body.frequency.value = 200;

    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime(0.2, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    body.connect(bodyGain);
    bodyGain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.15);
    body.start(time);
    body.stop(time + 0.08);
  }

  _playHiHat(time, isOpen) {
    const buffer = isOpen ? this.hihatOpenBuffer : this.hihatClosedBuffer;
    const decay = isOpen ? 0.12 : 0.04;
    const vol = isOpen ? 0.06 : 0.1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const highpass = this.ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 8000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    noise.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + decay);
  }

  _playBass(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 55; // A1

    const sustain = this.beatDuration * 0.75;
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.setValueAtTime(0.3, time + sustain * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, time + sustain);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + sustain);
  }

  // -- Helpers ------------------------------------------------------------

  _createNoiseBuffer(durationSec) {
    const length = Math.ceil(this.ctx.sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
