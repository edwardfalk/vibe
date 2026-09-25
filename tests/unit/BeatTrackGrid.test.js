import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BeatTrack } from '../../js/audio/BeatTrack.js';

// A BeatTrack whose scheduler reads a fake BeatClock on a fake AudioContext
function setup({ now, clockStartMs, beatMs = 500 }) {
  const ctx = { currentTime: now };
  const clock = {
    audioContext: ctx,
    startTime: clockStartMs,
    beatInterval: beatMs,
  };
  const track = new BeatTrack(120, {
    get: (k) => (k === 'beatClock' ? clock : undefined),
  });
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
});
