import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../../js/entities/player.js';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { CONFIG } from '../../js/config.js';

// His feet land on his eighths: swung, with his fire, while a bassist is
// about (the bassist spec, Timing)
const p = {
  color: () => ({}),
  keyIsDown: () => false,
  constrain: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
  cos: Math.cos,
  sin: Math.sin,
  mouseX: 0,
  mouseY: 0,
};

function walker({ swing }) {
  globalThis.window = { playerIsShooting: false };
  const ahead = CONFIG.BEAT_CLOCK.AHEAD_MS / 1000;
  const ctx = { currentTime: 0 };
  const clock = new BeatClock(120, ctx);
  clock.startTime = 0;
  clock.wantSwing(swing);
  const to = (beats) => {
    ctx.currentTime = beats * 0.5 - ahead;
    clock.update(true);
  };
  to(4.01); // a new bar takes the swing
  const player = new Player(p, 100, 100, null, {
    playerBullets: [],
    beatClock: clock,
  });
  player.isMoving = true;
  return { player, to };
}

describe("the hero's stride", () => {
  const and = CONFIG.SWING.AND_AT;
  beforeEach(() => {
    CONFIG.SWING.AND_AT = 2 / 3;
  });

  it('swung: a step from the beat to the let, and from the let to the beat', () => {
    const { player } = walker({ swing: true });
    expect(player.poseAt(4 + 1 / 3).stepPhase).toBeCloseTo(0.5, 9);
    expect(player.poseAt(4 + 1 / 3).stepFoot).toBe(0);
    const atLet = player.poseAt(4 + 2 / 3 + 1e-9);
    expect(atLet.stepFoot).toBe(1);
    expect(atLet.stepPhase).toBeCloseTo(0, 6);
    expect(player.poseAt(4 + 5 / 6).stepPhase).toBeCloseTo(0.5, 9);
    CONFIG.SWING.AND_AT = and;
  });

  it('straight: as today', () => {
    const { player } = walker({ swing: false });
    expect(player.poseAt(4.25).stepPhase).toBeCloseTo(0.5, 9);
    expect(player.poseAt(4.5 + 1e-9).stepFoot).toBe(1);
  });

  it('a foot lands, and cracks, on the beat and on the let', () => {
    const { player, to } = walker({ swing: true });
    for (let b = 4.02; b < 6; b += 1 / 30) {
      to(b);
      player.keepPoseBeats();
      player.recordFootfall();
    }
    const at = player.footfalls.map((f) => f.at);
    const want = [4 + 2 / 3, 5, 5 + 2 / 3];
    expect(at).toHaveLength(want.length);
    at.forEach((a, i) => expect(a).toBeCloseTo(want[i], 9));
    expect(player.footfalls.map((f) => f.foot)).toEqual([1, 0, 1]);
  });
});
