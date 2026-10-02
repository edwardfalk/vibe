import { BeatClock } from '../../../js/audio/BeatClock.js';
import { createMockAudio } from './enemyMocks.js';

// A real BeatClock on a fake audio clock at 120 BPM: a beat is 500 ms and a
// bar 2000 ms, so bar n's beat 1 is at n·2000 ms. `values` adds to or
// overrides what the context holds (audio, beatClock, enemies by default).
export function beatWorld(values = {}) {
  const audioClock = { currentTime: 0 };
  const clock = new BeatClock(120, audioClock);
  const all = {
    audio: createMockAudio(),
    beatClock: clock,
    enemies: [],
    ...values,
  };
  const context = { get: (k) => all[k] ?? null, set() {} };
  const at = (ms) => {
    audioClock.currentTime = ms / 1000;
    clock.update(true);
  };
  return { clock, audio: all.audio, context, at, values: all };
}
