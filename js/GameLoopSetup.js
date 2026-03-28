/**
 * GameLoopSetup - Initialization of game systems and state.
 * Extracted from GameLoop.js for file-size split (~500 line guideline).
 */

import { Player } from './entities/player.js';
import { ExplosionManager } from './effects/explosions/ExplosionManager.js';
import { GameState } from './core/GameState.js';
import { CameraSystem } from './systems/CameraSystem.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { BackgroundRenderer } from './systems/BackgroundRenderer.js';
import { UIRenderer } from './systems/UIRenderer.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { TestMode } from './systems/TestMode.js';
import { Audio } from './Audio.js';
import { BeatClock } from './audio/BeatClock.js';
import { BeatTrack } from './audio/BeatTrack.js';
import { RhythmFX } from './RhythmFX.js';
import { GameContext, createWindowBackedContext } from './core/GameContext.js';
import { VisualEffectsManager, FloatingTextManager } from './effects/index.js';
import { EnemyDeathHandler } from './systems/combat/EnemyDeathHandler.js';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const DEFAULT_BPM = 120;

/**
 * Run game setup. Mutates window and returns initialized state refs.
 * @param {p5} p - p5 instance
 * @param {object} arrays - Shared arrays: enemies, playerBullets, enemyBullets, activeBombs
 * @param {Function} [syncContext] - (gameContext) => void, syncs window.* into context before spawn
 * @returns {{ player, explosionManager, gameContext, enemyDeathHandler }}
 */
export function runSetup(p, arrays, syncContext = null) {
  const { enemies, playerBullets, enemyBullets, activeBombs } = arrays;

  p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);

  const gameContext = createWindowBackedContext(new GameContext());
  window.gameContext = gameContext;

  if (!window.cameraSystem) {
    window.cameraSystem = new CameraSystem(p, gameContext);
  }
  if (!window.gameState) {
    window.gameState = new GameState();
  }
  window.gameState.activeBombs = activeBombs;

  const player = new Player(
    p,
    p.width / 2,
    p.height / 2,
    window.cameraSystem,
    gameContext
  );
  window.player = player;
  if (player) player.cameraSystem = window.cameraSystem;

  window.enemies = enemies;
  window.playerBullets = playerBullets;
  window.enemyBullets = enemyBullets;
  window.activeBombs = activeBombs;

  const explosionManager =
    window.explosionManager ?? new ExplosionManager(gameContext);
  window.explosionManager = explosionManager;

  window.floatingText =
    window.floatingText ?? new FloatingTextManager(gameContext);
  gameContext.set('hitStopFrames', 0);

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
  const backgroundLayers = window.backgroundRenderer.parallaxLayers ?? [];

  if (!window.visualEffectsManager) {
    window.visualEffectsManager = new VisualEffectsManager(
      backgroundLayers,
      gameContext
    );
  } else {
    window.visualEffectsManager.backgroundLayers = backgroundLayers;
    window.visualEffectsManager.context = gameContext;
  }
  console.log('🎮 Visual effects manager initialized');

  if (!window.audio) {
    window.audio = new Audio(p, window.player, gameContext);
  }
  console.log('🎵 Unified audio system initialized');

  console.log('📷 Camera system initialized');

  if (!window.spawnSystem) {
    window.spawnSystem = new SpawnSystem(gameContext);
  }
  console.log('👾 Spawn system initialized');

  if (!window.beatClock) {
    window.beatClock = new BeatClock(DEFAULT_BPM, window.audio?.audioContext ?? null);
    console.log('🎵 BeatClock initialized and assigned to window.beatClock');
  }

  // Monkey-patch audio.initialize so BeatClock syncs once AudioContext is available
  const originalInit = window.audio?.initialize?.bind(window.audio);
  if (originalInit && window.audio) {
    window.audio.initialize = function() {
      originalInit();
      if (this.audioContext && window.beatClock && !window.beatClock.audioContext) {
        window.beatClock.audioContext = this.audioContext;
        window.beatClock.startTime = window.beatClock._now();
        window.beatClock.update(true);
        console.log('🎵 BeatClock synced to AudioContext');
      }
    };
  }
  if (!window.rhythmFX) {
    window.rhythmFX = new RhythmFX(gameContext);
    console.log('🎵 RhythmFX initialized');
  }
  window.testModeManager = new TestMode(window.player, gameContext);
  console.log('🧪 Test mode manager initialized');

  if (!window.collisionSystem) {
    window.collisionSystem = new CollisionSystem(gameContext);
  }
  console.log('💥 Collision system initialized');

  // Sync context BEFORE restart so spawnEnemies() can resolve player/p5 instance
  if (typeof syncContext === 'function') {
    syncContext(gameContext);
  }
  window.gameState.restart();
  console.log('🎮 GameState system initialized');

  console.log('🌌 Background renderer initialized');

  const enemyDeathHandler =
    window.enemyDeathHandler ?? new EnemyDeathHandler(gameContext);
  window.enemyDeathHandler = enemyDeathHandler;

  window.uiRenderer = new UIRenderer(
    window.gameState,
    window.player,
    window.audio,
    window.cameraSystem,
    window.testModeManager
  );
  console.log('🖥️ UI renderer initialized');

  if (!window.beatTrack) {
    window.beatTrack = new BeatTrack(DEFAULT_BPM, gameContext);
  }

  if (window.spawnSystem) {
    window.spawnSystem.spawnEnemies(1);
  }

  console.log('🎮 Game setup complete - all systems initialized');

  return {
    player,
    explosionManager,
    gameContext,
    enemyDeathHandler,
  };
}
