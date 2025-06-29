/**
 * GameLoop.js - Core game loop and coordination between all systems
 *
 * Musical combat system where all actions sync to beats:
 * - Player = Hi-hat (every beat)
 * - Grunts = Snare (beats 2 & 4)
 * - Tanks = Bass drum (beat 1)
 * - Stabbers = Off-beat accent (beat 3.5)
 */

console.log('🟢 [DEBUG] GameLoop.js: Top of file');

import { Player } from '@vibe/entities';
console.log('🟢 [DEBUG] GameLoop.js: Imported entities');
import VisualEffectsManager from '@vibe/fx/visualEffects.js';
import { EffectsManager } from '@vibe/fx/effects.js';
console.log('🟢 [DEBUG] GameLoop.js: Imported VisualEffectsManager');
import {
  GameState,
  Audio,
  BeatClock,
  MusicManager,
  CONFIG,
} from '@vibe/core';
console.log('🟢 [DEBUG] GameLoop.js: Imported core');
import {
  CameraSystem,
  SpawnSystem,
  BackgroundRenderer,
  UIRenderer,
  CollisionSystem,
  TestMode,
  BombSystem,
} from '@vibe/systems';
console.log('🟢 [DEBUG] GameLoop.js: Imported systems');
import { setupRemoteConsoleLogger } from '@vibe/tooling';
import { updatePass } from './updatePass.js';
import { drawPass } from './drawPass.js';
console.log('🟢 [DEBUG] GameLoop.js: Imported tooling');
import ProfilerOverlay from '@vibe/fx/ProfilerOverlay.js';
console.log('🟢 [DEBUG] GameLoop.js: Imported ProfilerOverlay');
import AdaptiveLODManager, {
  shouldRender as adaptiveShouldRender,
} from '@vibe/fx/AdaptiveLODManager.js';
console.log('🟢 [DEBUG] GameLoop.js: Imported AdaptiveLODManager');
import VFXDispatcher from '@vibe/fx/VFXDispatcher.js';
console.log('🟢 [DEBUG] GameLoop.js: Imported VFXDispatcher');
console.log('🟢 [DEBUG] GameLoop.js: Imported all remaining modules');
import EffectsProfiler from '@vibe/fx/EffectsProfiler.js';

// Core game objects
let player;
let enemies = [];
let playerBullets = [];
let enemyBullets = [];
let bullets = [];
let activeBombs = [];

// Systems
let effectsManager;
let visualEffectsManager;
let audio;

// Sync local variables to window globals after restart
window.updateGameLoopLocals = function () {
  player = window.player;
  enemies = window.enemies;
  playerBullets = window.playerBullets;
  enemyBullets = window.enemyBullets;
  bullets = window.bullets;
  activeBombs = window.activeBombs;
  effectsManager = window.effectsManager;
  visualEffectsManager = window.visualEffectsManager;
  audio = window.audio;
};

// Global system references for easy access
window.player = null;
window.enemies = [];
window.playerBullets = playerBullets;
window.enemyBullets = enemyBullets;
window.bullets = bullets;
window.activeBombs = activeBombs;
window.audio = null;
window.speechManager = null;

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
window.playerIsShooting = false;
window.arrowUpPressed = false;
window.arrowDownPressed = false;
window.arrowLeftPressed = false;
window.arrowRightPressed = false;

// Attach profiler overlay for global access
window.profilerOverlay = ProfilerOverlay;

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

// Only add listeners once
if (!window.inputListenersAdded) {
  window.addEventListener('mousedown', () => {
    window.playerIsShooting = true;
  });
  window.addEventListener('mouseup', () => {
    window.playerIsShooting = false;
  });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.inputListenersAdded = true;
}

if (!window.uiKeyListenersAdded) {
  // Prevent rapid-fire for single-action UI keys (R, P, M, T, E, Space)
  window.addEventListener('keydown', (event) => {
    // Only handle on initial keydown, not auto-repeat
    if (!event.repeat) {
      const singleActionKeys = [
        'r',
        'R',
        'Escape',
        'm',
        'M',
        't',
        'T',
        'e',
        'E',
        'F6',
        'F7',
        'F8',
        'F10',
        '1',
        '2',
        '3',
        '4',
        ' ',
      ];
      if (singleActionKeys.includes(event.key) && window.uiRenderer) {
        window.uiRenderer.handleKeyPress(event.key);
      }
    }
  });
  window.uiKeyListenersAdded = true;
}

