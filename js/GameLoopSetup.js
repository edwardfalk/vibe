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

  if (!window.visualEffectsManager) {
    window.visualEffectsManager = new VisualEffectsManager();
  }

  if (!window.audio) {
    window.audio = new Audio(p, window.player, gameContext);
  }

  if (!window.spawnSystem) {
    window.spawnSystem = new SpawnSystem(gameContext);
  }

  if (!window.beatClock) {
    window.beatClock = new BeatClock(
      DEFAULT_BPM,
      window.audio?.audioContext ?? null
    );
  }

  // Monkey-patch audio.initialize so BeatClock syncs once AudioContext is available
  const originalInit = window.audio?.initialize?.bind(window.audio);
  if (originalInit && window.audio) {
    window.audio.initialize = function () {
      originalInit();
      if (
        this.audioContext &&
        window.beatClock &&
        !window.beatClock.audioContext
      ) {
        // Preserve beat position across Date.now → AudioContext epoch switch.
        // Capture both clocks as close together as possible to minimize drift.
        const audioNow = this.audioContext.currentTime * 1000;
        const dateNow = Date.now();
        const oldElapsed = dateNow - window.beatClock.startTime;
        window.beatClock.audioContext = this.audioContext;
        window.beatClock.startTime = audioNow - oldElapsed;
        window.beatClock.update(true);
      }
    };
  }
  if (!window.rhythmFX) {
    window.rhythmFX = new RhythmFX(gameContext);
  }
  if (!window.collisionSystem) {
    window.collisionSystem = new CollisionSystem(gameContext);
  }

  // Sync context BEFORE restart so spawnEnemies() can resolve player/p5 instance
  if (typeof syncContext === 'function') {
    syncContext(gameContext);
  }
  window.gameState.restart();

  const enemyDeathHandler =
    window.enemyDeathHandler ?? new EnemyDeathHandler(gameContext);
  window.enemyDeathHandler = enemyDeathHandler;

  window.uiRenderer = new UIRenderer(
    window.gameState,
    window.player,
    window.audio,
    window.cameraSystem
  );

  if (!window.beatTrack) {
    window.beatTrack = new BeatTrack(DEFAULT_BPM, gameContext);
  }

  if (window.audio && window.audio.startDrone) {
    window.audio.startDrone();
  }

  if (window.spawnSystem) {
    window.spawnSystem.spawnEnemies(1);
  }

  return {
    player,
    explosionManager,
    gameContext,
    enemyDeathHandler,
  };
}
