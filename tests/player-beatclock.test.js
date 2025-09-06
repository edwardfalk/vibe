import { describe, it, expect } from 'bun:test';
import { Player } from '../packages/entities/src/player.js';

class StubBeatClock {
  constructor(bpm = 60) {
    this.bpm = bpm;
    this.beatInterval = (60 / bpm) * 1000;
    this.timeScale = 1;
    this.startTime = 0;
    this.quarterBeatTolerance = 8;
    this.currentTime = 0;
  }
  advance(ms) {
    this.currentTime += ms;
  }
  canPlayerShootQuarterBeat() {
    const quarterBeatInterval = this.beatInterval / 4;
    const timeSinceLast = (this.currentTime - this.startTime) % quarterBeatInterval;
    const tol = this.quarterBeatTolerance;
    return (
      timeSinceLast <= tol ||
      timeSinceLast >= quarterBeatInterval - tol
    );
  }
  getTimeToNextQuarterBeat() {
    const quarterBeatInterval = this.beatInterval / 4;
    const timeSinceLast = (this.currentTime - this.startTime) % quarterBeatInterval;
    return quarterBeatInterval - timeSinceLast;
  }
}

describe('Player BeatClock shooting', () => {
  it('fires exactly one bullet per quarter beat while trigger held', () => {
    const beatClock = new StubBeatClock(60);
    global.window = { beatClock };
    const p = { color: () => ({}) };
    const player = new Player(p, 0, 0, null);

    const frameStep = 16; // ms per simulated frame (~60 FPS)
    const quarterBeatInterval = beatClock.beatInterval / 4;
    const quartersToSimulate = 5;
    const totalDuration =
      quarterBeatInterval * (quartersToSimulate - 1) + frameStep;

    const bulletQuarters = [];
    const originalNow = Date.now;

    // initial frame at t=0
    Date.now = () => beatClock.currentTime;
    const firstBullet = player.shoot();
    if (firstBullet) bulletQuarters.push(0);

    for (let t = 0; t < totalDuration; t += frameStep) {
      beatClock.advance(frameStep);
      // override Date.now for deterministic timing
      Date.now = () => beatClock.currentTime;

      // process queued shot manually
      if (player.queuedShot) {
        player.queuedShot.timerMs -= frameStep;
        if (player.queuedShot.timerMs <= 0) {
          const bullet = player.fireBullet();
          const q = Math.floor(
            (beatClock.currentTime - beatClock.startTime) / quarterBeatInterval
          );
          player.lastShotQuarter = q;
          bullet && bulletQuarters.push(q);
          // mimic update cooldown behavior
          player.shootCooldownMs += frameStep;
          player.queuedShot = null;
        }
      }

      const bullet = player.shoot();
      if (bullet) {
        const q = Math.floor(
          (beatClock.currentTime - beatClock.startTime) / quarterBeatInterval
        );
        bulletQuarters.push(q);
      }

      // decrement cooldown as in update
      if (player.shootCooldownMs > 0) {
        player.shootCooldownMs = Math.max(0, player.shootCooldownMs - frameStep);
      }
    }

    Date.now = originalNow;

    expect(bulletQuarters.length).toBe(quartersToSimulate);
    expect(bulletQuarters).toEqual([0, 1, 2, 3, 4]);
  });
});
