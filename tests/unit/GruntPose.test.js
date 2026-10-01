import { describe, it, expect } from 'vitest';
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

describe('the grunt dances on the beat', () => {
  it('hops on 2 and 4, its snare, and not on 1 and 3', () => {
    const half = CONFIG.GRUNT_LOOK.HOP_PX * 0.5;
    expect(poseAt(1, 0.15).hop).toBeGreaterThan(half);
    expect(poseAt(3, 0.15).hop).toBeGreaterThan(half);
    expect(poseAt(0, 0.15).hop).toBe(0);
    expect(poseAt(2, 0.15).hop).toBe(0);
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
