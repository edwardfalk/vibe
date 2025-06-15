// bench_spawn_system.js - micro-benchmark for SpawnSystem.findSpawnPosition()
import { performance } from 'node:perf_hooks';

// Lightweight stubs for globals expected by SpawnSystem
// These let us isolate SpawnSystem performance without a full game environment.
global.window = {
  enemies: [],
  player: {
    x: 400,
    y: 300,
    p: { width: 800, height: 600 },
  },
  gameState: { level: 3, gameState: 'playing' },
};

// Benchmark helpers
const ITERATIONS = 1_000_000;

function getDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function getDistanceSq(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

function bench(fn) {
  const start = performance.now();
  let acc = 0;
  for (let i = 0; i < ITERATIONS; i++) {
    acc += fn(i, i + 1, i + 2, i + 3);
  }
  return { duration: performance.now() - start, acc };
}

const sqrtRes = bench(getDistance);
const sqRes = bench(getDistanceSq);

console.log(
  `\nDistance vs DistanceSq (${ITERATIONS.toLocaleString()} iterations)`
);
console.log(`sqrt version : ${sqrtRes.duration.toFixed(2)} ms`);
console.log(`squared ver. : ${sqRes.duration.toFixed(2)} ms`);
console.log(
  `Speedup      : ${(sqrtRes.duration / sqRes.duration).toFixed(2)}×`
);
