import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMockP5, createMockAudio } from './helpers/enemyMocks.js';
import { Grunt } from '../../js/entities/Grunt.js';
import { BeatClock } from '../../js/audio/BeatClock.js';
import { RhythmFX } from '../../js/RhythmFX.js';
import { GruntSwarm } from '../../js/systems/GruntSwarm.js';

// A real BeatClock on a fake audio clock and a real RhythmFX, and a grunt in
// a swarm of one at (0, 0): the swarm picks and settles before he updates
function world() {
  const ctx = { currentTime: 0 };
  const clock = new BeatClock(120, ctx);
  const fxContext = { get: (k) => (k === 'beatClock' ? clock : null) };
  const rhythmFX = new RhythmFX(fxContext);
  const floatingText = { addText: vi.fn() };
  const enemies = [];
  const values = {
    audio: createMockAudio(),
    beatClock: clock,
    rhythmFX,
    floatingText,
    enemies,
  };
  const context = { get: (k) => values[k] ?? null, set() {} };
  const at = (ms) => {
    ctx.currentTime = ms / 1000;
    clock.update(true);
  };
  const swarm = new GruntSwarm({ size: 1, x: 0, y: 0 });
  const grunt = new Grunt(0, 0, 'grunt', { context }, createMockP5(), null);
  grunt.swarm = swarm;
  grunt.isSpawning = false;
  enemies.push(grunt);
  // One frame: the swarm, then the grunt, the hero at (heroX, 0); the grunt
  // stays put
  const frame = (heroX) => {
    swarm.update(enemies, { x: heroX, y: 0 }, clock);
    grunt.velocity = { x: 0, y: 0 };
    return grunt.updateSpecificBehavior(heroX, 0, 10);
  };
  return {
    clock,
    rhythmFX,
    floatingText,
    context,
    at,
    grunt,
    enemies,
    frame,
    swarm,
  };
}

// One bar of the grunt, the hero at x: the question marks shown over him,
// the shots he fired and the frames his ring was drawn in
function oneBar(heroXAt, blockerAt = () => null) {
  vi.spyOn(Math, 'random').mockReturnValue(0.99); // no chatter
  const { floatingText, rhythmFX, at, enemies, frame, grunt } = world();
  const add = vi.spyOn(rhythmFX, 'addAttackTelegraph');
  const blocker = { x: 0, y: 0, markedForRemoval: false };
  let shots = 0;
  for (let ms = 0; ms < 2000; ms += 10) {
    at(ms);
    const spot = blockerAt(ms);
    enemies.length = 1;
    if (spot) enemies.push(Object.assign(blocker, spot));
    grunt.aimAngle = 0; // at the hero, to his right
    if (frame(heroXAt(ms))) shots++;
  }
  const marks = floatingText.addText.mock.calls.filter(
    ([, , text]) => text === '?'
  ).length;
  return { marks, shots, rings: add.mock.calls.length };
}
const questionMarks = (...args) => oneBar(...args).marks;

describe('his line of fire', () => {
  // Another enemy `deg` degrees off his aim and `d` px away; the grunt at
  // (0, 0) aims along +x
  const blockedBy = (deg, d, extra = {}) => {
    const { grunt, enemies } = world();
    grunt.aimAngle = 0;
    const a = (deg * Math.PI) / 180;
    enemies.push({
      x: d * Math.cos(a),
      y: d * Math.sin(a),
      markedForRemoval: false,
      ...extra,
    });
    return grunt.lineBlocked();
  };

  it('is blocked by another enemy within 20° of his aim and 400 px, by no one else', () => {
    // alone, aiming along +x as every enemy is born: never in his own way
    expect(world().grunt.lineBlocked()).toBe(false);
    expect(blockedBy(0, 100)).toBe(true);
    expect(blockedBy(15, 300)).toBe(true);
    expect(blockedBy(-15, 300)).toBe(true);
    expect(blockedBy(25, 300)).toBe(false);
    expect(blockedBy(90, 50)).toBe(false); // beside him
    expect(blockedBy(180, 50)).toBe(false); // behind him
    expect(blockedBy(0, 410)).toBe(false); // past 400 px
    expect(blockedBy(0, 100, { markedForRemoval: true })).toBe(false);
  });
});

