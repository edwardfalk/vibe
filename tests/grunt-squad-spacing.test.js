import { expect, test } from 'bun:test';
import { Grunt } from '../packages/entities/src/Grunt.js';

// Stub p5 instance with minimal functionality
const pStub = {
  color: () => ({ levels: [0, 0, 0] }),
  PI: Math.PI,
  TWO_PI: Math.PI * 2,
};

// Prepare global window object used by game entities
const setupGlobals = () => {
  globalThis.window = {
    enemies: [],
    beatClock: {
      isOnBeat: () => false,
      canGruntShoot: () => false,
    },
    audio: null,
  };
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Ensure squad members push away from each other
// when too close.
test('Grunt squad members maintain minimum spacing', () => {
  setupGlobals();

  const squadId = 'alpha';
  const g1 = new Grunt(0, 0, 'grunt', {}, pStub, null, squadId);
  const g2 = new Grunt(5, 0, 'grunt', {}, pStub, null, squadId);
  const g3 = new Grunt(10, 0, 'grunt', {}, pStub, null, squadId);

  window.enemies.push(g1, g2, g3);

  const frames = 240; // simulate ~4 seconds at 60fps
  for (let i = 0; i < frames; i++) {
    for (const g of [g1, g2, g3]) {
      g.updateSpecificBehavior(g.x, g.y);
      g.x += g.velocity.x;
      g.y += g.velocity.y;
    }
  }

  const minSpacing = 30;
  const epsilon = 0.1;
  expect(dist(g1, g2)).toBeGreaterThanOrEqual(minSpacing - epsilon);
  expect(dist(g1, g3)).toBeGreaterThanOrEqual(minSpacing - epsilon);
  expect(dist(g2, g3)).toBeGreaterThanOrEqual(minSpacing - epsilon);
});
