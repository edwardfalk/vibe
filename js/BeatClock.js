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

export class BeatClock {
  constructor(bpm = 120) {
    this.bpm = bpm;
    this.beatInterval = (60 / bpm) * 1000; // milliseconds per beat
    this.startTime = Date.now();
    this.tolerance = 100; // ms tolerance for "on beat" detection

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

    console.log(
      `🎵 BeatClock initialized: ${bpm} BPM (${this.beatInterval}ms per beat)`
    );
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

  // Check if we're currently on a beat (within tolerance)
  // Can optionally accept an array of beat numbers to check against
  isOnBeat(beats = null) {
    const timeToNext = this.getTimeToNextBeat();
    const onBeat =
      timeToNext <= this.tolerance ||
      timeToNext >= this.beatInterval - this.tolerance;

    // If no specific beats requested, return general on-beat status
    if (!beats || !Array.isArray(beats)) {
      return onBeat;
    }

    // If specific beats requested, check if current beat is in the array
    if (!onBeat) return false;

    const currentBeat = this.getCurrentBeat() + 1; // Convert to 1-indexed for comparison
    return beats.includes(currentBeat);
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

    // EXACT TIMING: Only return true in a very small window around the quarter-beat
    // This creates precise rhythm timing instead of loose tolerance windows
    const exactTolerance = 16; // ~1 frame at 60fps for precise timing

    return (
      timeSinceLastQuarterBeat <= exactTolerance ||
      timeSinceLastQuarterBeat >= quarterBeatInterval - exactTolerance
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

  // GRUNT TIMING: Beats 2 and 4 (snare pattern)
  canGruntShoot() {
    if (!this.isOnBeat()) return false;
    const currentBeat = this.getCurrentBeat();
    return currentBeat === 1 || currentBeat === 3; // Beats 2 and 4 (0-indexed)
  }

  // TANK TIMING: Beat 1 only (bass drum pattern)
  canTankShoot() {
    if (!this.isOnBeat()) return false;
    const currentBeat = this.getCurrentBeat();
    return currentBeat === 0; // Beat 1 (0-indexed)
  }

  // STABBER TIMING: Off-beat (syncopated, creates tension)
  canStabberAttack() {
    this.update();
    const elapsed = this.cache.elapsed;
    const beatPosition = (elapsed % this.beatInterval) / this.beatInterval;

    // Attack on beat 3.5 (75% through beat 3, or 25% through beat 4)
    const currentBeat = this.getCurrentBeat();
    if (currentBeat === 2) {
      // Beat 3 (0-indexed)
      return beatPosition >= 0.75; // Last quarter of beat 3
    }
    if (currentBeat === 3) {
      // Beat 4 (0-indexed)
      return beatPosition <= 0.25; // First quarter of beat 4
    }
    return false;
  }

  // RUSHER TIMING: Can charge on any beat, but explode on strong beats (1 or 3)
  canRusherCharge() {
    return this.isOnBeat();
  }

  canRusherExplode() {
    if (!this.isOnBeat()) return false;
    const currentBeat = this.getCurrentBeat();
    return currentBeat === 0 || currentBeat === 2; // Beats 1 and 3 (0-indexed)
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
    this.update(true);
    console.log(`🎵 Tempo changed to ${newBPM} BPM`);
  }

  // Reset timing (for level transitions)
  reset() {
    this.startTime = Date.now();
    this.update(true);
    console.log('🎵 BeatClock reset');
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
    const now = Date.now();
    if (!force && now === this.cache.timestamp) return;

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
