import { describe, it, expect } from 'bun:test';
import { MusicManager } from '../packages/core/src/audio/MusicManager.js';
import { BeatClock } from '../packages/core/src/BeatClock.js';
import { SOUND } from '../packages/core/src/audio/SoundIds.js';

class StubAudio {
  constructor() {
    this.calls = [];
  }
  ensureAudioContext() {
    return true;
  }
  playSound(id) {
    this.calls.push(id);
  }
}

class DeterministicBeatClock extends BeatClock {
  constructor(bpm) {
    super(bpm);
    this.current = 0;
  }
  getTotalBeats() {
    return this.current;
  }
}

describe('MusicManager beat pattern', () => {
  it('fires hi-hat every beat with alternating kick and snare', () => {
    const audio = new StubAudio();
    const beatClock = new DeterministicBeatClock(120);
    const musicManager = new MusicManager(audio, beatClock);

    for (let i = 0; i < 8; i++) {
      beatClock.current = i;
      musicManager.update();
    }

    expect(audio.calls).toEqual([
      SOUND.playerShoot,
      SOUND.tankEnergy,
      SOUND.playerShoot,
      SOUND.alienShoot,
      SOUND.playerShoot,
      SOUND.tankEnergy,
      SOUND.playerShoot,
      SOUND.alienShoot,
      SOUND.playerShoot,
      SOUND.tankEnergy,
      SOUND.playerShoot,
      SOUND.alienShoot,
      SOUND.playerShoot,
      SOUND.tankEnergy,
      SOUND.playerShoot,
      SOUND.alienShoot,
    ]);
  });
});