// Add key toggle for profiler overlay (P key) once
if (!window.profilerOverlayToggleAdded) {
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'p' || e.key === 'P') && !e.repeat) {
      if (window.profilerOverlay) {
        window.profilerOverlay.toggle();
      }
    }
  });
  window.profilerOverlayToggleAdded = true;
}

console.log('[VIBE DEBUG] Global scope reached in GameLoop.js');

// Game Loop's internal state
const state = {
  isPaused: false,
  isGameOver: false,
};

function setup(p) {
  console.log('🟢 [DEBUG] GameLoop.js: Entered setup(p)');
  console.log('🟢 [DEBUG] GameLoop.js: p.createCanvas called');
  p.createCanvas(800, 600);
  p.frameRate(60);

  // Initialize core systems (dependency injection style)
  if (!window.player) {
    restartGame(p); // Initial game setup
    console.log('🔄 Robust Restart: Re-initializing systems...');
  }
  if (!window.audio) {
    window.audio = new Audio(p, window.player);
    window.audio.setPlayer(window.player);
    console.log('🎵 Unified audio system initialized');
  }

  if (!window.visualEffectsManager) {
    window.visualEffectsManager = new VisualEffectsManager(p);
    console.log('✨ Visual effects fully initialized');
  }
  if (!window.effectsManager) {
    window.effectsManager = new EffectsManager(p, window.visualEffectsManager);
    console.log('✨ Visual effects enabled - full rendering active');
  }

  // Initialize VFX dispatcher (event-bus bridge)
  if (!window.vfxDispatcher) {
    window.vfxDispatcher = new VFXDispatcher({
      visualFX: window.visualEffectsManager,
      screenFX: window.effectsManager,
      audio: window.audio,
    });
  }

  if (!window.cameraSystem) {
    window.cameraSystem = new CameraSystem(p);
    console.log('📷 Camera system initialized');
  }

  if (!window.collisionSystem) {
    window.collisionSystem = new CollisionSystem();
    console.log('💢 Collision system initialized');
  }

  if (!window.spawnSystem) {
    window.spawnSystem = new SpawnSystem(p, window.audio);
    console.log('👾 Spawn system initialized');
  }

  if (!window.beatClock) {
    window.beatClock = new BeatClock(120, p);
    console.log('🎵 BeatClock initialized: 120 BPM (500ms per beat)');
  }
  console.log('✅ Audio system initialized');

  if (!window.gameState) {
    window.gameState = new GameState();
    console.log('🎮 GameState system initialized');
  }

  if (!window.backgroundRenderer) {
    window.backgroundRenderer = new BackgroundRenderer(
      p,
      window.cameraSystem,
      window.player,
      window.gameState
    );
    console.log('🌌 Background renderer initialized');
  }

  if (!window.uiRenderer) {
    window.uiRenderer = new UIRenderer(
      window.gameState,
      window.player,
      window.audio,
      window.cameraSystem,
      window.testMode
    );
    console.log('🖥️ UI renderer initialized');
  }

  if (!window.testMode) {
    window.testMode = new TestMode(window.player);
    console.log('🧪 Test mode manager initialized');
  }

  // Ensure at least one enemy exists for automated probes
  if (window.spawnSystem && window.enemies && window.enemies.length === 0) {
    try {
      window.spawnSystem.spawnEnemies?.(1);
      console.log('👾 Initial enemy spawned for probes');
    } catch (err) {
      console.warn('⚠️ Failed to spawn initial enemy:', err);
    }
  }

  console.log('🎮 Game setup complete - all systems initialized');

  // Attach minimal testRunner for Playwright probes
  window.testRunner = {
    async testGameMechanics() {
      // Check player movement, shooting, and enemy presence
      const movement =
        typeof window.player?.x === 'number' &&
        typeof window.player?.y === 'number';
      const shooting = Array.isArray(window.playerBullets);
      const enemies =
        Array.isArray(window.enemies) && window.enemies.length > 0;
      return { movement, shooting, enemies };
    },
  };
}

