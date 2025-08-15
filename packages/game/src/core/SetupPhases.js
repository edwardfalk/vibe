// SetupPhases.js – Incremental extraction of initialization from GameLoop.js
import { GameState, Audio, BeatClock, MusicManager } from '@vibe/core';
import {
  CameraSystem,
  SpawnSystem,
  BackgroundRenderer,
  UIRenderer,
  CollisionSystem,
  TestMode,
} from '@vibe/systems';
import { ExplosionManager, EffectsManager } from '@vibe/fx';
import VisualEffectsManager from '@vibe/fx/visualEffects.js';

export function initializeSystems(p) {
  // Effects & explosions
  if (!window.explosionManager) {
    window.explosionManager = new ExplosionManager();
  }
  if (!window.effectsManager) {
    window.effectsManager = new EffectsManager();
  }
  if (!window.visualEffectsManager) {
    window.visualEffectsManager = new VisualEffectsManager(
      window.backgroundLayers
    );
    window.visualEffectsManager.init(p);
  }

  // Core state & camera
  if (!window.gameState) {
    window.gameState = new GameState();
  }
  if (!window.cameraSystem) {
    window.cameraSystem = new CameraSystem(p);
    if (window.player) {
      window.player.cameraSystem = window.cameraSystem; // Fix mouse aiming
    }
  }

  // Spawning & collisions
  if (!window.spawnSystem) {
    window.spawnSystem = new SpawnSystem();
  }
  if (!window.collisionSystem) {
    window.collisionSystem = new CollisionSystem();
  }

  // Audio
  if (!window.audio) {
    window.audio = new Audio(p, window.player);
  } else {
    window.audio.player = window.player;
  }

  // Beat clock + music
  if (!window.beatClock) {
    window.beatClock = new BeatClock(120);
  }
  if (!window.musicManager) {
    window.musicManager = new MusicManager(window.audio, window.beatClock);
  }

  // Renderers & UI
  if (!window.backgroundRenderer) {
    window.backgroundRenderer = new BackgroundRenderer(
      p,
      window.cameraSystem,
      window.player,
      window.gameState
    );
  }
  window.backgroundRenderer.createParallaxBackground(p);

  if (!window.uiRenderer) {
    window.uiRenderer = new UIRenderer(
      window.gameState,
      window.player,
      window.audio,
      window.cameraSystem,
      window.testModeManager
    );
  }

  // Test mode
  if (!window.testModeManager) {
    window.testModeManager = new TestMode(window.player);
  }

  // Finalize initial state
  if (window.gameState && typeof window.gameState.restart === 'function') {
    window.gameState.restart();
  }
}
