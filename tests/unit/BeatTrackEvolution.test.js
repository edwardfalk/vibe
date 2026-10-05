import { describe, it, expect, vi } from 'vitest';
import { BeatTrack } from '../../js/audio/BeatTrack.js';

describe('BeatTrack evolution', () => {
  it('should expose a setLevel() method', () => {
    expect(typeof BeatTrack.prototype.setLevel).toBe('function');
  });

  it('should track current level', () => {
    const track = new BeatTrack({});
    track.setLevel(3);
    expect(track.level).toBe(3);
  });

  it('should track level for layer decisions', () => {
    const track = new BeatTrack({});
    track.setLevel(1);
    expect(track.level).toBe(1);
    track.setLevel(5);
    expect(track.level).toBe(5);
  });

  it('hands the hum the last level set, several level-ups in one frame included', () => {
    vi.useFakeTimers();
    try {
      const hum = { sync: vi.fn() };
      // No beat clock: only the hum's pass runs
      const track = new BeatTrack({ get: () => undefined });
      Object.assign(track, { ctx: { currentTime: 10 }, isPlaying: true, hum });
      // Level +1 pressed three times in one frame
      track.setLevel(3);
      track.setLevel(4);
      track.setLevel(5);
      track._scheduler();
      expect(hum.sync).toHaveBeenLastCalledWith(10, 5, 0);
      track.setLevel(1); // a restart
      track.ctx.currentTime = 10.1;
      vi.advanceTimersByTime(25);
      expect(hum.sync).toHaveBeenLastCalledWith(10.1, 1, 0);
    } finally {
      vi.useRealTimers();
    }
  });
});
