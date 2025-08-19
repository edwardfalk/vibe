/**
 * GameLoop.js - Core game loop and coordination between all systems
 *
 * Musical combat system where all actions sync to beats:
 * - Player = Hi-hat (every beat)
 * - Grunts = Snare (beats 2 & 4)
 * - Tanks = Bass drum (beat 1)
 * - Stabbers = Off-beat accent (beat 3.5)
 */

import { Player, EnemyFactory, Bullet } from '@vibe/entities';
import { ExplosionManager, EffectsManager } from '@vibe/fx';
import VisualEffectsManager from '@vibe/fx/visualEffects.js';
import {
  GameState,
  Audio,
  BeatClock,
  MusicManager,
  CONFIG,
  sqrt,
  max,
  min,
  floor,
  ceil,
  round,
  random,
  atan2,
  cos,
  sin,
  setRandomSeed,
} from '@vibe/core';
import {
  CameraSystem,
  SpawnSystem,
  BackgroundRenderer,
  UIRenderer,
  CollisionSystem,
  BulletSystem,
  BombSystem,
  InputSystem,
} from '@vibe/systems';
// Remote console logging is dev-only; guard import for localhost
// Remote console logging removed – no ticket server in this codebase
import EffectsProfiler from '@vibe/fx/EffectsProfiler.js';
import ProfilerOverlay from '@vibe/fx/ProfilerOverlay.js';
import AdaptiveLODManager from '@vibe/fx/AdaptiveLODManager.js';
import { updateBullets, updateBombs } from './core/CombatOps.js';
import { buildRestartContext } from './core/RestartContext.js';

// Core game objects
let player;
let enemies = [];
let playerBullets = [];
let enemyBullets = [];
let activeBombs = [];

// Systems
let explosionManager;
let effectsManager;
let visualEffectsManager;
let audio;

// Sync local variables to window globals after restart
window.updateGameLoopLocals = function () {
  player = window.player;
  const gsLoc = window.gameState;
  if (gsLoc) {
    enemies = gsLoc.enemies;
    playerBullets = gsLoc.playerBullets;
    enemyBullets = gsLoc.enemyBullets;
    activeBombs = gsLoc.activeBombs;
  }
  explosionManager = window.explosionManager;
  effectsManager = window.effectsManager;
  visualEffectsManager = window.visualEffectsManager;
  audio = window.audio;
};

// Global system references for easy access
window.player = null;
// Tier-3 globals (enemies, bullets, bombs) deprecated – use window.gameState.* instead
window.explosionManager = null;
window.audio = null;
// Removed unused speechManager global (was legacy TTS helper)

// Keys system for testing
window.keys = {
  W: false,
  w: false,
  A: false,
  a: false,
  S: false,
  s: false,
  D: false,
  d: false,
};

// Add at the top, after global system references
window.DEBUG_DOTS = false; // toggle in console to trace lingering explosion dots
window.playerIsShooting = false;
window.arrowUpPressed = false;
window.arrowDownPressed = false;
window.arrowLeftPressed = false;
window.arrowRightPressed = false;

// Attach profiler overlay for global access
window.profilerOverlay = ProfilerOverlay;
// Expose EffectsProfiler for probes
window.EffectsProfiler = EffectsProfiler;

// Input event handler helpers
function onKeyDown(e) {
  switch (e.code) {
    case 'Space':
      window.playerIsShooting = true;
      e.preventDefault();
      break;
    case 'ArrowUp':
      window.arrowUpPressed = true;
      e.preventDefault();
      break;
    case 'ArrowDown':
      window.arrowDownPressed = true;
      e.preventDefault();
      break;
    case 'ArrowLeft':
      window.arrowLeftPressed = true;
      e.preventDefault();
      break;
    case 'ArrowRight':
      window.arrowRightPressed = true;
      e.preventDefault();
      break;
  }
}

function onKeyUp(e) {
  switch (e.code) {
    case 'Space':
      window.playerIsShooting = false;
      e.preventDefault();
      break;
    case 'ArrowUp':
      window.arrowUpPressed = false;
      e.preventDefault();
      break;
    case 'ArrowDown':
      window.arrowDownPressed = false;
      e.preventDefault();
      break;
    case 'ArrowLeft':
      window.arrowLeftPressed = false;
      e.preventDefault();
      break;
    case 'ArrowRight':
      window.arrowRightPressed = false;
      e.preventDefault();
      break;
  }
}

// Input listeners moved to InputSystem.initialize() via InputBootstrap.js

