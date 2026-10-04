import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BeatTrack, heardKick } from '../../js/audio/BeatTrack.js';
import { hz } from '../../js/audio/Harmony.js';
import { CONFIG } from '../../js/config.js';

const original = structuredClone(CONFIG.BEAT_TRACK);
const originalHum = structuredClone(CONFIG.HUM);

// Schedule `eighths` eighth notes 0.25 s apart (8 = one measure) and report
// which beats (0-3) got a kick. `hum` stands in for audio.hum; without one
// the track schedules as it does in the voice playground.
function playMeasure(hum = null, eighths = 8) {
  const track = new BeatTrack({});
  track.hum = hum;
  track._beatSec = 0.5;
  const kicks = [];
  vi.spyOn(track, '_playKick').mockImplementation(() => {
    kicks.push(track._beat);
  });
  for (let i = 0; i < eighths; i++) {
    track._beat = (i % 8) / 2;
    track._scheduleNote(i * 0.25, i % 8);
  }
  return kicks;
}

// A BeatTrack on a fake AudioContext that records which node connects to
// which (edges) and where each kick's pitch drop ends (ends)
function fakeKick() {
  const edges = [];
  const ends = [];
  const param = (onRamp = () => {}) => ({
    setValueAtTime() {},
    exponentialRampToValueAtTime: onRamp,
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
      node('osc', {
        frequency: param((value) => ends.push(value)),
        start() {},
        stop() {},
      }),
    createGain: () => node('gain', { gain: param() }),
    createWaveShaper: () => node('shaper'),
  };
  track.masterGain = node('master');
  return { track, edges, ends };
}

// Where a kick at audio time 2 ends its pitch drop
function kickEndHz() {
  const { track, ends } = fakeKick();
  track._playKick(2);
  return ends[0];
}

describe('BeatTrack kick', () => {
  beforeEach(() => {
    CONFIG.BEAT_TRACK = structuredClone(original);
    CONFIG.HUM = structuredClone(originalHum);
  });
  afterEach(() => {
    CONFIG.BEAT_TRACK = structuredClone(original);
    CONFIG.HUM = structuredClone(originalHum);
  });

  it('plays four on the floor by default, with no hum as in the voice playground', () => {
    expect(playMeasure()).toEqual([0, 1, 2, 3]);
  });

  it('plays only beats 1 and 3 with the oneThree pattern', () => {
    CONFIG.BEAT_TRACK.KICK.PATTERN = 'oneThree';
    expect(playMeasure()).toEqual([0, 2]);
  });

  it('dips the hum on every beat, kick or not, and turns its breath on each beat 1', () => {
    const setups = [
      () => {},
      () => (CONFIG.BEAT_TRACK.KICK.PATTERN = 'oneThree'),
      () => (CONFIG.BEAT_TRACK.KICK.ENABLED = false),
    ];
    for (const setup of setups) {
      CONFIG.BEAT_TRACK = structuredClone(original);
      setup();
      const hum = { dipAt: vi.fn(), barAt: vi.fn() };
      playMeasure(hum, 16); // two bars
      expect(hum.dipAt.mock.calls).toEqual(
        [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((t) => [t])
      );
      expect(hum.barAt.mock.calls).toEqual([
        [0, 2],
        [2, 2],
      ]); // a bar: 4 × 0.5 s
    }
  });

  it("ends the tuned kick on the hum's root", () => {
    CONFIG.HUM.DRIFT_CENTS = 0;
    CONFIG.HUM.ROOT = 'F#';
    expect(kickEndHz()).toBeCloseTo(46.249, 3);
    CONFIG.HUM.ROOT = 'A';
    expect(kickEndHz()).toBeCloseTo(55, 3);
  });

  it('takes the drift at the moment the tuned kick starts', () => {
    CONFIG.HUM.DRIFT_CENTS = 9;
    expect(kickEndHz()).toBeCloseTo(hz(['1', 1], 2), 9);
    expect(kickEndHz()).not.toBeCloseTo(hz(['1', 1], 0), 3);
  });

  it('ends the untuned kick on PITCH_END_HZ, as before', () => {
    CONFIG.BEAT_TRACK.KICK.TUNED = false;
    CONFIG.BEAT_TRACK.KICK.PITCH_END_HZ = 45;
    expect(kickEndHz()).toBe(45);
  });

  it('plays the kick on PITCH_END_HZ if the root is bad, logging once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      CONFIG.HUM.ROOT = 'H';
      const { track, ends } = fakeKick();
      track._playKick(2);
      track._playKick(2.5);
      const { PITCH_END_HZ } = CONFIG.BEAT_TRACK.KICK;
      expect(ends).toEqual([PITCH_END_HZ, PITCH_END_HZ]);
      expect(error).toHaveBeenCalledTimes(1);
    } finally {
      error.mockRestore();
    }
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
    // The kick's wiring, on fakeKick's AudioContext
    function kickWiring() {
      const { track, edges } = fakeKick();
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

  it('can switch the kick off', () => {
    CONFIG.BEAT_TRACK.KICK.ENABLED = false;
    expect(playMeasure()).toEqual([]);
  });

  it('heardKick reports the last kick and whether it was beat 1', () => {
    // Beat 8 is beat 1 of the third bar; 0.2 beats = 0.1 s later
    const one = heardKick(8.2, 0.5, 0, true);
    expect(one.kickAge).toBeCloseTo(0.1);
    expect(one.downbeat).toBe(true);
    expect(one.t).toBeCloseTo(4.1);
    expect(heardKick(9.2, 0.5, 0, true).downbeat).toBe(false);
  });

  it('heardKick shifts the kick later by the audio latency', () => {
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