describe('attack warning rings', () => {
  afterEach(() => vi.restoreAllMocks());

  it("a picked grunt's ring runs through the beat before its shot, not during it", () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // no chatter
    const { clock, rhythmFX, at, grunt, frame } = world();
    const warnedOn = new Set();
    const add = vi.spyOn(rhythmFX, 'addAttackTelegraph');
    for (let ms = 0; ms < 2000; ms += 10) {
      at(ms);
      add.mockClear();
      frame(150); // in range
      if (add.mock.calls.length) {
        warnedOn.add(clock.getCurrentBeat());
        expect(add.mock.calls[0][3]).toBeLessThanOrEqual(1);
        expect(add.mock.calls[0][4]).toBe(grunt); // its own ring, not a trail
      }
    }
    // Beats 1 and 3 (0 and 2 counted from 0) warn of the shots on 2 and 4
    expect([...warnedOn].sort()).toEqual([0, 2]);
  });

  it('a pick whose line is blocked at the shot holds, and shows a ? instead', () => {
    // A friend comes into his line just before each 2 and 4
    const blocker = (ms) => (ms % 1000 >= 400 ? { x: 80, y: 0 } : null);
    expect(questionMarks(() => 150, blocker)).toBe(2); // beats 2 and 4
  });

  it('fires though his 2 or 4 lands between his swarm’s update and his own in one frame', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // no chatter
    // When beat 2's window opens on this clock, to the ms
    const probe = world();
    let open = 0;
    while (open < 1000) {
      probe.at(open);
      if (probe.clock.canGruntShoot()) break;
      open++;
    }
    expect(open).toBeGreaterThan(0);
    expect(open).toBeLessThan(1000);
    const { at, clock, grunt, enemies, swarm, floatingText } = world();
    const hero = { x: 150, y: 0 };
    let shots = 0;
    // A frame: the swarm reads the clock at one ms, the grunt at another
    const step = (swarmMs, gruntMs) => {
      at(swarmMs);
      swarm.update(enemies, hero, clock);
      at(gruntMs);
      grunt.velocity = { x: 0, y: 0 };
      if (grunt.updateSpecificBehavior(hero.x, hero.y, 10)) shots++;
    };
    for (let ms = 0; ms < open - 1; ms += 10) step(ms, ms);
    step(open - 1, open);
    for (let ms = open + 9; ms < open + 100; ms += 10) step(ms, ms);
    expect(shots).toBe(1);
    expect(
      floatingText.addText.mock.calls.filter(([, , t]) => t === '?')
    ).toHaveLength(0);
  });

  it('a grunt that fires shows no ?', () => {
    expect(questionMarks(() => 150)).toBe(0);
  });

  it('a pick fires on its 2 or 4 even if the hero has run out of range since: range is judged at the pick', () => {
    // In range through beats 1 and 3, out of range as 2 and 4 land
    const heroX = (ms) => (ms % 1000 < 500 ? 150 : 900);
    expect(oneBar(heroX)).toMatchObject({ marks: 0, shots: 2 });
  });

  it('a warning whose fire window was missed shows no ? a bar later, and fires nothing', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { floatingText, at, frame } = world();
    const shots = [];
    for (let ms = 0; ms < 2000; ms += 10) {
      if (ms >= 490 && ms < 620) continue; // hitstop across beat 2's window
      at(ms);
      // In range through beat 1, out of range from beat 3 on
      const shot = frame(ms < 1000 ? 150 : 900);
      if (shot) shots.push(ms);
    }
    expect(floatingText.addText).not.toHaveBeenCalled();
    expect(shots).toEqual([]);
  });

  it('a grunt that was never picked shows no ring and no ?', () => {
    // Out of range through beat 1, in range only as beat 2 lands
    const heroX = (ms) => (ms % 1000 < 500 ? 900 : 150);
    expect(oneBar(heroX)).toMatchObject({ marks: 0, rings: 0 });
  });

  it('a grunt with no swarm never fires and is never warned', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { at, rhythmFX, grunt } = world();
    grunt.swarm = null;
    const add = vi.spyOn(rhythmFX, 'addAttackTelegraph');
    const shots = [];
    for (let ms = 0; ms < 2000; ms += 10) {
      at(ms);
      const shot = grunt.updateSpecificBehavior(150, 0, 10);
      if (shot) shots.push(ms);
    }
    expect(shots).toEqual([]);
    expect(add).not.toHaveBeenCalled();
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
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // no chatter
    const { at, grunt, enemies, clock } = world();
    const swarm = grunt.swarm;
    for (let ms = 0; ms < 500; ms += 10) {
      at(ms);
      swarm.update(enemies, { x: 150, y: 0 }, clock); // picked through beat 1
    }
    // A slow frame: its first update in beat 2 comes 80 ms after it lands.
    // Through update() itself, which must hand the shot on to the game
    at(580);
    swarm.update(enemies, { x: 150, y: 0 }, clock);
    expect(grunt.update(150, 0, 10)?.owner).toBe('enemy-grunt');
    expect(grunt.pose().flash).toBeGreaterThan(0.9);
  });

  it('sulks through the beat it held its fire on, and is over it by the next', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const { floatingText, at, grunt, enemies, clock } = world();
    const swarm = grunt.swarm;
    // Through update(), which keeps the beat the grunt is drawn at
    for (let ms = 0; ms <= 600; ms += 10) {
      at(ms);
      // a friend steps into his line as beat 2 comes
      enemies.length = 1;
      if (ms >= 400) enemies.push({ x: 80, y: 0, markedForRemoval: false });
      swarm.update(enemies, { x: 150, y: 0 }, clock);
      grunt.velocity = { x: 0, y: 0 };
      grunt.update(150, 0, 10);
    }
    expect(floatingText.addText).toHaveBeenCalled(); // the ? of beat 2
    expect(grunt.pose().droop).toBeGreaterThan(0.9);
    at(1010); // beat 3
    grunt.update(150, 0, 10);
    expect(grunt.pose().droop).toBe(0);
  });
});
