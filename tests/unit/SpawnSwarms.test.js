import { describe, it, expect, vi, afterEach } from 'vitest';
import { SpawnSystem } from '../../js/systems/SpawnSystem.js';
import {
  GruntSwarm,
  swarmSize,
  cloudRadius,
} from '../../js/systems/GruntSwarm.js';
import { CONFIG } from '../../js/config.js';
import { CameraSystem } from '../../js/systems/CameraSystem.js';
import { createMockP5 } from './helpers/enemyMocks.js';

vi.spyOn(console, 'log').mockImplementation(() => {});
const SWARM = { ...CONFIG.SWARM };
const PACING = structuredClone(CONFIG.PACING);
afterEach(() => {
  Object.assign(CONFIG.SWARM, SWARM);
  CONFIG.PACING = structuredClone(PACING);
  vi.restoreAllMocks();
});

const halfW = CONFIG.GAME_SETTINGS.WORLD_WIDTH / 2;
const halfH = CONFIG.GAME_SETTINGS.WORLD_HEIGHT / 2;

// A SpawnSystem on a world with a hero, a camera and a beat clock
function world({ level = 1, beats = 0, hero = { x: 0, y: 0 } } = {}) {
  const p = { ...createMockP5(), width: 800, height: 600 };
  const enemies = [];
  const clock = { beats };
  const gameState = {
    gameState: 'playing',
    level,
    getProgressToNextLevel: () => 0,
  };
  const cameraSystem = new CameraSystem(p);
  cameraSystem.x = hero.x;
  cameraSystem.y = hero.y;
  const context = {
    gameState,
    enemies,
    player: { ...hero, p },
    cameraSystem,
    beatClock: {
      beatInterval: 500,
      isOnBeat: () => false,
      getTotalBeats: () => clock.beats,
      getBeatPosition: () => clock.beats,
      getCurrentBeat: () => clock.beats % 4,
      canGruntShoot: () => false,
    },
  };
  const system = new SpawnSystem(context);
  system.getContextValue = (key) => context[key];
  return { system, enemies, clock, gameState, p };
}

const grunts = (enemies) => enemies.filter((e) => e.type === 'grunt');

// How far round the hero (at 0, 0) two spots are from each other, 0 to π
const apart = (a, b) => {
  const d = Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x);
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
};

