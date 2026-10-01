import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMockP5, createMockAudio } from './helpers/enemyMocks.js';
import { Grunt } from '../../js/entities/Grunt.js';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { RhythmFX } from '../../js/RhythmFX.js';

// A real BeatClock on a fake audio clock and a real RhythmFX
function world() {
  const ctx = { currentTime: 0 };
  const clock = new BeatClock(120, ctx);
  const fxContext = { get: (k) => (k === 'beatClock' ? clock : null) };
  const rhythmFX = new RhythmFX(fxContext);
  const floatingText = { addText: vi.fn() };
  const values = {
    audio: createMockAudio(),
    beatClock: clock,
    rhythmFX,
    floatingText,
    enemies: [],
  };
  const context = { get: (k) => values[k] ?? null, set() {} };
  const at = (ms) => {
    ctx.currentTime = ms / 1000;
    clock.update(true);
  };
  return { clock, rhythmFX, floatingText, context, at };
}

// Question marks shown over a grunt through one bar, with the hero at x
function questionMarks(roll, heroXAt) {
  vi.spyOn(Math, 'random').mockReturnValue(roll);
  const { floatingText, context, at } = world();
  const grunt = new Grunt(0, 0, 'grunt', { context }, createMockP5(), null);
  for (let ms = 0; ms < 2000; ms += 10) {
    at(ms);
    grunt.updateSpecificBehavior(heroXAt(ms), 0, 10);
  }
  return floatingText.addText.mock.calls.filter(([, , text]) => text === '?')
    .length;
}

describe('attack warning rings', () => {
  afterEach(() => vi.restoreAllMocks());

  it("a grunt's ring runs through the beat before its shot, not during it", () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // never skip or wander
    const { clock, rhythmFX, context, at } = world();
    const grunt = new Grunt(0, 0, 'grunt', { context }, createMockP5(), null);
    const warnedOn = new Set();
    const add = vi.spyOn(rhythmFX, 'addAttackTelegraph');
    for (let ms = 0; ms < 2000; ms += 10) {
      at(ms);
      add.mockClear();
      grunt.updateSpecificBehavior(150, 0, 10); // in range, not too close
      if (add.mock.calls.length) {
        warnedOn.add(clock.getCurrentBeat());
        expect(add.mock.calls[0][3]).toBeLessThanOrEqual(1);
        expect(add.mock.calls[0][4]).toBe(grunt); // its own ring, not a trail
      }
    }
    // Beats 1 and 3 (0 and 2 counted from 0) warn of the shots on 2 and 4
    expect([...warnedOn].sort()).toEqual([0, 2]);
  });

  it('a warned grunt that holds its fire shows a ? instead', () => {
    // 0.1 is under the 20% skip chance: every shot is skipped
    expect(questionMarks(0.1, () => 150)).toBe(2); // beats 2 and 4
  });

  it('a grunt that fires shows no ?', () => {
    expect(questionMarks(0.99, () => 150)).toBe(0);
  });

  it('a warned grunt the hero ran from shows a ? on its beat', () => {
    // In range through beats 1 and 3, out of range as 2 and 4 land
    const heroX = (ms) => (ms % 1000 < 500 ? 150 : 900);
    expect(questionMarks(0.99, heroX)).toBe(2);
  });

  it('a warning whose fire window was missed shows no ? a bar later', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { floatingText, context, at } = world();
    const grunt = new Grunt(0, 0, 'grunt', { context }, createMockP5(), null);
    for (let ms = 0; ms < 2000; ms += 10) {
      if (ms >= 490 && ms < 620) continue; // hitstop across beat 2's window
      at(ms);
      // In range through beat 1, out of range from beat 3 on
      grunt.updateSpecificBehavior(ms < 1000 ? 150 : 900, 0, 10);
    }
    expect(floatingText.addText).not.toHaveBeenCalled();
  });

  it('a grunt that was never warned shows no ?', () => {
    // Out of range through beat 1, in range only as beat 2 lands
    const heroX = (ms) => (ms % 1000 < 500 ? 900 : 150);
    expect(questionMarks(0.1, heroX)).toBe(0);
  });

  it('keeps one ring per enemy, drawn where the enemy is now', () => {
    const { rhythmFX } = world();
    const enemy = { x: 0, y: 0 };
    rhythmFX.addAttackTelegraph(0, 0, 'grunt', 1, enemy);
    enemy.x = 40; // moved well past the old 5 px match
    rhythmFX.addAttackTelegraph(40, 0, 'grunt', 0.8, enemy);
    expect(rhythmFX.telegraphs).toHaveLength(1);
    enemy.x = 60;
    const drawn = [];
    const p = {
      push() {},
      pop() {},
      noFill() {},
      fill() {},
      stroke() {},
      noStroke() {},
      strokeWeight() {},
      ellipse: (x, y) => drawn.push([x, y]),
    };
    rhythmFX.drawAttackTelegraphs(p, null);
    expect(drawn[0]).toEqual([60, 0]);
  });

  it('goes when its enemy dies', () => {
    const { rhythmFX } = world();
    const enemy = { x: 0, y: 0 };
    rhythmFX.addAttackTelegraph(0, 0, 'tank', 2, enemy);
    enemy.markedForRemoval = true;
    rhythmFX.update(16);
    expect(rhythmFX.telegraphs).toHaveLength(0);
  });
});

describe("the grunt's body shows its shot and its held fire", () => {
  afterEach(() => vi.restoreAllMocks());

  it('fires with a full flash, even late in its fire window', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // never skip or wander
    const { context, at } = world();
    const grunt = new Grunt(0, 0, 'grunt', { context }, createMockP5(), null);
    for (let ms = 0; ms < 500; ms += 10) {
      at(ms);
      grunt.updateSpecificBehavior(150, 0, 10); // warned through beat 1
    }
    // A slow frame: its first update in beat 2 comes 80 ms after it lands.
    // Through update() itself, which must hand the shot on to the game
    at(580);
    grunt.isSpawning = false;
    expect(grunt.update(150, 0, 10)?.owner).toBe('enemy-grunt');
    expect(grunt.pose().flash).toBeGreaterThan(0.9);
  });

  it('sulks through the beat it held its fire on, and is over it by the next', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // under the skip chance
    const { floatingText, context, at } = world();
    const grunt = new Grunt(0, 0, 'grunt', { context }, createMockP5(), null);
    grunt.isSpawning = false;
    // Through update(), which keeps the beat the grunt is drawn at
    for (let ms = 0; ms <= 600; ms += 10) {
      at(ms);
      grunt.update(150, 0, 10);
    }
    expect(floatingText.addText).toHaveBeenCalled(); // the ? of beat 2
    expect(grunt.pose().droop).toBeGreaterThan(0.9);
    at(1010); // beat 3
    grunt.update(150, 0, 10);
    expect(grunt.pose().droop).toBe(0);
  });
});
