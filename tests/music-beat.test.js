import { describe, expect, test } from 'bun:test';
import { MusicManager } from '../packages/core/src/audio/MusicManager.js';
import { SOUND } from '../packages/core/src/audio/SoundIds.js';

class MockAudio {
  constructor() {
    this.calls = [];
  }
  playSound(id) {
    this.calls.push(id);
  }
  ensureAudioContext() {
    return true;
  }
}

describe('MusicManager drum sequencing', () => {
  test('emits correct sounds for each beat', () => {
    const audio = new MockAudio();
    const manager = new MusicManager(audio, { beatsPerMeasure: 4 });

    for (let beat = 1; beat <= 4; beat++) {
      audio.calls = [];
      manager.triggerBeat(beat);
      expect(audio.calls).toContain(SOUND.hihat);
      if (beat === 1 || beat === 3) {
        expect(audio.calls).toContain(SOUND.kick);
        expect(audio.calls).not.toContain(SOUND.snare);
      } else {
        expect(audio.calls).toContain(SOUND.snare);
        expect(audio.calls).not.toContain(SOUND.kick);
      }
    }
  });
});
