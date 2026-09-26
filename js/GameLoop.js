/**
 * GameLoop.js - Core game loop and coordination between all systems
 *
 * Musical combat: enemies act on the beat (BeatClock), over a steady kick:
 * - Player = hi-hat (held fire snaps to eighth notes)
 * - Grunts = snare (beats 2 & 4)
 * - Tanks = beat 1
 * - Stabbers = off-beat accent (3.5)
 * - Rushers = crash (beats 1 & 3)
 */

import { initializeInputHandlers } from './core/InputHandlers.js';
import { createTunePanel } from './dev/TunePanel.js';
import { updateBombs as updateBombSystem } from './systems/BombSystem.js';
import { updateEnemiesAndResolveResults } from './systems/gameplay/EnemyUpdatePipeline.js';
import { Bullet } from './entities/bullet.js';
import { handleAreaDamageEvents } from './effects/AreaDamageHandler.js';
import { runSetup } from './GameLoopSetup.js';
import { runDraw } from './GameLoopDraw.js';

// Core game objects
let player;
const enemies = [];
const playerBullets = [];
const enemyBullets = [];
const activeBombs = [];

// Systems
let explosionManager;
let gameContext;
let enemyDeathHandler;

// Global system references for easy access
window.player = null;
window.enemies = enemies;
window.playerBullets = playerBullets;
window.enemyBullets = enemyBullets;
window.activeBombs = activeBombs;
window.explosionManager = null;
window.audio = null;

// Input state, written by core/InputHandlers.js
window.playerIsShooting = false;
window.arrowUpPressed = false;
window.arrowDownPressed = false;
window.arrowLeftPressed = false;
window.arrowRightPressed = false;

initializeInputHandlers();

function setup(p) {
  const state = runSetup(p, {
    enemies,
    playerBullets,
    enemyBullets,
    activeBombs,
  });
  player = state.player;
  explosionManager = state.explosionManager;
  gameContext = state.gameContext;
  enemyDeathHandler = state.enemyDeathHandler;
  window.gameState.showTitle();
  if (new URLSearchParams(location.search).has('tune')) createTunePanel();
}

function draw(p) {
  runDraw(p, updateGame, drawGame);
}

function updateGame(p) {
  // Hitstop: freeze game updates for a few frames on impactful kills
  const hitStopFrames = gameContext?.get?.('hitStopFrames') ?? 0;
  if (hitStopFrames > 0) {
    const next = hitStopFrames - 1;
    gameContext.set('hitStopFrames', next);
    // Still update floating text during hitstop so they don't freeze
    if (window.floatingText) window.floatingText.update();

    // Apply chromatic aberration during hit-stop (decays as hitstop ends)
    if (window.visualEffectsManager && next > 0) {
      const hitStopProgress = (8 - next) / 8; // Intensity peaks at end of hitstop (impact moment)
      const chromaIntensity = hitStopProgress * 0.6;
      window.visualEffectsManager.chromaticAberration = chromaIntensity;
    }

    return;
  }

  // Cap frame time to prevent teleportation after lag spikes or tab switches
  const dt = Math.min(p.deltaTime, 50);

  // Update BeatClock every frame for accurate rhythm timing
  if (window.beatClock && typeof window.beatClock.update === 'function') {
    window.beatClock.update();
  }

  // Update beat visualizer
  if (window.rhythmFX) {
    window.rhythmFX.update(dt);
  }

  // Update player
  if (player) {
    player.update(dt);
  }

  // Update camera for parallax effect
  if (window.cameraSystem) {
    if (typeof window.cameraSystem.update === 'function') {
      window.cameraSystem.update(dt);
    } else {
      console.warn('⚠️ Camera update method not found');
    }
  }

  // Unified shooting logic
  if (window.playerIsShooting && player) {
    const bullet = player.shoot();
    if (bullet) {
      playerBullets.push(bullet);
      if (window.gameState) {
        window.gameState.addShotFired();
      }
      if (window.audio) {
        window.audio.playSound('playerShoot', player.x, player.y);
      }
    }
  }

  // Update bullets
  compactBullets(playerBullets);
  compactBullets(enemyBullets);

  // Update bombs (split into dedicated BombSystem module)
  updateBombSystem({
    activeBombs,
    enemies,
    player: window.player,
    explosionManager,
    audio: window.audio,
    cameraSystem: window.cameraSystem,
    gameState: window.gameState,
    collisionSystem: window.collisionSystem,
    enemyDeathHandler,
  });

  // Update enemies and resolve their emitted combat results
  updateEnemiesAndResolveResults({
    enemies,
    enemyBullets,
    player,
    deltaTimeMs: dt,
    collisionSystem: window.collisionSystem,
    explosionManager: window.explosionManager,
    visualEffectsManager: window.visualEffectsManager,
    audio: window.audio,
    cameraSystem: window.cameraSystem,
    gameState: window.gameState,
  });

  // Keep BeatTrack informed of enemy count for dynamic volume scaling
  if (window.beatTrack) {
    window.beatTrack.setEnemyCount(enemies.length);
  }

  // Check collisions using CollisionSystem
  if (window.collisionSystem) {
    window.collisionSystem.checkBulletCollisions();
    window.collisionSystem.checkContactCollisions();
  }

  // Update spawn system
  if (window.spawnSystem) {
    window.spawnSystem.update();
  }

  // Update explosion manager and handle damage events
  if (explosionManager) {
    const damageEvents = explosionManager.update();

    // Process area damage events from plasma clouds and radioactive debris
    if (damageEvents && damageEvents.length > 0) {
      handleAreaDamageEvents(damageEvents, {
        player: gameContext ? gameContext.get('player') : window.player,
        enemies: gameContext ? gameContext.get('enemies') : enemies,
        audio: gameContext ? gameContext.get('audio') : window.audio,
        gameState: gameContext
          ? gameContext.get('gameState')
          : window.gameState,
        cameraSystem: gameContext
          ? gameContext.get('cameraSystem')
          : window.cameraSystem,
        collisionSystem: gameContext
          ? gameContext.get('collisionSystem')
          : window.collisionSystem,
        explosionManager: gameContext
          ? gameContext.get('explosionManager')
          : window.explosionManager,
        enemyDeathHandler,
      });
    }
  }

  // Update audio system
  if (window.audio) {
    window.audio.update();
  }

  // Update floating text
  if (window.floatingText) {
    window.floatingText.update();
  }
}

