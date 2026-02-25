/**
 * GameLoop.js - Core game loop and coordination between all systems
 *
 * Musical combat system where all actions sync to beats:
 * - Player = Hi-hat (every beat)
 * - Grunts = Snare (beats 2 & 4)
 * - Tanks = Bass drum (beat 1)
 * - Stabbers = Off-beat accent (beat 3.5)
 */

import { initializeInputHandlers } from './core/InputHandlers.js';
import { updateBombs as updateBombSystem } from './systems/BombSystem.js';
import { updateEnemiesAndResolveResults } from './systems/gameplay/EnemyUpdatePipeline.js';
import { updateBullets } from './systems/gameplay/BulletUpdatePipeline.js';
import { drawGameplayWorld } from './systems/gameplay/RenderPipeline.js';
import { updatePerformanceDiagnostics } from './systems/gameplay/PerformanceDiagnostics.js';
import { EnemyDeathHandler } from './systems/combat/EnemyDeathHandler.js';
import { Bullet } from './entities/bullet.js';
import { VisualEffectsManager, FloatingTextManager } from './effects/index.js';
import { handleAreaDamageEvents } from './effects/AreaDamageHandler.js';
import { CONFIG } from './config.js';
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
let audio;
let gameContext;
let enemyDeathHandler;

// Global system references for easy access
window.player = null;
window.enemies = [];
window.playerBullets = playerBullets;
window.enemyBullets = enemyBullets;
window.activeBombs = activeBombs;
window.explosionManager = null;
window.audio = null;
window.speechManager = null;
window.performanceDiagnostics = null;

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

initializeInputHandlers();

function syncRuntimeContext(
  hitStopFramesOverride = null,
  targetContext = null
) {
  const ctx = targetContext ?? gameContext;
  if (!ctx) return;
  const hitStopFrames =
    hitStopFramesOverride ??
    gameContext?.get?.('hitStopFrames') ??
    window.hitStopFrames ??
    0;

  ctx.assign({
    player: window.player,
    enemies: window.enemies,
    playerBullets: window.playerBullets,
    enemyBullets: window.enemyBullets,
    activeBombs: window.activeBombs,
    audio: window.audio,
    gameState: window.gameState,
    cameraSystem: window.cameraSystem,
    collisionSystem: window.collisionSystem,
    spawnSystem: window.spawnSystem,
    explosionManager: window.explosionManager,
    floatingText: window.floatingText,
    beatClock: window.beatClock,
    rhythmFX: window.rhythmFX,
    visualEffectsManager: window.visualEffectsManager,
    hitStopFrames,
    testModeManager: window.testModeManager,
  });
}

function setup(p) {
  const state = runSetup(
    p,
    {
      enemies,
      playerBullets,
      enemyBullets,
      activeBombs,
    },
    (ctx) => syncRuntimeContext(window.hitStopFrames, ctx)
  );
  player = state.player;
  explosionManager = state.explosionManager;
  gameContext = state.gameContext;
  enemyDeathHandler = state.enemyDeathHandler;
  syncRuntimeContext(window.hitStopFrames);
}

function draw(p) {
  runDraw(p, updateGame, drawGame);
}

function updateGame(p) {
  syncRuntimeContext();

  // Hitstop: freeze game updates for a few frames on impactful kills
  const hitStopFrames =
    gameContext?.get?.('hitStopFrames') ?? window.hitStopFrames ?? 0;
  if (hitStopFrames > 0) {
    const next = hitStopFrames - 1;
    if (gameContext && typeof gameContext.set === 'function') {
      gameContext.set('hitStopFrames', next);
    }
    window.hitStopFrames = next;
    // Still update floating text during hitstop so they don't freeze
    if (window.floatingText) window.floatingText.update();

    // Apply chromatic aberration during hit-stop (decays as hitstop ends)
    if (window.visualEffectsManager && next > 0) {
      const hitStopProgress = next / 8; // Normalize to max expected frames
      const chromaIntensity = hitStopProgress * 0.6;
      window.visualEffectsManager.chromaticAberration = chromaIntensity;
    }

    return;
  }

  // Update BeatClock every frame for accurate rhythm timing
  if (window.beatClock && typeof window.beatClock.update === 'function') {
    window.beatClock.update();
  }

  // Update beat visualizer
  if (window.rhythmFX) {
    window.rhythmFX.update();
  }

  // Test mode - automated movement and shooting
  if (window.testModeManager && window.testModeManager.enabled) {
    window.testModeManager.update();
  }

  // Update player
  if (player) {
    player.update(p.deltaTime);
  }

  // Update camera for parallax effect
  if (window.cameraSystem) {
    if (typeof window.cameraSystem.update === 'function') {
      window.cameraSystem.update();
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
        window.audio.playPlayerShoot(player.x, player.y);
      }
    }
  }

  // Update bullets
  updateBullets({
    playerBullets,
    enemyBullets,
    bulletClass: Bullet,
  });

  // Immediately process bullet collisions to catch hits before enemies move
  if (window.collisionSystem) {
    window.collisionSystem.checkBulletCollisions();
  }

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
  });

  // Update enemies and resolve their emitted combat results
  updateEnemiesAndResolveResults({
    enemies,
    enemyBullets,
    player,
    deltaTimeMs: p.deltaTime,
    collisionSystem: window.collisionSystem,
    explosionManager: window.explosionManager,
    visualEffectsManager: window.visualEffectsManager,
    audio: window.audio,
    cameraSystem: window.cameraSystem,
    gameState: window.gameState,
  });

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

  updatePerformanceDiagnostics({
    frameCount: p.frameCount,
    config: CONFIG,
    collisionSystem: window.collisionSystem,
    bulletClass: Bullet,
    floatingText: window.floatingText,
    explosionManager: window.explosionManager,
  });
}

function drawGame(p) {
  drawGameplayWorld({
    p,
    enemies,
    player,
    playerBullets,
    enemyBullets,
    explosionManager,
    floatingText: window.floatingText,
    audio: window.audio,
    cameraSystem: window.cameraSystem,
    visualEffectsManager: window.visualEffectsManager,
  });
}

// --- p5.js instance mode initialization for ES module compatibility ---
// This ensures setup() and draw() are registered and the canvas is created.
new window.p5((p) => {
  p.setup = () => setup(p);
  p.draw = () => draw(p);
});

// --- Audio/Canvas Unlock Handler for Modern Browsers ---
function unlockAudioAndShowCanvas() {
  // Resume p5.js audio context if present
  if (typeof getAudioContext === 'function') {
    getAudioContext().resume();
  }
  // Resume your own audio context
  if (window.audio && typeof window.audio.ensureAudioContext === 'function') {
    window.audio.ensureAudioContext();
  }
  // Start the procedural beat track
  if (window.beatTrack && !window.beatTrack.isPlaying) {
    window.beatTrack.start();
  }
  // Try to show the canvas if hidden
  const canvas = document.querySelector('canvas');
  if (canvas && canvas.style.visibility === 'hidden') {
    canvas.style.visibility = 'visible';
    canvas.removeAttribute('data-hidden');
  }
  // Remove this handler after first use
  window.removeEventListener('pointerdown', unlockAudioAndShowCanvas);
  window.removeEventListener('keydown', unlockAudioAndShowCanvas);
}
window.addEventListener('pointerdown', unlockAudioAndShowCanvas);
window.addEventListener('keydown', unlockAudioAndShowCanvas);
