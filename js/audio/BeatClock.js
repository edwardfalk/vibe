/**
 * BeatClock - Musical Timing System for Vibe Game
 *
 * Creates a subtle rhythmic foundation where enemy combat actions sync to musical beats.
 * The player can shoot freely, but enemies create the musical structure:
 * - Player = Free shooting (creates natural hi-hat feel)
 * - Grunts = Snare (beats 2 & 4)
 * - Tanks = Bass drum (beat 1)
 * - Stabbers = Off-beat accent (beat 3.5)
 *
 * This creates an emergent musical experience that players discover organically.
 */

import { CONFIG } from '../config.js';

export class BeatClock {
  constructor(bpm = 120, audioContext = null) {
    this.bpm = bpm;
    this.audioContext = audioContext ?? null;
    this.beatInterval = (60 / bpm) * 1000; // milliseconds per beat
    this.startTime = this._now();
    this._updateTolerances();

    // Beat pattern tracking (4/4 time signature)
    this.beatsPerMeasure = 4;
    this.cache = {
      timestamp: 0,
      elapsed: 0,
      totalBeats: 0,
      currentBeat: 0,
      timeToNextBeat: this.beatInterval,
      beatPhase: 0,
      measurePhase: 0,
    };
    this.update(true);

    const clockSource = this.audioContext ? 'AudioContext' : 'Date.now';
    console.log(
      `🎵 BeatClock initialized: ${bpm} BPM (${this.beatInterval}ms per beat) [${clockSource}]`
    );
  }

  // Compute ms tolerances from fractional config values
  _updateTolerances() {
    this.tolerance = this.beatInterval * CONFIG.BEAT_TOLERANCES.ON_BEAT;
    this.quarterBeatTolerance =
      (this.beatInterval / 4) * CONFIG.BEAT_TOLERANCES.QUARTER_BEAT;
    this.eighthNoteTolerance =
      (this.beatInterval / 2) * CONFIG.BEAT_TOLERANCES.EIGHTH_NOTE;
  }

  // Internal clock source: AudioContext (seconds->ms) or Date.now fallback
  _now() {
    return this.audioContext
      ? this.audioContext.currentTime * 1000
      : Date.now();
  }

  // Get current beat number (0-based, resets every measure)
  getCurrentBeat() {
    this.update();
    return this.cache.currentBeat;
  }

  // Get total beats since start (for longer patterns)
  getTotalBeats() {
    this.update();
    return this.cache.totalBeats;
  }

  // Time until next beat
  getTimeToNextBeat() {
    this.update();
    return this.cache.timeToNextBeat;
  }

  // Check if we're currently on a beat (within tolerance).
  // Enemies poll this every frame — at typical counts (<10) the cost is
  // negligible (~360 calls/sec of simple arithmetic). A pub/sub model
  // would add complexity without measurable benefit.
  isOnBeat(beats = null) {
    const timeToNext = this.getTimeToNextBeat();
    const onBeat =
      timeToNext <= this.tolerance ||
      timeToNext >= this.beatInterval - this.tolerance;

    // If no specific beats requested, return general on-beat status
    if (!beats || !Array.isArray(beats)) {
      return onBeat;
    }

    // Specific beats: the window opens when that beat lands and lasts
    // `tolerance` ms, never before it, so no enemy acts ahead of the kick and
    // getTotalBeats() can't change inside a window
    const sinceBeat = this.beatInterval - timeToNext;
    if (sinceBeat > this.tolerance) return false;
    return beats.includes(this.getCurrentBeat() + 1); // 1-indexed
  }

  // PLAYER TIMING: Free shooting (not restricted, but creates natural hi-hat feel)
  canPlayerShoot() {
    return this.isOnBeat(); // Available for audio timing, but player shooting is unrestricted
  }

  // NEW: PLAYER QUARTER-BEAT SHOOTING - Exact timing, no tolerance windows
  canPlayerShootQuarterBeat() {
    this.update();
    const elapsed = this.cache.elapsed;
    const quarterBeatInterval = this.beatInterval / 4; // 125ms at 120 BPM
    const timeSinceLastQuarterBeat = elapsed % quarterBeatInterval;

    return (
      timeSinceLastQuarterBeat <= this.quarterBeatTolerance ||
      timeSinceLastQuarterBeat >=
        quarterBeatInterval - this.quarterBeatTolerance
    );
  }

  // Get time until next quarter beat for queuing
  getTimeToNextQuarterBeat() {
    this.update();
    const elapsed = this.cache.elapsed;
    const quarterBeatInterval = this.beatInterval / 4;
    const timeSinceLastQuarterBeat = elapsed % quarterBeatInterval;
    return quarterBeatInterval - timeSinceLastQuarterBeat;
  }

