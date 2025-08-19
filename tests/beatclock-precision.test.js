import { test, expect } from 'bun:test';
import { BeatClock } from '../packages/core/src/BeatClock.js';

test('fires quarter-beat every 250ms', () => {
  const realNow = Date.now;
  const clock = new BeatClock(60); // tempo = 60 bpm
  clock.startTime = 0; // align to epoch

  Date.now = () => 233; // 17ms early -> outside tolerance
  expect(clock.canPlayerShootQuarterBeat()).toBe(false);

  Date.now = () => 251; // 1ms late -> within tolerance
  expect(clock.canPlayerShootQuarterBeat()).toBe(true);

  Date.now = realNow;
});