describe('a run starts with its first swarms', () => {
  it('COUNT of them, each of its level’s size, every grunt carrying his swarm, inside the world', () => {
    for (const [level, count] of [
      [1, 2],
      [3, 2],
      [5, 3],
    ]) {
      CONFIG.SWARM.COUNT = count;
      const { system, enemies } = world({ level });
      system.update();
      expect(system.swarms).toHaveLength(count);
      expect(grunts(enemies)).toHaveLength(count * swarmSize(level));
      for (const swarm of system.swarms) {
        expect(swarm).toBeInstanceOf(GruntSwarm);
        expect(enemies.filter((g) => g.swarm === swarm)).toHaveLength(
          swarmSize(level)
        );
      }
      for (const g of enemies) {
        expect(Math.abs(g.x)).toBeLessThanOrEqual(halfW);
        expect(Math.abs(g.y)).toBeLessThanOrEqual(halfH);
      }
    }
  });

  it('each from the spot furthest round the hero from the swarms already there, of a few tries', () => {
    const { system } = world();
    // The first takes the first try; the second, of the next tries, the one
    // furthest round from the first (straight across), not the first given
    const spots = [
      { x: 500, y: 10 },
      { x: 480, y: -60 },
      { x: 0, y: 450 },
      { x: -500, y: 20 },
      { x: 300, y: 400 },
    ];
    let n = 0;
    vi.spyOn(system, 'findSpawnPosition').mockImplementation(() => ({
      ...spots[Math.min(n++, spots.length - 1)],
    }));
    system.update();
    const [a, b] = system.swarms;
    expect({ x: a.x, y: a.y }).toEqual(spots[0]);
    expect({ x: b.x, y: b.y }).toEqual(spots[3]);
  });

  it('two of them come from well apart round the hero', () => {
    for (let run = 0; run < 30; run++) {
      const { system } = world();
      system.update();
      const [a, b] = system.swarms;
      expect(apart(a, b)).toBeGreaterThan(Math.PI / 3);
    }
  });

  it('its grunts start on the far side of its centre from the view, or held at the world’s edge', () => {
    for (let run = 0; run < 50; run++) {
      const { system, enemies } = world();
      system.update();
      const edgeX = halfW - enemies[0].size / 2; // a grunt's half size inside
      const edgeY = halfH - enemies[0].size / 2;
      for (const g of enemies) {
        const { x, y } = g.swarm; // its centre as placed
        const away = Math.atan2(y, x); // the view is centred on the hero at 0, 0
        const atEdge =
          Math.abs(g.x) >= edgeX - 1e-9 || Math.abs(g.y) >= edgeY - 1e-9;
        if (atEdge) continue;
        const toward = Math.atan2(g.y - y, g.x - x);
        const off = Math.abs(
          Math.atan2(Math.sin(toward - away), Math.cos(toward - away))
        );
        expect(off).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
      }
    }
  });

  it('its grunts start within its cloud’s radius of its centre, spread out', () => {
    for (let run = 0; run < 20; run++) {
      const { system, enemies } = world({ level: 6 });
      vi.spyOn(system, 'findSpawnPosition').mockReturnValue({ x: 300, y: 0 });
      system.update();
      const r = cloudRadius(swarmSize(6));
      const out = enemies.map((g) => Math.hypot(g.x - 300, g.y));
      for (const d of out) expect(d).toBeLessThanOrEqual(r + 1e-9);
      expect(Math.max(...out)).toBeGreaterThan(r / 4);
    }
  });

  it('spawned at the world’s corner, its grunts are held inside the world', () => {
    const { system, enemies } = world();
    vi.spyOn(system, 'findSpawnPosition').mockReturnValue({
      x: halfW,
      y: halfH,
    });
    system.update();
    for (const g of enemies) {
      expect(Math.abs(g.x)).toBeLessThanOrEqual(halfW - g.size / 2);
      expect(Math.abs(g.y)).toBeLessThanOrEqual(halfH - g.size / 2);
    }
  });

  it('pushed past the world’s edge as they move, its grunts are held inside it', () => {
    const { system, enemies } = world();
    system.update();
    const g = grunts(enemies)[0];
    g.isSpawning = false;
    g.x = halfW - 1;
    g.y = 0;
    g.velocity = { x: 5, y: 0 }; // his swarm's push, outward
    g.update(0, 0, CONFIG.GAME_SETTINGS.FRAME_TIME_MS);
    expect(g.x).toBeLessThanOrEqual(halfW - g.size / 2);
  });

  it('is never added half-made: a grunt that can’t be made adds none', () => {
    const { system, enemies } = world();
    const make = system.createEnemy.bind(system);
    let n = 0;
    vi.spyOn(system, 'createEnemy').mockImplementation((...a) => {
      if (++n === swarmSize(1)) throw new Error('no grunt'); // the last
      return make(...a);
    });
    expect(() => system.update()).toThrow('no grunt');
    expect(enemies).toHaveLength(0);
  });
});

const kill = (enemies, swarm) => {
  for (const g of enemies) if (g.swarm === swarm) g.markedForRemoval = true;
};

