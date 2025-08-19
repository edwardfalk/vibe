/* BeatClock - Musical Timing System (moved to @vibe/core) */

export class BeatClock {
  constructor(audioContext, bpm = 120) {
    this.audioContext = audioContext;
    this.bpm = bpm;
    this.beatInterval = (60 / bpm) * 1000; // ms per beat
    // Time-scale factor (1 = normal, <1 slow-motion, >1 fast). Used by DeathTransitionSystem.
    this.timeScale = 1;
    this.startTime = this._now();
    this.tolerance = 20; // ms tolerance for on-beat
    this.beatsPerMeasure = 4;
    console.log(
      `🎵 BeatClock initialized: ${bpm} BPM (${this.beatInterval}ms per beat)`
    );
  }

  _now() {
    return this.audioContext && typeof this.audioContext.currentTime === 'number'
      ? this.audioContext.currentTime * 1000
      : Date.now();
  }

  _getElapsed() {
    return (this._now() - this.startTime) * this.timeScale;
  }

  getCurrentBeat() {
    const elapsed = this._getElapsed();
    const totalBeats = Math.floor(elapsed / this.beatInterval);
    return totalBeats % this.beatsPerMeasure;
  }
  getTotalBeats() {
    const elapsed = this._getElapsed();
    return Math.floor(elapsed / this.beatInterval);
  }
  getTimeToNextBeat() {
    const elapsed = this._getElapsed();
    const timeSinceLastBeat = elapsed % this.beatInterval;
    return this.beatInterval - timeSinceLastBeat;
  }
  isOnBeat(beats = null) {
    const timeToNext = this.getTimeToNextBeat();
    const onBeat =
      timeToNext <= this.tolerance ||
      timeToNext >= this.beatInterval - this.tolerance;
    if (!beats || !Array.isArray(beats)) return onBeat;
    if (!onBeat) return false;
    const currentBeat = this.getCurrentBeat() + 1;
    return beats.includes(currentBeat);
  }
  canPlayerShoot() {
    return this.isOnBeat();
  }
  canPlayerShootQuarterBeat() {
    const elapsed = this._getElapsed();
    const quarterBeatInterval = this.beatInterval / 4;
    const timeSinceLastQuarterBeat = elapsed % quarterBeatInterval;
    const exactTolerance = 16;
    return (
      timeSinceLastQuarterBeat <= exactTolerance ||
      timeSinceLastQuarterBeat >= quarterBeatInterval - exactTolerance
    );
  }
  getTimeToNextQuarterBeat() {
    const elapsed = this._getElapsed();
    const quarterBeatInterval = this.beatInterval / 4;
    const timeSinceLastQuarterBeat = elapsed % quarterBeatInterval;
    return quarterBeatInterval - timeSinceLastQuarterBeat;
  }
  canGruntShoot() {
    if (!this.isOnBeat()) return false;
    const currentBeat = this.getCurrentBeat();
    return currentBeat === 1 || currentBeat === 3;
  }
  canTankShoot() {
    if (!this.isOnBeat()) return false;
    const currentBeat = this.getCurrentBeat();
    return currentBeat === 0;
  }
  canStabberAttack() {
    const elapsed = this._getElapsed();
    const beatPosition = (elapsed % this.beatInterval) / this.beatInterval;
    const currentBeat = this.getCurrentBeat();
    // Beat 3.5 (1-based) = Beat 2.5 (0-based)
    // This means halfway through beat 2 (0-based)
    if (currentBeat === 2) return beatPosition >= 0.5;
    return false;
  }
  canRusherCharge() {
    return this.isOnBeat();
  }
  canRusherExplode() {
    if (!this.isOnBeat()) return false;
    const currentBeat = this.getCurrentBeat();
    return currentBeat === 0 || currentBeat === 2;
  }
  getBeatInfo() {
    return {
      currentBeat: this.getCurrentBeat() + 1,
      totalBeats: this.getTotalBeats(),
      timeToNext: Math.round(this.getTimeToNextBeat()),
      onBeat: this.isOnBeat(),
      bpm: this.bpm,
    };
  }
  setBPM(newBPM) {
    this.bpm = newBPM;
    this.beatInterval = (60 / newBPM) * 1000;
    console.log(`🎵 Tempo changed to ${newBPM} BPM`);
  }
  reset() {
    this.startTime = this._now();
    console.log('🎵 BeatClock reset');
  }

  /**
   * Adjust global time-scale. Recommended range 0.1–2.0.
   * @param {number} scale
   */
  setTimeScale(scale = 1) {
    this.timeScale = Math.max(0.05, scale);
  }
  update() {}
  get currentBeat() {
    return this.getCurrentBeat();
  }
}
