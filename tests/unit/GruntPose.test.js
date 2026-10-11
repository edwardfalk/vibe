import { describe, it, expect, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import {
  GRUNT_COLORS,
  gruntPose,
  nextFacing,
} from '../../js/entities/GruntRenderer.js';

// The pose at a beat in the bar (0..3, so 1 and 3 are beats 2 and 4) and a
// phase through it, a few bars in, with neutral defaults
const poseAt = (beat, phase, o = {}) =>
  gruntPose({
    beats: 16 + beat + phase,
    beatSec: 0.5,
    seed: 0.3,
    aimAngle: 0,
    facing: 1,
    size: 30,
    ...o,
  });
const brightness = (rgb) => rgb[0] + rgb[1] + rgb[2];
const DEFAULTS = { ...CONFIG.GRUNT_LOOK };
afterEach(() => {
  Object.assign(CONFIG.GRUNT_LOOK, DEFAULTS);
});

describe('the grunt dances on the beat', () => {
  it('hops on 2 and 4, its snare, and not on 1 and 3', () => {
    // A shot on the snare it hops on (0.15 beats ago, as the snare landed)
    const half = CONFIG.GRUNT_LOOK.HOP_PX * 0.5;
    expect(poseAt(1, 0.15, { sinceShot: 0.15 }).hop).toBeGreaterThan(half);
    expect(poseAt(3, 0.15, { sinceShot: 0.15 }).hop).toBeGreaterThan(half);
    expect(poseAt(0, 0.15).hop).toBe(0);
    expect(poseAt(2, 0.15).hop).toBe(0);
  });

  it('does the full dance when it fires on the snare, a small one and slumps back when not', () => {
    const fires = poseAt(1, 0.15, { sinceShot: 0.15 });
    const idle = poseAt(1, 0.15);
    expect(fires.hop).toBeGreaterThan(CONFIG.GRUNT_LOOK.HOP_PX * 0.9);
    expect(idle.hop).toBeGreaterThan(0);
    expect(idle.hop).toBeCloseTo(fires.hop * CONFIG.GRUNT_LOOK.IDLE_DANCE);
    expect(idle.thrust).toBeLessThan(fires.thrust);
    expect(idle.back).toBeLessThan(0); // it slumps back from its target
  });

  it('counts only a shot on this snare, not the one before', () => {
    // Fired on the previous snare, two beats earlier
    const old = poseAt(3, 0.15, { sinceShot: 2.15 });
    expect(old.hop).toBeCloseTo(poseAt(3, 0.15).hop);
  });

  it('does not hop at all when it does not fire, with IDLE_DANCE 0', () => {
    CONFIG.GRUNT_LOOK.IDLE_DANCE = 0;
    expect(poseAt(1, 0.15).hop).toBe(0);
    expect(poseAt(1, 0.15, { sinceShot: 0.15 }).hop).toBeGreaterThan(0);
  });

  it('leans right on 1 and left on 3', () => {
    CONFIG.GRUNT_LOOK.WANDER_RAD = 0; // only the dance leans
    // A positive turn is clockwise on screen: its top goes right
    expect(poseAt(0, 0).lean).toBeCloseTo(CONFIG.GRUNT_LOOK.LEAN_RAD);
    expect(poseAt(2, 0).lean).toBeCloseTo(-CONFIG.GRUNT_LOOK.LEAN_RAD);
  });
});

describe('the grunt winds up, fires and sulks', () => {
  it('lights amber through the first half of the warning beat, then white-hot, its gun true', () => {
    const calm = poseAt(0, 0.3);
    const early = poseAt(0, 0.3, { warn: 0.3 });
    const late = poseAt(0, 0.7, { warn: 0.7 });
    expect(calm.bob).toEqual(GRUNT_COLORS.bobble);
    expect(early.bob).not.toEqual(GRUNT_COLORS.bobble);
    // A step in brightness, not only in hue, for colour-blind players
    expect(brightness(late.bob)).toBeGreaterThan(brightness(early.bob) + 150);
    expect(late.back).toBeLessThan(0); // it leans back from its target
    expect(early.gunWobble).toBe(0);
    expect(late.gunWobble).toBe(0);
    expect(calm.gunWobble).not.toBe(0); // it does wobble otherwise
  });

  it('is rocked back by its own shot, its gun true', () => {
    const shot = poseAt(1, 0.02, { sinceShot: 0.02 });
    const calm = poseAt(1, 0.02);
    expect(shot.back).toBeLessThan(
      calm.back - CONFIG.GRUNT_LOOK.TUMBLE_RAD * 0.5
    );
    expect(shot.recoil).toBeGreaterThan(0);
    expect(shot.flash).toBeGreaterThan(0.8);
    expect(shot.gunWobble).toBe(0);
  });

  it('sulks through most of the beat it held its fire on', () => {
    expect(poseAt(1, 0.1, { sulk: 0.1 }).droop).toBeCloseTo(1);
    expect(poseAt(1, 0.8, { sulk: 0.8 }).droop).toBeCloseTo(1);
    expect(poseAt(1, 0.8).droop).toBe(0);
  });

  it('a wind-up always wins over a sulk', () => {
    const both = poseAt(0, 0.7, { warn: 0.7, sulk: 0.2 });
    expect(both.droop).toBe(0);
    expect(both.bob).toEqual(poseAt(0, 0.7, { warn: 0.7 }).bob);
  });
});

describe('the grunt faces its target and never turns upside down', () => {
  it('aims its gun true in its mirrored frame, never folded', () => {
    const left = poseAt(0, 0, { aimAngle: Math.PI - 0.3, facing: -1 });
    expect(left.face).toBe(-1);
    expect(left.aim).toBeCloseTo(0.3);
    // Inside the dead band, still facing right: the gun points up-left, true
    const pastUp = poseAt(0, 0, { aimAngle: -Math.PI / 2 - 0.1, facing: 1 });
    expect(pastUp.aim).toBeCloseTo(-Math.PI / 2 - 0.1);
  });

  it('does not flicker while its target hovers straight above it', () => {
    // Its idle jitter makes the aim cross straight up every few frames
    let facing = 1;
    let turns = 0;
    for (let i = 0; i < 40; i++) {
      const next = nextFacing(facing, -Math.PI / 2 + (i % 2 ? 0.05 : -0.05));
      if (next !== facing) turns++;
      facing = next;
    }
    expect(turns).toBe(0);
  });

  it('flips once as its target crosses straight above it', () => {
    let facing = 1;
    let turns = 0;
    for (let i = 0; i <= 100; i++) {
      // From up-right to up-left, jittering as it goes
      const aim = -Math.PI / 2 + 0.5 - i * 0.01 + (i % 2 ? 0.05 : -0.05);
      const next = nextFacing(facing, aim);
      if (next !== facing) turns++;
      facing = next;
    }
    expect(turns).toBe(1);
    expect(facing).toBe(-1);
  });
});

describe('what the grunt sounds shows', () => {
  // A chatter or a move call on the snare it is in, `beats` ago
  const squeak = (beats, o = {}) =>
    poseAt(1, beats, { sinceChatter: beats, chatterVoice: 'squeak', ...o });
  const whine = (beats) =>
    poseAt(1, beats, { sinceChatter: beats, chatterVoice: 'whine' });
  const call = (heading, beats, o = {}) =>
    poseAt(1, beats, { sinceCall: beats, call: heading, ...o });
  const beatsOf = (sec) => sec / 0.5;

  it('spins round once as it squeaks, fast at first and slowing to a stop', () => {
    const { SPIN_SEC } = CONFIG.GRUNT_LOOK;
    expect(squeak(0).turn).toBeCloseTo(1);
    // Half way round it faces away, a third of the way into its time
    const away = beatsOf(SPIN_SEC * (1 - Math.SQRT1_2));
    expect(squeak(away).turn).toBeCloseTo(-1);
    expect(squeak(beatsOf(SPIN_SEC * 0.9)).turn).toBeGreaterThan(0.9);
    // Edge-on it is still a blob, never a line
    for (let i = 0; i < 40; i++) {
      expect(
        Math.abs(squeak(beatsOf((SPIN_SEC * i) / 40)).turn)
      ).toBeGreaterThan(0.25);
    }
    expect(squeak(beatsOf(SPIN_SEC)).turn).toBe(1);
    expect(poseAt(1, away).turn).toBe(1); // no chatter, no spin
    expect(whine(away).turn).toBe(1);
  });

  it('never spins while it aims, so its gun stays true', () => {
    const away = beatsOf(CONFIG.GRUNT_LOOK.SPIN_SEC * (1 - Math.SQRT1_2));
    expect(squeak(away, { sinceShot: away }).turn).toBe(1);
    expect(squeak(away, { warn: 0.2 }).turn).toBe(1);
  });

  it('hops in full as it squeaks and does not slump; a whine keeps the small hop', () => {
    const fires = poseAt(1, 0.15, { sinceShot: 0.15 });
    expect(squeak(0.15).hop).toBeCloseTo(fires.hop);
    expect(squeak(0.15).back).toBe(0);
    expect(whine(0.15).hop).toBeCloseTo(poseAt(1, 0.15).hop);
    // A squeak on the snare before counts no more than a shot does
    const old = poseAt(3, 0.15, { sinceChatter: 2.15, chatterVoice: 'squeak' });
    expect(old.hop).toBeCloseTo(poseAt(3, 0.15).hop);
  });

  it('stretches up as it whines, trembling with it, and relaxes once it ends', () => {
    const { WHINE_STRETCH } = CONFIG.GRUNT_LOOK;
    // Against a grunt that doesn't chatter: the same small hop and dance
    const taller = (beats) => poseAt(1, beats).squash - whine(beats).squash;
    expect(taller(0)).toBeCloseTo(0);
    const through = Array.from({ length: 9 }, (_, i) => taller(0.15 + i / 40));
    expect(Math.min(...through)).toBeGreaterThan(WHINE_STRETCH * 0.5);
    // It trembles: up and down by more than a third of its stretch
    expect(Math.max(...through) - Math.min(...through)).toBeGreaterThan(
      WHINE_STRETCH * 0.35
    );
    expect(taller(beatsOf(0.4))).toBeCloseTo(0);
    CONFIG.GRUNT_LOOK.WHINE_STRETCH = 0; // its knob reaches it live
    expect(taller(0.2)).toBeCloseTo(0);
  });

  it('leans at the hero with its jet in full as its swarm calls an advance', () => {
    const before = poseAt(1, 0.1);
    const lunge = call('advance', 0.1);
    expect(lunge.back - before.back).toBeGreaterThan(
      CONFIG.GRUNT_LOOK.CALL_LEAN_RAD * 0.5
    );
    expect(lunge.thrust).toBeGreaterThan(before.thrust);
  });

  it('leans back from the hero and cowers as its swarm calls a retreat', () => {
    const before = poseAt(1, 0.1);
    const flinch = call('retreat', 0.1);
    expect(before.back - flinch.back).toBeGreaterThan(
      CONFIG.GRUNT_LOOK.CALL_LEAN_RAD * 0.5
    );
    expect(flinch.squash).toBeGreaterThan(before.squash);
  });

  it('leans with its swarm only for a moment, and not when it fires', () => {
    expect(call('advance', 1.5).back).toBe(poseAt(1, 1.5).back);
    expect(call('advance', 0.1, { sinceShot: 0.1 })).toEqual(
      poseAt(1, 0.1, { sinceShot: 0.1 })
    );
    expect(poseAt(1, 0.1, { sinceCall: 0.1 })).toEqual(poseAt(1, 0.1));
    CONFIG.GRUNT_LOOK.CALL_LEAN_RAD = 0; // its knob reaches it live
    expect(call('retreat', 0.1).back).toBeCloseTo(poseAt(1, 0.1).back);
  });
});
