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

  const player = new Player(
    p,
    p.width / 2,
    p.height / 2,
    window.cameraSystem,
    gameContext
  );
  window.player = player;

  window.enemies = enemies;
  window.playerBullets = playerBullets;
  window.enemyBullets = enemyBullets;
  window.activeBombs = activeBombs;

  const explosionManager = new ExplosionManager(gameContext);
  window.explosionManager = explosionManager;

  window.floatingText = new FloatingTextManager(gameContext);
  window.hitStopFrames = 0;
  gameContext.set('hitStopFrames', 0);

  if (!window.visualEffectsManager) {
    window.visualEffectsManager = new VisualEffectsManager(
      window.backgroundLayers,
      gameContext
    );
  }
  console.log('🎮 Visual effects manager initialized');

  if (!window.audio) {
    window.audio = new Audio(p, window.player, gameContext);
  }
  console.log('🎵 Unified audio system initialized');

  if (!window.gameState) {
    window.gameState = new GameState();
  }
  window.gameState.activeBombs = activeBombs;

  if (!window.cameraSystem) {
    window.cameraSystem = new CameraSystem(p, gameContext);
    if (player) player.cameraSystem = window.cameraSystem;
  }
  console.log('📷 Camera system initialized');

  if (!window.spawnSystem) {
    window.spawnSystem = new SpawnSystem(gameContext);
  }
  console.log('👾 Spawn system initialized');

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
    console.log('🧪 Test mode manager initialized');
  }

  if (!window.collisionSystem) {
    window.collisionSystem = new CollisionSystem(gameContext);
  }
  console.log('💥 Collision system initialized');

  if (typeof syncContext === 'function') {
    syncContext(gameContext);
  }
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

  const enemyDeathHandler = new EnemyDeathHandler(gameContext);

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

  if (!window.beatTrack) {
    window.beatTrack = new BeatTrack(120, gameContext);
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
