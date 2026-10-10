import { describe, it, expect, vi, afterEach } from 'vitest';
import { SpawnSystem } from '../../js/systems/SpawnSystem.js';
import { GruntSwarm, swarmSize } from '../../js/systems/GruntSwarm.js';
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

describe('a run starts with its first swarm', () => {
  it('of its level’s size, every grunt carrying the swarm, inside the world', () => {
    for (const level of [1, 3, 5]) {
      const { system, enemies } = world({ level });
      system.update();
      expect(system.swarm).toBeInstanceOf(GruntSwarm);
      expect(grunts(enemies)).toHaveLength(swarmSize(level));
      for (const g of enemies) {
        expect(g.swarm).toBe(system.swarm);
        expect(Math.abs(g.x)).toBeLessThanOrEqual(halfW);
        expect(Math.abs(g.y)).toBeLessThanOrEqual(halfH);
      }
      // the first swarm of a run has no gap before its first volley
      expect(system.swarm.quietUntil).toBe(-Infinity);
    }
  });

  it('its grunts start on the far side of its centre from the view, or held at the world’s edge', () => {
    for (let run = 0; run < 50; run++) {
      const { system, enemies } = world();
      system.update();
      const edgeX = halfW - enemies[0].size / 2; // a grunt's half size inside
      const edgeY = halfH - enemies[0].size / 2;
      const { x, y } = system.swarm; // its centre as placed
      const away = Math.atan2(y, x); // the view is centred on the hero at 0, 0
      for (const g of enemies) {
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

  it('is never added half-made: a grunt that can’t be made adds none', () => {
    const { system, enemies } = world();
    const make = system.createEnemy.bind(system);
    let n = 0;
    vi.spyOn(system, 'createEnemy').mockImplementation((...a) => {
      if (++n === 3) throw new Error('no grunt');
      return make(...a);
    });
    expect(() => system.update()).toThrow('no grunt');
    expect(enemies).toHaveLength(0);
  });
});

describe('the next swarm', () => {
  it('comes at once when all of the last are dead, its first volley no sooner than GAP_BEATS after', () => {
    const { system, enemies, clock } = world();
    system.update();
    const first = system.swarm;
    clock.beats = 40;
    system.update();
    expect(system.swarm).toBe(first); // still alive: no new swarm
    for (const g of enemies) g.markedForRemoval = true;
    system.update();
    expect(system.swarm).not.toBe(first);
    expect(system.swarm.quietUntil).toBe(40 + CONFIG.SWARM.GAP_BEATS);
    expect(
      grunts(enemies).filter((g) => g.swarm === system.swarm)
    ).toHaveLength(swarmSize(1));
    // a clear late in a beat counts from the next: never under GAP_BEATS
    for (const g of enemies) g.markedForRemoval = true;
    clock.beats = 50.9;
    system.update();
    expect(system.swarm.quietUntil).toBe(51 + CONFIG.SWARM.GAP_BEATS);
  });

  it('a restart (reset) drops the swarm; the next run starts its own', () => {
    const { system, enemies } = world();
    system.update();
    system.reset();
    expect(system.swarm).toBe(null);
    enemies.length = 0; // the restart clears the enemies too
    system.update();
    expect(system.swarm.quietUntil).toBe(-Infinity);
    expect(grunts(enemies).every((g) => g.swarm === system.swarm)).toBe(true);
    expect(grunts(enemies)).toHaveLength(swarmSize(1));
  });

  it('steers its grunts before they move (updateSwarm)', () => {
    const { system, enemies } = world();
    system.update();
    for (const g of enemies) g.velocity = { x: 0, y: 0 };
    system.updateSwarm();
    expect(enemies.some((g) => g.velocity.x !== 0 || g.velocity.y !== 0)).toBe(
      true
    );
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
    expect(grunts(enemies)).toHaveLength(12);
    system.getContextValue('beatClock').isOnBeat = () => true;
    for (let wave = 0; wave < 4; wave++) {
      clock.beats += 100;
      system.update();
    }
    expect(enemies.filter((e) => e.type !== 'grunt')).toHaveLength(3);
  });
});

describe('a swarm’s grunts speak as one', () => {
  it('only its speaker has a line to say; a grunt in no swarm speaks for himself', () => {
    const { system, enemies } = world();
    system.update();
    system.updateSwarm();
    const speakers = enemies.filter((g) => g.getAmbientSpeechConfig() !== null);
    expect(speakers).toEqual([system.swarm.speaker]);
    enemies[1].swarm = null;
    expect(enemies[1].getAmbientSpeechConfig()).not.toBe(null);
  });
});
