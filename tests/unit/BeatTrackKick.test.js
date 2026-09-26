import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BeatTrack } from '../../js/audio/BeatTrack.js';
import { CONFIG } from '../../js/config.js';

const original = structuredClone(CONFIG.BEAT_TRACK);

// Schedule one measure (8 eighth notes) and report which beats (0-3) got
// a kick and which got a sub pulse.
function playMeasure() {
  const track = new BeatTrack({});
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

  it('drive curve soft-clips but keeps full scale, cached per drive', () => {
    const track = new BeatTrack({});
    track.ctx = { createWaveShaper: () => ({}) };
    const curve = track._getDriveShaper(4).curve;
    // A quarter of full scale in comes out well above a quarter: overtones
    const quarter = curve[Math.round((curve.length - 1) * 0.625)];
    expect(quarter).toBeGreaterThan(0.6);
    expect(track._getDriveShaper(4).curve).toBe(curve);
    expect(track._getDriveShaper(8).curve).not.toBe(curve);
    // Normalisation matters most at low drive: without it, 0.5 gives ±0.46
    const gentle = track._getDriveShaper(0.5).curve;
    expect(gentle[0]).toBeCloseTo(-1, 5);
    expect(gentle[gentle.length - 1]).toBeCloseTo(1, 5);
  });

  it('routes the kick through the drive stage only when DRIVE > 0', () => {
    // Fake AudioContext that records which node connects to which
    function kickWiring() {
      const edges = [];
      const param = () => ({
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
        linearRampToValueAtTime() {},
      });
      const node = (name, extra = {}) => ({
        name,
        connect(to) {
          edges.push(`${name}->${to.name}`);
        },
        disconnect() {},
        ...extra,
      });
      const track = new BeatTrack({});
      track.ctx = {
        createOscillator: () =>
          node('osc', { frequency: param(), start() {}, stop() {} }),
        createGain: () => node('gain', { gain: param() }),
        createWaveShaper: () => node('shaper'),
      };
      track.masterGain = node('master');
      track._playKick(0);
      return edges;
    }

    CONFIG.BEAT_TRACK.KICK.DRIVE = 4;
    expect(kickWiring()).toEqual([
      'osc->gain',
      'gain->shaper',
      'shaper->master',
    ]);
    CONFIG.BEAT_TRACK.KICK.DRIVE = 0;
    expect(kickWiring()).toEqual(['osc->gain', 'gain->master']);
  });

  it('can switch the kick and the sub pulse off independently', () => {
    CONFIG.BEAT_TRACK.KICK.ENABLED = false;
    expect(playMeasure()).toEqual({ kicks: [], pulses: [0, 1, 2, 3] });

    CONFIG.BEAT_TRACK.KICK.ENABLED = true;
    CONFIG.BEAT_TRACK.SUB_PULSE.ENABLED = false;
    expect(playMeasure()).toEqual({ kicks: [0, 1, 2, 3], pulses: [] });
  });
});
