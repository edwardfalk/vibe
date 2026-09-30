import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BeatTrack, heardKick } from '../../js/audio/BeatTrack.js';
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

  it('heardKick reports the last kick and whether it was beat 1', () => {
    // Beat 8 is beat 1 of the third bar; 0.2 beats = 0.1 s later
    const one = heardKick(8.2, 0.5, 0, true);
    expect(one.kickAge).toBeCloseTo(0.1);
    expect(one.downbeat).toBe(true);
    expect(one.t).toBeCloseTo(4.1);
    expect(heardKick(9.2, 0.5, 0, true).downbeat).toBe(false);
  });

  it('heardKick shifts the kick later by the output latency', () => {
    // Heard at 8.2 - 0.05 / 0.5 = 8.1 beats: 0.05 s after the kick
    expect(heardKick(8.2, 0.5, 0.05, true).kickAge).toBeCloseTo(0.05);
  });

  it('heardKick counts the next and previous kicks across the bar line', () => {
    CONFIG.BEAT_TRACK.KICK.PATTERN = 'oneThree';
    // Beat 10.5 is halfway through beat 3; kicks on beats 8, 10 and 12
    const k = heardKick(10.5, 0.5, 0, true);
    expect(k.kickAge).toBeCloseTo(0.25);
    expect(k.prevKickAge).toBeCloseTo(1.25);
    expect(k.nextKickIn).toBeCloseTo(0.75);
  });

  it('heardKick follows a pattern change at once', () => {
    expect(heardKick(9.1, 0.5, 0, true).kickAge).toBeCloseTo(0.05);
    CONFIG.BEAT_TRACK.KICK.PATTERN = 'oneThree';
    // Beat 9 (beat 2) no longer kicks: the last kick was beat 8
    expect(heardKick(9.1, 0.5, 0, true).kickAge).toBeCloseTo(0.55);
  });

  it('heardKick gives finite "none" values when nothing plays', () => {
    const none = {
      kickAge: 99,
      prevKickAge: 99,
      nextKickIn: 99,
      downbeat: false,
    };
    expect(heardKick(8.2, 0.5, 0, false)).toMatchObject(none);
    CONFIG.BEAT_TRACK.KICK.ENABLED = false;
    expect(heardKick(8.2, 0.5, 0, true)).toMatchObject(none);
  });
});
