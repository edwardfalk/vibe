import { describe, it, expect, vi } from 'vitest';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { BaseEnemy } from '../../js/entities/BaseEnemy.js';

vi.spyOn(console, 'log').mockImplementation(() => {});

// A BeatClock on a fake audio clock, `ms` after its start (500 ms beats)
function clockAt(ms) {
  const ctx = { currentTime: 0 };
  const clock = new BeatClock(120, ctx);
  ctx.currentTime = ms / 1000;
  clock.update(true);
  return { clock, ctx };
}

describe('Beat windows open when the beat lands', () => {
  it('nothing fires in the ~100 ms before a beat', () => {
    const { clock } = clockAt(1450); // 50 ms before beat 4
    for (const b of [1, 2, 3, 4]) expect(clock.isOnBeat([b])).toBe(false);
    expect(clock.canGruntShoot()).toBe(false);
  });

  it('each gate opens just after its own beat', () => {
    expect(clockAt(1510).clock.canGruntShoot()).toBe(true); // beat 4
    expect(clockAt(510).clock.canGruntShoot()).toBe(true); // beat 2
    expect(clockAt(10).clock.canTankShoot()).toBe(true); // beat 1
    expect(clockAt(1010).clock.canTankShoot()).toBe(false); // beat 3
    expect(clockAt(1010).clock.canRusherExplode()).toBe(true); // beat 3
    expect(clockAt(510).clock.canRusherExplode()).toBe(false); // beat 2
  });

  it('the stabber window is the off-beat 3.5, not beat 4', () => {
    expect(clockAt(1260).clock.canStabberAttack()).toBe(true); // 3.5 + 10 ms
    expect(clockAt(1240).clock.canStabberAttack()).toBe(false); // before 3.5
    expect(clockAt(1510).clock.canStabberAttack()).toBe(false); // beat 4
  });

  it('onBeatOnce: once per beat per key, only while open', () => {
    const { clock, ctx } = clockAt(1005); // beat 3 just landed
    const enemy = Object.create(BaseEnemy.prototype);
    expect(enemy.onBeatOnce(clock, 'x', false)).toBe(false); // closed gate
    expect(enemy.onBeatOnce(clock, 'x', true)).toBe(true);
    ctx.currentTime = 1.03; // same window, a frame later
    clock.update(true);
    expect(enemy.onBeatOnce(clock, 'x', true)).toBe(false);
    expect(enemy.onBeatOnce(clock, 'y', true)).toBe(true); // other key
    ctx.currentTime = 1.51; // next beat
    clock.update(true);
    expect(enemy.onBeatOnce(clock, 'x', true)).toBe(true);
  });

  it('ambient speech waits for its gate instead of skipping its turn', () => {
    const enemy = Object.create(BaseEnemy.prototype);
    let gateOpen = false;
    const spoken = [];
    Object.assign(enemy, {
      type: 'grunt',
      ambientSpeechTimer: 0,
      speechCooldown: 0,
      maxSpeechCooldown: 0,
      getAmbientSpeechConfig: () => ({
        lines: ['HI'],
        gate: () => gateOpen,
        chance: 1,
      }),
      getContextValue: (k) =>
        k === 'audio' ? { speak: (_, l) => spoken.push(l) || true } : {},
    });
    enemy.updateAmbientSpeech(16); // timer up, gate closed: wait
    expect(spoken).toEqual([]);
    expect(enemy.ambientSpeechTimer).toBeLessThanOrEqual(0); // still waiting
    gateOpen = true;
    enemy.updateAmbientSpeech(16); // gate opens: one roll
    expect(spoken).toEqual(['HI']);
    expect(enemy.ambientSpeechTimer).toBeGreaterThan(0); // re-armed
  });
});
