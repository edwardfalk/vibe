import { describe, expect, test } from 'bun:test';
import { BeatClock } from '../packages/core/src/BeatClock.js';

class StubAudioContext {
  constructor() {
    this.currentTime = 0;
  }
}

describe('BeatClock', () => {
  test('onBeat fires within 20ms tolerance', () => {
    globalThis.AudioContext = StubAudioContext;
    const audioCtx = new AudioContext();

    let now = 0;
    const originalDateNow = Date.now;
    Date.now = () => now;

    const clock = new BeatClock(120); // 500ms per beat
    clock.tolerance = 20;
    const interval = clock.beatInterval;

    const fireTimes = [];
    let lastOnBeat = clock.isOnBeat();

    const totalBeats = 4;
    for (let t = 0; t <= interval * totalBeats; t += 10) {
      now = t;
      audioCtx.currentTime = t / 1000;
      const onBeat = clock.isOnBeat();
      if (onBeat && !lastOnBeat) {
        fireTimes.push(t);
      }
      lastOnBeat = onBeat;
    }

    Date.now = originalDateNow;

    const expected = Array.from({ length: totalBeats }, (_, i) => interval * (i + 1));
    expect(fireTimes).toHaveLength(expected.length);
    fireTimes.forEach((time, i) => {
      expect(Math.abs(time - expected[i])).toBeLessThanOrEqual(20);
    });
  });
});
