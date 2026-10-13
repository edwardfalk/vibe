import { describe, it, expect, vi, afterEach } from 'vitest';
import { CONFIG } from '../../js/config.js';
import { drawInk, drawInkWait } from '../../js/entities/BassistInk.js';
import {
  EnemyDeathHandler,
  popTime,
} from '../../js/systems/combat/EnemyDeathHandler.js';
import { bassistWorld } from './helpers/bassistWorld.js';
import { transformP5 } from './helpers/transformP5.js';

// What a bassist's death hands its picture each frame (BassistInk.js's
// drawInk and drawInkWait, stood in for here): its age from the start as
// heard, the time since the kill, his scale as it is now
vi.mock('../../js/entities/BassistInk.js', () => ({
  drawInk: vi.fn(() => true),
  drawInkWait: vi.fn(),
}));

const LOOK = { ...CONFIG.BASSIST_LOOK };
afterEach(() => {
  Object.assign(CONFIG.BASSIST_LOOK, LOOK);
  vi.clearAllMocks();
});

const LATENCY = 0.03; // the output's, s
function killed(blow = null) {
  const explosionManager = { fragmentExplosions: [] };
  const w = bassistWorld({ ms0: 4100, values: { explosionManager } });
  w.audio.ensureAudioContext = vi.fn();
  w.audio.playBassistDeath = vi.fn();
  w.audio.audioContext = { baseLatency: 0, outputLatency: LATENCY };
  const diedAt = w.clock.nowSec();
  new EnemyDeathHandler(w.context).handleEnemyDeath(w.b, 'bassist', 0, 0, blow);
  const [death] = explosionManager.fragmentExplosions;
  const at = w.audio.playBassistDeath.mock.calls[0][2];
  let now = diedAt;
  death.now = () => now;
  const { p } = transformP5();
  const drawAt = (t) => {
    now = t;
    death.draw(p);
  };
  return { w, death, at, diedAt, drawAt };
}

describe('the frame his death draws from', () => {
  it('reaches each jet of his scroll at its start as heard plus its offset, as its sound is booked at its start plus the same', () => {
    for (const blow of [null, { bomb: true, at: 2.62, dir: 0 }]) {
      const { death, at, drawAt } = killed(blow);
      expect(death.startsAt).toBeCloseTo(
        at + LATENCY + CONFIG.SKY.OFFSET_MS / 1000,
        9
      );
      for (const offset of death.record.jets) {
        drawAt(death.startsAt + offset);
        expect(drawInk.mock.calls.at(-1)[1].age).toBeCloseTo(offset, 9);
      }
    }
  });

  it('a shot kill starts on the next eighth, as heard', () => {
    const { death, diedAt, w } = killed();
    expect(death.startsAt - LATENCY - CONFIG.SKY.OFFSET_MS / 1000).toBeCloseTo(
      popTime(diedAt, w.clock),
      9
    );
  });

  it('waits trembling: the time since the kill runs on through the wait', () => {
    const { death, diedAt, drawAt } = killed();
    expect(death.startsAt).toBeGreaterThan(diedAt + 0.05);
    drawAt(diedAt + 0.01);
    drawAt(diedAt + 0.04);
    const [first, second] = drawInkWait.mock.calls.map((c) => c[1].since);
    expect(first).toBeCloseTo(0.01, 9);
    expect(second).toBeCloseTo(0.04, 9);
  });

  it('draws him at his scale as it is now, not as it was at the kill', () => {
    const { death, drawAt } = killed();
    CONFIG.BASSIST_LOOK.ART_SCALE = 1.7;
    drawAt(death.startsAt + 0.2);
    expect(drawInk.mock.calls.at(-1)[1].scale).toBe(1.7);
  });
});
