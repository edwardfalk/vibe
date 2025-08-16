/* BeatClock - Musical Timing System (moved to @vibe/core) */

export class BeatClock {
  constructor(bpm = 120) {
    this.bpm = bpm;
    this.beatInterval = (60 / bpm) * 1000; // ms per beat
    // Time-scale factor (1 = normal, <1 slow-motion, >1 fast). Used by DeathTransitionSystem.
    this.timeScale = 1;
    this.startTime = Date.now();
    this.tolerance = 100; // ms tolerance for on-beat
    this.beatsPerMeasure = 4;
    console.log(
      `🎵 BeatClock initialized: ${bpm} BPM (${this.beatInterval}ms per beat)`
    );
  }
  getCurrentBeat() {
    const elapsed = (Date.now() - this.startTime) * this.timeScale;
    const totalBeats = Math.floor(elapsed / this.beatInterval);
    return totalBeats % this.beatsPerMeasure;
  }
  getTotalBeats() {
    const elapsed = (Date.now() - this.startTime) * this.timeScale;
    return Math.floor(elapsed / this.beatInterval);
  }
  getTimeToNextBeat() {
    const elapsed = (Date.now() - this.startTime) * this.timeScale;
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
    const elapsed = (Date.now() - this.startTime) * this.timeScale;
    const quarterBeatInterval = this.beatInterval / 4;
    const timeSinceLastQuarterBeat = elapsed % quarterBeatInterval;
    const exactTolerance = 16;
    return (
      timeSinceLastQuarterBeat <= exactTolerance ||
      timeSinceLastQuarterBeat >= quarterBeatInterval - exactTolerance
    );
  }
  getTimeToNextQuarterBeat() {
    const elapsed = (Date.now() - this.startTime) * this.timeScale;
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
    const elapsed = Date.now() - this.startTime;
    const beatPosition = (elapsed % this.beatInterval) / this.beatInterval;
    const currentBeat = this.getCurrentBeat();
    if (currentBeat === 2) return beatPosition >= 0.75;
    if (currentBeat === 3) return beatPosition <= 0.25;
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
    this.startTime = Date.now();
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
