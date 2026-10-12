import { Bassist } from '../../../js/entities/Bassist.js';
import { createMockP5 } from './enemyMocks.js';
import { beatWorld } from './beatWorld.js';

export const FRAME_MS = 16;

// A spawned bassist at (x, y), made at ms0 in a beat world (a beat is
// 500 ms); step(ms) is one update at ms with the hero at `hero`, and
// run(from, to) steps a frame at a time. `values` adds to the context
export function bassistWorld({
  x = 0,
  y = 0,
  ms0 = 0,
  hero = { x: 300, y: 0 },
  values,
} = {}) {
  const w = beatWorld(values);
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
  w.values.enemies.push(b);
  const step = (ms) => {
    w.at(ms);
    return b.update(hero.x, hero.y, FRAME_MS);
  };
  const run = (from, to, every = FRAME_MS) => {
    const results = [];
    for (let ms = from; ms <= to; ms += every) {
      const r = step(ms);
      if (r) results.push({ ms, r });
    }
    return results;
  };
  // What he played: each playSound call's name and options
  const plays = () =>
    w.audio.playSound.mock.calls
      .filter(([name]) => name === 'bassPluck' || name === 'bassSlap')
      .map(([name, , , opts]) => ({ name, ...opts }));
  return { ...w, b, hero, step, run, plays };
}
