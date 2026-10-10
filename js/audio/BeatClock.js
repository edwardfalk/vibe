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

// A hero shot this far (s) before its eighth is booked on it
// (Audio.heroShotTiming); a timer aimed at an eighth may wake this early on
// the clock too, and is booked on it (BaseEnemy.onNearbyDeath)
export const SNAP_SEC = 0.03;

export class BeatClock {
  constructor(bpm = 120, audioContext = null) {
    this.bpm = bpm;
    this.audioContext = audioContext ?? null;
    this.beatInterval = (60 / bpm) * 1000; // milliseconds per beat
    this._ahead = this.audioContext ? CONFIG.BEAT_CLOCK.AHEAD_MS : 0;
    this._startTime = this._now();
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
  }

  // Compute ms tolerances from fractional config values
  _updateTolerances() {
    this.tolerance = this.beatInterval * CONFIG.BEAT_TOLERANCES.ON_BEAT;
    this.eighthNoteTolerance =
      (this.beatInterval / 2) * CONFIG.BEAT_TOLERANCES.EIGHTH_NOTE;
  }

  // Internal clock source: AudioContext (seconds->ms) plus the lead the game
  // runs ahead of what you hear, or Date.now with no lead before audio starts
  _now() {
    this._syncLead();
    return this.audioContext
      ? this.audioContext.currentTime * 1000 + this._ahead
      : Date.now();
  }

  // A new CONFIG.BEAT_CLOCK.AHEAD_MS moves the grid's origin with it, so the
  // elapsed time and the beat count carry on: only the heard grid moves. Every
  // reader of the origin or the lead calls this first, so it gets the pair
  // as written together
  _syncLead() {
    const ahead = this.audioContext ? CONFIG.BEAT_CLOCK.AHEAD_MS : 0;
    if (ahead === this._ahead) return;
    this._startTime += ahead - this._ahead;
    this._ahead = ahead;
  }

  /** The grid's origin, ms on this clock: a grid time is when it is heard */
  get startTime() {
    this._syncLead();
    return this._startTime;
  }

  set startTime(ms) {
    this._syncLead();
    this._startTime = ms;
  }

  /** How far (s) the game runs ahead of the AudioContext; 0 before audio */
  get aheadSec() {
    this._syncLead();
    return this._ahead / 1000;
  }

  /** Its clock now, in seconds: the AudioContext's once audio has started */
  nowSec() {
    return this._now() / 1000;
  }

  // Get current beat number (0-based, resets every measure)
  getCurrentBeat() {
    this.update();
    return this.cache.currentBeat;
  }

  // Total beats since start plus the phase through the current one, from one
  // reading of the clock (getTotalBeats then getBeatPhase can straddle a beat)
  getBeatPosition() {
    this.update();
    return this.cache.elapsed / this.beatInterval;
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

  // STABBER TIMING: the off-beat 3.5 (syncopated, creates tension).
  // Opens halfway through beat 3 and lasts `tolerance`, like the other gates.
  canStabberAttack() {
    this.update();
    if (this.cache.currentBeat !== 2) return false; // beat 3 (0-indexed)
    const sinceHalf =
      this.beatInterval - this.cache.timeToNextBeat - this.beatInterval / 2;
    return sinceHalf >= 0 && sinceHalf <= this.tolerance;
  }

  // Move from Date.now() to the AudioContext's clock, led, once audio
  // starts, keeping the elapsed time so the grid doesn't jump. Only the first
  // call switches; later calls do nothing.
  useAudioClock(audioContext) {
    if (this.audioContext) return;
    // Read both clocks back to back so they agree as closely as possible
    const audioNow = audioContext.currentTime * 1000;
    const elapsed = Date.now() - this._startTime;
    this.audioContext = audioContext;
    this._ahead = CONFIG.BEAT_CLOCK.AHEAD_MS;
    this._startTime = audioNow + this._ahead - elapsed;
    this.update(true);
  }

  // Adjust tempo (for dynamic music)
  setBPM(newBPM) {
    this.bpm = newBPM;
    this.beatInterval = (60 / newBPM) * 1000;
    this._updateTolerances();
    this.update(true);
  }

  // Re-zero the grid. Only GameState's restart calls it, after the enemies
  // are cleared: the tank's charge, the rusher's fuse, the bombs and the
  // stabber's phrase, lunge and rest bar are beat positions on this grid,
  // and a stabber kept across it would freeze mid-lunge or wait hundreds of
  // bars. A caller with enemies alive must clear those first
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
