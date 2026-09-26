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
import { GameContext } from './core/GameContext.js';
import VisualEffectsManager from './effects/VisualEffectsManager.js';
import { FloatingTextManager } from './effects/FloatingTextManager.js';
import { EnemyDeathHandler } from './systems/combat/EnemyDeathHandler.js';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const DEFAULT_BPM = 120;

/**
 * Run game setup once: create every system, put each on window (a set-once
 * handle the E2E tests and dev tools read), then hand them to the GameContext
 * the modules read. The run itself starts from the title screen.
 * @param {p5} p - p5 instance
 * @param {object} arrays - Shared arrays: enemies, playerBullets, enemyBullets, activeBombs
 * @returns {{ player, explosionManager, gameContext, enemyDeathHandler }}
 */
export function runSetup(p, arrays) {
  const { enemies, playerBullets, enemyBullets, activeBombs } = arrays;

  p.createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);

  const gameContext = new GameContext();

  window.cameraSystem = new CameraSystem(p, gameContext);
  window.gameState = new GameState();
  window.gameState.activeBombs = activeBombs;

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

  window.backgroundRenderer = new BackgroundRenderer(
    p,
    window.cameraSystem,
    window.player,
    window.gameState,
    gameContext
  );
  window.backgroundRenderer.createParallaxBackground(p);

  window.visualEffectsManager = new VisualEffectsManager();
  window.audio = new Audio(p, window.player, gameContext);
  window.spawnSystem = new SpawnSystem(gameContext);
  // Runs on Date.now() until Audio.initialize() moves it to the audio clock
  window.beatClock = new BeatClock(DEFAULT_BPM);
  window.rhythmFX = new RhythmFX(gameContext);
  window.collisionSystem = new CollisionSystem(gameContext);

  const enemyDeathHandler = new EnemyDeathHandler(gameContext);
  window.enemyDeathHandler = enemyDeathHandler;

  window.uiRenderer = new UIRenderer(
    window.gameState,
    window.player,
    window.audio,
    window.cameraSystem
  );

  window.beatTrack = new BeatTrack(gameContext);

  // Every system exists now; none of them is replaced later
  gameContext.assign({
    player,
    enemies,
    playerBullets,
    enemyBullets,
    activeBombs,
    audio: window.audio,
    gameState: window.gameState,
    cameraSystem: window.cameraSystem,
    collisionSystem: window.collisionSystem,
    spawnSystem: window.spawnSystem,
    explosionManager,
    floatingText: window.floatingText,
    beatClock: window.beatClock,
    rhythmFX: window.rhythmFX,
    visualEffectsManager: window.visualEffectsManager,
    hitStopFrames: 0,
  });

  return {
    player,
    explosionManager,
    gameContext,
    enemyDeathHandler,
  };
}