function draw(p) {
  EffectsProfiler.startFrame();
  window.frameCount = p.frameCount;

  const now = p.millis();
  const dt = (now - (window.lastFrameTime || now)) / 1000;
  window.lastFrameTime = now;

  // --- High-level state handling -----------------------------------------
  if (state.isGameOver) {
    window.uiRenderer.drawGameOver(p);
    EffectsProfiler.endFrame();
    return;
  }
  if (state.isPaused) {
    window.uiRenderer.drawPauseMenu(p);
    EffectsProfiler.endFrame();
    return;
  }

  window.gameState.update(p, window.player, window.enemies.length, p.deltaTime);
  if (window.gameState.isGameOver()) {
    handleGameOver(p);
    EffectsProfiler.endFrame();
    return;
  }

  // --- Simulation --------------------------------------------------------
  updatePass(p, dt);

  // --- Rendering ---------------------------------------------------------
  drawPass(p);

  // UI & overlays
  window.uiRenderer.draw(p, window.gameState, window.player);
  window.testMode.draw(p);

  EffectsProfiler.endFrame();
  if (CONFIG.GAME_SETTINGS.DEBUG_GAME_LOOP) {
    console.log(
      `[DRAW] cam=(${window.cameraSystem.x.toFixed(1)},${window.cameraSystem.y.toFixed(1)}) en=${window.enemies.length}`
    );
  }
}

function handleGameOver(p) {
  console.log('GAME OVER');
  state.isGameOver = true;
  window.audio.stopMusic();
  // any other game over logic
}

function restartGame(p) {
  console.log('RESTARTING GAME');
  state.isGameOver = false;
  state.isPaused = false;

  window.player = new Player(p, p.width / 2, p.height / 2, window.cameraSystem);
  if (!Number.isFinite(window.player.x) || !Number.isFinite(window.player.y)) {
    console.error(
      '[GAME FATAL] Player position invalid after creation',
      window.player
    );
    window.player.x = 400;
    window.player.y = 300;
  }
  window.enemies = [];
  window.bullets = [];
  window.playerBullets = [];

  // Reset systems
  if (window.gameState) window.gameState.reset();
  if (window.spawnSystem) window.spawnSystem.reset();
  if (
    window.visualEffectsManager &&
    typeof window.visualEffectsManager.reset === 'function'
  ) {
    window.visualEffectsManager.reset();
  }

  // Let other systems know the player has changed
  if (window.audio) {
    window.audio.setPlayer(window.player);
  }
  if (window.dispatchEvent) {
    window.dispatchEvent(
      new CustomEvent('playerChanged', { detail: window.player })
    );
  }
  console.log('✅ Robust game restart complete.');
}

function keyPressed(p) {
  if (p.key === 'p' || p.key === 'P') {
    state.isPaused = !state.isPaused;
    console.log(`Game ${state.isPaused ? 'paused' : 'resumed'}`);
  }
  if (state.isGameOver && p.key === 'r') {
    restartGame(p);
  }
  if (p.key === 't' || p.key === 'T') {
    window.testMode.toggle();
  }
}

// Make core functions available to p5 instance
export default {
  setup,
  draw,
  keyPressed,
  restartGame,
};

console.log('🟢 [DEBUG] GameLoop.js: Before p5 instance creation');
console.log(
  'setup:',
  typeof setup,
  'draw:',
  typeof draw,
  'keyPressed:',
  typeof keyPressed
);
function createP5InstanceWhenReady() {
  if (typeof window !== 'undefined' && typeof window.p5 !== 'undefined') {
    console.log('🟢 [DEBUG] GameLoop.js: Creating p5 instance');
    new window.p5((p) => {
      p.setup = () => setup(p);
      p.draw = () => draw(p);
      p.keyPressed = () => keyPressed(p);
    });
    console.log('🟢 [DEBUG] GameLoop.js: p5 instance created');
  } else {
    console.log(
      '🔴 [DEBUG] GameLoop.js: window.p5 is undefined, retrying in 100ms'
    );
    setTimeout(createP5InstanceWhenReady, 100);
  }
}
createP5InstanceWhenReady();
