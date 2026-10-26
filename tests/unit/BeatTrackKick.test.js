import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BeatTrack, heardKick, heardKickOf } from '../../js/audio/BeatTrack.js';
import { hz } from '../../js/audio/Harmony.js';
import { CONFIG } from '../../js/config.js';
import { fakeAudio } from './helpers/fakeAudio.js';
import { playedKicks, beatsFrom } from './helpers/playedKicks.js';

const original = structuredClone(CONFIG.BEAT_TRACK);
const originalHum = structuredClone(CONFIG.HUM);

// Schedule `eighths` eighth notes 0.25 s apart (8 = one measure) and report
// which beats (0-3) got a kick. `hum` stands in for audio.hum.
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
    currentTime: 0,
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

  it('plays four on the floor by default, with no hum', () => {
    expect(playMeasure()).toEqual([0, 1, 2, 3]);
  });

  it('plays only beats 1 and 3 with the oneThree pattern', () => {
    CONFIG.BEAT_TRACK.KICK.PATTERN = 'oneThree';
    expect(playMeasure()).toEqual([0, 2]);
  });

  it('dips the hum on every beat, kick or not, and turns its breath on each beat 1 by default', () => {
    const setups = [
      () => {},
      () => (CONFIG.BEAT_TRACK.KICK.PATTERN = 'oneThree'),
      () => (CONFIG.BEAT_TRACK.KICK.ENABLED = false),
    ];
    for (const setup of setups) {
      CONFIG.BEAT_TRACK = structuredClone(original);
      setup();
      const hum = { dipAt: vi.fn(), fadeInAt: vi.fn(), breathAt: vi.fn() };
      playMeasure(hum, 16); // two bars
      expect(hum.dipAt.mock.calls).toEqual(
        [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((t) => [t])
      );
      expect(hum.fadeInAt.mock.calls).toEqual([[0], [2]]); // the hum keeps the first
      expect(hum.breathAt.mock.calls).toEqual([
        [0, 2, true],
        [2, 2, false],
      ]); // a bar each way: 4 × 0.5 s
    }
  });

  it('breathes every BREATH_BEATS beats, opening from each half counted from beat 1', () => {
    const breaths = (every) => {
      CONFIG.HUM.BREATH_BEATS = every;
      const hum = { dipAt: vi.fn(), fadeInAt: vi.fn(), breathAt: vi.fn() };
      playMeasure(hum, 16); // two bars
      return hum.breathAt.mock.calls;
    };
    expect(breaths(2)).toEqual([
      [0, 1, true],
      [1, 1, false],
      [2, 1, true],
      [3, 1, false],
    ]);
    expect(breaths(1)).toEqual(
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((t, i) => [t, 0.5, i % 2 === 0])
    );
  });

  it('keeps the breath in its place in the bar when the track starts mid-bar', () => {
    CONFIG.HUM.BREATH_BEATS = 2;
    const track = new BeatTrack({});
    track.hum = { dipAt: vi.fn(), fadeInAt: vi.fn(), breathAt: vi.fn() };
    track._beatSec = 0.5;
    vi.spyOn(track, '_playKick').mockImplementation(() => {});
    // From beat 3 of a bar: it closes over 3-4, then opens from the bar line
    for (let i = 4; i < 12; i++) track._scheduleNote(i * 0.25, i % 8);
    expect(track.hum.breathAt.mock.calls).toEqual([
      [1, 1, false],
      [2, 1, true],
    ]);
    expect(track.hum.fadeInAt.mock.calls).toEqual([[2]]);
  });

  it('keeps every kick when the hum throws on the beat, logging once', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const fail = () => {
        throw new Error('hum');
      };
      const hum = { dipAt: fail, fadeInAt: fail, breathAt: fail };
      expect(playMeasure(hum)).toEqual([0, 1, 2, 3]);
      expect(error).toHaveBeenCalledTimes(1);
    } finally {
      error.mockRestore();
    }
  });

  it("ends the tuned kick on the hum's root", () => {
    CONFIG.HUM.DRIFT_CENTS = 0;
    CONFIG.HUM.ROOT = 'F#';
    expect(kickEndHz()).toBeCloseTo(46.249, 3);
    CONFIG.HUM.ROOT = 'A';
    expect(kickEndHz()).toBeCloseTo(55, 3);
  });

  it('takes the drift at the moment the tuned kick starts, with SOUNDS_DRIFT', () => {
    CONFIG.HUM.DRIFT_CENTS = 9;
    CONFIG.HUM.SOUNDS_DRIFT = true;
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

  it('keeps the kicks it plays, from the scheduler: when, and which were beat 1; muted too', () => {
    vi.useFakeTimers();
    try {
      const { ctx } = fakeAudio({ currentTime: 10.2 });
      const clock = { audioContext: ctx, startTime: 1234, beatInterval: 500 };
      const track = new BeatTrack({ get: (k) => ({ beatClock: clock })[k] });
      Object.assign(track, {
        ctx,
        masterGain: { gain: { value: 1 } },
        isPlaying: true,
      });
      // The sky follows the kick's schedule, not its loudness
      track.setMuted(true);
      track._scheduler();
      for (let i = 0; i < 80; i++) {
        ctx.currentTime += 0.025;
        vi.advanceTimersByTime(25);
      }
      track.isPlaying = false;
      // Beats 18-22 of the grid from 1.234 s, booked up to 75 ms ahead of
      // 12.2 s; beat 20 is a bar's beat 1
      expect(track.kicks.map((k) => [+k.at.toFixed(6), k.downbeat])).toEqual([
        [10.234, false],
        [10.734, false],
        [11.234, true],
        [11.734, false],
        [12.234, false],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a late kick from when it starts, none that failed to, and the last 8', () => {
    const { ctx } = fakeAudio({ currentTime: 10.03 });
    const track = new BeatTrack({});
    Object.assign(track, { ctx, masterGain: {} });
    track._playKick(10, true); // 30 ms late: Web Audio starts it now
    expect(track.kicks).toEqual([{ at: 10.03, downbeat: true }]);
    const make = ctx.createOscillator;
    ctx.createOscillator = () => {
      throw new Error('boom');
    };
    expect(() => track._playKick(10.5)).toThrow('boom');
    expect(track.kicks).toHaveLength(1);
    ctx.createOscillator = make;
    for (let i = 0; i < 10; i++) track._playKick(11 + i * 0.5);
    expect(track.kicks).toHaveLength(8);
    expect(track.kicks[0].at).toBe(12);
  });

  // The kicks played on `beats` of a grid from 0 (0.5 s a beat), the track
  // come to `until` beats
  const booked = (beats, until = Math.max(...beats) + 0.5) => ({
    kicks: playedKicks(beats),
    originSec: 0,
    until: until * 0.5,
  });

  it('heardKick reports the last kick played and whether it was beat 1', () => {
    // Beat 8 is beat 1 of the third bar; 0.2 beats = 0.1 s later
    const one = heardKick(8.2, 0.5, 0, booked(beatsFrom(4, 9)));
    expect(one.kickAge).toBeCloseTo(0.1);
    expect(one.prevKickAge).toBeCloseTo(0.6);
    expect(one.downbeat).toBe(true);
    expect(one.t).toBeCloseTo(4.1);
    expect(heardKick(9.2, 0.5, 0, booked(beatsFrom(4, 9))).downbeat).toBe(
      false
    );
  });

  it('heardKick shifts the kick later by the audio latency', () => {
    // Heard at 8.2 - 0.05 / 0.5 = 8.1 beats: 0.05 s after the kick
    const k = heardKick(8.2, 0.5, 0.05, booked(beatsFrom(4, 9)));
    expect(k.kickAge).toBeCloseTo(0.05);
  });

  it('heardKick counts the next and previous kicks across the bar line', () => {
    CONFIG.BEAT_TRACK.KICK.PATTERN = 'oneThree';
    // Beat 10.5 is halfway through beat 3; kicks on beats 8, 10 and 12
    const k = heardKick(10.5, 0.5, 0, booked([6, 8, 10]));
    expect(k.kickAge).toBeCloseTo(0.25);
    expect(k.prevKickAge).toBeCloseTo(1.25);
    expect(k.nextKickIn).toBeCloseTo(0.75);
  });

  it('heardKick keeps a kick played when the pattern changes, and never shows one skipped', () => {
    expect(heardKick(9.1, 0.5, 0, booked([8, 9])).kickAge).toBeCloseTo(0.05);
    CONFIG.BEAT_TRACK.KICK.PATTERN = 'oneThree';
    expect(heardKick(9.1, 0.5, 0, booked([8, 9])).kickAge).toBeCloseTo(0.05);
    // A beat the track skipped (a pattern change, a stall): beat 8's
    CONFIG.BEAT_TRACK.KICK.PATTERN = 'four';
    expect(heardKick(9.1, 0.5, 0, booked([8, 10])).kickAge).toBeCloseTo(0.55);
  });

  it('heardKick shows no kick before the first one plays (the phantom pulse on the first key press)', () => {
    const k = heardKick(8.2, 0.5, 0, booked([], -Infinity));
    expect(k).toMatchObject({ kickAge: 99, prevKickAge: 99, downbeat: false });
    expect(k.nextKickIn).toBeCloseTo(0.4); // the pattern's next, beat 9
  });

  it('heardKick across a restart: no kick added or lost, and the accent each was played with', () => {
    CONFIG.BEAT_TRACK.KICK.PATTERN = 'oneThree';
    // Played on old beats 6 and 8 (beat 1); the restart moved beat 1 to old
    // beat 7 (3.5 s), where the pattern would put a kick that never played
    const b = {
      kicks: [
        { at: 3, downbeat: false },
        { at: 4, downbeat: true },
      ],
      originSec: 3.5,
      until: 4.25,
    };
    const k = heardKick(1.2, 0.5, 0, b); // heard at 4.1 s
    expect(k.kickAge).toBeCloseTo(0.1);
    expect(k.prevKickAge).toBeCloseTo(1.1);
    expect(k.downbeat).toBe(true);
    // the pattern's next on the new grid, its beat 3 at 4.5 s
    expect(k.nextKickIn).toBeCloseTo(0.4);
  });

  it("heardKick's next kick: the next booked, else the pattern's on a beat the track hasn't come to", () => {
    expect(heardKick(8.5, 0.5, 0, booked([8, 9])).nextKickIn).toBeCloseTo(0.25);
    CONFIG.BEAT_TRACK.KICK.ENABLED = false; // a booked kick plays anyway
    expect(heardKick(8.5, 0.5, 0, booked([8, 9])).nextKickIn).toBeCloseTo(0.25);
    CONFIG.BEAT_TRACK.KICK.ENABLED = true;
    // The track came through beat 9 kicking oneThree, then four: not beat 9
    const k = heardKick(8.5, 0.5, 0, booked([8], 9.5));
    expect(k.nextKickIn).toBeCloseTo(0.75);
    // nor a grid beat a hair past its last note (a restart's rounding)
    const hair = heardKick(8.5, 0.5, 0, booked([8], 9 - 1e-13));
    expect(hair.nextKickIn).toBeCloseTo(0.75);
  });

  it("heardKick's next kick has the accent it was booked with, across a restart too", () => {
    // Booked as an ordinary beat at 4.5 s; a restart made 4.5 s a beat 1
    const b = {
      kicks: [
        { at: 4, downbeat: true },
        { at: 4.5, downbeat: false },
      ],
      originSec: 4.5,
      until: 4.5,
    };
    const k = heardKick(-0.8, 0.5, 0, b); // heard at 4.1 s
    expect(k.nextKickIn).toBeCloseTo(0.4);
    expect(k.nextDownbeat).toBe(false);
    // Forecast, the grid's: beat 12 is a bar's beat 1, beat 9 isn't
    expect(heardKick(11.5, 0.5, 0, booked([], -Infinity)).nextDownbeat).toBe(
      true
    );
    expect(heardKick(8.5, 0.5, 0, booked([], -Infinity)).nextDownbeat).toBe(
      false
    );
  });

  it("heardKickOf reads the track's record, its grid from the clock and how far it has come", () => {
    const clock = { startTime: 1000, beatInterval: 500 }; // the grid from 1 s
    const track = {
      isPlaying: true,
      ctx: { state: 'running' },
      kicks: playedKicks([8], 0.5, 1),
      _lastNoteSec: 1 + 9.5 * 0.5, // come through beat 9 without a kick
      getContextValue: (k) => (k === 'beatClock' ? clock : null),
    };
    const k = heardKickOf(track, 8.5, 0.5);
    expect(k.kickAge).toBeCloseTo(0.25 - CONFIG.SKY.OFFSET_MS / 1000);
    expect(k.nextKickIn).toBeCloseTo(0.75 + CONFIG.SKY.OFFSET_MS / 1000);
  });

  it('heardKick gives finite "none" values when nothing plays', () => {
    const none = {
      kickAge: 99,
      prevKickAge: 99,
      nextKickIn: 99,
      downbeat: false,
      nextDownbeat: false,
    };
    expect(heardKick(8.2, 0.5, 0, null)).toMatchObject(none);
    CONFIG.BEAT_TRACK.KICK.ENABLED = false;
    expect(heardKick(8.2, 0.5, 0, booked([], -Infinity))).toMatchObject(none);
    // and a kick long gone is none too
    expect(heardKick(800, 0.5, 0, booked([8])).kickAge).toBe(99);
  });
});
