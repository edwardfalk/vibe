import { describe, it, expect, afterEach } from 'vitest';
import { Bassist, bassistAbout } from '../../js/entities/Bassist.js';
import { stalkWant } from '../../js/entities/Stabber.js';
import { SpawnSystem } from '../../js/systems/SpawnSystem.js';
import { CONFIG } from '../../js/config.js';
import { createMockP5 } from './helpers/enemyMocks.js';
import { beatWorld } from './helpers/beatWorld.js';

const B = CONFIG.BASSIST;
const DEFAULTS = { ...CONFIG.BASSIST };
const FRAME_MS = 16;

afterEach(() => {
  Object.assign(CONFIG.BASSIST, DEFAULTS);
});

// A spawned bassist at (x, y) in a beat world; step(ms) is one update at ms
// with the hero at `hero`
export function bassist({
  x = 0,
  y = 0,
  ms0 = 0,
  hero = { x: 300, y: 0 },
} = {}) {
  const w = beatWorld();
  w.at(ms0);
  const b = new Bassist(
    x,
    y,
    'bassist',
    { context: w.context },
    createMockP5(),
    w.audio
  );
  b.isSpawning = false;
  b.spawnTimer = b.spawnDuration;
  const step = (ms) => {
    w.at(ms);
    return b.update(hero.x, hero.y, FRAME_MS);
  };
  return { ...w, b, hero, step };
}

describe('the bassist arrives', () => {
  it('has four strings of HITS_PER_STRING hits each', () => {
    B.HITS_PER_STRING = 2;
    expect(bassist().b.health).toBe(8);
    expect(bassist().b.type).toBe('bassist');
  });

  it("stalks with the stabber's rule, on his own band and speeds", () => {
    const { b, step } = bassist({ hero: { x: 900, y: 0 } });
    for (let ms = 0; ms < 3000; ms += FRAME_MS) step(ms);
    // Far beyond his band: closing in at his own approach speed
    const want = stalkWant(B, b.distance, b.circle, 1, 0);
    expect(want.x).toBe(B.APPROACH_PX_S);
    expect(b.walk.x).toBeCloseTo(B.APPROACH_PX_S, 0);
    expect(b.x).toBeGreaterThan(0);
  });

  it('settles inside his band round a still hero', () => {
    const { b, step } = bassist({ hero: { x: 600, y: 300 } });
    for (let ms = 0; ms < 30000; ms += FRAME_MS) step(ms);
    expect(b.distance).toBeGreaterThan(B.STALK_MIN_PX - 20);
    expect(b.distance).toBeLessThan(B.STALK_MAX_PX + 20);
  });
});

describe('the swing follows him', () => {
  it('is wanted while a bassist is about, and not once he is gone', () => {
    const { b } = bassist();
    expect(bassistAbout([{ type: 'grunt' }])).toBe(false);
    expect(bassistAbout([{ type: 'grunt' }, b])).toBe(true);
    b.markedForRemoval = true;
    expect(bassistAbout([b])).toBe(false);
  });
});

describe('he joins at level 4', () => {
  const mix = (level) => new SpawnSystem().weightedTypesForLevel(level);

  it('is in the mix from level 4, and not before', () => {
    expect(mix(3)).not.toContain('bassist');
    expect(mix(4)).toContain('bassist');
    expect(mix(4)).not.toContain('tank');
    expect(mix(6)).toEqual(['grunt', 'stabber', 'rusher', 'tank', 'bassist']);
  });
});