describe('a cleared swarm’s place', () => {
  it('is taken BREAK_BEATS after all of it are dead, not before, while the other stays', () => {
    CONFIG.SWARM.BREAK_BEATS = 9.5;
    const { system, enemies, clock } = world();
    system.update();
    const [first, other] = system.swarms;
    clock.beats = 40;
    system.update();
    expect(system.swarms).toEqual([first, other]); // all alive: none new
    kill(enemies, first);
    clock.beats = 40.3;
    system.update();
    expect(system.swarms).toEqual([other]); // its break
    clock.beats = 40.3 + 9.4;
    system.update();
    expect(system.swarms).toEqual([other]);
    clock.beats = 40.3 + 9.5;
    system.update();
    expect(system.swarms).toHaveLength(2);
    const [kept, next] = system.swarms;
    expect(kept).toBe(other);
    expect(next).toBeInstanceOf(GruntSwarm);
    expect(next).not.toBe(first);
    expect(grunts(enemies).filter((g) => g.swarm === next)).toHaveLength(
      swarmSize(1)
    );
  });

  it('is taken from the spot furthest round the hero from the swarm still there', () => {
    const { system, enemies, clock } = world();
    system.update();
    const [first, other] = system.swarms;
    kill(enemies, first);
    clock.beats = 40;
    system.update();
    const spots = [
      { x: other.x, y: other.y + 5 }, // beside the one still there
      { x: -other.x, y: -other.y }, // straight across from it
    ];
    let n = 0;
    vi.spyOn(system, 'findSpawnPosition').mockImplementation(() => ({
      ...spots[Math.min(n++, spots.length - 1)],
    }));
    clock.beats = 40 + CONFIG.SWARM.BREAK_BEATS;
    system.update();
    const next = system.swarms[1];
    expect({ x: next.x, y: next.y }).toEqual(spots[1]);
  });

  it('two cleared together are both taken when their break ends', () => {
    const { system, enemies, clock } = world();
    system.update();
    for (const g of enemies) g.markedForRemoval = true;
    clock.beats = 40;
    system.update();
    expect(system.swarms).toEqual([]);
    clock.beats = 40 + CONFIG.SWARM.BREAK_BEATS;
    system.update();
    expect(system.swarms).toHaveLength(2);
  });

  it('takes a change of BREAK_BEATS on ?tune at once, in a break already begun', () => {
    const { system, enemies, clock } = world();
    system.update();
    const [first, other] = system.swarms;
    kill(enemies, first);
    clock.beats = 40;
    system.update(); // cleared: its break begins
    CONFIG.SWARM.BREAK_BEATS = 2.5;
    clock.beats = 42.4;
    system.update();
    expect(system.swarms).toEqual([other]);
    clock.beats = 42.5;
    system.update();
    expect(system.swarms).toHaveLength(2);
  });

  it('takes a change of COUNT on ?tune: raised, a swarm comes at once', () => {
    const { system, clock } = world();
    system.update();
    CONFIG.SWARM.COUNT = 3;
    clock.beats = 1;
    system.update();
    expect(system.swarms).toHaveLength(3);
  });

  it('takes a change of COUNT on ?tune: lowered, a cleared one isn’t replaced, and the last still gets its break', () => {
    const { system, enemies, clock } = world();
    system.update();
    const [first, other] = system.swarms;
    CONFIG.SWARM.COUNT = 1;
    kill(enemies, first);
    clock.beats = 40;
    system.update();
    clock.beats = 40 + CONFIG.SWARM.BREAK_BEATS + 1;
    system.update();
    expect(system.swarms).toEqual([other]); // one is COUNT: no place to fill
    kill(enemies, other);
    clock.beats = 80;
    system.update();
    expect(system.swarms).toEqual([]); // its own break, not the first's long past
    clock.beats = 80 + CONFIG.SWARM.BREAK_BEATS;
    system.update();
    expect(system.swarms).toHaveLength(1);
  });

  it('a restart (reset) drops the swarms still alive; the next run starts its own at once', () => {
    const { system, enemies, clock } = world();
    system.update();
    const old = [...system.swarms];
    system.reset();
    expect(system.swarms).toEqual([]);
    enemies.length = 0; // the restart clears the enemies too
    clock.beats = 0;
    system.update();
    expect(system.swarms).toHaveLength(CONFIG.SWARM.COUNT);
    for (const s of system.swarms) expect(old).not.toContain(s);
  });

  it('a restart (reset) drops the swarms and their breaks; the next run starts its own at once', () => {
    const { system, enemies, clock } = world();
    system.update();
    kill(enemies, system.swarms[0]);
    clock.beats = 40;
    system.update(); // cleared: its break begins
    system.reset();
    expect(system.swarms).toEqual([]);
    enemies.length = 0; // the restart clears the enemies too
    clock.beats = 0; // and the next run's clock starts over
    system.update();
    expect(system.swarms).toHaveLength(CONFIG.SWARM.COUNT);
    expect(grunts(enemies).every((g) => system.swarms.includes(g.swarm))).toBe(
      true
    );
    expect(grunts(enemies)).toHaveLength(CONFIG.SWARM.COUNT * swarmSize(1));
  });

  it('steers every swarm’s grunts before they move (updateSwarm)', () => {
    const { system, enemies } = world();
    system.update();
    for (const g of enemies) g.velocity = { x: 0, y: 0 };
    system.updateSwarm();
    for (const swarm of system.swarms) {
      expect(
        enemies.some(
          (g) => g.swarm === swarm && (g.velocity.x !== 0 || g.velocity.y !== 0)
        )
      ).toBe(true);
    }
  });
  it('makes its swarm’s sounds on the 2s and 4s, from where its grunts are (updateSwarm)', () => {
    const { system, enemies } = world();
    system.update();
    // Each swarm's grunts coming in from the right, its centre at (520, 0)
    for (const swarm of system.swarms) {
      const own = grunts(enemies).filter((g) => g.swarm === swarm);
      own.forEach((g, i) => {
        g.x = 520 + (i - (own.length - 1) / 2) * 10;
        g.y = 0;
      });
    }
    const audio = { playSound: vi.fn() };
    const get = system.getContextValue;
    const onBeatTwo = {
      ...get('beatClock'),
      isOnBeat: (beats) => beats.includes(2),
      getTotalBeats: () => 9,
      getCurrentBeat: () => 1,
    };
    system.getContextValue = (k) =>
      ({ audio, beatClock: onBeatTwo })[k] ?? get(k);
    vi.spyOn(Math, 'random').mockReturnValue(0.3); // a move call, no chatter
    system.updateSwarm();
    expect(audio.playSound).toHaveBeenCalledWith('gruntAdvance', 520, 0);
  });
});