// UI single-action key routing moved to DevShortcuts.js

// Profiler overlay toggle moved to DevShortcuts.js

export function setup(p) {
  p = p || this;
  p.createCanvas(800, 600);
  // Ensure browser TTS is initialized ASAP; Chrome sometimes requires an early call
  try {
    if (window.audio && typeof window.audio.loadVoices === 'function') {
      window.audio.loadVoices();
    } else if (window.speechSynthesis) {
      // Trigger voice enumeration
      window.speechSynthesis.getVoices();
    }
  } catch (_) {}
  // Apply deterministic seed to p5 random as well
  if (typeof p.randomSeed === 'function') {
    p.randomSeed(window.gameSeed);
  }

  // Initialize player at world origin (0,0) – camera centers world to screen
  player = new Player(p, 0, 0, window.cameraSystem);
  window.player = player;
  // Inform all systems that player reference changed (event-bus pattern)
  window.dispatchEvent(
    new CustomEvent('playerChanged', { detail: window.player })
  );

  // Arrays live in gameState; no separate window globals.

  // Initialize systems
  explosionManager = new ExplosionManager();
  window.explosionManager = explosionManager;

  // Initialize effects systems
  effectsManager = new EffectsManager();
  window.effectsManager = effectsManager;

  if (!window.visualEffectsManager) {
    window.visualEffectsManager = new VisualEffectsManager(
      window.backgroundLayers
    );
    // Ensure visual effects system is fully initialized once p5 is ready
    window.visualEffectsManager.init(p);
  }
  console.log('✨ Visual effects enabled - full rendering active');

  // Initialize unified audio system
  if (!window.audio) {
    window.audio = new Audio(p, window.player);
  } else {
    window.audio.player = window.player;
  }
  console.log('🎵 Unified audio system initialized');

  // Initialize modular systems
  if (!window.gameState) {
    window.gameState = new GameState();
  }

  if (!window.cameraSystem) {
    window.cameraSystem = new CameraSystem(p);
    if (player) {
      player.cameraSystem = window.cameraSystem; // Fix mouse aiming
    }
  }
  console.log('📷 Camera system initialized');

  if (!window.spawnSystem) {
    window.spawnSystem = new SpawnSystem();
  }
  console.log('👾 Spawn system initialized');

  // Now restart the game state (this calls spawnEnemies which needs camera)
  if (
    window.gameState &&
    typeof window.gameState.setRestartContext === 'function'
  ) {
    window.gameState.setRestartContext(buildRestartContext());
  }
  window.gameState.restart();
  console.log('🎮 GameState system initialized');

  if (!window.backgroundRenderer) {
    window.backgroundRenderer = new BackgroundRenderer(
      p,
      window.cameraSystem,
      window.player,
      window.gameState
    );
  }
  window.backgroundRenderer.createParallaxBackground(p);
  console.log('🌌 Background renderer initialized');

  if (!window.collisionSystem) {
    window.collisionSystem = new CollisionSystem();
  }
  console.log('💥 Collision system initialized');

  if (!window.uiRenderer) {
    window.uiRenderer = new UIRenderer(
      window.gameState,
      window.player,
      window.audio,
      window.cameraSystem
    );
  }
  console.log('🖥️ UI renderer initialized');

  // Initialize BeatClock for rhythm-locked gameplay
  if (!window.beatClock) {
    window.beatClock = new BeatClock(
      window.audio ? window.audio.audioContext : null,
      120
    ); // 120 BPM default, adjust as needed
    console.log('🎵 BeatClock initialized and assigned to window.beatClock');
  }

  // Background music (kick/snare/hat) synced to BeatClock
  if (!window.musicManager) {
    window.musicManager = new MusicManager(window.audio, window.beatClock);
    console.log('🎶 Music manager initialised');
  }

  // Initial enemy spawn
  if (window.spawnSystem) {
    window.spawnSystem.spawnEnemies(1);
  }

  console.log('🎮 Game setup complete - all systems initialized');
}

