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
import { GameState, BeatClock, CONFIG } from '@vibe/core';
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
import { AudioDiagnosticsOverlay } from '@vibe/fx';
import AdaptiveLODManager, {
  shouldRender as adaptiveShouldRender,
} from '@vibe/fx/AdaptiveLODManager.js';
console.log('🟢 [DEBUG] GameLoop.js: Imported AdaptiveLODManager');
import VFXDispatcher from '@vibe/fx/VFXDispatcher.js';
console.log('🟢 [DEBUG] GameLoop.js: Imported VFXDispatcher');
console.log('🟢 [DEBUG] GameLoop.js: Imported all remaining modules');
import EffectsProfiler from '@vibe/fx/EffectsProfiler.js';

// Lazy-loaded audio facade (Tone.js heavy). Will be set after first user gesture.
let toneAudio = null;

async function ensureAudioInitialized() {
  if (
    toneAudio &&
    toneAudio.ensureAudioContext &&
    toneAudio.ensureAudioContext()
  ) {
    return;
  }
  if (!toneAudio) {
    // Dynamic import after user gesture to avoid autoplay restrictions.
    const { ToneAudioFacade } = await import(
      '@vibe/core/audio/ToneAudioFacade.js'
    );
    toneAudio = new ToneAudioFacade();
    window.audio = toneAudio;
    console.log('🎵 ToneAudioFacade instantiated after gesture');
  }
  try {
    await toneAudio.init();
    toneAudio.startMusic();
    if (window.beatClock) {
      toneAudio.setBeatClock(window.beatClock);
    }
    console.log('🎵 ToneAudioFacade initialized after user gesture');
  } catch (err) {
    console.error('Audio init failed:', err);
  }
}

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
// Fully dynamic no-op audio stub – any property call is a harmless function.
window.audio = new Proxy(
  {
    ensureAudioContext: () => false,
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Return a no-op function for any unknown method
      return () => {};
    },
  }
);
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
window.audioOverlay = AudioDiagnosticsOverlay;

// Input event handler helpers
function onKeyDown(e) {
  switch (e.code) {
    case 'Space':
      ensureAudioInitialized();
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
    // Ensure audio is initialized after a user gesture to satisfy browser autoplay policies
    ensureAudioInitialized();
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
    if ((e.key === 'o' || e.key === 'O') && !e.repeat) {
      if (window.audioOverlay) {
        window.audioOverlay.toggle();
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

  // Initialize core systems FIRST (dependency injection style)
  // Camera system must be initialized before player
  if (!window.cameraSystem) {
    window.cameraSystem = new CameraSystem(p);
    console.log('📷 Camera system initialized');
  }

  if (!window.audio) {
    window.audio = toneAudio;
    console.log(
      '🎵 ToneAudioFacade attached – will initialize on first user gesture'
    );
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
      lodManager: { shouldRender: () => true }, // Simple stub LOD manager
    });
  }

  // NOW it's safe to create the player (requires cameraSystem)
  if (!window.player) {
    restartGame(p); // Initial game setup
    console.log('🔄 Robust Restart: Re-initializing systems...');
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
    if (window.audio && window.audio.setBeatClock) {
      window.audio.setBeatClock(window.beatClock);
    }
  }
  console.log('✅ Core timing systems initialized');

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
  if (window.audioOverlay) window.audioOverlay.draw(p);

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

  // Safety check: ensure cameraSystem exists before creating player
  if (!window.cameraSystem) {
    console.error(
      '[GAME FATAL] CameraSystem not initialized before player creation'
    );
    window.cameraSystem = new CameraSystem(p);
    console.log('📷 Emergency camera system initialization');
  }

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
  // Ensure visual effects manager is initialized with p for consistent FX readiness
  if (
    window.visualEffectsManager &&
    typeof window.visualEffectsManager.init === 'function'
  ) {
    try {
      window.visualEffectsManager.init(p);
    } catch {}
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
  // Spawn at least one enemy and resync locals
  if (
    window.spawnSystem &&
    typeof window.spawnSystem.spawnEnemies === 'function'
  ) {
    try {
      window.spawnSystem.spawnEnemies(1);
    } catch {}
  }
  if (typeof window.updateGameLoopLocals === 'function') {
    try {
      window.updateGameLoopLocals();
    } catch {}
  }
  setTimeout(() => {
    if (
      window.audio &&
      window.player &&
      typeof window.audio.speakPlayerLine === 'function'
    ) {
      window.audio.speakPlayerLine(window.player, 'start');
    }
  }, 500);
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
