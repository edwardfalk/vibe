import { vi } from 'vitest';
import { Tank } from '../../../js/entities/Tank.js';
import { createMockP5 } from './enemyMocks.js';
import { beatWorld } from './beatWorld.js';

// A beat world (120 BPM: bar n's beat 1 at n·2000 ms) with a hero, and
// tanks that have finished spawning
export function tankWorld({ hero = { x: 300, y: 0 }, enemies = [] } = {}) {
  const player = {
    size: 32,
    hurt: vi.fn(() => false),
    knockBack: vi.fn(),
    ...hero,
  };
  const w = beatWorld({
    player,
    enemies,
    activeBombs: [],
    explosionManager: { addExplosion: vi.fn() },
  });
  const tank = (x = 0, y = 0) => {
    const t = new Tank(
      x,
      y,
      'tank',
      { context: w.context },
      createMockP5(),
      w.audio
    );
    t.isSpawning = false;
    enemies.push(t);
    return t;
  };
  // One frame of the game for one tank: the clock at ms, then its update
  const frame = (t, ms, dtMs = 16) => {
    w.at(ms);
    return t.update(player.x, player.y, dtMs);
  };
  return { ...w, player, tank, frame };
}