  // Get time to next 8th note (for player sustained fire)
  getTimeToNextEighthNote() {
    this.update();
    const elapsed = this.cache.elapsed;
    const eighthInterval = this.beatInterval / 2; // 250ms at 120 BPM
    const timeSinceLastEighth = elapsed % eighthInterval;
    return eighthInterval - timeSinceLastEighth;
  }

  // Check if we're on an 8th note
  isOnEighthNote() {
    this.update();
    const elapsed = this.cache.elapsed;
    const eighthInterval = this.beatInterval / 2;
    const timeSinceLastEighth = elapsed % eighthInterval;
    return (
      timeSinceLastEighth <= this.eighthNoteTolerance ||
      timeSinceLastEighth >= eighthInterval - this.eighthNoteTolerance
    );
  }

  // GRUNT TIMING: Beats 2 and 4 (snare pattern)
  canGruntShoot() {
    return this.isOnBeat([2, 4]);
  }

  // TANK TIMING: Beat 1 only (bass drum pattern)
  canTankShoot() {
    return this.isOnBeat([1]);
  }

  // STABBER TIMING: the off-beat 3.5 (syncopated, creates tension).
  // Opens halfway through beat 3 and lasts `tolerance`, like the other gates.
  canStabberAttack() {
    this.update();
    if (this.cache.currentBeat !== 2) return false; // beat 3 (0-indexed)
    const sinceHalf =
      this.beatInterval - this.cache.timeToNextBeat - this.beatInterval / 2;
    return sinceHalf >= 0 && sinceHalf <= this.tolerance;
  }

  // RUSHER TIMING: Can charge on any beat, but explode on strong beats (1 or 3)
  canRusherCharge() {
    return this.isOnBeat();
  }

  canRusherExplode() {
    return this.isOnBeat([1, 3]);
  }

  // Get beat info for debugging
  getBeatInfo() {
    return {
      currentBeat: this.getCurrentBeat() + 1, // 1-indexed for display
      totalBeats: this.getTotalBeats(),
      timeToNext: Math.round(this.getTimeToNextBeat()),
      onBeat: this.isOnBeat(),
      bpm: this.bpm,
    };
  }

  // Adjust tempo (for dynamic music)
  setBPM(newBPM) {
    this.bpm = newBPM;
    this.beatInterval = (60 / newBPM) * 1000;
    this._updateTolerances();
    this.update(true);
    console.log(`🎵 Tempo changed to ${newBPM} BPM`);
  }

  // Reset timing (for level transitions)
  reset() {
    const now = this._now();
    // Snap to nearest beat boundary so the grid stays aligned
    const elapsed = now - this.startTime;
    const remainder = elapsed % this.beatInterval;
    if (remainder < this.beatInterval / 2) {
      // Closer to the previous beat — snap back
      this.startTime = now - remainder;
    } else {
      // Closer to the next beat — snap forward
      // Same grid and bar numbering, one bar earlier, so elapsed time is
      // never negative (a future origin made isOnBeat() fire 200 ms early)
      this.startTime =
        now +
        (this.beatInterval - remainder) -
        this.beatInterval * this.beatsPerMeasure;
    }
    this.update(true);
    console.log('🎵 BeatClock reset (beat-aligned)');
  }

  // Continuous beat phase: 0 = beat just hit, 1 = next beat about to hit
  getBeatPhase() {
    this.update();
    return this.cache.beatPhase;
  }

  // Exponential decay intensity from last beat (1 at beat, decays toward 0)
  getBeatIntensity(decayRate = 8) {
    const phase = this.getBeatPhase();
    return Math.exp(-phase * decayRate);
  }

  // Same as getBeatIntensity but stronger on downbeat (beat 1)
  getDownbeatIntensity(decayRate = 6) {
    const beat = this.getCurrentBeat();
    const intensity = this.getBeatIntensity(decayRate);
    return beat === 0 ? intensity : intensity * 0.4;
  }

  // Phase through a full measure (0-1 over 4 beats)
  getMeasurePhase() {
    this.update();
    return this.cache.measurePhase;
  }

  // No-op update method for compatibility with GameLoop
  update(force = false) {
    const now = this._now();
    if (!force && Math.abs(now - this.cache.timestamp) < 0.1) return;

    const elapsed = now - this.startTime;
    const totalBeats = Math.floor(elapsed / this.beatInterval);
    const timeSinceLastBeat = elapsed % this.beatInterval;
    const measureLength = this.beatInterval * this.beatsPerMeasure;

    this.cache.timestamp = now;
    this.cache.elapsed = elapsed;
    this.cache.totalBeats = totalBeats;
    this.cache.currentBeat = totalBeats % this.beatsPerMeasure;
    this.cache.timeToNextBeat = this.beatInterval - timeSinceLastBeat;
    this.cache.beatPhase = timeSinceLastBeat / this.beatInterval;
    this.cache.measurePhase = (elapsed % measureLength) / measureLength;
  }

  // Getter for currentBeat for probe/debug compatibility
  get currentBeat() {
    return this.getCurrentBeat();
  }
}
