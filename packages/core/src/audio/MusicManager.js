// MusicManager.js – background rhythm engine synced to BeatClock
// Requires the Audio system for sound playback.

import { floor } from '../mathUtils.js';

/**
 * MusicManager – drives a simple 4-beat backing track using existing SFX.
 * Currently uses kick (tankEnergy), snare (alienShoot) and hi-hat (playerShoot).
 * All events are scheduled on-beat via BeatClock every frame.
 */
export class MusicManager {
  /**
   * @param {Audio} audio – Parent Audio system (already initialised in GameLoop).
   * @param {BeatClock} beatClock – Global BeatClock instance.
   */
  constructor(audio, beatClock) {
    this.audio = audio;
    this.beatClock = beatClock;
    this.lastBeatProcessed = -1;
    this.enabled = true;
  }

  /** Toggle music playback */
  toggle() {
    this.enabled = !this.enabled;
    console.log(`🎶 Music ${this.enabled ? 'enabled' : 'muted'}`);
  }

  /** Call once per frame */
  update() {
    if (!this.enabled || !this.audio || !this.beatClock) return;
    if (!this.audio.ensureAudioContext()) return;

    const totalBeats = this.beatClock.getTotalBeats();
    if (totalBeats === this.lastBeatProcessed) return; // no new beat yet

    const beatInMeasure = (totalBeats % this.beatClock.beatsPerMeasure) + 1; // 1-4
    this.triggerBeat(beatInMeasure);
    this.lastBeatProcessed = totalBeats;
  }

  /**
   * Fire SFX for the given beat (1-4).
   * Kick on 1 & 3, Snare on 2 & 4, Hi-hat every beat.
   */
  triggerBeat(beat) {
    // Hi-hat (quiet)
    this.audio.playSound('playerShoot');

    if (beat === 1 || beat === 3) {
      this.audio.playSound('tankEnergy'); // Kick
    }
    if (beat === 2 || beat === 4) {
      this.audio.playSound('alienShoot'); // Snare
    }
  }
} 