export function draw(p) {
  p = p || this;
  window.draw = draw;
  // Begin profiler frame timing
  EffectsProfiler.startFrame();

  // Hard clear frame to prevent paint accumulation/trails
  if (!window.__skipLegacyClear) {
    p.background(0);
  }

  // Ensure global frameCount is updated for all modules and probes (p5 instance mode)
  window.frameCount = p.frameCount;

  // Log the current game state every frame - DISABLED to reduce console spam
  // if (window.DEBUG && window.gameState && window.gameState.gameState) {
  //     console.log('🎮 [STATE] gameState:', window.gameState.gameState);
  // }

  // Draw background using BackgroundRenderer
  if (window.backgroundRenderer) {
    window.backgroundRenderer.drawCosmicAuroraBackground(p);
    // Use a calmer baseline background to avoid excessive overlays
    window.backgroundRenderer.drawSubtleSpaceElements(p);
  }

  // Draw parallax background
  if (window.backgroundRenderer) {
    window.backgroundRenderer.drawParallaxBackground(p);

    if (window.gameState && window.gameState.gameState === 'playing') {
      window.backgroundRenderer.drawInteractiveBackgroundEffects(p);
    }
  }

  // Main game logic based on state
  if (window.gameState) {
    switch (window.gameState.gameState) {
      case 'playing':
        updateGame(p);
        drawGame(p);
        if (window.uiRenderer) {
          window.uiRenderer.updateUI(p);
        }
        break;

      case 'paused':
        drawGame(p); // Draw game in background
        break;

      case 'gameOver':
        break;
    }
  }

  // Draw UI overlay
  if (window.uiRenderer) {
    window.uiRenderer.drawUI(p);
  }

  // ------------------ Profiler overlay (after UI) ------------------
  EffectsProfiler.endFrame();
  if (window.profilerOverlay) {
    window.profilerOverlay.draw(p);
  }

  // Adaptive LOD adjustment
  AdaptiveLODManager.update();
}

// -----------------------------------------------------------------------------
// Legacy compatibility wrappers – full logic now lives in core/CoreUpdate.js &
// core/CoreDraw.js.  These wrappers exist only so external tools/tests that
// still import { updateGame, drawGame } do not crash during the transition.
// They will be removed in a subsequent cleanup once all references are gone.
// -----------------------------------------------------------------------------

import { coreUpdateGame } from './core/CoreUpdate.js';
import { coreDrawGame } from './core/CoreDraw.js';

export function updateGame(p) {
  if (!updateGame.__warned) {
    console.warn(
      '⚠️  legacy GameLoop.updateGame deprecated – redirected to coreUpdateGame'
    );
    updateGame.__warned = true;
  }
  coreUpdateGame(p);
}

export function drawGame(p) {
  if (!drawGame.__warned) {
    console.warn(
      '⚠️  legacy GameLoop.drawGame deprecated – redirected to coreDrawGame'
    );
    drawGame.__warned = true;
  }
  coreDrawGame(p);
}

// Area damage handling moved to core/EnemyOps.js

// Combat ops moved to core/CombatOps.js

// --- p5.js instance mode initialization for ES module compatibility ---
// This ensures setup() and draw() are registered and the canvas is created.
// --- Deterministic RNG Seed -----------------------------------------------
// Already set by GameLoopCore; guard to avoid double-initialization
if (typeof window.gameSeed === 'undefined') {
  const searchParams = new window.URLSearchParams(window.location.search);
  const _urlSeed = Number(searchParams.get('seed'));
  window.gameSeed = Number.isFinite(_urlSeed) ? _urlSeed : 1337;
  setRandomSeed(window.gameSeed);
}

// Audio/canvas unlock moved to bootstrap/AudioCanvasUnlock.js

// -----------------------------------------------------------------------------
// Activate browser-side remote logging as early as possible. This captures all
// console output (log/info/warn/error) and POSTs it to the Ticket API running
// on port 3001 where it is persisted to `.debug/` for later troubleshooting.
// -----------------------------------------------------------------------------

// Expose Player class as global for robust restart logic
window.Player = Player;

// Initialise input system once at module load
InputSystem.initialize();

// Bridge modular classes to legacy global namespace for backward compatibility (temporary during migration)
if (typeof window !== 'undefined') {
  window.ExplosionManager = ExplosionManager; // Needed by GameState.restart()
  window.EffectsManager = EffectsManager; // Needed by GameState.restart()
  window.VisualEffectsManager = VisualEffectsManager; // Needed by GameState.restart()
  // Game systems & entities referenced inside GameState.restart()
  window.Player = Player;
  window.SpawnSystem = SpawnSystem;
  window.CollisionSystem = CollisionSystem;
  window.BeatClock = BeatClock;
}

// Expose setup/draw globally only if not provided via p5 wrapper (migration guard)
if (typeof window !== 'undefined' && !window.setup && !window.draw) {
  window.setup = setup;
  window.draw = draw;
}
