import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BeatTrack } from '../../js/audio/BeatTrack.js';

// A BeatTrack whose scheduler reads a fake BeatClock on a fake AudioContext
function setup({ now, clockStartMs, beatMs = 500, gameState }) {
  const ctx = { currentTime: now };
  const clock = {
    audioContext: ctx,
    startTime: clockStartMs,
    beatInterval: beatMs,
  };
  const context = { beatClock: clock, gameState };
  const track = new BeatTrack({ get: (k) => context[k] });
  track.ctx = ctx;
  track.masterGain = {};
  track.isPlaying = true;
  const notes = [];
  vi.spyOn(track, '_scheduleNote').mockImplementation((t, eighth) =>
    notes.push([Number(t.toFixed(4)), eighth])
  );
  return { ctx, clock, track, notes };
}

describe('BeatTrack grid', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('schedules on the BeatClock grid, eighth 0 = beat 1', () => {
    const { track, notes } = setup({ now: 10.2, clockStartMs: 1234 });
    track._scheduler();
    // origin 1.234 s; eighth 36 = 10.234 s; 36 % 8 = 4 (beat 3)
    expect(notes).toEqual([[10.234, 4]]);
  });

  it('after a reset (grid moved by whole beats) renumbers the bar and never re-schedules a queued note', () => {
    const { track, clock, notes } = setup({ now: 10.2, clockStartMs: 1234 });
    track._scheduler(); // queues 10.234
    clock.startTime += 2 * 500; // what reset() does: same times, bar renumbered
    notes.length = 0;
    track._scheduler(); // still at 10.2
    expect(notes).toEqual([]); // 10.234 is already queued
    track.ctx.currentTime = 10.45;
    track._scheduler();
    // next eighth; on the moved grid 10.234 is eighth 0, so 10.484 is eighth 1
    expect(notes).toEqual([[10.484, 1]]);
  });

  it('still plays a note that a short main-thread stall made slightly late', () => {
    const { track, ctx, notes } = setup({ now: 10.2, clockStartMs: 1234 });
    track._scheduler(); // queues 10.234
    ctx.currentTime = 10.51; // a stall: 10.484 is now 26 ms in the past
    notes.length = 0;
    track._scheduler();
    expect(notes).toEqual([[10.484, 5]]); // played (slightly late), not dropped
  });

  it('skips missed notes after a hidden tab instead of bursting', () => {
    const { track, ctx, notes } = setup({ now: 10.2, clockStartMs: 1234 });
    track._scheduler();
    ctx.currentTime = 60.2;
    notes.length = 0;
    track._scheduler();
    expect(notes.length).toBeLessThanOrEqual(1);
  });

  it('schedules nothing until BeatClock runs on the same AudioContext', () => {
    const { track, clock, notes } = setup({ now: 10.2, clockStartMs: 1234 });
    clock.audioContext = null;
    track._scheduler();
    expect(notes).toEqual([]);
  });

  it('never schedules before audio time 0, where the grid can begin once audio starts', () => {
    // BeatClock carried the title screen's time over, so its grid began
    // before audio time 0, and the first pass looks back LATE_GRACE_SEC from
    // about 0: Web Audio rejects a negative time
    const { track, notes } = setup({ now: 0.005, clockStartMs: -40 });
    track._scheduler();
    expect(notes).toEqual([]);
  });

  it("turns the hum's breath over the clock's own bar length", () => {
    const ctx = { currentTime: 10.2 };
    const clock = { audioContext: ctx, startTime: 1234, beatInterval: 400 };
    const track = new BeatTrack({ get: (k) => ({ beatClock: clock })[k] });
    Object.assign(track, { ctx, masterGain: {}, isPlaying: true });
    vi.spyOn(track, '_playKick').mockImplementation(() => {});
    track.hum = { sync: vi.fn(), dipAt: vi.fn(), barAt: vi.fn() };
    track._scheduler();
    // Four seconds of passes: at 150 BPM, a bar is 4 × 0.4 s
    for (let i = 0; i < 160; i++) {
      ctx.currentTime += 0.025;
      vi.advanceTimersByTime(25);
    }
    expect(track.hum.barAt).toHaveBeenCalled();
    for (const [, barSec] of track.hum.barAt.mock.calls) {
      expect(barSec).toBeCloseTo(1.6, 9);
    }
  });

  it('re-arms the next pass first, so an error in this one cannot stop the kick', () => {
    const { track, ctx, notes } = setup({ now: 10.2, clockStartMs: 1234 });
    track._scheduleNote.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => track._scheduler()).toThrow('boom'); // 10.234 is lost
    ctx.currentTime = 10.45;
    vi.advanceTimersByTime(25);
    expect(notes).toEqual([[10.484, 5]]);
  });

  it('syncs the hum once each time the audio clock moves', () => {
    const { track, ctx } = setup({ now: 10.2, clockStartMs: 1234 });
    track.hum = { sync: vi.fn() };
    track.setLevel(4);
    track.setEnemyCount(3);
    track._scheduler();
    expect(track.hum.sync).toHaveBeenLastCalledWith(10.2, 4, 3);
    // A pause or a stalled device freezes the clock: no writes pile up at it
    vi.advanceTimersByTime(25);
    expect(track.hum.sync).toHaveBeenCalledTimes(1);
    ctx.currentTime = 10.25;
    vi.advanceTimersByTime(25);
    expect(track.hum.sync).toHaveBeenCalledTimes(2);
  });

  it('hands the hum no enemies on the game-over screen, whatever the frame last counted', () => {
    const gameState = { gameState: 'playing' };
    const { track, ctx } = setup({ now: 10.2, clockStartMs: 1234, gameState });
    track.hum = { sync: vi.fn() };
    track.setEnemyCount(3);
    track._scheduler();
    expect(track.hum.sync).toHaveBeenLastCalledWith(10.2, 1, 3);
    // A death inside the frame's update, then that frame's own count
    gameState.gameState = 'gameOver';
    track.setEnemyCount(3);
    ctx.currentTime = 10.25;
    vi.advanceTimersByTime(25);
    expect(track.hum.sync).toHaveBeenLastCalledWith(10.25, 1, 0);
  });

  it("logs the hum's first error only, and keeps scheduling the kick", () => {
    const { track, ctx, notes } = setup({ now: 10.2, clockStartMs: 1234 });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      track.hum = {
        sync: vi.fn(() => {
          throw new Error('hum');
        }),
      };
      track._scheduler();
      ctx.currentTime = 10.45;
      vi.advanceTimersByTime(25);
      expect(notes).toEqual([
        [10.234, 4],
        [10.484, 5],
      ]);
      expect(track.hum.sync).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledTimes(1);
    } finally {
      error.mockRestore();
    }
  });
});