// Single-pass compaction: O(n) instead of O(n²) from repeated splice
function compactBullets(arr) {
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    const bullet = arr[read];
    bullet.update();

    if (bullet.isOffScreen()) {
      Bullet.release(bullet);
    } else {
      arr[write++] = bullet;
    }
  }
  arr.length = write;
}

function drawGame(p) {
  const cameraSystem = window.cameraSystem;
  if (cameraSystem) {
    cameraSystem.applyTransform();
  }

  for (const enemy of enemies) {
    enemy.draw(p);
  }

  if (player) {
    player.draw(p);
  }

  for (const bullet of playerBullets) {
    bullet.draw(p);
  }

  for (const bullet of enemyBullets) {
    bullet.draw(p);
  }

  if (explosionManager) {
    explosionManager.draw(p);
  }

  if (window.floatingText) {
    window.floatingText.draw(p);
  }

  if (window.audio) {
    window.audio.drawTexts(p);
  }

  if (cameraSystem) {
    cameraSystem.removeTransform();
  }

  // Screen-space effects applied after camera transform is removed
  if (window.visualEffectsManager) {
    window.visualEffectsManager.applyScreenEffects(p);
  }
}

// --- p5.js instance mode initialization for ES module compatibility ---
// This ensures setup() and draw() are registered and the canvas is created.
new window.p5((p) => {
  p.setup = () => setup(p);
  p.draw = () => draw(p);
});

// Keys that don't count as "press any key": modifiers, plus F1-F24 (below)
const NON_START_KEYS = [
  'Shift',
  'Control',
  'Alt',
  'AltGraph',
  'Meta',
  'CapsLock',
  'Tab',
  'ContextMenu',
];

// --- Title screen: the first click or key press starts the run ---
// Browsers only allow audio after a user gesture, so this also unlocks audio.
function startFromTitle(event) {
  // Before setup finishes there is no title yet; keep listening.
  if (window.gameState?.gameState !== 'title') return;
  // Dev UI such as the ?tune panel doesn't start the game
  if (event.target.closest?.('[data-no-start]')) return;
  // Ignore modifiers and function keys (Alt+Tab, F11, Shift, Ctrl+zoom...)
  if (
    event.type === 'keydown' &&
    (event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      NON_START_KEYS.includes(event.key) ||
      /^F\d+$/.test(event.key))
  ) {
    return;
  }
  // The starting input only starts the game: M must not also mute, and
  // preventDefault stops a click's follow-up mousedown from firing a shot.
  event.stopImmediatePropagation();
  if (event.type === 'pointerdown') event.preventDefault();

  // Creates the AudioContext, which also starts the beat track
  if (window.audio && typeof window.audio.ensureAudioContext === 'function') {
    window.audio.ensureAudioContext();
  }
  document.getElementById('title')?.remove();
  window.gameState.restart();

  window.removeEventListener('pointerdown', startFromTitle, true);
  window.removeEventListener('keydown', startFromTitle, true);
}
// Capture phase, so it runs before (and can swallow) the game's own handlers.
window.addEventListener('pointerdown', startFromTitle, true);
window.addEventListener('keydown', startFromTitle, true);