describe('the trickle of other types', () => {
  it('has no type at level 1, today’s others without grunts after', () => {
    const { system } = world();
    expect(system.getEnemyTypeForLevel(1)).toBe(null);
    const seen = (level) => {
      const types = new Set();
      for (let i = 0; i < 400; i++)
        types.add(system.getEnemyTypeForLevel(level));
      return [...types].sort();
    };
    expect(seen(2)).toEqual(['stabber']);
    expect(seen(3)).toEqual(['rusher', 'stabber']);
    expect(seen(5)).toEqual(['rusher', 'stabber', 'tank']);
  });

  it('caps the others at today’s cap times today’s share of non-grunts', () => {
    const { system } = world();
    expect(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => system.getMaxOthersForLevel(l))
    ).toEqual([0, 1, 2, 2, 3, 4, 4, 5, 5]);
  });

  it('counts only the others against it: a full swarm never holds them back', () => {
    const { system, enemies, clock } = world({ level: 5 });
    system.update();
    expect(grunts(enemies)).toHaveLength(CONFIG.SWARM.COUNT * swarmSize(5));
    system.getContextValue('beatClock').isOnBeat = () => true;
    for (let wave = 0; wave < 4; wave++) {
      clock.beats += 100;
      system.update();
    }
    expect(enemies.filter((e) => e.type !== 'grunt')).toHaveLength(3);
  });
});

describe('a swarm’s grunts speak as one', () => {
  it('only each swarm’s speaker has a line to say; a grunt in no swarm speaks for himself', () => {
    const { system, enemies } = world();
    system.update();
    system.updateSwarm();
    const speakers = enemies.filter((g) => g.getAmbientSpeechConfig() !== null);
    expect(speakers).toEqual(system.swarms.map((s) => s.speaker));
    enemies[1].swarm = null;
    expect(enemies[1].getAmbientSpeechConfig()).not.toBe(null);
  });
});
