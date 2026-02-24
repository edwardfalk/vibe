/**
 * GameLoop.js - Core game loop and coordination between all systems
 *
 * Musical combat system where all actions sync to beats:
 * - Player = Hi-hat (every beat)
 * - Grunts = Snare (beats 2 & 4)
 * - Tanks = Bass drum (beat 1)
 * - Stabbers = Off-beat accent (beat 3.5)
 */

import { Player } from './player.js';
import { EnemyFactory } from './EnemyFactory.js';
import { ExplosionManager } from './explosions/ExplosionManager.js';
import { GameState } from './GameState.js';
import { CameraSystem } from './CameraSystem.js';
import { SpawnSystem } from './SpawnSystem.js';
import { BackgroundRenderer } from './BackgroundRenderer.js';
import { UIRenderer } from './UIRenderer.js';
import { CollisionSystem } from './CollisionSystem.js';
import { TestMode } from './TestMode.js';
import { Audio } from './Audio.js';
import { BeatClock } from './audio/BeatClock.js';
import { BeatTrack } from './audio/BeatTrack.js';
import { RhythmFX } from './RhythmFX.js';
import { GameContext, createWindowBackedContext } from './core/GameContext.js';
import { initializeInputHandlers } from './core/InputHandlers.js';
import { updateBombs as updateBombSystem } from './systems/BombSystem.js';
import { updateEnemiesAndResolveResults } from './systems/gameplay/EnemyUpdatePipeline.js';
import { updateBullets } from './systems/gameplay/BulletUpdatePipeline.js';
import { drawGameplayWorld } from './systems/gameplay/RenderPipeline.js';
import { updatePerformanceDiagnostics } from './systems/gameplay/PerformanceDiagnostics.js';
import { EnemyDeathHandler } from './systems/combat/EnemyDeathHandler.js';
import { Bullet } from './bullet.js';
import VisualEffectsManager from './visualEffects.js';
import { FloatingTextManager } from './effects.js';
import { handleAreaDamageEvents } from './effects/AreaDamageHandler.js';
import { CONFIG } from './config.js';
import { sqrt, max, min, floor, ceil, round, random } from './mathUtils.js';

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

function setup(p) {
  p.createCanvas(800, 600);
  if (!gameContext) {
    gameContext = createWindowBackedContext(new GameContext());
    window.gameContext = gameContext;
  }

  // Initialize player at center (cameraSystem set later; context populated before first draw)
  player = new Player(
    p,
    p.width / 2,
    p.height / 2,
    window.cameraSystem,
    gameContext
  );
  window.player = player;

  // Initialize global arrays
  window.enemies = enemies;
  window.playerBullets = playerBullets;
  window.enemyBullets = enemyBullets;
  window.activeBombs = activeBombs;

  // Initialize systems
  explosionManager = new ExplosionManager(gameContext);
  window.explosionManager = explosionManager;

  window.floatingText = new FloatingTextManager(gameContext);
  window.hitStopFrames = 0;
  gameContext.set('hitStopFrames', 0);

  // Use one visual effects manager path to avoid split state.
  if (!window.visualEffectsManager) {
    window.visualEffectsManager = new VisualEffectsManager(
      window.backgroundLayers,
      gameContext
    );
  }
  console.log('🎮 Visual effects manager initialized');

  // Initialize unified audio system
  if (!window.audio) {
    window.audio = new Audio(p, window.player, gameContext);
  }
  console.log('🎵 Unified audio system initialized');

  // Initialize modular systems
  if (!window.gameState) {
    window.gameState = new GameState();
  }
  window.gameState.activeBombs = activeBombs;

  if (!window.cameraSystem) {
    window.cameraSystem = new CameraSystem(p, gameContext);
    if (player) {
      player.cameraSystem = window.cameraSystem; // Fix mouse aiming
    }
  }
  console.log('📷 Camera system initialized');

  if (!window.spawnSystem) {
    window.spawnSystem = new SpawnSystem(gameContext);
  }
  console.log('👾 Spawn system initialized');

  // Initialize beatClock, rhythmFX, testModeManager before first assign so restart/spawnEnemies get defined refs
  if (!window.beatClock) {
    window.beatClock = new BeatClock(120);
    console.log('🎵 BeatClock initialized and assigned to window.beatClock');
  }
  if (!window.rhythmFX) {
    window.rhythmFX = new RhythmFX(gameContext);
    console.log('🎵 RhythmFX initialized');
  }
  if (!window.testModeManager) {
    window.testModeManager = new TestMode(window.player, gameContext);
  }
  console.log('🧪 Test mode manager initialized');

  // Sync context before restart (spawnEnemies reads from context)
  gameContext.assign({
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
    hitStopFrames: window.hitStopFrames,
    testModeManager: window.testModeManager,
  });

  // Now restart the game state (this calls spawnEnemies which needs camera)
  window.gameState.restart();
  console.log('🎮 GameState system initialized');

  if (!window.backgroundRenderer) {
    window.backgroundRenderer = new BackgroundRenderer(
      p,
      window.cameraSystem,
      window.player,
      window.gameState,
      gameContext
    );
  }
  window.backgroundRenderer.createParallaxBackground(p);
  console.log('🌌 Background renderer initialized');

  if (!window.collisionSystem) {
    window.collisionSystem = new CollisionSystem(gameContext);
  }
  console.log('💥 Collision system initialized');

  if (!enemyDeathHandler) {
    enemyDeathHandler = new EnemyDeathHandler(gameContext);
  }

  if (!window.uiRenderer) {
    window.uiRenderer = new UIRenderer(
      window.gameState,
      window.player,
      window.audio,
      window.cameraSystem,
      window.testModeManager
    );
  }
  console.log('🖥️ UI renderer initialized');

  // Initialize procedural beat track (starts on first user interaction)
  if (!window.beatTrack) {
    window.beatTrack = new BeatTrack(120, gameContext);
  }

  // Initial enemy spawn
  if (window.spawnSystem) {
    window.spawnSystem.spawnEnemies(1);
  }

  gameContext.assign({
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
    hitStopFrames: window.hitStopFrames,
    testModeManager: window.testModeManager,
  });

  console.log('🎮 Game setup complete - all systems initialized');
}

function draw(p) {
  // Ensure global frameCount is updated for all modules and probes (p5 instance mode)
  window.frameCount = p.frameCount;

  // Log the current game state every frame - DISABLED to reduce console spam
  // if (window.DEBUG && window.gameState && window.gameState.gameState) {
  //     console.log('🎮 [STATE] gameState:', window.gameState.gameState);
  // }

  // Draw background using BackgroundRenderer
  if (window.backgroundRenderer) {
    window.backgroundRenderer.drawCosmicAuroraBackground(p);
    window.backgroundRenderer.drawEnhancedSpaceElements(p);
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
        // Auto-restart in test mode
        if (window.testModeManager && window.testModeManager.enabled) {
          window.gameState.gameOverTimer++;
          if (window.gameState.gameOverTimer >= 60) {
            window.gameState.restart();
            console.log('🔄 Auto-restarting game in test mode');
          }
        }
        break;
    }
  }

  // Draw UI overlay
  if (window.uiRenderer) {
    window.uiRenderer.drawUI(p);
  }

  // Draw beat visualizer effects (telegraphs, beat bar)
  if (window.rhythmFX) {
    window.rhythmFX.draw(p, window.cameraSystem);
  }
}

function updateGame(p) {
  if (gameContext) {
    gameContext.assign({
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
      hitStopFrames: gameContext.get('hitStopFrames') ?? window.hitStopFrames,
      testModeManager: window.testModeManager,
    });
  }

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
