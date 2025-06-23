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
} from '@vibe/core';
import {
  CameraSystem,
  SpawnSystem,
  BackgroundRenderer,
  UIRenderer,
  CollisionSystem,
  TestMode,
  BulletSystem,
  BombSystem,
  InputSystem,
  SpatialHashGrid,
} from '@vibe/systems';
import { setupRemoteConsoleLogger } from '@vibe/tooling';
import ProfilerOverlay from '@vibe/fx/ProfilerOverlay.js';
import AdaptiveLODManager, { shouldRender as adaptiveShouldRender } from '@vibe/fx/AdaptiveLODManager.js';
import VFXDispatcher from '@vibe/fx/VFXDispatcher.js';
import { Grunt } from '@vibe/entities/Grunt.js';
import { Tank } from '@vibe/entities/Tank.js';
import { ENEMY_HIT } from '@vibe/entities';
import { EnemyEventBus } from '@vibe/entities';
import { Debris, ScorePopup } from '@vibe/fx/visualEffects';

// Core game objects
let player;
let enemies = [];
let playerBullets = [];
let enemyBullets = [];
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
        '1','2','3','4',
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
  console.log('[VIBE DEBUG] setup(p) called');
  p.createCanvas(800, 600);
  p.frameRate(60);

  // Initialize core systems (dependency injection style)
  if (!window.audio) {
    window.audio = new Audio();
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

  if (!window.spawnSystem) {
    window.spawnSystem = new SpawnSystem(p, window.audio);
    console.log('👾 Spawn system initialized');
  }

  if (!window.player) {
    restartGame(p); // Initial game setup
    console.log('🔄 Robust Restart: Re-initializing systems...');
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
    window.backgroundRenderer = new BackgroundRenderer(p);
    console.log('🌌 Background renderer initialized');
  }

  if (!window.uiRenderer) {
    window.uiRenderer = new UIRenderer(p);
    console.log('🖥️ UI renderer initialized');
  }

  if (!window.testMode) {
    window.testMode = new TestMode(p);
    console.log('🧪 Test mode manager initialized');
  }

  console.log('🎮 Game setup complete - all systems initialized');
}

function draw(p) {
  const p5 = p; // p5 instance
  const now = p.millis();
  const deltaTime = now - (window.lastFrameTime || now);
  window.lastFrameTime = now;

  const dt = deltaTime / 1000; // deltaTime in seconds

  // Handle game over state
  if (state.isGameOver) {
    window.uiRenderer.drawGameOver(p);
    return; // Stop the game loop
  }

  // Handle paused state
  if (state.isPaused) {
    window.uiRenderer.drawPauseMenu(p);
    return; // Skip game updates
  }

  // Update game state
  window.gameState.update(p, window.player, window.enemies.length, p.deltaTime);
  if (window.gameState.isGameOver()) {
    handleGameOver(p);
    return;
  }

  // Update core systems
  window.beatClock.update(p);
  window.testMode.update(p, window.player, window.enemies, dt);
  window.player.handleInput(p);
  window.player.update(p, window.enemies, p.deltaTime);

  // Update all enemies
  for (let i = window.enemies.length - 1; i >= 0; i--) {
    const enemy = window.enemies[i];
    enemy.update(window.player.x, window.player.y, p.deltaTime);
    if (enemy.health <= 0) {
      window.enemies.splice(i, 1);
    }
  }

  // Update bullets and handle collisions
  const { playerHit, enemyHit } = window.collisionSystem.checkCollisions(
    window.player,
    window.enemies,
    window.bullets,
    window.playerBullets
  );
  if (playerHit) {
    window.player.takeDamage(10);
    window.effectsManager.addHitEffect();
  }
  if (enemyHit) {
    window.effectsManager.addHitEffect();
  }

  // Spawn new enemies
  window.spawnSystem.update(p, window.player, window.enemies.length);

  // Camera, background, and drawing
  window.cameraSystem.update(p, window.player.x, window.player.y);
  p.background(0);
  window.backgroundRenderer.draw(p, window.cameraSystem);

  p.push();
  p.translate(window.cameraSystem.x, window.cameraSystem.y);

  // Draw game objects
  window.player.draw(p);
  for (const enemy of window.enemies) {
    enemy.draw(p);
  }
  for (const bullet of window.bullets) {
    bullet.draw(p);
  }
  for (const playerBullet of window.playerBullets) {
    playerBullet.draw(p);
  }

  // Draw visual effects
  window.visualEffectsManager.draw(p);

  p.pop();

  // Draw UI
  window.uiRenderer.draw(p, window.gameState, window.player);
  window.testMode.draw(p);

  if (CONFIG.GAME_SETTINGS.DEBUG_GAME_LOOP) {
    console.log(
      `[DRAW GAME] camera=(${window.cameraSystem.x.toFixed(2)},${window.cameraSystem.y.toFixed(2)}) enemies=${
        window.enemies.length
      }`
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

  window.player = new Player(p.width / 2, p.height / 2, p);
  window.enemies = [];
  window.bullets = [];
  window.playerBullets = [];

  // Reset systems
  if (window.gameState) window.gameState.reset();
  if (window.spawnSystem) window.spawnSystem.reset();
  if (window.visualEffectsManager) window.visualEffectsManager.reset();

  // Let other systems know the player has changed
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
