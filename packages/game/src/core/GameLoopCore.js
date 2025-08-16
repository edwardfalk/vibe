// GameLoopCore.js - Extracted from original GameLoop for cleaner architecture
// Phase 1: thin wrapper that still relies on functions defined in ../GameLoop.js
// Subsequent phases will progressively move logic here until GameLoop.js becomes
// a tiny orchestrator.

// We deliberately import the *whole* original GameLoop to access existing
// setup/draw declarations without breaking runtime.
import { setup as legacySetup } from '../GameLoop.js';
import { setRandomSeed } from '@vibe/core';
import { initializeSystems } from './SetupPhases.js';
import { updateFrame, drawFrame } from './UpdateLoop.js';

/**
 * Start the game by creating a new p5 instance wired to the global setup/draw
 * functions already present in the legacy GameLoop module.
 * When we later migrate logic, we will replace these references with the
 * refactored methods defined directly in this file.
 */
export function startGame() {
  // Instance-mode p5 sketch wired to legacy exports (no window globals)
  new window.p5((p) => {
    // Deterministic seed for mathUtils & p5
    const searchParams = new URLSearchParams(window.location.search);
    const seedParam = searchParams.get('seed');
    const parsedSeed =
      seedParam === null || seedParam.trim() === ''
        ? NaN
        : parseInt(seedParam, 10);
    window.gameSeed = Number.isFinite(parsedSeed) ? parsedSeed : 1337;
    // Seed both our math utils and p5 for deterministic behavior
    setRandomSeed(window.gameSeed);
    p.randomSeed(window.gameSeed);
    p.noiseSeed(window.gameSeed);
    p.setup = () => {
      legacySetup.call(p, p);
      // Phase-extracted init after legacy setup creates player
      initializeSystems(p);
    };
    p.draw = () => {
      updateFrame(p);
      drawFrame(p);
    };
  });
}

// Phase 2 (planned): detach from legacy GameLoop by providing setup/draw here
// and importing only the systems/entities needed. Keep in sync with TODO_REFRACTOR.
