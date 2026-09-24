import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BeatTrack } from '../../js/audio/BeatTrack.js';
import { CONFIG } from '../../js/config.js';

const original = structuredClone(CONFIG.BEAT_TRACK);

// Schedule one measure (8 eighth notes) and report which beats (0-3) got
// a kick and which got a sub pulse.
function playMeasure() {
  const track = new BeatTrack(120, {});
  const kicks = [];
  const pulses = [];
  vi.spyOn(track, '_playKick').mockImplementation(() => {
    kicks.push(track._beat);
  });
  vi.spyOn(track, '_playPulse').mockImplementation(() => {
    pulses.push(track._beat);
  });
  for (let eighth = 0; eighth < 8; eighth++) {
    track._beat = eighth / 2;
    track._scheduleNote(eighth * 0.25, eighth);
  }
  return { kicks, pulses };
}

describe('BeatTrack kick', () => {
  beforeEach(() => {
    CONFIG.BEAT_TRACK = structuredClone(original);
  });
  afterEach(() => {
    CONFIG.BEAT_TRACK = structuredClone(original);
  });

  it('plays four on the floor, with the sub pulse, by default', () => {
    expect(playMeasure()).toEqual({
      kicks: [0, 1, 2, 3],
      pulses: [0, 1, 2, 3],
    });
  });

  it('plays only beats 1 and 3 with the oneThree pattern', () => {
    CONFIG.BEAT_TRACK.KICK.PATTERN = 'oneThree';
    expect(playMeasure().kicks).toEqual([0, 2]);
  });

  it('can switch the kick and the sub pulse off independently', () => {
    CONFIG.BEAT_TRACK.KICK.ENABLED = false;
    expect(playMeasure()).toEqual({ kicks: [], pulses: [0, 1, 2, 3] });

    CONFIG.BEAT_TRACK.KICK.ENABLED = true;
    CONFIG.BEAT_TRACK.SUB_PULSE.ENABLED = false;
    expect(playMeasure()).toEqual({ kicks: [0, 1, 2, 3], pulses: [] });
  });
});
