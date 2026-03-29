import { describe, it, expect } from 'vitest';
import { BeatTrack } from '../../js/audio/BeatTrack.js';

describe('BeatTrack evolution', () => {
  it('should expose a setLevel() method', () => {
    expect(typeof BeatTrack.prototype.setLevel).toBe('function');
  });

  it('should track current level', () => {
    const track = new BeatTrack(120, {});
    track.setLevel(3);
    expect(track.level).toBe(3);
  });

  it('should track level for layer decisions', () => {
    const track = new BeatTrack(120, {});
    track.setLevel(1);
    expect(track.level).toBe(1);
    track.setLevel(5);
    expect(track.level).toBe(5);
  });
});
